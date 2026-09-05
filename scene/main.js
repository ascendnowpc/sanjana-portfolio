import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Placement. Image-to-3D models each return their own scale and origin, so
// every one of these is expected to need a pass of tuning once the real meshes
// land. Heights are metres, with the floor at y = 0.
// ---------------------------------------------------------------------------
const FIGURE_HEIGHT = 1.68;   // girl, feet to crown
const MOUTH_HEIGHT  = 1.55;   // drives the mic height

const PLACEMENT = {
  girl: {
    file: 'assets/girl.glb',
    fitHeight: FIGURE_HEIGHT,
    ground: true,               // stands on the floor
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  guitar: {
    file: 'assets/guitar.glb',
    fitHeight: 1.02,            // full body+neck length of the double-neck
    ground: false,              // hangs on a strap, so centred on its own origin
    // Worn on a strap: body sits at the right hip, neck rides up to the left
    // shoulder. Pushed forward in z so it hangs off the chest, not inside it.
    position: [0.10, 0.98, 0.20],
    rotation: [THREE.MathUtils.degToRad(-8), 0, THREE.MathUtils.degToRad(58)],
  },
  mic: {
    file: 'assets/mic.glb',
    fitHeight: MOUTH_HEIGHT + 0.06,  // stand base to capsule
    ground: true,                    // stand foot on the floor
    position: [0, 0, 0.46],          // in front of her
    rotation: [0, THREE.MathUtils.degToRad(180), 0],
  },
};

const TURNTABLE_RPM = 2.2;

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);
scene.fog = new THREE.Fog(0x07070a, 4.5, 11);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0.9, 1.55, 3.1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.02, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.2;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 0.52;

// ---------------------------------------------------------------------------
// Stage lighting — warm key front-left, cool rim behind, dark surround
// ---------------------------------------------------------------------------
const key = new THREE.SpotLight(0xffd9a8, 46, 14, THREE.MathUtils.degToRad(34), 0.45, 1.6);
key.position.set(-2.1, 3.0, 2.6);
key.target.position.set(0, 1.25, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0012;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

const rim = new THREE.SpotLight(0x9fc4ff, 30, 14, THREE.MathUtils.degToRad(42), 0.6, 1.6);
rim.position.set(1.7, 2.9, -2.7);
rim.target.position.set(0, 1.3, 0);
scene.add(rim, rim.target);

// Low warm bounce off the stage floor, so shadowed sides don't go to pure black.
const fill = new THREE.PointLight(0xffb98a, 5.5, 7, 2);
fill.position.set(1.1, 0.35, 1.5);
scene.add(fill);

scene.add(new THREE.HemisphereLight(0x3a4358, 0x0a0a0d, 0.35));

// Floor: dark, faintly reflective-looking, catches the key light's shadow.
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(9, 96),
  new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.72, metalness: 0.12 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ---------------------------------------------------------------------------
// Loading. A missing GLB becomes a labelled wireframe proxy of the right size,
// so framing and lighting stay checkable before the meshes exist.
// ---------------------------------------------------------------------------
const turntable = new THREE.Group();
scene.add(turntable);

const proxies = [];
const loader = new GLTFLoader();
const statusEl = document.getElementById('status');
const status = {};

function report() {
  statusEl.innerHTML = Object.entries(PLACEMENT).map(([name]) => {
    const s = status[name] ?? { text: 'loading…', cls: '' };
    return `<div class="row"><span>${name}</span><span class="${s.cls}">${s.text}</span></div>`;
  }).join('');
}
report();

/**
 * Uniformly scale an object to `fitHeight` tall and centre it on x/z.
 * `ground` puts its base on y = 0; otherwise it is centred on y too, which is
 * what a strap-hung part wants so its holder can position it directly.
 */
function fitTo(object3d, fitHeight, ground) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0) {
    const s = fitHeight / size.y;
    object3d.scale.multiplyScalar(s);
  }
  const fitted = new THREE.Box3().setFromObject(object3d);
  const centre = fitted.getCenter(new THREE.Vector3());
  object3d.position.x -= centre.x;
  object3d.position.z -= centre.z;
  object3d.position.y -= ground ? fitted.min.y : centre.y;
  return object3d;
}

function makeProxy(name, cfg) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x4a4f63, wireframe: true });
  if (name === 'girl') {
    const h = cfg.fitHeight;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, h * 0.52, 6, 14), mat);
    body.position.y = h * 0.52;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), mat);
    head.position.y = h * 0.93;
    g.add(body, head);
  } else if (name === 'guitar') {
    // Centred on its own origin, matching cfg.ground === false.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.06), mat);
    body.position.y = -0.24;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.04), mat);
    neck.position.y = 0.26;
    g.add(body, neck);
  } else {
    const h = cfg.fitHeight;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, h, 10), mat);
    pole.position.y = h / 2;
    const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 12), mat);
    capsule.position.y = h;
    g.add(pole, capsule);
  }
  proxies.push(g);
  return g;
}

function place(object3d, cfg) {
  const holder = new THREE.Group();
  holder.add(object3d);
  holder.position.fromArray(cfg.position);
  holder.rotation.fromArray(cfg.rotation);
  turntable.add(holder);
}

function loadPart(name, cfg) {
  loader.load(
    cfg.file,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      fitTo(model, cfg.fitHeight, cfg.ground);
      place(model, cfg);
      const tris = countTriangles(model);
      status[name] = { text: `${tris.toLocaleString()} tris`, cls: 'ok' };
      report();
    },
    undefined,
    () => {
      place(makeProxy(name, cfg), cfg);
      status[name] = { text: 'missing — proxy', cls: 'miss' };
      report();
    },
  );
}

function countTriangles(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry;
    n += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
  });
  return Math.round(n);
}

for (const [name, cfg] of Object.entries(PLACEMENT)) loadPart(name, cfg);

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let spinning = true;
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { spinning = !spinning; e.preventDefault(); }
  if (e.code === 'KeyP') proxies.forEach((p) => { p.visible = !p.visible; });
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (spinning) turntable.rotation.y += dt * (TURNTABLE_RPM * Math.PI * 2) / 60;
  controls.update();
  renderer.render(scene, camera);
});

// Expose for tuning from the console.
Object.assign(globalThis, { scene, camera, turntable, PLACEMENT });
