import * as THREE from 'three';

// Simulação gravítica de N-corpos (Newton) em unidades visuais.
// G aqui é independente do Gvis (deformação da grelha) e do G de Schwarzschild.
export const SIM = {
  G: 0.8,          // intensidade da gravidade dinâmica (órbitas)
  softening: 1.5,  // suaviza a força a curta distância (evita acelerações infinitas)
  maxSpeed: 80,    // limite de velocidade (estabilidade numérica)
  substeps: 6,     // sub-passos de integração por frame
};

const _d = new THREE.Vector3();
let _acc = [];

// Integra velocidades e posições (Euler semi-implícito, simplético) com sub-passos.
export function integrate(bodies, dt) {
  const n = bodies.length;
  if (n < 1 || dt <= 0) return;

  if (_acc.length < n) {
    _acc = [];
    for (let i = 0; i < n; i++) _acc.push(new THREE.Vector3());
  }

  const sub = SIM.substeps;
  const h = dt / sub;
  const soft2 = SIM.softening * SIM.softening;

  for (let s = 0; s < sub; s++) {
    for (let i = 0; i < n; i++) _acc[i].set(0, 0, 0);

    // Acelerações par a par.
    for (let i = 0; i < n; i++) {
      const bi = bodies[i];
      for (let j = i + 1; j < n; j++) {
        const bj = bodies[j];
        _d.subVectors(bj.position, bi.position);
        const r2 = _d.lengthSq() + soft2;
        const inv = 1 / (r2 * Math.sqrt(r2)); // 1 / r³
        // Buracos brancos repelem (gravidade hipotética negativa).
        const repel = (bi.repulsive || bj.repulsive) ? -1 : 1;
        _acc[i].addScaledVector(_d, repel * SIM.G * bj.mass * inv);
        _acc[j].addScaledVector(_d, -repel * SIM.G * bi.mass * inv);
      }
    }

    // Atualiza velocidade e posição.
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      b.velocity.addScaledVector(_acc[i], h);
      const sp = b.velocity.length();
      if (sp > SIM.maxSpeed) b.velocity.multiplyScalar(SIM.maxSpeed / sp);
      b.position.addScaledVector(b.velocity, h);
      b.group.position.copy(b.position);
    }
  }
}

// Velocidade inicial para uma órbita ~circular à volta da massa dominante.
// Devolve { center, velocity, tangential } ou null se não houver à volta de quê orbitar.
export function orbitalVelocity(pos, bodies) {
  let center = null;
  let bestMass = 0;
  for (const b of bodies) {
    if (!b.repulsive && b.mass > bestMass) { bestMass = b.mass; center = b; }
  }
  if (!center) return null;

  const r = new THREE.Vector3().subVectors(pos, center.position);
  const dist = r.length();
  if (dist < 1e-3) return null;

  const speed = Math.sqrt((SIM.G * center.mass) / dist);

  // Tangente: perpendicular a r e a um eixo de referência.
  const tangential = new THREE.Vector3().crossVectors(r, new THREE.Vector3(0, 1, 0));
  if (tangential.lengthSq() < 1e-6) tangential.crossVectors(r, new THREE.Vector3(1, 0, 0));
  tangential.normalize().multiplyScalar(speed);

  // Velocidade absoluta = a do centro + a tangencial (orbita um centro em movimento).
  const velocity = tangential.clone().add(center.velocity);
  return { center, velocity, tangential };
}

// Pares de corpos suficientemente próximos para fundir (acreção).
export function findMerge(bodies) {
  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j];
      if (bi.repulsive || bj.repulsive) continue; // buracos brancos não fundem
      const reach = (bi.radius + bj.radius) * 0.7;
      if (bi.position.distanceTo(bj.position) < reach) return [i, j];
    }
  }
  return null;
}
