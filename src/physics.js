// physics.js — modelo físico "de brincar" em unidades visuais.
// Não usamos as constantes do SI (G real = 6.674e-11) porque a cena vive em
// unidades arbitrárias; escolhemos constantes que produzem deformações bonitas
// e que ainda assim respeitam as RELAÇÕES físicas reais (M = ρV, R_s = 2GM/c²).

export const PHYS = {
  Gvis: 0.06,        // intensidade da DEFORMAÇÃO visual da grelha
  G: 1.2,            // G usado na classificação (raio de Schwarzschild)
  c: 60,             // "velocidade da luz" em unidades visuais (limite de Schwarzschild)
  softening: 0.6,    // evita a singularidade 1/r quando o nó está sobre o corpo
  maxPullFrac: 0.92, // um nó nunca se desloca mais do que esta fração da distância ao corpo
};

// Raio de uma esfera com um dado volume: V = (4/3)·π·r³  =>  r = ∛(3V/4π)
export function sphereRadius(volume) {
  return Math.cbrt((3 * volume) / (4 * Math.PI));
}

// Massa = densidade × volume
export function mass(volume, density) {
  return volume * density;
}

// Raio de Schwarzschild: tamanho a que a massa teria de ser comprimida para
// se tornar um buraco negro. R_s = 2·G·M / c²
export function schwarzschildRadius(m) {
  return (2 * PHYS.G * m) / (PHYS.c * PHYS.c);
}

// Compacidade = R_s / R_corpo. Quão perto está o corpo de colapsar.
//   C >= 1   -> a matéria está dentro do seu horizonte de eventos = buraco negro
//   C ~ 0.3+ -> regime de estrela de neutrões (extremamente densa)
export function compactness(volume, density) {
  const R = sphereRadius(volume);
  const M = mass(volume, density);
  return schwarzschildRadius(M) / R;
}

// Classificação automática a partir do volume + densidade.
export function classify(volume, density) {
  const C = compactness(volume, density);
  if (C >= 1) return 'blackhole';
  if (C >= 0.3) return 'neutron';
  return 'normal';
}

// Calcula a posição deslocada de um nó da grelha sob a influência de todos os
// corpos. `base` e `out` são THREE.Vector3. Soma o "puxão" de cada corpo.
export function displacedPosition(base, bodies, time, out) {
  let dx = 0, dy = 0, dz = 0;
  let minR = Infinity; // distância ao corpo mais próximo

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const rx = base.x - b.position.x;
    const ry = base.y - b.position.y;
    const rz = base.z - b.position.z;
    let r = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (r < 1e-4) r = 1e-4;
    if (r < minR) minR = r;

    // Profundidade do poço gravítico (cresce perto da massa, decai com a distância).
    let pull = (PHYS.Gvis * b.mass) / (r + PHYS.softening);

    // Oscilação gravítica: modula a profundidade do poço ao longo do tempo
    // (analogia simplificada a pulsações / ondas gravitacionais).
    if (b.oscAmp > 0) {
      const phase = 2 * Math.PI * b.oscFreq * time;
      pull *= (1 + b.oscAmp * Math.sin(phase));
    }

    // Não deixar o nó atravessar o centro do corpo.
    const cap = r * PHYS.maxPullFrac;
    if (pull > cap) pull = cap;

    // Sinal: corpos normais ATRAEM (puxam o nó para si); o buraco branco REPELE.
    const sign = b.repulsive ? -1 : 1;
    const f = (sign * pull) / r;        // fator radial
    dx += f * (-rx);                    // deslocamento em direção (ou contra) o corpo
    dy += f * (-ry);
    dz += f * (-rz);

    // Ondulação radial viajante (onda gravitacional) — só quando há oscilação.
    if (b.oscAmp > 0) {
      const k = 0.55;                                   // número de onda
      const w = 2 * Math.PI * b.oscFreq;                // frequência angular
      const env = Math.exp(-r * 0.04);                  // envelope que decai com r
      const wave = b.oscAmp * 1.4 * env * Math.sin(k * r - w * time);
      const g = wave / r;
      dx += g * rx;                                     // ao longo do raio (para fora)
      dy += g * ry;
      dz += g * rz;
    }
  }

  // Limite global: a soma dos puxões de vários corpos não pode lançar o nó
  // para lá do corpo mais próximo (evita "picos" que rasgam a grelha).
  if (minR !== Infinity) {
    const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const limit = 0.9 * minR;
    if (mag > limit && mag > 0) {
      const s = limit / mag;
      dx *= s; dy *= s; dz *= s;
    }
  }

  out.set(base.x + dx, base.y + dy, base.z + dz);
}
