import * as THREE from 'three';

// Câmara em primeira pessoa do tipo "fly": WASD move ao longo do olhar,
// Espaço/Shift sobe/desce, rato olha (com pointer lock).
export class Controls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;

    this.speed = 22;          // unidades por segundo
    this.lookSensitivity = 0.0022;
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;

    this.keys = { w: false, a: false, s: false, d: false, up: false, down: false };

    // Callbacks definidos a partir do main.js
    this.onSpawn = null;        // clique para criar corpo
    this.onToggleMenu = null;   // tecla E
    this.onClearAll = null;     // tecla R
    this.onUndo = null;         // tecla Z
    this.onTogglePause = null;  // tecla P

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    this._bind();
  }

  _bind() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.lookSensitivity;
      this.pitch -= e.movementY * this.lookSensitivity;
      const lim = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
      this._applyRotation();
    });

    this.dom.addEventListener('mousedown', (e) => {
      if (this.locked && e.button === 0 && this.onSpawn) this.onSpawn();
    });

    document.addEventListener('keydown', (e) => this._onKey(e, true));
    document.addEventListener('keyup', (e) => this._onKey(e, false));
  }

  _onKey(e, down) {
    switch (e.code) {
      case 'KeyW': this.keys.w = down; break;
      case 'KeyA': this.keys.a = down; break;
      case 'KeyS': this.keys.s = down; break;
      case 'KeyD': this.keys.d = down; break;
      case 'Space': this.keys.up = down; if (down) e.preventDefault(); break;
      case 'ShiftLeft':
      case 'ShiftRight': this.keys.down = down; break;
      case 'KeyE': if (down && this.onToggleMenu) this.onToggleMenu(); break;
      case 'KeyR': if (down && this.onClearAll) this.onClearAll(); break;
      case 'KeyZ': if (down && this.onUndo) this.onUndo(); break;
      case 'KeyP': if (down && this.onTogglePause) this.onTogglePause(); break;
    }
  }

  lock() { this.dom.requestPointerLock(); }
  unlock() { document.exitPointerLock(); }

  _applyRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  update(dt) {
    if (!this.locked) return;

    this.camera.getWorldDirection(this._forward);
    this._right.crossVectors(this._forward, this._worldUp).normalize();

    const v = this.speed * dt;
    const move = new THREE.Vector3();
    if (this.keys.w) move.addScaledVector(this._forward, v);
    if (this.keys.s) move.addScaledVector(this._forward, -v);
    if (this.keys.d) move.addScaledVector(this._right, v);
    if (this.keys.a) move.addScaledVector(this._right, -v);
    if (this.keys.up) move.addScaledVector(this._worldUp, v);
    if (this.keys.down) move.addScaledVector(this._worldUp, -v);

    this.camera.position.add(move);
  }
}
