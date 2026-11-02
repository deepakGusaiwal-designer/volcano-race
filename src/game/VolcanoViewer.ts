import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CameraPreset {
  name: string;
  cameraPos: [number, number, number];
  targetPos: [number, number, number];
}

export class VolcanoViewer {
  private container: HTMLDivElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;

  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;
  public volcanoModel: THREE.Group | null = null;

  // Camera presets centered relative to the racetrack (origin (0, 0, 0))
  public presets: Record<string, CameraPreset> = {
    overview: {
      name: 'Overview',
      cameraPos: [0, 85, 115],
      targetPos: [0, 0, 0],
    },
    startLine: {
      name: 'Start Grid',
      cameraPos: [-22, 5.5, 24],
      targetPos: [-7.3, 0.5, 10.6],
    },
    crater: {
      name: 'Caldera',
      cameraPos: [38, 18, 38],
      targetPos: [23, 4, 22],
    },
    hairpin: {
      name: 'Hairpin Turn',
      cameraPos: [48, 14, -36],
      targetPos: [28, 2, -18],
    },
    summit: {
      name: 'Peak',
      cameraPos: [0, 130, 150],
      targetPos: [4, 25, 11],
    },
  };

  private targetCameraPos: THREE.Vector3 | null = null;
  private targetLookAt: THREE.Vector3 | null = null;
  public onPresetChange?: (presetKey: string) => void;

  constructor(container: HTMLDivElement) {
    this.container = container;

    // 1. Scene with clean, neutral backdrop - No external tint or artificial fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x18191c);

    // 2. Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.2, 3000);
    this.camera.position.set(0, 85, 115);

    // 3. WebGL Renderer with clean standard tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls with smooth damping & zoom limits
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0, 0);

    // Zoom and pan limits
    this.controls.minDistance = 2.0;    // zoom right up to track surface
    this.controls.maxDistance = 480.0;  // zoom out to wide aerial view
    this.controls.zoomSpeed = 1.25;
    this.controls.rotateSpeed = 0.85;
    this.controls.panSpeed = 0.85;

    // 5. Clean, neutral natural lighting (no artificial red/orange pointlights or tint)
    this.setupLighting();

    // 6. Event Listeners
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
  }

  private setupLighting() {
    // Neutral ambient light so file textures appear accurately
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    // Balanced white directional sunlight for natural depth
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(-60, 120, 80);
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(60, 80, -60);
    this.scene.add(fillLight);
  }

  async loadVolcano(onProgress?: (progress: number) => void): Promise<void> {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        '/models/Volcano.glb',
        (gltf) => {
          this.volcanoModel = gltf.scene;

          // Accurately locate road center to center the racetrack at origin (0, 0, 0)
          let roadMesh: THREE.Object3D | null = null;
          this.volcanoModel.traverse((child) => {
            if (child.name.toLowerCase().includes('specialroad')) {
              roadMesh = child;
            }
          });

          const roadBox = new THREE.Box3();
          if (roadMesh) {
            roadBox.setFromObject(roadMesh);
          } else {
            roadBox.setFromObject(this.volcanoModel);
          }

          const roadCenter = new THREE.Vector3();
          roadBox.getCenter(roadCenter);

          // Shift model so the track is centered at (0, 0, 0)
          this.volcanoModel.position.set(-roadCenter.x, -roadCenter.y, -roadCenter.z);
          this.volcanoModel.updateMatrixWorld(true);

          // Stay like it is in file:
          // NO masking (no alphaTest), NO external emissive overrides, NO roughness overrides.
          // Keep all materials and textures exactly as authored in the GLB file.
          this.volcanoModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const name = (mesh.name || '').toLowerCase();

              // Hide collision volume bounds
              if (name.includes('colwall')) {
                mesh.visible = false;
                return;
              }

              // Ensure depthWrite is active so geometry renders reliably
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.depthWrite = true;
                mat.side = THREE.DoubleSide;
              }
            }
          });

          this.scene.add(this.volcanoModel);
          this.startLoop();
          resolve();
        },
        (xhr) => {
          if (xhr.total > 0 && onProgress) {
            onProgress(xhr.loaded / xhr.total);
          }
        },
        (err) => reject(err)
      );
    });
  }

  // Camera Actions
  zoomIn(factor: number = 0.75) {
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const dist = dir.length();
    const newDist = Math.max(this.controls.minDistance, dist * factor);
    dir.setLength(newDist);
    this.camera.position.copy(this.controls.target).add(dir);
    this.controls.update();
  }

  zoomOut(factor: number = 1.33) {
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const dist = dir.length();
    const newDist = Math.min(this.controls.maxDistance, dist * factor);
    dir.setLength(newDist);
    this.camera.position.copy(this.controls.target).add(dir);
    this.controls.update();
  }

  resetView() {
    this.setPreset('overview');
  }

  setPreset(key: string) {
    const preset = this.presets[key];
    if (!preset) return;
    this.targetCameraPos = new THREE.Vector3(...preset.cameraPos);
    this.targetLookAt = new THREE.Vector3(...preset.targetPos);
    if (this.onPresetChange) {
      this.onPresetChange(key);
    }
  }

  toggleAutoRotate(): boolean {
    this.controls.autoRotate = !this.controls.autoRotate;
    this.controls.autoRotateSpeed = 1.2;
    return this.controls.autoRotate;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Zoom shortcuts: + or = or Z
    if (e.key === '+' || e.key === '=' || e.key === 'z' || e.key === 'Z') {
      this.zoomIn();
    }
    // Zoom out shortcuts: - or _ or X
    else if (e.key === '-' || e.key === '_' || e.key === 'x' || e.key === 'X') {
      this.zoomOut();
    }
    // Reset view
    else if (e.key === 'r' || e.key === 'R') {
      this.resetView();
    }
    // Toggle 360 auto rotate
    else if (e.code === 'Space') {
      e.preventDefault();
      this.toggleAutoRotate();
    }
    // Presets 1 to 5
    else if (e.key === '1') this.setPreset('overview');
    else if (e.key === '2') this.setPreset('startLine');
    else if (e.key === '3') this.setPreset('crater');
    else if (e.key === '4') this.setPreset('hairpin');
    else if (e.key === '5') this.setPreset('summit');
  };

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

      const delta = Math.min(this.clock.getDelta(), 0.05);

      // Smooth preset camera transition
      if (this.targetCameraPos && this.targetLookAt) {
        this.camera.position.lerp(this.targetCameraPos, delta * 4);
        this.controls.target.lerp(this.targetLookAt, delta * 4);
        if (
          this.camera.position.distanceTo(this.targetCameraPos) < 0.2 &&
          this.controls.target.distanceTo(this.targetLookAt) < 0.2
        ) {
          this.targetCameraPos = null;
          this.targetLookAt = null;
        }
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
