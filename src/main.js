import * as THREE from 'three';
import { SpaceGrid } from './SpaceGrid.js';
import { Body } from './Body.js';
import { Controls } from './Controls.js';
import { UI } from './UI.js';
import { SIM, integrate, orbitalVelocity, findMerge } from './Simulation.js';

const SPAWN_DISTANCE = 14;     // distância à frente da câmara onde nasce o corpo
let gridSize = 256;            // alcance/raio de renderização da grelha (ajustável no menu)

// Nevoeiro linear afinado ao tamanho da grelha: esconde os bordos do cubo para
// a rede parecer infinita (as linhas distantes dissolvem-se no fundo).
function fogRange(size) { return { near: size * 0.15, far: size * 0.46 }; }

// --- Renderer / cena / câmara ---------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);
const fog0 = fogRange(gridSize);
scene.fog = new THREE.Fog(0x05060d, fog0.near, fog0.far);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 8, gridSize * 0.8);

// Luzes (os corpos são em grande parte emissivos, mas isto dá relevo às esferas).
scene.add(new THREE.AmbientLight(0x404a6b, 1.2));
const keyLight = new THREE.PointLight(0xffffff, 0.6, 0);
keyLight.position.set(30, 40, 30);
scene.add(keyLight);

// Campo de estrelas de fundo (segue a câmara, como um skybox).
const starfield = addStarfield();

// Grelha 3D (valores iniciais coincidem com as predefinições do menu).
const grid = new SpaceGrid({
  size: gridSize, divisions: 15,
  calmColor: '#2e8cd9', hotColor: '#ff2f93', colorScale: 11, opacity: 0.5,
});
scene.add(grid.object);

// --- Estado ----------------------------------------------------------------
const bodies = [];
const sim = { enabled: true, gravity: 0.8, speed: 1, autoOrbit: true, merge: true };
const ui = new UI();
const controls = new Controls(camera, canvas);

// --- Spawn -----------------------------------------------------------------
function spawnBody() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = camera.position.clone().addScaledVector(dir, SPAWN_DISTANCE);

  const t = ui.getTemplate();
  const body = new Body({ position: pos, ...t });

  // Velocidade orbital automática à volta da massa dominante (com recuo no
  // centro para conservar o momento — o "sol" não foge).
  if (sim.enabled && sim.autoOrbit) {
    const orb = orbitalVelocity(pos, bodies);
    if (orb) {
      body.velocity.copy(orb.velocity);
      orb.center.velocity.addScaledVector(orb.tangential, -body.mass / orb.center.mass);
    }
  }

  bodies.push(body);
  scene.add(body.group);
  ui.setBodyCount(bodies.length);
}

function clearAll() {
  for (const b of bodies) { scene.remove(b.group); b.dispose(); }
  bodies.length = 0;
  ui.setBodyCount(0);
}

function undo() {
  const b = bodies.pop();
  if (b) { scene.remove(b.group); b.dispose(); ui.setBodyCount(bodies.length); }
}

// Funde dois corpos em colisão (acreção): conserva massa e momento.
function mergeStep() {
  const pair = findMerge(bodies);
  if (!pair) return;
  const [i, j] = pair; // j > i
  const a = bodies[i];
  const b = bodies[j];
  const m = a.mass + b.mass;
  const volume = a.volume + b.volume;
  const density = m / volume;
  const big = a.mass >= b.mass ? a : b;
  const position = a.position.clone().multiplyScalar(a.mass)
    .addScaledVector(b.position, b.mass).multiplyScalar(1 / m);
  const velocity = a.velocity.clone().multiplyScalar(a.mass)
    .addScaledVector(b.velocity, b.mass).multiplyScalar(1 / m);
  const kind = (a.kind === 'blackhole' || b.kind === 'blackhole') ? 'blackhole' : 'auto';

  scene.remove(a.group); a.dispose();
  scene.remove(b.group); b.dispose();
  bodies.splice(j, 1);
  bodies.splice(i, 1);

  const merged = new Body({ position, volume, density, oscAmp: big.oscAmp, oscFreq: big.oscFreq, kind });
  merged.velocity.copy(velocity);
  bodies.push(merged);
  scene.add(merged.group);
  ui.setBodyCount(bodies.length);
}

