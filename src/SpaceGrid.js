import * as THREE from 'three';
import { displacedPosition } from './physics.js';

// Rede 3D de linhas (lattice) que se deforma sob a gravidade dos corpos.
// É um único objeto LineSegments cujos vértices recalculamos a cada frame.
// O tamanho, número de divisões, cores e opacidade são configuráveis.
export class SpaceGrid {
  constructor({
    size = 48,
    divisions = 15,
    calmColor = '#2e8cd9',
    hotColor = '#ff2f93',
    colorScale = 11,   // deslocamento (unidades) a que a cor satura
    opacity = 0.5,
  } = {}) {
    this.size = size;
    this.N = divisions;
    this.calm = new THREE.Color(calmColor);
    this.hot = new THREE.Color(hotColor);
    this.colorScale = colorScale;
    this.follow = true; // a rede segue a câmara (parece infinita)

    this._base = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._cx = 0; this._cy = 0; this._cz = 0; // centro atual da rede

    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
    });
    this.object = new THREE.LineSegments(new THREE.BufferGeometry(), this.material);

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

    if (this.geometry) this.geometry.dispose();
    this.geometry = geo;
    this.object.geometry = geo;

    this._writeVertices();
  }

  // Reconstrói a grelha com novo tamanho / número de divisões.
  rebuild(size, divisions) {
    this.size = size;
    this.N = divisions;
    this._build();
  }

  get nodeCount() { return this.nodeBase.length / 3; }

  setColors(calmHex, hotHex) {
    this.calm.set(calmHex);
    this.hot.set(hotHex);
    this._writeVertices();
  }
  setColorScale(v) { this.colorScale = v; this._writeVertices(); }
  setOpacity(v) { this.material.opacity = v; }
  setFollow(b) { this.follow = b; }

  // Recalcula a deformação de todos os nós e atualiza a geometria.
  // `cameraPos` (opcional) faz a rede seguir a câmara, para parecer infinita.
  update(bodies, time, cameraPos) {
    const nb = this.nodeBase;
    const nd = this.nodeDisp;
    const count = nb.length / 3;
    const base = this._base;
    const tmp = this._tmp;

    // Centro da rede encaixado no passo: as linhas ficam fixas no espaço-mundo
    // (não tremem) e a janela renderizada desliza sobre uma rede "infinita".
    let cx = 0, cy = 0, cz = 0;
    if (this.follow && cameraPos) {
      const step = this.size / (this.N - 1);
      cx = Math.round(cameraPos.x / step) * step;
      cy = Math.round(cameraPos.y / step) * step;
      cz = Math.round(cameraPos.z / step) * step;
    }
    this._cx = cx; this._cy = cy; this._cz = cz;

    for (let n = 0; n < count; n++) {
      const o = n * 3;
      base.set(nb[o] + cx, nb[o + 1] + cy, nb[o + 2] + cz);
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
    const calm = this.calm;
    const hot = this.hot;
    const scale = this.colorScale;

    for (let v = 0; v < v2n.length; v++) {
      const n = v2n[v];
      const no = n * 3;
      const vo = v * 3;
      pos[vo] = nd[no];
      pos[vo + 1] = nd[no + 1];
      pos[vo + 2] = nd[no + 2];

      // Cor por magnitude de deslocamento: cor "calma" -> cor "intensa".
      const dx = nd[no] - (nb[no] + this._cx);
      const dy = nd[no + 1] - (nb[no + 1] + this._cy);
      const dz = nd[no + 2] - (nb[no + 2] + this._cz);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const t = Math.min(d / scale, 1);
      col[vo] = calm.r + (hot.r - calm.r) * t;
      col[vo + 1] = calm.g + (hot.g - calm.g) * t;
      col[vo + 2] = calm.b + (hot.b - calm.b) * t;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
