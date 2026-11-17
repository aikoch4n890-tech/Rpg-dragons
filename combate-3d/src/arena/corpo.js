// Corpo físico (posição, velocidade, salto, queda) e animador em camadas (locomoção + ação).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clipeAditivoSuperior } from '../poses.js';
import { DEGRAU } from './mundo.js';

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
    this.angVel = 0;
    this.giroMedido = 0; // rad/s realmente girados (alimenta a animação de giro no lugar)
    this.yawAnterior = this.yaw;
    this.velReal = new THREE.Vector2();
    this.posAnterior = raiz.position.clone();
    this.bateu = false;
    this.voador = false;
    this.semColisaoCorpos = false;
  }

  get frente() { return new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw)); }
  get lado() { return new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw)); } // esquerda do personagem (+X local)

  // Gira até o ângulo desejado com aceleração angular (nada de virar instantaneamente):
  // a velocidade de giro cresce, chega ao máximo e freia perto do alvo.
  virarPara(yawAlvo, velGiro, dt) {
    let d = yawAlvo - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const desejada = THREE.MathUtils.clamp(d * 9, -velGiro, velGiro);
    const acel = velGiro * 7 * dt;
    this.angVel += THREE.MathUtils.clamp(desejada - this.angVel, -acel, acel);
    const passo = this.angVel * dt;
    this.yaw += Math.abs(passo) > Math.abs(d) && Math.sign(passo) === Math.sign(d) ? d : passo;
    this.girouNoQuadro = true;
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
      // Descendo um degrau pequeno andando: acompanha o chão em vez de cair
      if (this.noChao && this.vy === 0 && this.pos.y > chao + 0.01 && this.pos.y - chao <= DEGRAU + 0.01) {
        this.pos.y = Math.max(chao, this.pos.y - Math.max(1.5, 10 * (this.pos.y - chao)) * dt);
      } else if (!this.noChao || this.pos.y > chao + 0.01) {
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
      } else if (chao > this.pos.y) {
        // Subindo degrau ou rampa: sobe aos poucos (o IK dos pés acompanha), sem teletransporte
        this.pos.y = Math.min(chao, this.pos.y + Math.max(1.2, 9 * (chao - this.pos.y)) * dt);
      } else {
        this.pos.y = chao;
      }
    }
    mundo.resolver(this);
    // Velocidade real (deslocamento / tempo): é ela que move as pernas, não a velocidade pedida.
    // Encostado numa parede, a velocidade real é zero e o personagem não "anda no lugar".
    if (dt > 0) {
      const vx = (this.pos.x - this.posAnterior.x) / dt, vz = (this.pos.z - this.posAnterior.z) / dt;
      const k = Math.min(1, dt * 20);
      this.velReal.x += (vx - this.velReal.x) * k;
      this.velReal.y += (vz - this.velReal.y) * k;
    }
    this.posAnterior.copy(this.pos);
    if (!this.girouNoQuadro) this.angVel *= Math.exp(-dt * 12);
    this.girouNoQuadro = false;
    const dy = Math.atan2(Math.sin(this.yaw - this.yawAnterior), Math.cos(this.yaw - this.yawAnterior));
    this.giroMedido += ((dt > 0 ? dy / dt : 0) - this.giroMedido) * Math.min(1, dt * 10);
    this.yawAnterior = this.yaw;
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

// Animador em camadas:
//  1. Locomoção (blend tree): guarda ↔ andar ↔ correr ↔ sprint, por direção (frente, trás, esquerda, direita)
//     e giro no lugar. Os ciclos andam sincronizados pela mesma fase e a velocidade de cada um vem
//     da passada medida (userData.passada), então o pé de apoio não escorrega.
//  2. Ação (golpes, reações): corpo inteiro, entra e sai com fade cruzado.
//  3. Superior aditiva (defesa): só tronco e braços, por cima da locomoção (pernas continuam andando).
// Os pesos das camadas 1 e 2 sempre somam 1, para nunca misturar com a pose de repouso.
const CICLOS = ['andar', 'correr', 'sprint', 'recuar', 'lateralE', 'lateralD', 'virar'];

