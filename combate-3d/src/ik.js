// Cinemática inversa (IK) de dois ossos, para pernas (pés no chão) e braços (mãos num alvo).
//
// IKPes faz, depois da animação, a cada quadro:
//  1. adapta os pés à altura real do chão (degraus, rampa, plataforma) e abaixa o quadril
//     quando um pé precisa descer;
//  2. trava o pé de apoio no mundo enquanto ele está na fase de apoio do ciclo de marcha
//     (o pé não escorrega, mesmo com pequenas diferenças entre passada e velocidade);
//     ao levantar, o pé solta suavemente até a posição da animação;
//  3. nunca deixa o pé atravessar o chão.
import * as THREE from 'three';
import { DEGRAU } from './arena/mundo.js';

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
const _u = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3();

// Aplica uma rotação no espaço do mundo a um osso (convertendo para o espaço local do pai).
function girarNoMundo(osso, qMundo) {
  osso.parent.getWorldQuaternion(_qp);
  _qi.copy(_qp).invert();
  osso.quaternion.premultiply(_qp).premultiply(qMundo).premultiply(_qi);
  osso.updateMatrixWorld(true);
}

// IK analítico de dois ossos: raiz (coxa/braço) → meio (joelho/cotovelo) → ponta (tornozelo/punho).
// eixoReserva: eixo local do osso do meio usado quando o membro está totalmente esticado.
export function doisOssos(raiz, meio, ponta, alvo, peso = 1, eixoReserva = new THREE.Vector3(1, 0, 0)) {
  if (peso <= 0) return;
  raiz.getWorldPosition(_a); meio.getWorldPosition(_b); ponta.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _t.copy(_c).lerp(alvo, peso);
  const d = THREE.MathUtils.clamp(_a.distanceTo(_t), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  // 1. Joelho: ângulo interno desejado (lei dos cossenos)
  _u.subVectors(_a, _b).normalize();
  _w.subVectors(_c, _b).normalize();
  const atual = Math.acos(THREE.MathUtils.clamp(_u.dot(_w), -1, 1));
  const desejado = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  // Eixo de dobradiça fixo do osso do meio (joelho/cotovelo): estável mesmo com o membro esticado.
  // O sentido é escolhido testando qual lado abre o ângulo interno.
  _n.copy(eixoReserva).applyQuaternion(meio.getWorldQuaternion(_q)).normalize();
  const teste = _w.clone().applyAxisAngle(_n, 0.01);
  const sinal = Math.acos(THREE.MathUtils.clamp(_u.dot(teste), -1, 1)) > atual ? 1 : -1;
  girarNoMundo(meio, _q.setFromAxisAngle(_n, sinal * (desejado - atual)));
  // 2. Raiz: aponta a ponta para o alvo
  ponta.getWorldPosition(_c);
  _u.subVectors(_c, _a).normalize();
  _w.subVectors(_t, _a).normalize();
  girarNoMundo(raiz, _q.setFromUnitVectors(_u, _w));
}

export class IKPes {
  // alturaTornozelo: altura do tornozelo acima do chão na pose de repouso (em metros no mundo)
  constructor(rig, mundo, { alturaTornozelo = 0.09, escala = 1 } = {}) {
    this.o = rig.ossos;
    this.raiz = rig.raiz;
    this.mundo = mundo;
    this.altura = alturaTornozelo * escala;
    this.escala = escala;
    this.pes = ['Left', 'Right'].map((lado) => ({ lado, trava: null, peso: 0, ajusteY: 0 }));
    this.quadril = 0;
  }

  zerar() { for (const p of this.pes) { p.trava = null; p.peso = 0; } this.quadril = 0; }

  // ativo: trava pés no apoio (só na locomoção); apoio(lado) → true se o pé está na fase de apoio
  aplicar(dt, { travar = true, apoio = () => true, ligado = true } = {}) {
    if (!ligado) { for (const p of this.pes) { p.trava = null; p.peso = 0; } this.quadril = 0; return; }
    const O = this.o;
    const chaoCorpo = this.raiz.position.y;
    const alvos = [];
    let descer = 0;
    for (const p of this.pes) {
      const pe = O[`${p.lado}Foot`];
      const pos = pe.getWorldPosition(new THREE.Vector3());
      // Travamento no apoio
      const apoiado = travar && apoio(p.lado) && (pos.y - chaoCorpo) < this.altura + 0.13 * this.escala;
      if (apoiado && !p.trava) p.trava = pos.clone();
      const longe = p.trava && Math.hypot(pos.x - p.trava.x, pos.z - p.trava.z) > 0.32 * this.escala;
      if (longe && p.peso <= 0.01) p.trava = apoiado ? pos.clone() : null; // replanta só depois de soltar
      if (p.trava && (!apoiado || longe)) p.peso = Math.max(0, p.peso - dt / 0.14); // levantando (ou curva fechada): solta aos poucos, sem tranco
      if (apoiado && !longe) p.peso = 1; // ao tocar o chão o pé gruda na hora; só a soltura é gradual
      if (p.peso <= 0 && !apoiado) p.trava = null;
      const alvo = pos.clone();
      if (p.trava) { alvo.x += (p.trava.x - pos.x) * p.peso; alvo.z += (p.trava.z - pos.z) * p.peso; }
      // Altura do chão onde o pé vai ficar, na sola inteira (calcanhar, tornozelo, ponta): a ponta
      // não entra no degrau seguinte e o calcanhar não fica no ar na borda
      const fx = Math.sin(this.raiz.rotation.y), fz = Math.cos(this.raiz.rotation.y);
      const chao = Math.max(...[-0.05, 0, 0.13].map((d) => this.mundo.alturaChao(alvo.x + fx * d * this.escala, alvo.z + fz * d * this.escala, chaoCorpo + 0.4)));
      let delta = chao - chaoCorpo;
      // Desnível maior que um degrau (borda, parede): o pé não tenta alcançar; o corpo é que vai pisar ou cair
      if (Math.abs(delta) > DEGRAU + 0.02) delta = 0;
      // Acompanha o desnível; nunca abaixo do chão
      alvo.y = Math.max(pos.y + delta, chao + this.altura * 0.85);
      if (delta < 0) descer = Math.min(descer, delta);
      alvos.push({ p, alvo, pos });
    }
    // Quadril desce quando um pé precisa alcançar um chão mais baixo (degrau abaixo)
    const k = 1 - Math.exp(-dt * 14);
    this.quadril += (Math.max(descer, -0.35 * this.escala) - this.quadril) * k;
    if (Math.abs(this.quadril) > 1e-4) { O.Hips.position.y += this.quadril / this.escala; O.Hips.updateMatrixWorld(true); }
    for (const { p, alvo } of alvos) {
      const pe = O[`${p.lado}Foot`];
      const qPe = pe.getWorldQuaternion(new THREE.Quaternion()); // mantém a orientação do pé da animação
      doisOssos(O[`${p.lado}UpLeg`], O[`${p.lado}Leg`], pe, alvo, 1);
      // Restaura a orientação do pé no mundo
      pe.parent.getWorldQuaternion(_qp);
      pe.quaternion.copy(_qp.invert().multiply(qPe));
      pe.updateMatrixWorld(true);
    }
  }
}
