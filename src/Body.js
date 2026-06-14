import * as THREE from 'three';
import { sphereRadius, mass, schwarzschildRadius, classify } from './physics.js';

const MIN_VISUAL_RADIUS = 0.45; // para corpos minúsculos continuarem visíveis

// Cores por tipo (em hex). 'pulsar' herda visual de 'neutron' mais feixes.
const PALETTE = {
  normal: 0x4ea8ff,
  neutron: 0xbfe9ff,
  pulsar: 0xbfe9ff,
  blackhole: 0x000000,
  whitehole: 0xfff4d6,
};

export class Body {
  // params: { position:Vector3, volume, density, oscAmp, oscFreq, kind }
  // kind: 'auto' | 'normal' | 'neutron' | 'pulsar' | 'blackhole' | 'whitehole'
  constructor(params) {
    this.position = params.position.clone();
    this.volume = params.volume;
    this.density = params.density;
    this.oscAmp = params.oscAmp ?? 0;
    this.oscFreq = params.oscFreq ?? 0.4;
    this.requestedKind = params.kind ?? 'auto';

    this.mass = mass(this.volume, this.density);
    this.radius = Math.max(sphereRadius(this.volume), MIN_VISUAL_RADIUS);
    this.rs = schwarzschildRadius(this.mass);

    this._resolveKind();
    this.repulsive = this.kind === 'whitehole';

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this._build();
  }

  _resolveKind() {
    if (this.requestedKind === 'auto') {
      const c = classify(this.volume, this.density);
      // Uma estrela de neutrões a oscilar/rodar é, na prática, um pulsar.
      this.kind = (c === 'neutron' && this.oscAmp > 0.05) ? 'pulsar' : c;
    } else {
      this.kind = this.requestedKind;
    }
  }

  _build() {
    const r = this.radius;
    const color = PALETTE[this.kind] ?? PALETTE.normal;

    if (this.kind === 'blackhole') {
      // Esfera negra (horizonte de eventos) + disco de acreção brilhante.
      const horizon = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      this.group.add(horizon);

      const disk = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.9, r * 0.28, 16, 64),
        new THREE.MeshBasicMaterial({ color: 0xffae42, transparent: true, opacity: 0.9 })
      );
      disk.rotation.x = Math.PI / 2.3;
      this.group.add(disk);
      this.disk = disk;

      // Halo de luz curvada à volta do horizonte.
      this._addGlow(r * 1.25, 0x66aaff, 0.35);
    } else if (this.kind === 'whitehole') {
      // Núcleo branco intenso que "expele" — visual oposto ao buraco negro.
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      this.group.add(core);
      this._addGlow(r * 2.2, 0xfff0c0, 0.55);
    } else {
      // Estrela / planeta / estrela de neutrões / pulsar.
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: this.kind === 'normal' ? 0.5 : 1.4,
        roughness: 0.5,
        metalness: 0.0,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32), mat);
      this.group.add(sphere);
      this.sphere = sphere;
      this._addGlow(r * (this.kind === 'normal' ? 1.4 : 1.9), color, this.kind === 'normal' ? 0.18 : 0.4);

      if (this.kind === 'pulsar') {
        // Dois feixes opostos que rodam (a assinatura de um pulsar).
        this.beams = new THREE.Group();
        const beamGeo = new THREE.ConeGeometry(r * 1.1, r * 9, 24, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0xbfe9ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
        });
        const up = new THREE.Mesh(beamGeo, beamMat);
        up.position.y = r * 4.5;
        const down = up.clone();
        down.rotation.z = Math.PI;
        down.position.y = -r * 4.5;
        this.beams.add(up, down);
        this.beams.rotation.z = 0.5; // eixo magnético inclinado
        this.group.add(this.beams);
      }
    }
  }

  _addGlow(radius, color, opacity) {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 24),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, side: THREE.BackSide, depthWrite: false,
      })
    );
    this.group.add(glow);
    this.glow = glow;
  }

  // Animações próprias do corpo (rotação de feixes/disco, pulsação do brilho).
  update(time) {
    if (this.beams) this.beams.rotation.y = time * (2 + this.oscFreq * 3);
    if (this.disk) this.disk.rotation.z = time * 0.6;

    if (this.oscAmp > 0) {
      const s = 1 + 0.12 * this.oscAmp * Math.sin(2 * Math.PI * this.oscFreq * time);
      if (this.sphere) this.sphere.scale.setScalar(s);
      if (this.glow) this.glow.material.opacity =
        (this.kind === 'normal' ? 0.18 : 0.4) * (0.7 + 0.5 * Math.abs(Math.sin(2 * Math.PI * this.oscFreq * time)));
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
