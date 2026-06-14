import { mass, sphereRadius, schwarzschildRadius, compactness, classify } from './physics.js';

// Predefinições: preenchem os sliders e fixam o tipo do corpo.
const PRESETS = {
  planeta:       { volume: 40,  density: 4,   oscAmp: 0,    oscFreq: 0.4, kind: 'auto' },
  estrela:       { volume: 130, density: 2,   oscAmp: 0.08, oscFreq: 0.3, kind: 'normal' },
  ana_branca:    { volume: 10,  density: 70,  oscAmp: 0,    oscFreq: 0.4, kind: 'neutron' },
  pulsar:        { volume: 4,   density: 240, oscAmp: 0.6,  oscFreq: 1.8, kind: 'pulsar' },
  buraco_negro:  { volume: 3,   density: 900, oscAmp: 0,    oscFreq: 0.4, kind: 'blackhole' },
  buraco_branco: { volume: 8,   density: 90,  oscAmp: 0.3,  oscFreq: 0.7, kind: 'whitehole' },
};

const KIND_LABEL = {
  normal: 'Corpo normal (planeta/estrela)',
  neutron: 'Estrela de neutrões',
  pulsar: 'Pulsar',
  blackhole: 'Buraco negro',
  whitehole: 'Buraco branco (hipotético)',
};

// Determina o tipo efetivo de um corpo a partir da predefinição escolhida e dos
// parâmetros. 'auto' deriva da compacidade (e vira pulsar se a estrela de
// neutrões estiver a oscilar); qualquer outro preset força o tipo.
function resolveKind(presetKind, volume, density, oscAmp) {
  if (presetKind && presetKind !== 'auto') return presetKind;
  const c = classify(volume, density);
  return (c === 'neutron' && oscAmp > 0.05) ? 'pulsar' : c;
}

export class UI {
  constructor() {
    this.el = {
      menu: document.getElementById('menu'),
      preset: document.getElementById('p-preset'),
      volume: document.getElementById('p-volume'),
      density: document.getElementById('p-density'),
      oscamp: document.getElementById('p-oscamp'),
      oscfreq: document.getElementById('p-oscfreq'),
      oVolume: document.getElementById('o-volume'),
      oDensity: document.getElementById('o-density'),
      oOscamp: document.getElementById('o-oscamp'),
      oOscfreq: document.getElementById('o-oscfreq'),
      rMass: document.getElementById('r-mass'),
      rRadius: document.getElementById('r-radius'),
      rRs: document.getElementById('r-rs'),
      rComp: document.getElementById('r-comp'),
      rClass: document.getElementById('r-class'),
      close: document.getElementById('menu-close'),
      hudBodies: document.getElementById('hud-bodies'),
      hudPos: document.getElementById('hud-pos'),
      hudFps: document.getElementById('hud-fps'),
    };

    this.onClose = null; // callback quando o menu fecha
    this._bind();
    this._refresh();
  }

  _bind() {
    [this.el.volume, this.el.density, this.el.oscamp, this.el.oscfreq].forEach((inp) =>
      inp.addEventListener('input', () => this._refresh())
    );

    this.el.preset.addEventListener('change', () => {
      const p = PRESETS[this.el.preset.value];
      if (p) {
        this.el.volume.value = p.volume;
        this.el.density.value = p.density;
        this.el.oscamp.value = p.oscAmp;
        this.el.oscfreq.value = p.oscFreq;
      }
      this._refresh();
    });

    this.el.close.addEventListener('click', () => this.close());
  }

  // Tipo que o preset selecionado força (ou 'auto').
  _presetKind() {
    const p = PRESETS[this.el.preset.value];
    return p ? p.kind : 'auto';
  }

  _values() {
    return {
      volume: parseFloat(this.el.volume.value),
      density: parseFloat(this.el.density.value),
      oscAmp: parseFloat(this.el.oscamp.value),
      oscFreq: parseFloat(this.el.oscfreq.value),
    };
  }

  _refresh() {
    const { volume: v, density: d, oscAmp: a, oscFreq: f } = this._values();

    this.el.oVolume.textContent = v.toFixed(1);
    this.el.oDensity.textContent = d.toFixed(1);
    this.el.oOscamp.textContent = a.toFixed(2);
    this.el.oOscfreq.textContent = f.toFixed(1) + ' Hz';

    const M = mass(v, d);
    const R = sphereRadius(v);
    const Rs = schwarzschildRadius(M);
    const C = compactness(v, d);

    this.el.rMass.textContent = M.toFixed(1);
    this.el.rRadius.textContent = R.toFixed(2);
    this.el.rRs.textContent = Rs.toFixed(2);
    this.el.rComp.textContent = C.toFixed(2);

    const kind = resolveKind(this._presetKind(), v, d, a);
    this.el.rClass.textContent = KIND_LABEL[kind] ?? kind;
  }

  // Parâmetros do próximo corpo a criar.
  getTemplate() {
    const vals = this._values();
    return { ...vals, kind: resolveKind(this._presetKind(), vals.volume, vals.density, vals.oscAmp) };
  }

  open() { this.el.menu.classList.remove('hidden'); this._refresh(); }
  close() {
    this.el.menu.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
  get isOpen() { return !this.el.menu.classList.contains('hidden'); }

  setBodyCount(n) { this.el.hudBodies.textContent = n; }
  setPosition(p) {
    this.el.hudPos.textContent = `${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`;
  }
  setFps(fps) { this.el.hudFps.textContent = fps.toFixed(0); }
}
