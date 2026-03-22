import * as THREE from 'three';
import { OBJLoader }  from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader }  from 'three/addons/loaders/MTLLoader.js';

// ── State colors ────────────────────────────────────────────────────────────

const COLORS = {
  EGO:     0x3b82f6,
  DANGER:  0xef4444,
  WARNING: 0xf59e0b,
  NORMAL:  0x6b7280,
};

// ── Road / lane constants ───────────────────────────────────────────────────

const LANE_W    = 3.5;
const NUM_LANES = 3;
const ROAD_W    = NUM_LANES * LANE_W;         // 10.5 m
const LANES_X   = [-3.5, 0.0, 3.5];

// ── Demo vehicles ───────────────────────────────────────────────────────────
// spd = approach speed toward camera per frame

const VEHICLE_DEFS = [
  { id: 'VEH-01', lx: LANES_X[0], z:  10, state: 'DANGER',  spd: 0.055 },
  { id: 'VEH-02', lx: LANES_X[2], z:   7, state: 'WARNING', spd: 0.045 },
  { id: 'VEH-03', lx: LANES_X[1], z:  22, state: 'NORMAL',  spd: 0.038 },
  { id: 'VEH-04', lx: LANES_X[0], z:  -5, state: 'NORMAL',  spd: 0.032 },
  { id: 'VEH-05', lx: LANES_X[2], z:  -3, state: 'WARNING', spd: 0.050 },
  { id: 'VEH-06', lx: LANES_X[1], z:  33, state: 'DANGER',  spd: 0.042 },
  { id: 'VEH-07', lx: LANES_X[2], z:  26, state: 'NORMAL',  spd: 0.040 },
];

// ── Three.js globals ────────────────────────────────────────────────────────

const canvas = document.getElementById('road-canvas');

let renderer, scene, camera;
let carTemplate = null;
let vehicles    = [];    // { def, mesh }
let dashMeshes  = [];    // lane marking dashes (animated)
let egoGlow     = null;  // PointLight under ego car

// ── Init Three.js ────────────────────────────────────────────────────────────

function initThree() {
  const { width: W, height: H } = canvas.getBoundingClientRect();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);
  scene.fog        = new THREE.FogExp2(0x0a0e1a, 0.018);

  // ── Camera: behind & above ego, looking forward ──
  camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 300);
  camera.position.set(0, 5.5, -12);
  camera.lookAt(0, 0.6, 12);

  // ── Lighting ──
  const ambient = new THREE.AmbientLight(0x7799cc, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(4, 12, -6);
  sun.castShadow = true;
  sun.shadow.camera.left   = -40;
  sun.shadow.camera.right  =  40;
  sun.shadow.camera.top    =  40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far    = 200;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  // Subtle front fill light
  const fill = new THREE.DirectionalLight(0x4466bb, 0.35);
  fill.position.set(0, 2, 30);
  scene.add(fill);

  // Ego underglow (blue point light close to ground, pulsing in the loop)
  egoGlow = new THREE.PointLight(0x3b82f6, 1.2, 6);
  egoGlow.position.set(0, 0.05, 0);
  scene.add(egoGlow);

  buildRoad();
  buildLaneMarkings();
}

// ── Road geometry ────────────────────────────────────────────────────────────

function buildRoad() {
  // Main asphalt surface
  const mat  = new THREE.MeshLambertMaterial({ color: 0x0d1828 });
  const geom = new THREE.PlaneGeometry(ROAD_W, 240);
  const road = new THREE.Mesh(geom, mat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, 100);
  road.receiveShadow = true;
  scene.add(road);

  // Shoulders (slightly darker)
  const shMat = new THREE.MeshLambertMaterial({ color: 0x060c15 });
  for (const side of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(10, 240), shMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(side * (ROAD_W / 2 + 5), -0.005, 100);
    scene.add(sh);
  }

  // Solid road edge lines (white)
  for (const ex of [-ROAD_W / 2, ROAD_W / 2]) {
    const pts  = [new THREE.Vector3(ex, 0.01, -20), new THREE.Vector3(ex, 0.01, 200)];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true }));
    scene.add(line);
  }
}

// ── Lane marking dashes (animated) ──────────────────────────────────────────

function buildLaneMarkings() {
  const mat      = new THREE.MeshBasicMaterial({ color: 0x556677 });
  const DASH_LEN = 3.0;
  const DASH_GAP = 5.5;
  const CYCLE    = DASH_LEN + DASH_GAP;
  const COUNT    = 22;   // dashes per divider

  for (let lane = 1; lane < NUM_LANES; lane++) {
    const lx = -ROAD_W / 2 + lane * LANE_W;
    for (let i = 0; i < COUNT; i++) {
      const geom = new THREE.BoxGeometry(0.12, 0.005, DASH_LEN);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(lx, 0.005, i * CYCLE);
      scene.add(mesh);
      dashMeshes.push({ mesh, cycle: CYCLE * COUNT });
    }
  }
}