// Remove corpos que escaparam para muito longe da câmara (mundo infinito).
function cleanupFar() {
  const limit = gridSize * 5;
  let removed = false;
  for (let i = bodies.length - 1; i >= 0; i--) {
    if (bodies[i].position.distanceTo(camera.position) > limit) {
      const b = bodies[i];
      scene.remove(b.group); b.dispose();
      bodies.splice(i, 1);
      removed = true;
    }
  }
  if (removed) ui.setBodyCount(bodies.length);
}

// --- Definições da grelha --------------------------------------------------
function applyGrid(s, rebuild) {
  if (rebuild) {
    gridSize = s.size;
    grid.rebuild(s.size, s.divisions);
    const f = fogRange(gridSize);
    scene.fog.near = f.near;
    scene.fog.far = f.far;
  }
  grid.setColors(s.calmColor, s.hotColor);
  grid.setColorScale(s.colorScale);
  grid.setOpacity(s.opacity);
  grid.setFollow(s.follow);
  scene.background.set(s.bgColor);
  scene.fog.color.set(s.bgColor);
}
ui.onGridChange = applyGrid;
// Sincroniza a cena com as definições guardadas (ou predefinições) ao arrancar.
applyGrid(ui.getGridSettings(), true);

// --- Definições da simulação -----------------------------------------------
function applySim(s) {
  sim.enabled = s.enabled;
  sim.gravity = s.gravity;
  sim.speed = s.speed;
  sim.autoOrbit = s.autoOrbit;
  sim.merge = s.merge;
  SIM.G = s.gravity;
}
ui.onSimChange = applySim;
ui.onClearVelocities = () => { for (const b of bodies) b.velocity.set(0, 0, 0); };
applySim(ui.getSimSettings());

// --- Ligações de controlo --------------------------------------------------
controls.onSpawn = spawnBody;
controls.onClearAll = clearAll;
controls.onUndo = undo;
controls.onTogglePause = () => ui.toggleSim();
controls.onToggleMenu = () => {
  if (ui.isOpen) {
    ui.close();
  } else {
    controls.unlock();
    overlay.classList.add('hidden'); // não deixar o overlay tapar o menu
    ui.open();
  }
};
// Ao fechar o menu sem o rato capturado, voltar a mostrar o "clica para começar".
ui.onClose = () => { if (!controls.locked) overlay.classList.remove('hidden'); };

// Overlay inicial.
const overlay = document.getElementById('overlay');
document.getElementById('start-btn').addEventListener('click', () => controls.lock());
canvas.addEventListener('click', () => { if (!controls.locked && !ui.isOpen) controls.lock(); });

document.addEventListener('pointerlockchange', () => {
  overlay.classList.toggle('hidden', controls.locked || ui.isOpen);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Loop de animação ------------------------------------------------------
const clock = new THREE.Clock();
let fpsAccum = 0, fpsFrames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  controls.update(dt);
  if (sim.enabled) {
    integrate(bodies, dt * sim.speed);
    if (sim.merge) mergeStep();
    cleanupFar();
  }
  grid.update(bodies, time, camera.position);
  starfield.position.copy(camera.position);
  for (const b of bodies) b.update(time);

  renderer.render(scene, camera);

  // HUD
  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) {
    ui.setFps(fpsFrames / fpsAccum);
    ui.setPosition(camera.position);
    fpsAccum = 0; fpsFrames = 0;
  }
}
animate();

// --- Estrelas ---------------------------------------------------------------
function addStarfield() {
  const n = 1500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 120 + Math.random() * 180;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // fog: false para as estrelas não desaparecerem com o nevoeiro da grelha.
  const mat = new THREE.PointsMaterial({ color: 0x9fb4e8, size: 0.7, sizeAttenuation: true, fog: false });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
}
