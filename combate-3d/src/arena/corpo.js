// Corpo físico (posição, velocidade, salto, queda) e animador em camadas (locomoção + ação).
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Corpo {
  constructor(raiz, raio, massa = 1) {
    this.raiz = raiz;
    this.pos = raiz.position;
    this.raio = raio;
    this.massa = massa;
    this.vel = new THREE.Vector2(); // velocidade desejada aplicada (x, z)
    this.velExtra = new THREE.Vector2(); // impulsos (empurrões, movimento de habilidade)
    this.vy = 0;
    this.noChao = true;
    this.alturaPico = 0;
    this.yaw = raiz.rotation.y;
    this.bateu = false;
    this.voador = false;
    this.semColisaoCorpos = false;
  }

  get frente() { return new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw)); }
  get lado() { return new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw)); } // esquerda do personagem (+X local)

  // Gira suavemente até o ângulo desejado.
  virarPara(yawAlvo, velGiro, dt) {
    let d = yawAlvo - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const passo = velGiro * dt;
    this.yaw += Math.abs(d) <= passo ? d : Math.sign(d) * passo;
  }

  olharPara(x, z, velGiro, dt) {
    this.virarPara(Math.atan2(x - this.pos.x, z - this.pos.z), velGiro, dt);
  }

  pular(vy) {
    this.vy = vy;
    this.noChao = false;
    this.alturaPico = this.pos.y;
  }

  // Integra a física de um passo. Retorna a altura da queda quando aterrissa (ou 0).
  passo(dt, mundo) {
    this.bateu = false;
    this.pos.x += (this.vel.x + this.velExtra.x) * dt;
    this.pos.z += (this.vel.y + this.velExtra.y) * dt;
    let quedaAterrissou = 0;
    if (!this.voador) {
      const chao = mundo.alturaChao(this.pos.x, this.pos.z, this.pos.y);
      if (!this.noChao || this.pos.y > chao + 0.01) {
        if (this.noChao) { this.noChao = false; this.alturaPico = this.pos.y; this.vy = Math.min(this.vy, 0); }
        this.vy -= CONFIG.guerreiro.gravidade * dt;
        this.pos.y += this.vy * dt;
        this.alturaPico = Math.max(this.alturaPico, this.pos.y);
        if (this.pos.y <= chao) {
          this.pos.y = chao;
          quedaAterrissou = Math.max(0.001, this.alturaPico - chao);
          this.noChao = true;
          this.vy = 0;
        }
      } else {
        this.pos.y = chao;
      }
    }
    mundo.resolver(this);
    this.raiz.rotation.y = this.yaw;
    return quedaAterrissou;
  }
}

// Separa corpos que se sobrepõem (o mais leve cede mais). Investidas param no corpo do alvo.
export function separarCorpos(corpos) {
  for (let i = 0; i < corpos.length; i++) {
    for (let j = i + 1; j < corpos.length; j++) {
      const a = corpos[i], b = corpos[j];
      if (a.semColisaoCorpos || b.semColisaoCorpos) continue;
      if (Math.abs(a.pos.y - b.pos.y) > 1.2) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz), min = a.raio + b.raio;
      if (d < min && d > 1e-4) {
        const sobra = min - d;
        const fa = b.massa / (a.massa + b.massa), fb = 1 - fa;
        a.pos.x -= (dx / d) * sobra * fa; a.pos.z -= (dz / d) * sobra * fa;
        b.pos.x += (dx / d) * sobra * fb; b.pos.z += (dz / d) * sobra * fb;
      }
    }
  }
}

// Animador em duas camadas: locomoção (guarda, andar, correr, lateral) e ações (golpes, reações).
// Os pesos sempre somam 1, para nunca misturar com a pose de repouso.
export class Animador {
  constructor(raiz, clipes, locomocao = ['guarda', 'andar', 'correr', 'lateral']) {
    this.mixer = new THREE.AnimationMixer(raiz);
    this.clipes = clipes;
    this.loco = {};
    for (const n of locomocao) {
      if (!clipes[n]) continue;
      const a = this.mixer.clipAction(clipes[n]);
      a.play();
      a.setEffectiveWeight(n === 'guarda' ? 1 : 0);
      this.loco[n] = a;
    }
    this.pesosLoco = Object.fromEntries(Object.keys(this.loco).map((n) => [n, n === 'guarda' ? 1 : 0]));
    this.acao = null; // { action, peso }
    this.anterior = null;
    this.pesoAcao = 0;
    this.fade = 0.1;
    this.alvoAcao = 0;
  }