// ── Material coloring ────────────────────────────────────────────────────────
//
// MTL material names in this OBJ:
//   White      → body paint (main)
//   Grey       → trim / underbody
//   Black      → tyres / dark trim   (keep dark)
//   Windows    → glass               (keep dark)
//   TailLights → tail-light lenses   (state-aware)
//   Headlights → headlight lenses    (keep warm)

function buildMat(color, emissiveFactor, shininess) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhongMaterial({
    color:     c,
    emissive:  c.clone().multiplyScalar(emissiveFactor),
    shininess,
    specular:  new THREE.Color(0x333333),
  });
}

function applyState(obj, state) {
  const bodyColor = COLORS[state];

  const tailColor = state === 'DANGER'  ? 0xff1111 :
                    state === 'WARNING' ? 0xff8800 :
                                         0x991111;

  obj.traverse(child => {
    if (!child.isMesh) return;
    const n = (child.material && child.material.name) || '';

    if (n === 'White') {
      child.material = buildMat(bodyColor, 0.10, 80);
    } else if (n === 'Grey') {
      // Slightly darker than body
      child.material = buildMat(
        new THREE.Color(bodyColor).multiplyScalar(0.55).getHex(),
        0.05, 40
      );
    } else if (n === 'TailLights') {
      child.material = buildMat(tailColor, 0.55, 60);
    }
    // Black, Windows, Headlights → keep original MTL materials
  });
}

// ── Load OBJ model ───────────────────────────────────────────────────────────

function loadCar() {
  const mtlLoader = new MTLLoader();
  mtlLoader.setPath('/static/assets/');
  mtlLoader.load('SportsCar2.mtl', mtl => {
    mtl.preload();

    const objLoader = new OBJLoader();
    objLoader.setMaterials(mtl);
    objLoader.setPath('/static/assets/');
    objLoader.load('SportsCar2.obj', obj => {
      // Put wheels exactly on the ground
      const box = new THREE.Box3().setFromObject(obj);
      obj.position.y -= box.min.y;

      // The OBJ front is at Z≈−2 (Blender −Y → OBJ −Z).
      // Rotate 180° so the car front faces +Z (forward travel direction).
      obj.rotation.y = Math.PI;

      obj.traverse(child => {
        if (child.isMesh) {
          child.castShadow    = true;
          child.receiveShadow = true;
        }
      });

      carTemplate = obj;

      // ── Ego vehicle (always at origin) ──────────────────────────────────
      const ego = carTemplate.clone(true);
      applyState(ego, 'EGO');
      ego.position.set(0, 0, 0);
      scene.add(ego);

      // ── Traffic vehicles ────────────────────────────────────────────────
      vehicles = VEHICLE_DEFS.map(def => {
        const mesh = carTemplate.clone(true);
        applyState(mesh, def.state);
        mesh.position.set(def.lx, 0, def.z);
        scene.add(mesh);
        return { def: { ...def }, mesh };
      });

      startLoop();
    });
  });
}

// ── Animation loop ───────────────────────────────────────────────────────────

let tick = 0;

function startLoop() {
  (function loop() {
    tick++;

    // Animate lane dash scrolling (road rushing past)
    dashMeshes.forEach(d => {
      d.mesh.position.z -= 0.14;
      if (d.mesh.position.z < -15) d.mesh.position.z += d.cycle;
    });

    // Move traffic vehicles toward camera; wrap when behind camera
    vehicles.forEach(v => {
      v.mesh.position.z -= v.def.spd;
      if (v.mesh.position.z < -13) {
        v.mesh.position.z = 55 + Math.random() * 35;
      }
    });

    // Ego underglow pulse
    egoGlow.intensity = 0.8 + 0.4 * Math.sin(tick * 0.07);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();
}

// ── Resize handler ────────────────────────────────────────────────────────────

function resize() {
  const { width: W, height: H } = canvas.getBoundingClientRect();
  renderer.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
}

// ── WebSocket (future MQTT bridge) ────────────────────────────────────────────

function applyVehicleState(data) {
  const vid   = data.vehicle_id || data.id;
  const state = (data.state || '').toUpperCase();
  if (!vid || !state || !(state in COLORS)) return;
  const v = vehicles.find(v => v.def.id === vid);
  if (v) applyState(v.mesh, state);
}

function connectWS() {
  let ws;
  try { ws = new WebSocket(`ws://${location.host}/ws`); } catch { return; }
  ws.onclose = () => setTimeout(connectWS, 4000);
  ws.onerror = () => ws.close();
  ws.onmessage = e => { try { applyVehicleState(JSON.parse(e.data)); } catch {} };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  initThree();
  loadCar();
  connectWS();
  new ResizeObserver(resize).observe(canvas);
});
