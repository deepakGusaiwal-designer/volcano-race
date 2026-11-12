import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { VolcanoTrack } from './VolcanoTrack';
import { VehicleController } from './VehicleController';
import { FollowCamera } from './FollowCamera';
import { CinematicDirector } from './CinematicDirector';
import { ParticleManager } from './ParticleManager';
import { SkidmarkManager } from './SkidmarkManager';
import { LightTrailManager } from './LightTrailManager';
import { CompetitionManager } from './CompetitionManager';
import { NitroPickupManager } from './NitroPickupManager';
import { HotWheelsPickupManager } from './HotWheelsPickupManager';
import { useGameStore } from '../store/useGameStore';
import { soundEffects } from '../audio/SoundEffects';
import { CarModelId, CAR_PRESETS } from '../types/game';

export class GameEngine {
  private container: HTMLDivElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public orbitControls: OrbitControls;

  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;

  public track: VolcanoTrack;
  public vehicle: VehicleController;
  public competitionManager: CompetitionManager;
  public followCamera: FollowCamera;
  public cinematicDirector: CinematicDirector;
  public particleManager: ParticleManager;
  public skidmarkManager: SkidmarkManager;
  public lightTrailManager: LightTrailManager;
  public nitroPickupManager: NitroPickupManager;
  public hotWheelsPickupManager: HotWheelsPickupManager;
  private dirLight: THREE.DirectionalLight | null = null;
  private magmaLight: THREE.PointLight | null = null;

  // Race Progress
  private currentLap = 1;
  private totalLaps = 3;
  private currentCheckpointIdx = 0;
  private lapStartTime = 0;
  private currentLapTime = 0;
  private bestLapTime: number | null = null;
  private raceStartTime = 0;
  private totalRaceTime = 0;
  private isFinished = false;
  private welcomeAngle = 0;
  private countdownTimer: number | null = null;
  private countdownClearTimeout: number | null = null;

  // FPS & Performance Profiling
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 60;
  private lastTelemetryTime = 0;
  private smoothDelta = 0.0166;

  constructor(container: HTMLDivElement) {
    this.container = container;

    // 1. Scene with volcanic twilight atmospheric backdrop
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b1c28);

    // 2. Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.2, 3500);
    this.followCamera = new FollowCamera(this.camera);

    // 3. Renderer with high-performance WebGL settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    // Optimized for consistent 60 FPS: clamp DPR to 1.0 to eliminate fillrate bottlenecks on high-DPI/4K displays
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // Hardware-filtered 2x2 shadow map, dramatically faster than PCFSoft
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls for Free Inspector & Zoom Mode
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.minDistance = 1.8;
    this.orbitControls.maxDistance = 12.0; // Strictly restricted: user stays focused on car and cannot see the whole environment/map edges
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.04; // Prevent camera dipping below road into the void
    this.orbitControls.enabled = false; // Disabled by default in chase camera mode

    // 5. Subsystems
    this.particleManager = new ParticleManager(this.scene);
    this.skidmarkManager = new SkidmarkManager(this.scene);
    this.lightTrailManager = new LightTrailManager(this.scene);
    this.track = new VolcanoTrack(this.scene);
    this.vehicle = new VehicleController(this.scene, this.particleManager);
    this.vehicle.skidmarkManager = this.skidmarkManager;
    this.competitionManager = new CompetitionManager(this.scene, this.particleManager, this.vehicle);
    this.competitionManager.setCarScale(this.vehicle.carScale);
    this.followCamera.carScale = this.vehicle.carScale;
    this.cinematicDirector = new CinematicDirector(this.camera);
    this.cinematicDirector.carScale = this.vehicle.carScale;
    this.nitroPickupManager = new NitroPickupManager(this.scene);
    this.hotWheelsPickupManager = new HotWheelsPickupManager(this.scene);

    // 6. Lighting
    this.setupLighting();

    // 7. Event Listeners
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private setupLighting() {
    // 1. Christopher Nolan-inspired Volcanic Atmospheric Depth Fog (Dunkirk / Interstellar style)
    // Seamlessly blends distant volcanic caldera rim and cliffs into atmospheric haze
    this.scene.fog = new THREE.FogExp2(0x1a1416, 0.0028);

    // 2. Warm Volcanic Ambient Light (ensures road and track surface are clearly visible even in shaded areas)
    const ambientLight = new THREE.AmbientLight(0x4e3e3b, 1.35);
    this.scene.add(ambientLight);

    // Soft sky hemisphere fill: top illuminates the road deck, bottom bounces dark volcanic ground reflection
    const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x3a2c28, 0.85);
    this.scene.add(hemiLight);