export class Animador {
  constructor(raiz, clipes, { velocidades = { andar: 1.8, correr: 4.2, sprint: 6 }, variacao = 0 } = {}) {
    this.mixer = new THREE.AnimationMixer(raiz);
    this.clipes = clipes;
    this.velocidades = velocidades;
    this.variacao = variacao; // irregularidade no ritmo dos passos (goblins)
    this.loco = {};
    for (const n of ['guarda', ...CICLOS]) {
      if (!clipes[n]) continue;
      const a = this.mixer.clipAction(clipes[n]);
      a.play();
      a.setEffectiveWeight(n === 'guarda' ? 1 : 0);
      if (n !== 'guarda') a.timeScale = 0; // o tempo dos ciclos é controlado pela fase
      this.loco[n] = a;
    }
    // Começa a respiração em um ponto aleatório (personagens iguais não respiram juntos)
    if (this.loco.guarda) this.loco.guarda.time = Math.random() * clipes.guarda.duration;
    this.pesosLoco = Object.fromEntries(Object.keys(this.loco).map((n) => [n, n === 'guarda' ? 1 : 0]));
    this.fase = 0;
    this.acao = null;
    this.anterior = null;
    this.pesoAcao = 0;
    this.alvoAcao = 0;
    this.fade = 0.1;
    this.sup = null; // camada superior aditiva
    this.aditivos = {};
    this.ritmo = 1;
    // Pose pura da animação (antes de procedural e IK). O mixer só reescreve um osso quando o valor
    // da animação muda; se a pose está parada, o que foi somado depois ficaria e se acumularia
    // (cabeça girando sem parar). Por isso a pose é restaurada antes de cada atualização.
    this.ossos = [];
    raiz.traverse((o) => { if (o.isBone) this.ossos.push(o); });
    this.poseQ = null;
    this.poseP = null;
  }

  restaurarPose() {
    if (!this.poseQ) return;
    this.ossos.forEach((o, i) => { o.quaternion.copy(this.poseQ[i]); o.position.copy(this.poseP[i]); });
  }

