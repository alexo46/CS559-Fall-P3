import * as THREE from "three";

import { Car } from "./Car.js";
import { AIDriver } from "./AIDriver.js";
import { SkyEnvironment } from "./environment/Sky.js";
import { WorldPhysics } from "../physics/WorldPhysics.js";
import { RapierDebugRenderer } from "../physics/RapierDebugRenderer.js";
import { createRaceTrack } from "../assets/models/RaceTrack/RaceTrack.js";
import { Speedometer } from "../ui/Speedometer.js";
import { RacingHUD } from "../ui/RacingHUD.js";
import { ResultsScreen } from "../ui/ResultsScreen.js";

export class World {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.physics = new WorldPhysics();

        // this.rapierDebugger = new RapierDebugRenderer(
        //     this.scene,
        //     this.physics.world
        // );

        const axisHelper = new THREE.AxesHelper(60);
        this.scene.add(axisHelper);

        this.sky = new SkyEnvironment(
            this.scene,
            this.renderer,
            this.sunLight,
            {}
        );

        this.minFov = this.camera.fov || 70;
        this.maxFov = this.minFov + 15;
        this.fovSpeedRange = { min: 0, max: 140 };

        // Race state
        this.raceStartTime = null;
        this.currentLapStartTime = null;
        this.lapTimes = [];
        this.bestLapTime = null;
        this.currentLap = 1;
        this.totalLaps = 3;
        this.finishLineZ = 0;
        this.lastPlayerZ = 0;
        this.lastAiZ = 0;

        this.racePhase = "countdown"; // "countdown", "racing", "finished"
        this.countdownStartTime = 0;
        this.countdownDuration = 3; // seconds (3,2,1 then GO)

        this.trackWaypoints = null;
        this.trackLights = [];

        this.difficulty = "medium";

        // Waypoint-based race progress
        this.waypointLoop = null;
        this.totalWaypoints = 0;
        this.finishWaypointIndex = 0;
        this.playerWaypointIndex = 0;
        this.aiWaypointIndex = 0;
        this.playerLapCount = 0;
        this.aiLapCount = 0;

        // Precomputed path distances between waypoints
        this.segmentLengths = [];
        this.loopLength = 0;

        // Waypoint debug visualization
        this.aiDebug = null;
        this.showWaypoints = true;
        this.waypointToggleEl = null;

        this.resultsScreen = null;