    // 3. Low Golden-Hour Key Sun (dramatic cinematic shadows and vehicle silhouette)
    this.dirLight = new THREE.DirectionalLight(0xffdfb8, 2.4);
    this.dirLight.position.set(-60, 115, 75);
    this.dirLight.castShadow = true;
    // 1024x1024 map with tight 32m frustum following the vehicle provides razor-sharp shadows at a fraction of the GPU cost
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 200;
    const d = 32;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    // 4. Cool Smoky Rim/Sky Light (crisp cinematic edge definition along Mazda LM body contours)
    const rimLight = new THREE.DirectionalLight(0x8ca2b5, 1.15);
    rimLight.position.set(60, 75, -60);
    this.scene.add(rimLight);

    // 5. Pulsing Caldera Magma Point Light (dynamic warm firelight glow near central lava pool)
    this.magmaLight = new THREE.PointLight(0xff4500, 3.2, 85, 1.8);
    this.magmaLight.position.set(20.0, 2.0, 14.0);
    this.scene.add(this.magmaLight);
  }

  async init(): Promise<void> {
    const store = useGameStore.getState();

    try {
      store.setLoading(true, 'Loading Volcano Track & Terrain...', 20);
      await this.track.loadTrack((progress) => {
        store.setLoading(true, 'Loading Volcano Track...', 20 + Math.round(progress * 40));
      });

      this.vehicle.setColliders(this.track.colliders, this.track.barriers);
      this.nitroPickupManager.initPickups(this.track.colliders);
      this.hotWheelsPickupManager.initPickups(this.track.colliders);

      const initialCarId = store.carId || 'mazda';
      const initialCarName = CAR_PRESETS[initialCarId]?.name || 'Mazda LM Vision';
      store.setLoading(true, `Loading ${initialCarName} Model...`, 65);
      await this.vehicle.loadCar(initialCarId);

      store.setLoading(true, 'Loading Competitor Racing Fleet...', 80);
      await this.competitionManager.loadCompetitors((loaded, total) => {
        store.setLoading(true, `Loading Rivals (${loaded}/${total})...`, 80 + Math.round((loaded / total) * 16));
      });

      // Default to Reverse Track Circuit start mode as requested
      this.track.setTrackDirection('reverse');
      this.competitionManager.setTrackDirection('reverse');
      this.vehicle.setSpawn(this.track.spawnPosition, this.track.spawnHeading);
      this.competitionManager.resetGrid('reverse');

      store.setLoading(false);
      store.setGameState('welcome');
      store.setNotification('WELCOME TO VOLCANO GRAND PRIX! 🏁 Click START RACE to ignite engine');

      this.startLoop();
    } catch (err) {
      console.error('Failed to initialize game engine:', err);
      store.setLoading(false, 'Failed to load assets.');
    }
  }

  startRaceCountdown() {
    const store = useGameStore.getState();
    soundEffects.init();
    soundEffects.resume();

    // 1. Clear any active countdown timer or pending GO banner clear timeout
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.countdownClearTimeout !== null) {
      clearTimeout(this.countdownClearTimeout);
      this.countdownClearTimeout = null;
    }

    // 2. Lock player car and AI rivals in their exact starting grid spots
    this.vehicle.setSpawn(this.track.spawnPosition, this.track.spawnHeading);
    this.competitionManager.resetGrid(this.track.trackDirection);

    store.setGameState('countdown');
    store.setCountdownValue(3);
    store.setIsPerfectLaunch(false);
    soundEffects.playCountdown(3);

    let step = 3;
    this.countdownTimer = window.setInterval(() => {
      step--;
      if (step > 0) {
        store.setCountdownValue(step);
        soundEffects.playCountdown(step as 2 | 1);
      } else if (step === 0) {
        if (this.countdownTimer !== null) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        store.setCountdownValue(0);
        soundEffects.playCountdown(0);

        // Check for launch boost
        if (this.vehicle.getTelemetry().rpm > 5500) {
          store.setIsPerfectLaunch(true);
          const fwd = this.vehicle.forwardVec;
          this.vehicle.applyCollisionImpulse(
            new THREE.Vector3(fwd.x * 3.5, 0, fwd.z * 3.5),
            this.vehicle.position
          );
          store.triggerStunt('PERFECT LAUNCH! 🚀', 250, 'boost');
        }

        store.setGameState('racing');
        store.setPaused(false);
        this.raceStartTime = performance.now();
        this.lapStartTime = performance.now();

        this.countdownClearTimeout = window.setTimeout(() => {
          store.setCountdownValue(null);
          store.setIsPerfectLaunch(false);
          this.countdownClearTimeout = null;
        }, 1200);
      }
    }, 1000);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const store = useGameStore.getState();

    // Pause Toggle [Escape / P]
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (store.isCarSelectOpen) {
        store.setCarSelectOpen(false);
      } else if (store.isCareerModalOpen) {
        store.setCareerModalOpen(false);
      } else if (store.gameState === 'racing' || store.gameState === 'paused') {
        store.togglePause();
      }
      return;
    }

    // Camera Switch [C]
    if (e.code === 'KeyC') {
      this.cycleCamera();
    }
    // Zoom In [+ / = / Z]
    else if (e.key === '+' || e.key === '=' || e.key === 'z' || e.key === 'Z') {
      this.zoomIn();
    }
    // Zoom Out [- / _ / X]
    else if (e.key === '-' || e.key === '_' || e.key === 'x' || e.key === 'X') {
      this.zoomOut();
    }
    // Car Scale Cycle [T]
    else if (e.code === 'KeyT') {
      this.cycleCarScale();
    }
    // Track Direction Mode [M]
    else if (e.code === 'KeyM') {
      this.toggleTrackDirection();
    }
    // Car Selection Garage [V] or [G]
    else if (e.code === 'KeyV' || e.code === 'KeyG') {
      useGameStore.getState().toggleCarSelect();
    }
  };

  private onWheel = (e: WheelEvent) => {
    const store = useGameStore.getState();
    if (store.cameraMode !== 'far') {
      if (e.deltaY < 0) {
        this.zoomIn();
      } else if (e.deltaY > 0) {
        this.zoomOut();
      }
    }
  };

  cycleCamera() {
    const store = useGameStore.getState();
    const modes: Array<'chase' | 'hood' | 'far' | 'cinematic'> = ['chase', 'hood', 'far', 'cinematic'];
    const currentIdx = modes.indexOf(store.cameraMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    this.setCameraMode(nextMode);
  }

  setCameraMode(mode: 'chase' | 'hood' | 'far' | 'cinematic') {
    useGameStore.getState().updateTelemetry({ cameraMode: mode });

    if (mode === 'far') {
      // In Far / Free Inspector mode, enable OrbitControls pivoting tightly around the vehicle
      this.orbitControls.enabled = true;
      this.orbitControls.target.copy(this.vehicle.position);
      const camPos = this.vehicle.position.clone().add(new THREE.Vector3(0, 2.2, 5.0));
      this.camera.position.copy(camPos);
      useGameStore.getState().setNotification('Free Orbit Camera: Drag to rotate, wheel to zoom');
    } else if (mode === 'cinematic') {
      this.orbitControls.enabled = false;
      this.cinematicDirector.reset();
      useGameStore.getState().setNotification('Cinematic Director Camera: Dynamic Hollywood Cuts & Angles 🎬');
    } else {
      this.orbitControls.enabled = false;
      useGameStore.getState().setNotification(mode === 'hood' ? 'Cockpit Camera' : 'Chase Camera');
    }
  }

  zoomIn() {
    const store = useGameStore.getState();
    if (store.cameraMode === 'far') {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.orbitControls.target);
      dir.multiplyScalar(0.88);
      if (dir.length() >= this.orbitControls.minDistance) {
        this.camera.position.copy(this.orbitControls.target).add(dir);
      }
    } else if (store.cameraMode === 'cinematic') {
      this.cinematicDirector.nextShot();
      useGameStore.getState().setNotification(`Cinematic Cut: ${this.cinematicDirector.getShotName()} 🎬`);
    } else {
      this.followCamera.zoomIn();
    }
  }

  zoomOut() {
    const store = useGameStore.getState();
    if (store.cameraMode === 'far') {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.orbitControls.target);
      dir.multiplyScalar(1.12);
      if (dir.length() <= this.orbitControls.maxDistance) {
        this.camera.position.copy(this.orbitControls.target).add(dir);
      }
    } else if (store.cameraMode === 'cinematic') {
      this.cinematicDirector.nextShot();
      useGameStore.getState().setNotification(`Cinematic Cut: ${this.cinematicDirector.getShotName()} 🎬`);
    } else {
      this.followCamera.zoomOut();
    }
  }

  setCarScale(scale: number) {
    this.vehicle.setCarScale(scale);
    this.competitionManager.setCarScale(scale);
    this.followCamera.carScale = scale;
    this.cinematicDirector.carScale = scale;
    useGameStore.getState().setCarScale(scale);
    useGameStore.getState().setNotification(`Car Scale: ${scale.toFixed(2)}x 🏎️`);
  }

  cycleCarScale() {
    const scales = [0.14, 0.10, 0.18];
    const current = this.vehicle.carScale;
    let nextIdx = 0;
    if (Math.abs(current - 0.14) < 0.02) nextIdx = 1;
    else if (Math.abs(current - 0.10) < 0.02) nextIdx = 2;
    else nextIdx = 0;
    this.setCarScale(scales[nextIdx]);
  }

  toggleTrackDirection() {
    const current = this.track.trackDirection;
    const nextDir = current === 'reverse' ? 'normal' : 'reverse';
    this.setTrackDirection(nextDir);
  }

  setTrackDirection(dir: 'normal' | 'reverse') {
    const prevState = useGameStore.getState().gameState;
    this.track.setTrackDirection(dir);
    this.competitionManager.setTrackDirection(dir);
    useGameStore.getState().setTrackDirection(dir);
    if (prevState === 'welcome') {
      this.resetRace();
    } else {
      this.restartRaceCountdown();
    }
    useGameStore.getState().setNotification(`Track Mode: ${dir === 'reverse' ? 'REVERSE CIRCUIT 🔄' : 'CLASSIC CIRCUIT 🏎️'}`);
  }

  resetRace() {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.countdownClearTimeout !== null) {
      clearTimeout(this.countdownClearTimeout);
      this.countdownClearTimeout = null;
    }
    try {
      confetti.reset();
    } catch {
      // ignore if canvas not initialized
    }

    this.currentLap = 1;
    this.currentCheckpointIdx = 0;
    this.currentLapTime = 0;
    this.bestLapTime = null;
    this.totalRaceTime = 0;
    this.lapStartTime = performance.now();
    this.raceStartTime = performance.now();
    this.isFinished = false;
    this.welcomeAngle = 0;

    this.vehicle.clearInput();
    this.vehicle.setSpawn(this.track.spawnPosition, this.track.spawnHeading);
    this.competitionManager.resetGrid(this.track.trackDirection);
    this.skidmarkManager.reset();
    this.lightTrailManager.reset();
    this.particleManager.reset();
    this.followCamera.resetZoom();
    this.cinematicDirector.reset();
    this.track.reset();
    this.nitroPickupManager.resetAll();
    this.hotWheelsPickupManager.resetAll();
    soundEffects.updateEngine(1000, 0, false, false);
    useGameStore.getState().resetRace();
    useGameStore.getState().setNotification(`Race Reset! Mode: ${this.track.trackDirection.toUpperCase()} 🏁`);
  }

  restartRaceCountdown() {
    this.resetRace();
    this.startRaceCountdown();
  }

  returnToStartingGrid() {
    this.resetRace();
    useGameStore.getState().setGameState('welcome');
  }

  setCarPaint(hexColor: string) {
    this.vehicle.setPaintColor(hexColor);
    useGameStore.getState().setCarPaint(hexColor);
  }

  async switchCar(carId: CarModelId): Promise<void> {
    const store = useGameStore.getState();
    if (this.vehicle.carModelId === carId) {
      store.setNotification(`Already driving ${CAR_PRESETS[carId]?.name}! 🏎️`);
      return;
    }

    store.setCarId(carId);
    store.updateTelemetry({ carId });
    const carPreset = CAR_PRESETS[carId];
    store.setNotification(`Switching to ${carPreset?.name || carId}... 🏎️`);

    try {
      await this.vehicle.loadCar(carId, true);
      store.setNotification(`${carPreset?.name || carId} Ready! 🏁`);
    } catch (err) {
      console.error('Failed to switch car:', err);
      store.setNotification(`Failed to load ${carId}`);
    }
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private startLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      const rawDelta = this.clock.getDelta();
      // Clamp delta to prevent physics explosions on tab switch or micro-hiccups
      const clampedDelta = Math.min(Math.max(rawDelta, 0.001), 0.038);
      // Low-pass exponential smoothing filter eliminates frame-to-frame delta jitter
      this.smoothDelta = this.smoothDelta * 0.82 + clampedDelta * 0.18;
      const delta = this.smoothDelta;
      const now = performance.now();
      const store = useGameStore.getState();

      // FPS tracking
      this.frameCount++;
      if (now - this.lastFpsTime >= 500) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
        this.frameCount = 0;
        this.lastFpsTime = now;
      }

      // Welcome State: Cinematic Camera Orbit around starting grid
      if (store.gameState === 'welcome') {
        this.welcomeAngle += delta * 0.42;
        const carPos = this.vehicle.position;
        const radius = 9.2;
        const camHeight = 3.2;
        this.camera.position.set(
          carPos.x + Math.sin(this.welcomeAngle) * radius,
          carPos.y + camHeight,
          carPos.z + Math.cos(this.welcomeAngle) * radius
        );
        this.camera.lookAt(carPos.x, carPos.y + 0.9, carPos.z);
        this.track.update(delta, this.camera, this.vehicle.position, 0);
        this.renderer.render(this.scene, this.camera);
        return;
      }

      // Paused State: Freeze dynamic world but render frame
      if (store.gameState === 'paused' || store.paused) {
        this.renderer.render(this.scene, this.camera);
        return;
      }

      if (!this.isFinished) {
        this.currentLapTime = (now - this.lapStartTime) / 1000;
        this.totalRaceTime = (now - this.raceStartTime) / 1000;
      }

      // 1. Vehicle Physics
      this.vehicle.update(delta);

      // 2. AI Competitors Fleet & Live Leaderboard Standings (with Forza Horizon Camera Impact Trauma)
      this.competitionManager.update(delta, this.track.colliders, this.currentLap, (impactIntensity) => {
        this.followCamera.addShake(impactIntensity * 0.55);
      });

      // 3. Track & Checkpoints Rules
      this.track.update(delta, this.camera, this.vehicle.position, Math.abs(this.vehicle.speedKmH));

      if (!this.isFinished) {
        this.track.checkCheckpoints(
          this.vehicle.position,
          this.currentCheckpointIdx,
          (newIdx, isLapComplete) => {
            this.currentCheckpointIdx = newIdx;
            const cp = this.track.checkpoints[newIdx];
            const cpPos = cp
              ? new THREE.Vector3(cp.position[0], cp.position[1], cp.position[2])
              : this.track.spawnPosition;
            const heading = this.vehicle.currentHeading;
            this.vehicle.setCheckpointReached(cpPos, heading);

            if (isLapComplete) {
              const finishedLapTime = this.currentLapTime;
              if (this.bestLapTime === null || finishedLapTime < this.bestLapTime) {
                this.bestLapTime = finishedLapTime;
              }

              if (this.currentLap >= this.totalLaps) {
                this.isFinished = true;
                soundEffects.playVictory();
                confetti({
                  particleCount: 220,
                  spread: 90,
                  origin: { y: 0.6 },
                });

                const gStore = useGameStore.getState();
                const playerStanding = gStore.leaderboard.find(r => r.isPlayer);
                const place = playerStanding ? playerStanding.position : 1;
                const totalSeconds = this.totalRaceTime;

                // 3-Star Rating: 1★ Finish Race, 2★ Podium Top 3, 3★ 1st Place or Sub 180s
                let starsEarned = 1;
                if (place <= 3) starsEarned++;
                if (place === 1 || totalSeconds < 185) starsEarned++;

                const xpGained = place === 1 ? 600 : (place === 2 ? 400 : 250);
                gStore.awardStars(starsEarned, this.track.trackDirection);
                gStore.addDriverXp(xpGained, gStore.coinsCollected, place === 1);
                gStore.setGameState('victory');
                gStore.setNotification(`🏆 RACE FINISHED! ${place === 1 ? '1ST PLACE VICTORY!' : `${place}TH PLACE PODIUM!`}`);
              } else {
                this.currentLap++;
                this.lapStartTime = performance.now();
                useGameStore.getState().setNotification(`LAP ${this.currentLap} / ${this.totalLaps}! 🔥`);
              }
            } else {
              useGameStore.getState().setNotification(`Checkpoint ${newIdx} / ${this.track.checkpoints.length} Cleared!`);
            }
          }
        );

        // Collect coins along the volcanic track
        this.track.checkCoins(this.vehicle.position, () => {
          const currentCoins = useGameStore.getState().coinsCollected;
          useGameStore.getState().updateTelemetry({ coinsCollected: currentCoins + 1 });
          useGameStore.getState().setNotification(`+1 Coin! (${currentCoins + 1}) 🪙`);
        });
      }

      // 3. Dynamic Particles, Nitro Pickups, Hot Wheels Collectibles, Tire Skidmarks & Asphalt Light Trails
      this.nitroPickupManager.update(delta, this.vehicle, this.competitionManager.aiCars, this.particleManager);
      this.hotWheelsPickupManager.update(delta, this.vehicle, this.competitionManager.aiCars, this.particleManager);
      this.particleManager.update(delta, this.vehicle.position);
      this.skidmarkManager.update(delta);
      this.lightTrailManager.update(delta, this.vehicle, this.competitionManager.aiCars, this.camera);

      // 4. Camera Update
      if (store.cameraMode === 'far') {
        this.orbitControls.enabled = true;
        this.orbitControls.target.lerp(this.vehicle.position, delta * 8);
        this.orbitControls.update();
      } else if (store.cameraMode === 'cinematic') {
        this.orbitControls.enabled = false;
        this.cinematicDirector.update(
          this.vehicle.position,
          this.vehicle.quaternion,
          this.vehicle.speedKmH,
          delta,
          this.vehicle.steerAngle,
          this.vehicle.driftAngle
        );
      } else {
        this.orbitControls.enabled = false;
        this.followCamera.update(
          this.vehicle.position,
          this.vehicle.quaternion,
          this.vehicle.speedKmH,
          this.vehicle.isBoosting,
          store.cameraMode,
          delta,
          this.vehicle.steerAngle,
          this.vehicle.driftAngle
        );
      }

      // 5. Directional Light follows vehicle position smoothly for crisp shadows
      if (this.dirLight) {
        this.dirLight.position.set(
          this.vehicle.position.x - 60,
          this.vehicle.position.y + 115,
          this.vehicle.position.z + 75
        );
        this.dirLight.target.position.copy(this.vehicle.position);
        this.dirLight.target.updateMatrixWorld();
      }

      // Animate caldera magma firelight pulsing
      if (this.magmaLight) {
        this.magmaLight.intensity = 3.2 + Math.sin(now * 0.0035) * 0.45;
      }

      // 6. Render
      this.renderer.render(this.scene, this.camera);

      // 7. Telemetry Store Update (throttled to ~15 Hz to prevent React HUD re-render thrashing on the 60 FPS animation loop)
      if (now - this.lastTelemetryTime >= 66 || this.isFinished) {
        this.lastTelemetryTime = now;
        store.updateTelemetry({
          ...this.vehicle.getTelemetry(),
          lap: this.currentLap,
          totalLaps: this.totalLaps,
          lapTime: Math.round(this.currentLapTime * 10) / 10,
          bestLapTime: this.bestLapTime ? Math.round(this.bestLapTime * 10) / 10 : null,
          totalTime: Math.round(this.totalRaceTime * 10) / 10,
          checkpointIndex: this.currentCheckpointIdx,
          totalCheckpoints: this.track.checkpoints.length,
          trackDirection: this.track.trackDirection,
          finished: this.isFinished,
          fps: this.currentFps,
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
        });
      }
    };

    animate();
  }

  dispose() {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.countdownClearTimeout !== null) {
      clearTimeout(this.countdownClearTimeout);
      this.countdownClearTimeout = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('wheel', this.onWheel);
    this.orbitControls.dispose();
    this.track.dispose();
    this.competitionManager.dispose();
    this.nitroPickupManager.dispose();
    this.hotWheelsPickupManager.dispose();
    this.skidmarkManager.dispose();
    this.lightTrailManager.dispose();
    this.vehicle.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
