// Sons sintetizados com Web Audio (placeholders, sem arquivos).
// Para usar sons gravados depois: troque o corpo de cada função em SONS por um AudioBuffer
// carregado (mesmos nomes), sem mudar quem chama tocar('nome').
export class Audio {
  constructor(obterVolume) {
    this.obterVolume = obterVolume;
    this.ctx = null;
    this.ultimo = {};
  }

  // Navegadores só liberam áudio depois de um gesto do usuário.
  destravar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.saida = this.ctx.createGain();
      this.saida.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.ruido = this.ctx.createBuffer(1, n, n);
      const d = this.ruido.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }

  tocar(nome) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const vol = this.obterVolume();
    if (vol <= 0) return;
    // Evita empilhar o mesmo som muitas vezes no mesmo instante
    const agora = this.ctx.currentTime;
    if (this.ultimo[nome] && agora - this.ultimo[nome] < 0.04) return;
    this.ultimo[nome] = agora;
    this.saida.gain.value = vol;
    SONS[nome]?.(this, agora);
  }

  ruidoFiltrado(t, dur, freq, q, ganho, tipo = 'bandpass', freqFim = null) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.ruido;
    const f = c.createBiquadFilter();
    f.type = tipo; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqFim) f.frequency.exponentialRampToValueAtTime(freqFim, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(ganho, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.saida);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  tom(t, dur, freq, ganho, tipo = 'sine', freqFim = null, ataque = 0.005) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ganho, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.saida);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

const SONS = {
  corte: (a, t) => a.ruidoFiltrado(t, 0.16, 900, 1.2, 0.35, 'bandpass', 3200),
  habilidade: (a, t) => { a.ruidoFiltrado(t, 0.22, 500, 1, 0.3, 'bandpass', 2500); a.tom(t, 0.18, 220, 0.05, 'triangle', 440); },
  impactoCarne: (a, t) => { a.tom(t, 0.12, 140, 0.5, 'sine', 60); a.ruidoFiltrado(t, 0.1, 700, 0.8, 0.35, 'lowpass'); },
  impactoArmadura: (a, t) => { for (const f of [820, 1350, 2210]) a.tom(t, 0.22, f, 0.09, 'triangle'); a.ruidoFiltrado(t, 0.06, 3000, 1, 0.2); },
  bloqueio: (a, t) => { a.tom(t, 0.14, 180, 0.45, 'sine', 90); a.ruidoFiltrado(t, 0.12, 1200, 0.7, 0.35); for (const f of [640, 1010]) a.tom(t, 0.25, f, 0.05, 'triangle'); },
  perfeito: (a, t) => { for (const f of [1320, 1980, 2640, 3520]) a.tom(t, 0.6, f, 0.08, 'sine'); a.tom(t, 0.15, 200, 0.4, 'sine', 100); a.ruidoFiltrado(t, 0.08, 5000, 1, 0.25, 'highpass'); },
  passo: (a, t) => a.ruidoFiltrado(t, 0.06, 300, 1, 0.12, 'lowpass'),
  queda: (a, t) => { a.tom(t, 0.25, 90, 0.5, 'sine', 45); a.ruidoFiltrado(t, 0.2, 400, 0.7, 0.3, 'lowpass'); },
  impactoChao: (a, t) => { a.tom(t, 0.5, 70, 0.7, 'sine', 35); a.ruidoFiltrado(t, 0.4, 250, 0.6, 0.5, 'lowpass'); },
  grito: (a, t) => { a.tom(t, 0.45, 180, 0.12, 'sawtooth', 140, 0.03); a.tom(t, 0.45, 270, 0.06, 'sawtooth', 210, 0.03); a.ruidoFiltrado(t, 0.4, 900, 3, 0.08); },
  preparo: (a, t) => a.tom(t, 0.3, 110, 0.05, 'sawtooth', 85, 0.05),
  guincho: (a, t) => a.tom(t, 0.35, 2400, 0.05, 'square', 3600, 0.02),
  carregar: (a, t) => a.tom(t, 0.7, 160, 0.06, 'triangle', 480, 0.1),
  ui: (a, t) => a.tom(t, 0.05, 880, 0.06, 'triangle'),
  confirmar: (a, t) => { a.tom(t, 0.08, 660, 0.06, 'triangle'); a.tom(t + 0.07, 0.12, 990, 0.06, 'triangle'); },
  nivel: (a, t) => { [523, 659, 784, 1047].forEach((f, i) => a.tom(t + i * 0.09, 0.3, f, 0.07, 'triangle')); },
};
