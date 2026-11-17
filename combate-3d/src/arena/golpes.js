// Detecção de acerto pela trajetória real da arma e cálculo de dano.
// A lâmina é amostrada em vários pontos no quadro atual e no anterior (e entre eles),
// então um golpe rápido não "atravessa" o alvo entre dois quadros.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();

// Registra a posição da arma em cada quadro para varrer o caminho entre quadros.
export class RastroArma {
  constructor(base, ponta) {
    this.base = base; this.ponta = ponta;
    this.b0 = new THREE.Vector3(); this.p0 = new THREE.Vector3();
    this.b1 = new THREE.Vector3(); this.p1 = new THREE.Vector3();
    this.iniciado = false;
  }
  atualizar() {
    this.b0.copy(this.b1); this.p0.copy(this.p1);
    this.base.getWorldPosition(this.b1); this.ponta.getWorldPosition(this.p1);
    if (!this.iniciado) { this.b0.copy(this.b1); this.p0.copy(this.p1); this.iniciado = true; }
  }
  // Pontos ao longo da arma (com alcance extra além da ponta), no quadro atual, anterior e no meio.
  pontos(alcanceExtra = 0, n = 6) {
    const lista = [];
    for (const f of [0, 0.5, 1]) {
      _a.lerpVectors(this.b0, this.b1, f);
      _b.lerpVectors(this.p0, this.p1, f);
      const comp = _a.distanceTo(_b);
      const extra = comp > 1e-4 ? alcanceExtra / comp : 0;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * (1 + extra);
        lista.push(new THREE.Vector3().lerpVectors(_a, _b, t));
      }
    }
    return lista;
  }
}

// Partes do corpo (hurtboxes esféricas) presas a ossos.
export class Partes {
  constructor(defs, ossos, escala = 1) {
    this.lista = defs.map((d) => ({ ...d, osso: ossos[d.osso], local: new THREE.Vector3(...(d.offset || [0, 0, 0])), raio: d.raio * escala, centro: new THREE.Vector3() }));
  }
  atualizar() {
    for (const p of this.lista) p.centro.copy(p.local).applyMatrix4(p.osso.matrixWorld);
  }
  // Parte mais próxima atingida por algum dos pontos (ou null).
  atingida(pontos, folga = 0.04) {
    let melhor = null, dMin = Infinity;
    for (const p of this.lista) {
      for (const q of pontos) {
        const d = q.distanceTo(p.centro) - p.raio - folga;
        if (d < 0 && d < dMin) { dMin = d; melhor = { parte: p, ponto: q.clone() }; }
      }
    }
    return melhor;
  }
  esferaAtingida(centro, raio) {
    let melhor = null, dMin = Infinity;
    for (const p of this.lista) {
      const d = centro.distanceTo(p.centro) - p.raio - raio;
      if (d < 0 && d < dMin) { dMin = d; melhor = { parte: p, ponto: p.centro.clone().lerp(centro, 0.5) }; }
    }
    return melhor;
  }
  get maisBaixa() { return Math.min(...this.lista.map((p) => p.centro.y - p.raio)); }
  get maisAlta() { return Math.max(...this.lista.map((p) => p.centro.y + p.raio)); }
}

// Dano final considerando força, multiplicador do golpe, parte atingida e defesa do alvo.
export function calcularDano(forca, mult, parteMult, defesa) {
  const variacao = 1 + (Math.random() * 2 - 1) * CONFIG.dano.variacao;
  return Math.max(1, Math.round(forca * mult * parteMult * variacao * (100 / (100 + defesa))));
}

// Decide a reação a partir do stagger acumulado, do peso do alvo e do efeito do golpe.
export function decidirReacao(alvo, golpe) {
  const R = CONFIG.reacao;
  const res = alvo.resistStagger;
  const pesoLancavel = R.pesosQuePodemSerLancados.includes(alvo.peso);
  const pesoDerrubavel = R.pesosQuePodemSerDerrubados.includes(alvo.peso);
  if (golpe.efeito === 'lancar') {
    if (pesoLancavel) return 'lancado';
    if (pesoDerrubavel && golpe.stagger >= 100) return 'derrubado';
    return alvo.staggerAcum >= res ? 'cambaleando' : 'leve';
  }
  if (golpe.efeito === 'derrubar' && pesoDerrubavel && alvo.staggerAcum >= res * 0.6) return 'derrubado';
  if (alvo.staggerAcum >= res * R.derrubarMultiplo && pesoDerrubavel) return 'derrubado';
  if (alvo.staggerAcum >= res) return 'cambaleando';
  if (golpe.stagger >= res * R.leveSeAcima) return 'leve';
  return 'nenhuma';
}

// Ângulo entre a frente de quem defende e a direção de onde vem o golpe (graus).
export function anguloAtaque(defensor, origem) {
  const f = defensor.corpo.frente;
  const dx = origem.x - defensor.corpo.pos.x, dz = origem.z - defensor.corpo.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp((f.x * dx + f.y * dz) / d, -1, 1)));
}
