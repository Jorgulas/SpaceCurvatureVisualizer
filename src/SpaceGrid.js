import * as THREE from 'three';
import { displacedPosition } from './physics.js';

// Rede 3D de linhas (lattice) que se deforma sob a gravidade dos corpos.
// É um único objeto LineSegments cujos vértices recalculamos a cada frame.
export class SpaceGrid {
  constructor({ size = 48, divisions = 15 } = {}) {
    this.size = size;        // dimensão do cubo (unidades)
    this.N = divisions;      // nós por eixo
    this._base = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._build();
  }

  _index(i, j, k) {
    const N = this.N;
    return (i * N + j) * N + k;
  }

  _build() {
    const N = this.N;
    const size = this.size;
    const step = size / (N - 1);
    const half = size / 2;
    const count = N * N * N;

    // Posições de repouso e posições deslocadas de cada nó.
    this.nodeBase = new Float32Array(count * 3);
    this.nodeDisp = new Float32Array(count * 3);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        for (let k = 0; k < N; k++) {
          const o = this._index(i, j, k) * 3;
          this.nodeBase[o] = -half + i * step;
          this.nodeBase[o + 1] = -half + j * step;
          this.nodeBase[o + 2] = -half + k * step;
        }
      }
    }
    this.nodeDisp.set(this.nodeBase);

    // Segmentos: ligam nós vizinhos ao longo de x, y e z.
    const segNodes = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        for (let k = 0; k < N; k++) {
          const a = this._index(i, j, k);
          if (i < N - 1) segNodes.push(a, this._index(i + 1, j, k));
          if (j < N - 1) segNodes.push(a, this._index(i, j + 1, k));
          if (k < N - 1) segNodes.push(a, this._index(i, j, k + 1));
        }
      }
    }
    this.vertexToNode = Int32Array.from(segNodes);
    const vCount = this.vertexToNode.length;

    this.positions = new Float32Array(vCount * 3);
    this.colors = new Float32Array(vCount * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
    });
    this.geometry = geo;
    this.object = new THREE.LineSegments(geo, mat);

    this._writeVertices();
  }

  // Recalcula a deformação de todos os nós e atualiza a geometria.
  update(bodies, time) {
    const nb = this.nodeBase;
    const nd = this.nodeDisp;
    const count = nb.length / 3;
    const base = this._base;
    const tmp = this._tmp;

    for (let n = 0; n < count; n++) {
      const o = n * 3;
      base.set(nb[o], nb[o + 1], nb[o + 2]);
      displacedPosition(base, bodies, time, tmp);
      nd[o] = tmp.x;
      nd[o + 1] = tmp.y;
      nd[o + 2] = tmp.z;
    }
    this._writeVertices();
  }

  _writeVertices() {
    const v2n = this.vertexToNode;
    const pos = this.positions;
    const col = this.colors;
    const nd = this.nodeDisp;
    const nb = this.nodeBase;

    for (let v = 0; v < v2n.length; v++) {
      const n = v2n[v];
      const no = n * 3;
      const vo = v * 3;
      pos[vo] = nd[no];
      pos[vo + 1] = nd[no + 1];
      pos[vo + 2] = nd[no + 2];

      // Cor por magnitude de deslocamento: ciano (calmo) -> magenta (intenso).
      const dx = nd[no] - nb[no];
      const dy = nd[no + 1] - nb[no + 1];
      const dz = nd[no + 2] - nb[no + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const t = Math.min(d / 11, 1);
      col[vo] = 0.18 + 0.82 * t;          // R
      col[vo + 1] = 0.55 * (1 - t) + 0.08; // G
      col[vo + 2] = 0.85 * (1 - t) + 0.45 * t; // B
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