  guardarPose() {
    if (!this.poseQ) { this.poseQ = this.ossos.map((o) => o.quaternion.clone()); this.poseP = this.ossos.map((o) => o.position.clone()); return; }
    this.ossos.forEach((o, i) => { this.poseQ[i].copy(o.quaternion); this.poseP[i].copy(o.position); });
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
    if (this.loco[nome]) { console.warn('ciclo de locomoção não pode ser ação', nome); return null; }
    if (this.acao && this.acao.action === a) {
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
  set velocidadeAcao(ts) { if (this.acao) this.acao.action.timeScale = ts; }

  // Sai da ação e volta para a locomoção.
  soltar(fade = 0.15) {
    this.alvoAcao = 0;
    this.fade = Math.max(0.0001, fade);
  }

  // Camada superior aditiva: mesmo clipe da ação, só tronco e braços, somado à locomoção.
  tocarSuperior(nome, { fade = 0.08 } = {}) {
    if (!this.aditivos[nome]) {
      if (!this.clipes[nome] || !this.clipes.guarda) return null;
      this.aditivos[nome] = clipeAditivoSuperior(this.clipes[nome], this.clipes.guarda);
    }
    const a = this.mixer.clipAction(this.aditivos[nome]);
    a.blendMode = THREE.AdditiveAnimationBlendMode;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    if (this.sup && this.sup.action !== a) { this.sup.action.stop(); a.setEffectiveWeight(this.sup.peso); this.sup = { action: a, peso: this.sup.peso, alvo: 1, fade }; }
    else this.sup = { action: a, peso: this.sup?.peso ?? 0, alvo: 1, fade };
    return a;
  }
  soltarSuperior(fade = 0.15) { if (this.sup) { this.sup.alvo = 0; this.sup.fade = fade; } }
  get nomeSuperior() { return this.sup?.alvo ? this.sup.action.getClip().name.replace(/_sup$/, '') : null; }

  // O pé está na fase de apoio? Parado (guarda) os dois estão; andando, depende da fase do ciclo.
  peApoiado(lado) {
    if ((this.pCiclos ?? 0) < 0.3) return (this.pLoco ?? 1) > 0.5;
    const psi = (this.fase + (lado === 'Right' ? 0.5 : 0)) % 1;
    return psi < 0.47;
  }

  // vLocal: velocidade no espaço do personagem (x = esquerda, y = frente) em m/s; giro: rad/s
  atualizar(dt, vLocal, refs = null, giro = 0) {
    const V = refs || this.velocidades;
    const v = vLocal.length();
    const alvo = Object.fromEntries(Object.keys(this.loco).map((n) => [n, 0]));
    const mov = THREE.MathUtils.clamp((v - 0.08) / 0.5, 0, 1);
    alvo.guarda = 1 - mov;
    // Giro no lugar: passinhos quando vira parado
    if (this.loco.virar) {
      const g = (1 - mov) * THREE.MathUtils.clamp((Math.abs(giro) - 0.6) / 2, 0, 1);
      alvo.virar = g;
      alvo.guarda -= g;
    }
    if (mov > 0) {
      const c = vLocal.y / v, s = vLocal.x / v;
      const wF = Math.max(0, c) ** 2, wB = Math.max(0, -c) ** 2, wL = Math.max(0, s) ** 2, wR = Math.max(0, -s) ** 2;
      // Para a frente: andar → correr → sprint conforme a velocidade
      const corrida = THREE.MathUtils.clamp((v - V.andar) / (V.correr - V.andar), 0, 1);
      const sprint = this.loco.sprint ? THREE.MathUtils.clamp((v - V.correr) / ((V.sprint ?? V.correr * 1.4) - V.correr), 0, 1) : 0;
      const frente = mov * wF;
      if (this.loco.correr) {
        alvo.andar += frente * (1 - corrida);
        alvo.correr += frente * corrida * (1 - sprint);
        if (this.loco.sprint) alvo.sprint += frente * corrida * sprint;
      } else alvo.andar += frente;
      (this.loco.recuar ? (alvo.recuar += mov * wB) : (alvo.andar += mov * wB));
      (this.loco.lateralE ? (alvo.lateralE += mov * wL) : (alvo.andar += mov * wL));
      (this.loco.lateralD ? (alvo.lateralD += mov * wR) : (alvo.andar += mov * wR));
    }
    const k = 1 - Math.exp(-dt * 10);
    for (const n of Object.keys(this.loco)) this.pesosLoco[n] += (alvo[n] - this.pesosLoco[n]) * k;

    // Fase comum dos ciclos: cada ciclo pede a velocidade "real / passada"; mistura pelos pesos.
    let taxa = 0, soma = 0;
    for (const n of CICLOS) {
      const w = this.pesosLoco[n];
      if (!this.loco[n] || w < 0.001) continue;
      const clip = this.clipes[n];
      const passada = clip.userData?.passada || 1.5;
      const veloc = n === 'virar' ? Math.max(Math.abs(giro) * 0.4, 0.4) : Math.max(v, 0.3);
      taxa += w * (veloc / passada) / clip.duration;
      soma += w;
    }
    if (soma > 0) {
      if (this.variacao) this.ritmo += ((1 + (Math.random() * 2 - 1) * this.variacao) - this.ritmo) * Math.min(1, dt * 3);
      this.fase = (this.fase + (taxa / soma) * dt * this.ritmo) % 1;
    }
    for (const n of CICLOS) if (this.loco[n]) this.loco[n].time = this.fase * this.clipes[n].duration;

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
    const somaLoco = Object.values(this.pesosLoco).reduce((s, x) => s + Math.max(0, x), 0) || 1;
    // Quanto da pose atual vem dos ciclos de passo (para o IK saber se pode travar pelo ciclo)
    this.pCiclos = (CICLOS.reduce((s, n) => s + Math.max(0, this.pesosLoco[n] ?? 0), 0) / somaLoco) * pLoco;
    this.pLoco = pLoco;
    for (const n of Object.keys(this.loco)) this.loco[n].setEffectiveWeight((Math.max(0, this.pesosLoco[n]) / somaLoco) * pLoco);

    // Camada superior aditiva (some quando uma ação de corpo inteiro assume)
    if (this.sup) {
      const s = this.sup;
      const alvoSup = s.alvo * (1 - pAcao);
      s.peso += Math.sign(alvoSup - s.peso) * Math.min(Math.abs(alvoSup - s.peso), dt / Math.max(0.0001, s.fade));
      s.action.setEffectiveWeight(s.peso);
      if (s.alvo === 0 && s.peso <= 0) { s.action.stop(); this.sup = null; }
    }
    this.restaurarPose();
    this.mixer.update(dt);
    this.guardarPose();
  }
}
