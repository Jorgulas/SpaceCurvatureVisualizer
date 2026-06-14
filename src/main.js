import * as THREE from 'three';
import { SpaceGrid } from './SpaceGrid.js';
import { Body } from './Body.js';
import { Controls } from './Controls.js';
import { UI } from './UI.js';

const SPAWN_DISTANCE = 14;     // distância à frente da câmara onde nasce o corpo
let gridSize = 48;             // alcance atual da grelha (ajustável no menu)
let spawnBound = gridSize / 2 - 2;

// --- Renderer / cena / câmara ---------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);
scene.fog = new THREE.FogExp2(0x05060d, 0.0065);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 8, gridSize * 0.8);

// Luzes (os corpos são em grande parte emissivos, mas isto dá relevo às esferas).
scene.add(new THREE.AmbientLight(0x404a6b, 1.2));
const keyLight = new THREE.PointLight(0xffffff, 0.6, 0);
keyLight.position.set(30, 40, 30);
scene.add(keyLight);

// Campo de estrelas de fundo.
addStarfield();

// Grelha 3D (valores iniciais coincidem com as predefinições do menu).
const grid = new SpaceGrid({
  size: gridSize, divisions: 15,
  calmColor: '#2e8cd9', hotColor: '#ff2f93', colorScale: 11, opacity: 0.5,
});
scene.add(grid.object);

// Caixa subtil a delimitar a região (reconstruída quando o alcance muda).
const boundaryMat = new THREE.LineBasicMaterial({ color: 0x1c2a4a, transparent: true, opacity: 0.5 });
const boundary = new THREE.LineSegments(new THREE.BufferGeometry(), boundaryMat);
scene.add(boundary);

function rebuildBoundary() {
  boundary.geometry.dispose();
  boundary.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(gridSize, gridSize, gridSize));
}
rebuildBoundary();

// --- Estado ----------------------------------------------------------------
const bodies = [];
const ui = new UI();
const controls = new Controls(camera, canvas);

// --- Spawn -----------------------------------------------------------------
function spawnBody() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = camera.position.clone().addScaledVector(dir, SPAWN_DISTANCE);

  // Manter dentro da região da grelha.
  pos.clampScalar(-spawnBound, spawnBound);

  const t = ui.getTemplate();
  const body = new Body({ position: pos, ...t });
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

// --- Definições da grelha --------------------------------------------------
function applyGrid(s, rebuild) {
  if (rebuild) {
    gridSize = s.size;
    spawnBound = gridSize / 2 - 2;
    grid.rebuild(s.size, s.divisions);
    rebuildBoundary();
  }
  grid.setColors(s.calmColor, s.hotColor);
  grid.setColorScale(s.colorScale);
  grid.setOpacity(s.opacity);
  scene.background.set(s.bgColor);
  scene.fog.color.set(s.bgColor);
  boundary.visible = s.showBoundary;
}
ui.onGridChange = applyGrid;
// Sincroniza a cena com as definições guardadas (ou predefinições) ao arrancar.
applyGrid(ui.getGridSettings(), true);

// --- Ligações de controlo --------------------------------------------------
controls.onSpawn = spawnBody;
controls.onClearAll = clearAll;
controls.onUndo = undo;
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
  grid.update(bodies, time);
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
  const mat = new THREE.PointsMaterial({ color: 0x9fb4e8, size: 0.7, sizeAttenuation: true });
  scene.add(new THREE.Points(geo, mat));
}