  tocar(nome, { fade = 0.08, ts = 1, loop = false, inicio = 0 } = {}) {
    const clip = this.clipes[nome];
    if (!clip) { console.warn('clipe ausente', nome); return null; }
    const a = this.mixer.clipAction(clip);
    const configurar = () => {
      a.reset();
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.timeScale = ts;
      a.time = inicio;
      a.play();
    };
    if (this.acao && this.acao.action === a) {
      // Mesmo clipe de novo: reinicia mantendo o peso (não dá para misturar um clipe consigo mesmo).
      configurar();
      this.acao.nome = nome;
      this.alvoAcao = 1;
      return a;
    }
    if (this.anterior) { this.anterior.action.stop(); this.anterior = null; }
    if (this.acao && this.pesoAcao > 0) this.anterior = { action: this.acao.action, peso: this.pesoAcao };
    else if (this.acao) this.acao.action.stop();
    configurar();
    this.acao = { action: a, nome };
    this.pesoAcao = 0;
    this.alvoAcao = 1;
    this.fade = Math.max(0.0001, fade);
    return a;
  }

  get nomeAcao() { return this.acao?.nome; }
  get tempoAcao() { return this.acao ? this.acao.action.time : 0; }
  get duracaoAcao() { return this.acao ? this.acao.action.getClip().duration : 0; }

  // Sai da ação e volta para a locomoção.
  soltar(fade = 0.15) {
    this.alvoAcao = 0;
    this.fade = Math.max(0.0001, fade);
  }

  // vLocal: velocidade no espaço do personagem (x = esquerda, y = frente) em m/s
  atualizar(dt, vLocal, refs = { andar: 1.8, correr: 4.2, lateral: 1.5 }) {
    const vel = vLocal.length();
    const alvo = { guarda: 1, andar: 0, correr: 0, lateral: 0 };
    if (vel > 0.15) {
      const movendo = Math.min(1, vel / 0.8);
      alvo.guarda = 1 - movendo;
      const frente = Math.abs(vLocal.y) / vel, lat = Math.abs(vLocal.x) / vel;
      const corrida = THREE.MathUtils.clamp((vel - refs.andar) / (refs.correr - refs.andar), 0, 1);
      if (this.loco.lateral) {
        alvo.lateral = movendo * lat * (frente < 0.5 ? 1 : 0.5);
      }
      const resto = movendo - alvo.lateral;
      alvo.andar = resto * (1 - corrida);
      alvo.correr = vLocal.y > 0 ? resto * corrida : 0;
      if (vLocal.y <= 0) alvo.andar = resto; // para trás, só anda (de costas)
      // Velocidade e sentido dos ciclos
      if (this.loco.andar) this.loco.andar.timeScale = (vLocal.y < -0.1 ? -1 : 1) * THREE.MathUtils.clamp(vel / refs.andar, 0.6, 1.6);
      if (this.loco.correr) this.loco.correr.timeScale = THREE.MathUtils.clamp(vel / refs.correr, 0.7, 1.4);
      if (this.loco.lateral) this.loco.lateral.timeScale = (vLocal.x >= 0 ? 1 : -1) * THREE.MathUtils.clamp(vel / refs.lateral, 0.6, 1.5);
    }
    // Suaviza os pesos da locomoção
    const k = 1 - Math.exp(-dt * 12);
    for (const n of Object.keys(this.loco)) this.pesosLoco[n] += ((alvo[n] ?? 0) - this.pesosLoco[n]) * k;
    const somaLoco = Object.values(this.pesosLoco).reduce((s, v) => s + v, 0) || 1;

    // Camada de ação
    const passo = dt / this.fade;
    this.pesoAcao = this.alvoAcao > this.pesoAcao ? Math.min(1, this.pesoAcao + passo) : Math.max(0, this.pesoAcao - passo);
    if (this.anterior) {
      this.anterior.peso = Math.max(0, this.anterior.peso - passo);
      if (this.anterior.peso <= 0) { this.anterior.action.stop(); this.anterior = null; }
    }
    const pAnt = this.anterior ? Math.min(this.anterior.peso, 1 - this.pesoAcao) : 0;
    const pAcao = this.acao ? this.pesoAcao : 0;
    if (this.acao) {
      this.acao.action.setEffectiveWeight(pAcao);
      if (this.pesoAcao <= 0 && this.alvoAcao === 0) { this.acao.action.stop(); this.acao = null; }
    }
    if (this.anterior) this.anterior.action.setEffectiveWeight(pAnt);
    const pLoco = Math.max(0, 1 - pAcao - pAnt);
    for (const n of Object.keys(this.loco)) this.loco[n].setEffectiveWeight((this.pesosLoco[n] / somaLoco) * pLoco);
    this.mixer.update(dt);
  }
}
