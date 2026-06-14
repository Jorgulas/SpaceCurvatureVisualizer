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
      // Separadores
      tabs: Array.from(document.querySelectorAll('.tab')),
      contents: Array.from(document.querySelectorAll('.tab-content')),
      // Grelha
      gSize: document.getElementById('g-size'),
      gSpacing: document.getElementById('g-spacing'),
      gOpacity: document.getElementById('g-opacity'),
      gScale: document.getElementById('g-scale'),
      gCalm: document.getElementById('g-calm'),
      gHot: document.getElementById('g-hot'),
      gBg: document.getElementById('g-bg'),
      gBoundary: document.getElementById('g-boundary'),
      gReset: document.getElementById('g-reset'),
      oGSize: document.getElementById('o-gsize'),
      oGSpacing: document.getElementById('o-gspacing'),
      oGOpacity: document.getElementById('o-gopacity'),
      oGScale: document.getElementById('o-gscale'),
      gPoints: document.getElementById('g-points'),
      gNodes: document.getElementById('g-nodes'),
    };

    this.onClose = null;      // callback quando o menu fecha
    this.onGridChange = null; // callback quando a grelha muda (rebuild = true se mudou tamanho/divisões)
    this._load();             // restaura definições guardadas
    this._bind();
    this._refresh();
    this._refreshGrid();
  }

  // --- Persistência (localStorage) -------------------------------------------
  _persisted() {
    return [
      this.el.preset, this.el.volume, this.el.density, this.el.oscamp, this.el.oscfreq,
      this.el.gSize, this.el.gSpacing, this.el.gOpacity, this.el.gScale,
      this.el.gCalm, this.el.gHot, this.el.gBg, this.el.gBoundary,
    ];
  }

  _save() {
    const data = {};
    for (const el of this._persisted()) {
      data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    }
    try { localStorage.setItem('cgv-settings', JSON.stringify(data)); } catch (e) { /* ignora */ }
  }

  _load() {
    let data;
    try { data = JSON.parse(localStorage.getItem('cgv-settings')); } catch (e) { return; }
    if (!data) return;
    for (const el of this._persisted()) {
      if (!(el.id in data)) continue;
      if (el.type === 'checkbox') el.checked = data[el.id];
      else el.value = data[el.id];
    }
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

    // Troca de separadores
    this.el.tabs.forEach((tab) =>
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        this.el.tabs.forEach((t) => t.classList.toggle('active', t === tab));
        this.el.contents.forEach((c) =>
          c.classList.toggle('hidden', c.dataset.content !== name)
        );
      })
    );

    // Grelha: tamanho e distância reconstroem (emitir no 'change' para não
    // reconstruir a cada pixel arrastado); o 'input' só atualiza as etiquetas.
    [this.el.gSize, this.el.gSpacing].forEach((inp) => {
      inp.addEventListener('input', () => this._refreshGrid());
      inp.addEventListener('change', () => { this._refreshGrid(); this._emitGrid(true); });
    });

    // Estes não reconstroem a grelha (cor, opacidade, sensibilidade, caixa).
    [this.el.gOpacity, this.el.gScale, this.el.gCalm, this.el.gHot, this.el.gBg].forEach((inp) =>
      inp.addEventListener('input', () => { this._refreshGrid(); this._emitGrid(false); })
    );
    this.el.gBoundary.addEventListener('change', () => this._emitGrid(false));

    this.el.gReset.addEventListener('click', () => this._resetGrid());
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
    this._save();
  }

  // Parâmetros do próximo corpo a criar.
  getTemplate() {
    const vals = this._values();
    return { ...vals, kind: resolveKind(this._presetKind(), vals.volume, vals.density, vals.oscAmp) };
  }

  // --- Grelha ----------------------------------------------------------------
  // Divisões (pontos por eixo) derivadas do alcance e da distância entre pontos.
  _divisions(size, spacing) {
    return Math.max(4, Math.min(22, Math.round(size / spacing) + 1));
  }

  _refreshGrid() {
    const size = parseFloat(this.el.gSize.value);
    const spacing = parseFloat(this.el.gSpacing.value);
    const div = this._divisions(size, spacing);

    this.el.oGSize.textContent = size.toFixed(0);
    this.el.oGSpacing.textContent = spacing.toFixed(1);
    this.el.oGOpacity.textContent = parseFloat(this.el.gOpacity.value).toFixed(2);
    this.el.oGScale.textContent = this.el.gScale.value;
    this.el.gPoints.textContent = div;
    this.el.gNodes.textContent = (div * div * div).toLocaleString('pt-PT');
  }

  getGridSettings() {
    const size = parseFloat(this.el.gSize.value);
    const spacing = parseFloat(this.el.gSpacing.value);
    return {
      size,
      divisions: this._divisions(size, spacing),
      opacity: parseFloat(this.el.gOpacity.value),
      // Slider alto = mais vivo. colorScale = deslocamento a que a cor satura.
      colorScale: 28 - parseFloat(this.el.gScale.value),
      calmColor: this.el.gCalm.value,
      hotColor: this.el.gHot.value,
      bgColor: this.el.gBg.value,
      showBoundary: this.el.gBoundary.checked,
    };
  }

  _emitGrid(rebuild) {
    this._save();
    if (this.onGridChange) this.onGridChange(this.getGridSettings(), rebuild);
  }

  _resetGrid() {
    this.el.gSize.value = 48;
    this.el.gSpacing.value = 3.4;
    this.el.gOpacity.value = 0.5;
    this.el.gScale.value = 17;
    this.el.gCalm.value = '#2e8cd9';
    this.el.gHot.value = '#ff2f93';
    this.el.gBg.value = '#05060d';
    this.el.gBoundary.checked = true;
    this._refreshGrid();
    this._emitGrid(true);
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
