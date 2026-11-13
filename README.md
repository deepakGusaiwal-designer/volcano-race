# 🌋 Volcano Speedway: Caldera Apex Championship

[![Three.js](https://img.shields.io/badge/Three.js-r170-black?logo=three.js)](https://threejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A high-performance, arcade-grade 3D WebGL racing simulator set inside an erupting volcanic caldera. Built with Three.js, React, TypeScript, and Zustand, featuring authentic vehicle physics, an intelligent 4-car competitive field, realistic sequential transmission with analog needle damping, dynamic procedural particle FX, and an interactive career progression passport.

---

## 📸 Overview

**Volcano Speedway** challenges drivers to conquer extreme hairpin corners, steep elevation drops, and glowing magma hazards around the rim of an active volcano. Race against 3 adaptive AI opponents, execute high-angle power drifts, chain Nitro boosts, and set the all-time Caldera Apex lap record.

---

## ⚡ Core Features

### 🏎️ Vehicle Physics & Handling
* **Progressive Sports Car Dynamics**: Speed-sensitive steering with physical rotational inertia (`yawVelocity`), smooth self-centering, and anti-snap steering stability.
* **Trail-Braking Weight Transfer**: Heavy braking shifts aerodynamic load to the front axle, increasing steering bite into corner apexes.
* **Dynamic Drift Mechanics**: Handbrake power-sliding with fluid counter-steer recovery, rear-axle step-out, and continuous drift-duration stunt scoring.
* **High-Speed Anti-Tunneling**: Multi-substep physics integration ensures the car never clips through road geometry or barriers even at 250+ KM/H.
* **Ground Surface Probes**: Dual-raycast suspension probes (center and front axle) seamlessly absorb curbs, steps, and track ramps.

### 🕹️ 6-Speed Sequential Transmission
* **Hysteresis Shift Logic**: Wide speed hysteresis bands (12–24 KM/H gaps) between gears and shift cooldowns eliminate gear hunting or chattering when cruising around shift thresholds.
* **Realistic Power Bands**: Upshifting smoothly drops RPM into the engine's optimal torque band (~4,100–5,100 RPM) rather than dropping to idle.
* **Launch Control & Burnout**: Standstill throttle builds engine revs with authentic rev-limiter bounce.
* **Clean Reverse Mode**: Seamless reverse engagement with dedicated reverse ratio and clean positive speed telemetry.

### 🎛️ Need for Speed Underground Dual-Gauge Cluster
* **Carbon-Fiber Twill Faceplate**: Brushed titanium bezels and authentic carbon weave silhouette.
* **60+ FPS Analog Needle Damping**: Dedicated `requestAnimationFrame` exponential damping loop (`1 - Math.exp(-lambda * dt)`) renders fluid, mechanical needle sweeps decoupled from React virtual DOM diffing.
* **True Center-Axis Pivot**: Native SVG user-unit transformations (`rotate(deg cx cy)`) eliminate CSS transform-origin scaling bugs and prevent needle wobbling across all display resolutions.
* **Turbo Boost Sub-Dial**: Real-time manifold pressure simulation (-30 to +30 PSI) reflecting throttle, engine load, vacuum during heavy braking, and peak boost during Nitrous injection.
* **N2O Curved LED Bar**: 12-segment annular LED gauge indicating available boost reserves.
* **Shift Light & Redline Halo**: Smoothly pulses when engine revs enter the redline power zone (7,800+ RPM).

### 🤖 Intelligent AI Competition
* **4-Car Competitive Grid**: Race against rivals *Ignis*, *Pyro*, and *Vortex*.
* **Spline-Based Racing Lines**: AI vehicles navigate closed 3D Catmull-Rom track splines with dynamic speed adaptation through turns.
* **Overtake & Collision Avoidance**: Lateral lane shifting to draft behind competitors or overtake around sweeping bends.
* **Robust Finish-Line Lock**: Progress tracking locks racer positions upon crossing the finish line, preventing spline wrap-around sorting discrepancies.

### 🌋 Environment & Visual FX
* **Caldera Volcanic Circuit**: 3D volcanic rock formations, banked asphalt bends, and animated firelight pulsing from the caldera floor.
* **Dual Circuit Modes**: Switch between **Classic Circuit** and **Reverse Circuit** layouts on the fly.
* **Dynamic Skidmark System**: Rubber tire contact ribbons dynamically imprinted onto asphalt during high-angle drifts and heavy braking.
* **Particle Pipeline**:
  * Volumetric tire smoke puffs generated during wheel skids.
  * Nitrous hyper-boost blue thrust flame jets from twin exhaust pipes.
  * High-RPM throttle backfire wisps and exhaust pops.
  * Neon chassis light trails following rear diffusers.
* **Lava Hazards**: Off-track runoffs with tire-burning detection and automated track recovery.

### 🔊 Procedural Web Audio Engine
* **Synthesized Engine Audio**: Procedural multi-oscillator engine simulation whose frequency, harmonic distortion, and gain dynamically respond to RPM and road speed.
* **Turbo Blow-Off & Spooling**: Dynamic pitch rising under acceleration with pressure relief hiss on throttle lift.
* **Tire Screech Synthesis**: Filtered noise generator modulated by lateral drift angle and skid speed.
* **Full Event Audio**: Stunt fanfare, collision thuds, launch sequence countdown tones, and victory celebrations.

### 🏆 Career Passport & Stunt Scoring
* **Driver XP & Leveling**: Advance from *Rookie Speedster* up to *Hall of Fame Legend* across 15+ progression ranks.
* **Stunt Combo Multipliers**: Earn points and combo multipliers for Drift Chains, Hyper Boost Surges, Clean Overtakes, and Airtime.
* **Persistent Driver Profile**: Career wins, coins, and lap records safely persisted in `localStorage`.

---

## 🚗 Car Lineup

| Vehicle | Class | Top Speed | Acceleration | Handling | Drift Rating |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Mazda LM Vision** | Le Mans Hypercar | 248 KM/H | 9.5 / 10 | 9.8 / 10 | 3.45× |
| **Hot Wheels Iridium** | Supercharged Concept | 255 KM/H | 9.2 / 10 | 9.0 / 10 | 3.35× |
| **Hot Wheels RD-09** | Heavy Volcanic Muscle | 242 KM/H | 8.8 / 10 | 9.4 / 10 | 3.85× |

*All cars support real-time livery recoloring via the in-game Garage Customizer.*

---

## 🎮 Controls

| Action | Primary Key | Secondary Key |
| :--- | :--- | :--- |
| **Accelerate / Throttle** | `W` | `Up Arrow` |
| **Steer Left** | `A` | `Left Arrow` |
| **Steer Right** | `D` | `Right Arrow` |
| **Brake / Reverse** | `S` | `Down Arrow` |
| **Handbrake / Drift** | `Spacebar` | — |
| **Hyper Boost (Nitro)** | `Shift` (Left or Right) | — |
| **Change Camera View** | `C` | Top Bar Button |
| **Reset Car to Track** | `R` | Top Bar Button |
| **Pause / Resume Game** | `Escape` | `P` |

### Camera Modes
Press `C` to cycle through 4 dedicated camera perspectives:
1. **Chase Camera**: Dynamic 3rd-person trailing view with smooth corner look-ahead.
2. **Hood Camera**: Intense first-person bonnet view with high speed sensation.
3. **Far Chase**: Wide-angle tactical overview for competitive pack racing.
4. **Cinematic Director**: Autonomous drone camera smoothly tracking dynamic race angles.

---

## 🛠️ Tech Stack & Architecture

* **Core Engine**: [Three.js](https://threejs.org/) (WebGL rendering, GLTF loaders, procedural meshes, Catmull-Rom splines, raycasting)
* **Frontend UI**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **State Management**: [Zustand](https://github.com/pmndrs/zustand) (Reactive telemetry store decoupled from render loops)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Icons & Visuals**: [Lucide React](https://lucide.dev/), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)
* **Build System**: [Vite 5](https://vitejs.dev/) with optimized Rollup code-splitting chunks

### Directory Structure

```text
Volcano-race/
├── public/
│   ├── images/              # Logos and brand assets
│   └── models/              # 3D GLTF models (Mazda, Hot Wheels Iridium, RD-09, Volcano)
├── src/
│   ├── audio/
│   │   └── SoundEffects.ts  # Web Audio API engine & event synthesizer
│   ├── components/
│   │   ├── HUD/             # Heads-Up Display modular components
│   │   │   ├── CarSelectModal.tsx       # Garage vehicle selection & colorizer
│   │   │   ├── DriverProfileModal.tsx   # Career passport & XP statistics
│   │   │   ├── LapCounter.tsx           # Live position, lap time, and best lap
│   │   │   ├── MiniMap.tsx              # Real-time GPS radar track mini-map
│   │   │   ├── NitroBar.tsx             # Boost gauge bar
│   │   │   ├── PauseModal.tsx           # In-game pause menu with telemetry
│   │   │   ├── RoadHint.tsx             # Dynamic turn anticipation arrows
│   │   │   ├── Speedometer.tsx          # Dual-gauge tachometer & boost cluster
│   │   │   ├── StartingGridCountdown.tsx# 3-2-1-GO launch mini-game
│   │   │   ├── StuntFeed.tsx            # Combo score popups and multiplier
│   │   │   ├── TopBar.tsx               # Audio, camera, pause, reset quick pills
│   │   │   ├── VictoryModal.tsx         # Podium finish results & star awards
│   │   │   └── WelcomeScreen.tsx        # Hero start screen
│   │   └── LoadingScreen.tsx            # Asset preload & shader warm-up progress
│   ├── game/
│   │   ├── AICarController.ts           # Competitor vehicle pathfinding & physics
│   │   ├── CinematicDirector.ts         # Automated broadcast race cameras
│   │   ├── CompetitionManager.ts        # Race positions, laps, and finish order
│   │   ├── FollowCamera.ts              # Damped chase camera system
│   │   ├── ForzaTrackVisuals.ts         # Curbs, rumble strips, and sponsor hoardings
│   │   ├── GameEngine.ts                # Main Three.js loop, scene & render pass
│   │   ├── HotWheelsPickupManager.ts    # Collectible track tokens
│   │   ├── LightTrailManager.ts         # Neon taillight ribbon effects
│   │   ├── NitroPickupManager.ts        # Track-side boost recharge canisters
│   │   ├── ParticleManager.ts           # Smoke puffs, exhaust sparks, boost fire
│   │   ├── SkidmarkManager.ts           # Procedural tire rubber ribbons
│   │   ├── VehicleController.ts         # Player car dynamics, transmission & audio
│   │   └── VolcanoTrack.ts              # Spline geometry, checkpoints, raycast colliders
│   ├── store/
│   │   └── useGameStore.ts              # Global Zustand state management
│   ├── types/
│   │   └── game.ts                      # TypeScript definitions & car presets
│   ├── App.tsx                          # Root React component
│   ├── main.tsx                         # Entry point
│   └── index.css                        # Tailwind directives & typography
├── package.json
├── tsconfig.json
└── vite.config.ts                       # Rollup chunk optimization & Vite config
```

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (version 18.0 or higher recommended)
* `npm` or `yarn` / `pnpm`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/volcano-race.git
   cd volcano-race
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173/`.

4. **Build for production:**
   ```bash
   npm run build
   ```
   The optimized production bundle will be generated in the `dist/` directory.

5. **Preview the production build:**
   ```bash
   npm run preview
   ```

---

## ⚡ Performance Optimizations

* **Decoupled 60 FPS Needle Damping**: Speedometer and tachometer needles use direct SVG DOM manipulation within `requestAnimationFrame` instead of triggering React state reconciliations on every frame.
* **Vector-Only Cluster Styling**: Dynamic raster drop-shadow filters on animating SVG elements were eliminated in favor of native SVG vector glow paths and static HTML container compositing, avoiding GPU texture reallocations.
* **Selective Zustand Subscriptions**: Components subscribe strictly to their needed slice of state, preventing unnecessary re-renders across the HUD.
* **Rollup Chunk Splitting**: Production assets are split into distinct vendor chunks (`three-core`, `three-extras`, `react-vendor`, and `icons`) to ensure fast cold loads and sub-500kB chunks for fast Vercel edge deployment.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
