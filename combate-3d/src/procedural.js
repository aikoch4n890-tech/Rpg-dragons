// Camada procedural aplicada por cima da animação, depois do mixer, a cada quadro:
//  - inclinação do tronco com a aceleração (arranca → inclina para a frente, freia → para trás)
//    e para dentro das curvas (peso e equilíbrio)
//  - cabeça acompanhando o alvo (olhar), com limite e suavização
//  - tranco de impacto por parte atingida (molas amortecidas): cabeça vai para trás,
//    abdômen dobra, pernas fazem o quadril afundar, golpe pelas costas arqueia
//  - tiques de cabeça aleatórios (goblins inquietos)
// O mixer reescreve as rotações a cada quadro, então somar aqui não acumula.
import * as THREE from 'three';

const GRAU = Math.PI / 180;

// Mola criticamente amortecida (não oscila demais, volta ao alvo)
class Mola {
  constructor(rigidez = 120, amortecimento = 0.9) { this.x = 0; this.v = 0; this.k = rigidez; this.c = 2 * Math.sqrt(rigidez) * amortecimento; }
  passo(alvo, dt) {
    this.v += (this.k * (alvo - this.x) - this.c * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();

export class Procedural {
  constructor(rig, { escala = 1, tique = 0, olharMax = 45 } = {}) {
    this.ossos = rig.ossos;
    this.raiz = rig.raiz;
    this.escala = escala;
    this.tique = tique; // frequência dos tiques de cabeça (0 = nenhum)
    this.olharMax = olharMax * GRAU;
    this.velAnterior = new THREE.Vector2();
    this.acel = new THREE.Vector2();
    this.inclina = new Mola(60, 1);
    this.banca = new Mola(60, 1);
    this.olharYaw = 0; this.olharPitch = 0;
    // molas de impacto (radianos / metros)
    this.cabecaPitch = new Mola(160, 0.85); this.cabecaYaw = new Mola(160, 0.9);
    this.troncoPitch = new Mola(110, 0.6); this.troncoYaw = new Mola(110, 0.6); this.troncoRoll = new Mola(110, 0.6);
    this.quadrilDesce = new Mola(140, 0.7);
    this.proximoTique = 1 + Math.random() * 2;
    this.tiqueYaw = 0;
  }

  // Golpe recebido: parte atingida, direção de onde veio (vetor no mundo) e força 0..1
  impulso(parte = 'tronco', origem = null, forca = 0.5) {
    const f = Math.min(1.2, forca) * 9;
    let lado = 0, costas = false;
    if (origem) {
      // direção do golpe no espaço do personagem
      _v.set(origem.x - this.raiz.position.x, 0, origem.z - this.raiz.position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.raiz.rotation.y).normalize();
      lado = _v.x; // golpe vindo da esquerda (+x) empurra para a direita
      costas = _v.z < -0.3;
    }
    if (costas) { this.troncoPitch.v -= f * 0.8; this.cabecaPitch.v -= f * 0.5; return; }
    if (/cabe/.test(parte)) { this.cabecaPitch.v -= f * 1.3; this.cabecaYaw.v -= lado * f * 0.4; this.troncoPitch.v -= f * 0.4; }
    else if (/perna|coxa/.test(parte)) { this.quadrilDesce.v -= f * 0.06; this.troncoRoll.v += lado * f * 0.6; this.troncoPitch.v += f * 0.3; }
    else { this.troncoPitch.v += f * 1.1; this.troncoYaw.v -= lado * f * 0.6; this.cabecaPitch.v += f * 0.5; }
  }

  // velMundo: velocidade no chão (x, z); alvo: ponto para olhar (ou null); pesoOlhar 0..1; ativo: aplica inclinação
  aplicar(dt, { velMundo, giro = 0, alvo = null, pesoOlhar = 1, inclinar = 1 }) {
    if (dt <= 0) return;
    const O = this.ossos;
    const yaw = this.raiz.rotation.y;
    // velocidade local (x = esquerda, y = frente)
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const vL = new THREE.Vector2(velMundo.x * c - velMundo.y * s, velMundo.x * s + velMundo.y * c);
    const a = vL.clone().sub(this.velAnterior).divideScalar(dt);
    this.velAnterior.copy(vL);
    this.acel.lerp(a, Math.min(1, dt * 8));
    const vel = vL.length();
    const pitch = this.inclina.passo(THREE.MathUtils.clamp(this.acel.y * 0.025, -0.14, 0.14) * inclinar, dt);
    const roll = this.banca.passo(THREE.MathUtils.clamp(-giro * vel * 0.03, -0.14, 0.14) * inclinar, dt);

    // Olhar: direção do alvo no espaço do corpo
    let yawAlvo = 0, pitchAlvo = 0;
    if (alvo && pesoOlhar > 0) {
      const cab = O.Head.getWorldPosition(_v);
      const dx = alvo.x - cab.x, dy = alvo.y - cab.y, dz = alvo.z - cab.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      yawAlvo = THREE.MathUtils.clamp(Math.atan2(lx, lz), -this.olharMax, this.olharMax) * pesoOlhar;
      pitchAlvo = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(lx, lz)), -0.4, 0.45) * pesoOlhar;
      if (Math.abs(Math.atan2(lx, lz)) > Math.PI * 0.6) { yawAlvo = this.olharYaw * 0.9; pitchAlvo = 0; } // alvo atrás: a cabeça volta devagar, sem pular
    }
    // Tiques: olhadelas rápidas para os lados
    if (this.tique) {
      this.proximoTique -= dt;
      if (this.proximoTique <= 0) { this.tiqueYaw = (Math.random() * 2 - 1) * 0.5; this.proximoTique = (0.5 + Math.random() * 1.6) / this.tique; this.cabecaPitch.v += (Math.random() - 0.5) * 3; }
      this.tiqueYaw *= Math.exp(-dt * 2.5);
    }
    // Cabeça segue o alvo com suavidade e velocidade máxima (nada de virar de uma vez)
    const kOlhar = 1 - Math.exp(-dt * 4);
    const maxPasso = 2.4 * dt; // ~140°/s
    this.olharYaw += THREE.MathUtils.clamp((yawAlvo + this.tiqueYaw - this.olharYaw) * kOlhar, -maxPasso, maxPasso);
    this.olharPitch += THREE.MathUtils.clamp((pitchAlvo - this.olharPitch) * kOlhar, -maxPasso, maxPasso);

    // Impactos
    const cp = this.cabecaPitch.passo(0, dt), cy = this.cabecaYaw.passo(0, dt);
    const tp = this.troncoPitch.passo(0, dt), ty = this.troncoYaw.passo(0, dt), tr = this.troncoRoll.passo(0, dt);
    const qd = this.quadrilDesce.passo(0, dt);

    const somar = (osso, x, y, z) => { if (!osso || (!x && !y && !z)) return; osso.quaternion.multiply(_q.setFromEuler(_e.set(x, y, z))); };
    somar(O.Spine, pitch + tp * 0.6, ty * 0.5, roll + tr * 0.6);
    somar(O.Spine1, tp * 0.4, ty * 0.5, tr * 0.4);
    somar(O.Neck, this.olharPitch * 0.35 + cp * 0.3, this.olharYaw * 0.35, 0);
    somar(O.Head, this.olharPitch * 0.65 + cp * 0.7, this.olharYaw * 0.65 + cy, 0);
    if (qd) O.Hips.position.y += qd / this.escala;
  }
}