        this.setupWaypointDebugIndicator();
    }

    async init(useDetailedModel = false, difficulty = "medium", totalLaps = 3) {
        this.difficulty = difficulty;
        if (typeof totalLaps === "number" && totalLaps > 0) {
            this.totalLaps = totalLaps;
        }
        this.setupLights();
        this.setupGround();
        await this.setupRaceTrack();
        this.setupCars(useDetailedModel);
    }

    setupWaypointDebugIndicator() {
        if (typeof document === "undefined") return;

        // Add basic styles for the indicator once
        if (!document.getElementById("waypoint-toggle-style")) {
            const style = document.createElement("style");
            style.id = "waypoint-toggle-style";
            style.textContent = `
                #waypoint-toggle-indicator {
                    position: fixed;
                    bottom: 16px;
                    left: 20px;
                    padding: 4px 10px;
                    border-radius: 4px;
                    background: rgba(0, 0, 0, 0.6);
                    color: #ffffff;
                    font-size: 11px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    pointer-events: none;
                    z-index: 150;
                }
            `;
            document.head.appendChild(style);
        }

        this.waypointToggleEl = document.getElementById(
            "waypoint-toggle-indicator"
        );
        if (!this.waypointToggleEl) {
            this.waypointToggleEl = document.createElement("div");
            this.waypointToggleEl.id = "waypoint-toggle-indicator";
            document.body.appendChild(this.waypointToggleEl);
        }

        this.updateWaypointToggleIndicator();

        window.addEventListener("keydown", (e) => {
            if (e.code === "KeyV") {
                this.showWaypoints = !this.showWaypoints;
                if (this.aiDebug && this.aiDebug.group) {
                    this.aiDebug.group.visible = this.showWaypoints;
                }
                this.updateWaypointToggleIndicator();
            }
        });
    }

    updateWaypointToggleIndicator() {
        if (!this.waypointToggleEl) return;
        const state = this.showWaypoints ? "ON" : "OFF";
        this.waypointToggleEl.textContent = `V: Waypoints ${state}`;
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0xb1e1ff, 0x1d1d1d, 0.5);
        hemi.position.set(0, 40, 0);
        this.scene.add(hemi);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 5.0);
        this.sunLight.castShadow = true;

        this.sunLight.position.set(80, 100, 40);

        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 200;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;

        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        const fillLight = new THREE.DirectionalLight(0xffe8d0, 1.2);
        fillLight.position.set(-60, 60, -50);
        this.scene.add(fillLight);

        this.setupTrackLights();
    }

    setupTrackLights() {
        const lampColor = 0xfff2c5;
        const positions = [
            new THREE.Vector3(40, 15, 20),
            new THREE.Vector3(-45, 15, -10),
            new THREE.Vector3(0, 15, -50),
            new THREE.Vector3(60, 15, -90),
            new THREE.Vector3(-70, 15, 50),
        ];

        positions.forEach((pos, idx) => {
            const spot = new THREE.SpotLight(
                lampColor,
                2.2,
                140,
                Math.PI / 4,
                0.35
            );
            spot.position.copy(pos);
            spot.castShadow = true;
            spot.shadow.mapSize.width = 1024;
            spot.shadow.mapSize.height = 1024;
            spot.shadow.camera.near = 5;
            spot.shadow.camera.far = 200;

            const target = new THREE.Object3D();
            target.position.set(pos.x, 0, pos.z);
            this.scene.add(target);

            spot.target = target;
            this.scene.add(spot);
            this.trackLights.push({ light: spot, target });
        });
    }

    setupGround() {
        const loader = new THREE.TextureLoader();

        const colorMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_COLOR.jpg",
                import.meta.url
            ).href
        );
        const normalMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_NORM.jpg",
                import.meta.url
            ).href
        );
        const roughnessMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_ROUGH.jpg",
                import.meta.url
            ).href
        );
        const aoMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_OCC.jpg",
                import.meta.url
            ).href
        );

        [colorMap, normalMap, roughnessMap, aoMap].forEach((t) => {
            if (!t) return;

            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(40, 40);
        });

        const mat = new THREE.MeshStandardMaterial({
            map: colorMap,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            aoMap: aoMap,
        });

        const geo = new THREE.PlaneGeometry(1000, 1000);
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    async setupRaceTrack() {
        const raceTrack = createRaceTrack({
            world: this.physics.world,
            extraObjects: [
                { name: "waypoints", file: "demo_track/waypoints.glb" },
                // { name: "grandstand", file: "grandstand.glb" },
                // { name: "lamp_post", file: "lamp_post.glb" },
            ],
            onObjectLoaded: ({ def, object, trackGroup, RAPIER }) => {
                // e.g. add physics colliders here if you want
                // or tweak materials / shadow settings
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if (child.material && child.material.map) {
                            child.material.map.anisotropy =
                                this.renderer.capabilities.getMaxAnisotropy();
                        }
                    }
                });
            },
        });

        this.scene.add(raceTrack);

        // Set scale BEFORE waiting for load, so colliders pick it up
        await raceTrack.userData.loadPromise;

        this.raceTrack = raceTrack;
        this.trackWaypoints =
            this.extractWaypointsFromTrack(raceTrack) ||
            this.buildDefaultWaypoints();
    }

    setupCars(useDetailedModel = false) {
        this.playerCar = new Car(this.physics, this.scene, useDetailedModel, {
            enableKeyboard: true,
        });
        this.playerCar.chassisBody.setTranslation({ x: -3, y: 5, z: 0 }, true);

        this.camera.position.set(0, 6, 14);
        this.camera.lookAt(this.playerCar.group.position);

        const waypointLoop =
            this.trackWaypoints || this.buildDefaultWaypoints();

        this.waypointLoop = waypointLoop;
        this.totalWaypoints = waypointLoop.length || 0;
        this.playerLapCount = 0;
        this.aiLapCount = 0;

        this.precomputeWaypointDistances();

        const difficultySettings = {
            easy: {
                targetSpeedMph: 60,
                lookAheadDistance: 22,
                avoidanceDistance: 14,
                avoidanceStrength: 0.7,
            },
            medium: {
                targetSpeedMph: 75,
                lookAheadDistance: 26,
                avoidanceDistance: 12,
                avoidanceStrength: 0.5,
            },
            hard: {
                targetSpeedMph: 95,
                lookAheadDistance: 30,
                avoidanceDistance: 10,
                avoidanceStrength: 0.3,
            },
        };

        const aiCfg =
            difficultySettings[this.difficulty] || difficultySettings.medium;

        this.aiDriver = waypointLoop.length
            ? new AIDriver({
                  waypoints: waypointLoop,
                  waypointAdvanceDistance: 10,
                  lookAheadDistance: aiCfg.lookAheadDistance,
                  targetSpeedMph: aiCfg.targetSpeedMph,
                  playerCar: this.playerCar,
                  avoidanceDistance: aiCfg.avoidanceDistance,
                  avoidanceStrength: aiCfg.avoidanceStrength,
                  physicsWorld: this.physics.world,
                  wallDetectionDistance: 8,
              })
            : null;

        this.aiCar = new Car(this.physics, this.scene, useDetailedModel, {
            enableKeyboard: false,
        });
        this.aiCar.chassisBody.setTranslation({ x: 8, y: 5, z: -5 }, true);

        const aiAxes = new THREE.AxesHelper(3);
        aiAxes.position.y = 1;
        this.aiCar.group.add(aiAxes);

        if (this.aiDriver) {
            const startForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
                this.aiCar.group.quaternion
            );
            this.aiDriver.initializeWaypointIndex(
                this.aiCar.group.position.clone(),
                startForward
            );
        }

        this.aiCar.setControlProvider((dt) =>
            this.aiDriver ? this.aiDriver.update(this.aiCar, dt) : null
        );

        this.vehicles = [this.playerCar, this.aiCar];
        this.car = this.playerCar; // preserve existing references

        this.speedometer = new Speedometer();
        this.speedometer.visible = true;

        this.racingHUD = new RacingHUD();
        this.racingHUD.visible = true;
        this.racingHUD.updateLap(1, this.totalLaps);
        this.racingHUD.updatePosition(1, 2);

        // Initialize race countdown
        this.racePhase = "countdown";
        this.countdownStartTime = performance.now() / 1000;
        this.raceStartTime = null;
        this.currentLapStartTime = null;
        this.racingHUD.updateRaceTime(0);
        this.racingHUD.updateCurrentLapTime(0);
        this.racingHUD.updateCountdown("3");
        this.racingHUD.setCountdownVisible(true);

        // Initialize waypoint indices based on starting positions
        if (this.totalWaypoints > 0 && this.waypointLoop) {
            const playerRes = this.getNearestWaypointIndex(
                this.playerCar.group.position
            );
            const aiRes = this.getNearestWaypointIndex(
                this.aiCar.group.position
            );

            this.playerWaypointIndex = playerRes.index;
            this.aiWaypointIndex = aiRes.index;

            // Use the player's nearest waypoint as the official finish line
            this.finishWaypointIndex = playerRes.index;

            // Now that we know which waypoint is the finish, add the marker
            this.addFinishLineMarker();
        }

        // Debug visuals for waypoints and targets
        this.aiDebug = this.addWaypointDebug(waypointLoop);
    }

    /**
     * Visualize AI waypoints and current targets
     */
    addWaypointDebug(waypoints) {
        if (!waypoints?.length) return null;
        const group = new THREE.Group();
        group.name = "WaypointDebug";
        group.visible = this.showWaypoints;

        const dots = waypoints.map((wp, idx) => {
            const geo = new THREE.SphereGeometry(0.5, 8, 8);
            const mat = new THREE.MeshBasicMaterial({
                color: idx % 2 === 0 ? 0x00ff88 : 0x0099ff,
                transparent: true,
                opacity: 0.4,
                depthWrite: false,
            });
            const m = new THREE.Mesh(geo, mat);
            m.position.copy(wp);
            group.add(m);
            return m;
        });

        // line strip of waypoints
        const lineGeo = new THREE.BufferGeometry().setFromPoints(waypoints);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35,
        });
        const line = new THREE.LineLoop(lineGeo, lineMat);
        group.add(line);

        // current and lookAhead markers
        const current = new THREE.Mesh(
            new THREE.SphereGeometry(1.0, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        const lookAhead = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        group.add(current);
        group.add(lookAhead);

        this.scene.add(group);
        return { group, dots, line, current, lookAhead };
    }

    /**
     * Extract waypoints from Blender-exported empties named like "Waypoint001_axis"
     * Falls back to null if none are found.
     */
    extractWaypointsFromTrack(trackGroup) {
        const waypoints = [];
        const matches = [];

        const wpRegex = /Waypoint(\d+)_axis/i;

        trackGroup.traverse((child) => {
            console.log(child.name);
            if (!child.name) return;
            const match = child.name.match(wpRegex);
            if (match) {
                matches.push({ child, idx: parseInt(match[1], 10) });
            }
        });

        if (!matches.length) {
            console.warn(
                "No Blender waypoints found on track; using default ellipse"
            );
            return null;
        }

        matches
            .sort((a, b) => a.idx - b.idx)
            .forEach(({ child }) => {
                const p = new THREE.Vector3();
                child.getWorldPosition(p);
                p.y = 0.5; // keep near road plane
                waypoints.push(p);
            });

        console.log(`Loaded ${waypoints.length} Blender waypoints`);
        return waypoints;
    }

    buildDefaultWaypoints() {
        const points = [];
        const radiusX = 70;
        const radiusZ = 120;
        const segments = 24;
        const y = 0.5;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(
                new THREE.Vector3(
                    Math.cos(angle) * radiusX,
                    y,
                    Math.sin(angle) * radiusZ
                )
            );
        }

        return points;
    }

    precomputeWaypointDistances() {
        const waypoints = this.waypointLoop;
        if (!waypoints || waypoints.length < 2) {
            this.segmentLengths = [];
            this.loopLength = 0;
            return;
        }

        const n = waypoints.length;
        this.segmentLengths = new Array(n);
        let total = 0;

        for (let i = 0; i < n; i++) {
            const a = waypoints[i];
            const b = waypoints[(i + 1) % n];
            const len = a.distanceTo(b);
            this.segmentLengths[i] = len;
            total += len;
        }

        this.loopLength = total;
    }

    addFinishLineMarker() {
        const waypoints = this.waypointLoop || this.trackWaypoints;
        if (!waypoints || waypoints.length < 2) return;

        const total = waypoints.length;
        const idx = Math.min(
            Math.max(this.finishWaypointIndex || 0, 0),
            total - 1
        );

        const start = waypoints[idx].clone();
        const next = waypoints[(idx + 1) % total].clone();

        const dir = next.clone().sub(start);
        dir.y = 0;
        if (dir.lengthSq() === 0) return;
        dir.normalize();

        const widthAcross = 12; // across the track
        const lengthAlong = 2.2; // along the track
        const height = 0.08;

        const geometry = new THREE.BoxGeometry(
            widthAcross,
            height,
            lengthAlong
        );
        const material = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            metalness: 0.0,
            roughness: 0.25,
            emissive: new THREE.Color(0xffff00),
            emissiveIntensity: 1.0,
        });

        const finishLine = new THREE.Mesh(geometry, material);

        // Position it on the road plane at the finish waypoint
        finishLine.position.copy(start);
        finishLine.position.y = start.y + height * 0.5 + 0.05;

        // Align the box so its local Z axis points along the track direction
        const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            dir
        );
        finishLine.quaternion.copy(quat);

        finishLine.castShadow = false;
        finishLine.receiveShadow = true;

        this.scene.add(finishLine);
        this.finishLineMesh = finishLine;
    }

    getNearestWaypointIndex(position) {
        const waypoints = this.waypointLoop;
        if (!waypoints || waypoints.length === 0) {
            return { index: 0, distanceSquared: Infinity };
        }

        let bestIndex = 0;
        let bestDistSq = Infinity;

        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            const dSq = position.distanceToSquared(wp);
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestIndex = i;
            }
        }

        return { index: bestIndex, distanceSquared: bestDistSq };
    }

    computeCarProgress(car, nearestIndex, lapCount) {
        const waypoints = this.waypointLoop;
        const totalWp = this.totalWaypoints;
        if (!waypoints || !totalWp) {
            return { lap: lapCount, relIndex: 0, segmentT: 0 };
        }

        // Determine which segment the car is on: (nearest-1 -> nearest) or (nearest -> nearest+1)
        // We project the car onto the segment (nearest -> nearest+1).
        // If the projection t >= 0, we are "after" the nearest waypoint (segment: nearest -> nearest+1).
        // If the projection t < 0, we are "before" the nearest waypoint (segment: nearest-1 -> nearest).

        const prevIdx = (nearestIndex - 1 + totalWp) % totalWp;
        const nextIdx = (nearestIndex + 1) % totalWp;

        const pNearest = waypoints[nearestIndex];
        const pNext = waypoints[nextIdx];
        const pPrev = waypoints[prevIdx];

        // Project onto nearest->next
        const vNext = pNext.clone().sub(pNearest);
        const vCar = car.group.position.clone().sub(pNearest);
        const lenSqNext = vNext.lengthSq();
        
        // Default to t=0 if segment length is zero (shouldn't happen)
        let tNext = 0;
        if (lenSqNext > 1e-6) {
            tNext = vNext.dot(vCar) / lenSqNext;
        }

        let currentSegmentStart = nearestIndex;
        let currentSegmentEnd = nextIdx;
        let t = tNext;

        if (tNext < 0) {
            // We are before the nearest waypoint, so we are on [prev, nearest]
            currentSegmentStart = prevIdx;
            currentSegmentEnd = nearestIndex;

            // Recompute t for this segment
            const vPrev = pNearest.clone().sub(pPrev);
            const vCarPrev = car.group.position.clone().sub(pPrev);
            const lenSqPrev = vPrev.lengthSq();
            if (lenSqPrev > 1e-6) {
                t = vPrev.dot(vCarPrev) / lenSqPrev;
            } else {
                t = 1; // Fallback
            }
        }

        // Clamp t to [0, 1] for stability
        t = THREE.MathUtils.clamp(t, 0, 1);

        // The "next waypoint" is the end of the current segment
        const targetWaypointIndex = currentSegmentEnd;

        const finishIdx = this.finishWaypointIndex || 0;
        
        // Calculate relative index from finish line
        let relIndex = (targetWaypointIndex - finishIdx + totalWp) % totalWp;
        
        // --- RANKING LOGIC FIX ---
        // Handle the topology discontinuity at the finish line.
        
        const now = performance.now() / 1000;
        const timeSinceStart = (this.raceStartTime !== null) ? (now - this.raceStartTime) : 0;
        const isRaceStart = (lapCount === 0) && (this.racePhase === 'countdown' || timeSinceStart < 10);

        if (isRaceStart) {
            // At the start, if we are behind the finish line (high relative index),
            // we treat it as negative distance so it ranks BELOW the finish line.
            // e.g. Target 0 (Finish) -> relIndex 0.
            // e.g. Target 99 (Behind) -> relIndex 99 -> becomes -1.
            if (relIndex > totalWp * 0.5) {
                relIndex -= totalWp;
            }
        } else {
            // During the race, if we are targeting the finish line (relIndex 0),
            // it means we are completing a lap, so it should rank HIGHER than index 99.
            if (relIndex === 0) {
                relIndex = totalWp;
            }
        }

        return { lap: lapCount, relIndex, segmentT: t };
    }

    isPlayerAhead(playerProgress, aiProgress) {
        // 1) Higher lap wins
        if (playerProgress.lap !== aiProgress.lap) {
            return playerProgress.lap > aiProgress.lap;
        }

        // 2) On same lap, higher relative waypoint index wins
        if (playerProgress.relIndex !== aiProgress.relIndex) {
            return playerProgress.relIndex > aiProgress.relIndex;
        }

        // 3) If sharing waypoint, further along the segment wins
        return playerProgress.segmentT >= aiProgress.segmentT;
    }

    update(dt, controls) {
        const speed = this.car.getCarMph();
        const rpm = this.car.getRPM();
        this.speedometer.updateSpeed(speed);
        this.speedometer.updateRPM(rpm);
        this.speedometer.draw();

        this.updateCameraFov(speed);

        const now = performance.now() / 1000;

        // Handle pre-race countdown: freeze cars and timers until GO
        if (this.racePhase === "countdown") {
            const elapsed = now - this.countdownStartTime;

            if (elapsed < this.countdownDuration) {
                const remaining = this.countdownDuration - elapsed;
                const number = Math.ceil(remaining);

                if (number > 0) {
                    this.racingHUD.updateCountdown(String(number));
                } else {
                    this.racingHUD.updateCountdown("GO!");
                }

                // Keep physics running lightly (for environment), but do not
                // advance car logic so they stay put until the race starts.
                this.physics.step(dt);
                return;
            }

            // Countdown finished, start the race now
            this.racePhase = "racing";
            this.raceStartTime = now;
            this.currentLapStartTime = now;
            this.racingHUD.setCountdownVisible(false);
        }

        this.physics.step(dt);
        this.playerCar?.update(dt);
        this.aiCar?.update(dt);

        // Update race telemetry
        const currentTime = now;
        const raceTime =
            this.raceStartTime != null ? currentTime - this.raceStartTime : 0;
        const currentLapTime =
            this.currentLapStartTime != null
                ? currentTime - this.currentLapStartTime
                : 0;

        this.racingHUD.updateRaceTime(raceTime);
        this.racingHUD.updateCurrentLapTime(currentLapTime);

        // Waypoint-based lap completion and race position
        if (this.waypointLoop && this.totalWaypoints > 0) {
            const totalWp = this.totalWaypoints;
            const finishIdx = this.finishWaypointIndex || 0;

            const playerRes = this.getNearestWaypointIndex(
                this.playerCar.group.position
            );
            const aiRes = this.getNearestWaypointIndex(
                this.aiCar.group.position
            );

            const newPlayerIdx = playerRes.index;
            const newAiIdx = aiRes.index;

            // Work in coordinates relative to the finish-line waypoint
            const prevPlayerRel =
                (this.playerWaypointIndex - finishIdx + totalWp) % totalWp;
            const newPlayerRel = (newPlayerIdx - finishIdx + totalWp) % totalWp;
            const prevAiRel =
                (this.aiWaypointIndex - finishIdx + totalWp) % totalWp;
            const newAiRel = (newAiIdx - finishIdx + totalWp) % totalWp;

            const wrapLow = totalWp * 0.25;
            const wrapHigh = totalWp * 0.75;

            if (this.racePhase === "racing") {
                // Player lap crossing: from end of loop back to start
                if (prevPlayerRel > wrapHigh && newPlayerRel < wrapLow) {
                    const lapTime = currentLapTime;

                    // Don't count an instant first "lap" at start
                    if (this.currentLap > 1 || lapTime > 5) {
                        this.lapTimes.push(lapTime);
                        this.racingHUD.updateLastLapTime(lapTime);

                        if (
                            this.bestLapTime === null ||
                            lapTime < this.bestLapTime
                        ) {
                            this.bestLapTime = lapTime;
                            this.racingHUD.updateBestLapTime(lapTime);
                        }

                        this.currentLap++;
                        const lapForDisplay = Math.min(
                            this.currentLap,
                            this.totalLaps
                        );
                        this.racingHUD.updateLap(lapForDisplay, this.totalLaps);
                        this.currentLapStartTime = currentTime;

                        if (this.currentLap > this.totalLaps) {
                            console.log("Race finished!");
                            this.racePhase = "finished";
                            this.showResults();
                        }
                    }

                    this.playerLapCount++;
                }

                // AI lap counting (for position only)
                if (prevAiRel > wrapHigh && newAiRel < wrapLow) {
                    this.aiLapCount++;
                }
            }

            this.playerWaypointIndex = newPlayerIdx;
            this.aiWaypointIndex = newAiIdx;
            const playerProgress = this.computeCarProgress(
                this.playerCar,
                this.playerWaypointIndex,
                this.playerLapCount
            );
            const aiProgress = this.computeCarProgress(
                this.aiCar,
                this.aiWaypointIndex,
                this.aiLapCount
            );

            const position = this.isPlayerAhead(playerProgress, aiProgress)
                ? 1
                : 2;
            this.racingHUD.updatePosition(position, 2);
        } else {
            // Fallback: simple position by Z if no waypoints
            const playerZ = this.playerCar.group.position.z;
            const aiZ = this.aiCar.group.position.z;
            const position = playerZ > aiZ ? 1 : 2;
            this.racingHUD.updatePosition(position, 2);
        }

        // Debug AI targets
        if (this.aiDriver && this.aiDebug) {
            const { current, lookAhead } = this.aiDebug;
            if (this.aiDriver.debugCurrentTarget) {
                current.position.copy(this.aiDriver.debugCurrentTarget);
                current.visible = true;
            } else {
                current.visible = false;
            }
            if (this.aiDriver.debugLookAhead) {
                lookAhead.position.copy(this.aiDriver.debugLookAhead);
                lookAhead.visible = true;
            } else {
                lookAhead.visible = false;
            }
        }

        // this.rapierDebugger.update();
    }

    showResults() {
        if (this.resultsScreen) return;

        const raceTime =
            this.raceStartTime != null
                ? performance.now() / 1000 - this.raceStartTime
                : 0;
        const bestLap = this.bestLapTime;

        // Determine final position one last time
        let finalPosition = 1;
        if (this.waypointLoop && this.totalWaypoints > 0) {
            const playerProgress = this.computeCarProgress(
                this.playerCar,
                this.playerWaypointIndex,
                this.playerLapCount
            );
            const aiProgress = this.computeCarProgress(
                this.aiCar,
                this.aiWaypointIndex,
                this.aiLapCount
            );

            finalPosition = this.isPlayerAhead(playerProgress, aiProgress)
                ? 1
                : 2;
        }

        this.resultsScreen = new ResultsScreen({
            position: finalPosition,
            totalLaps: this.totalLaps,
            raceTime,
            bestLapTime: bestLap,
            onBackToMenu: () => {
                window.location.reload();
            },
        });
    }

    updateCameraFov(speedMph) {
        const { min, max } = this.fovSpeedRange;
        const normalized = THREE.MathUtils.clamp(
            (speedMph - min) / (max - min || 1),
            0,
            1
        );
        const targetFov = THREE.MathUtils.lerp(
            this.minFov,
            this.maxFov,
            normalized
        );

        if (Math.abs(this.camera.fov - targetFov) > 0.05) {
            this.camera.fov = THREE.MathUtils.lerp(
                this.camera.fov,
                targetFov,
                0.1
            );
            this.camera.updateProjectionMatrix();
        }
    }
}
