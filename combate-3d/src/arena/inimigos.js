// Inimigos de teste e o contrato de combate com o Guerreiro (EnemyCombatInterface).
// Todo inimigo expõe: corpo, partes, vivo, peso, resistStagger, ameaca (ataque em preparo),
// receberGolpe(golpe) e reações (leve, cambaleando, derrubado, lançado, repelido, preso).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { criarGoblin, criarMorcego } from './goblin.js';
import { criarGoblinBloco } from '../modelosBloco.js';
import { ATAQUES_GOBLIN } from './animGoblin.js';
import { Corpo, Animador } from './corpo.js';
import { Partes, RastroArma, calcularDano, decidirReacao, anguloAtaque } from './golpes.js';
import { Procedural } from '../procedural.js';
import { IKPes, doisOssos } from '../ik.js';
import { escolherReacao } from '../reacoes.js';

const PARTES_GOBLIN = [
  { nome: 'cabeça', osso: 'Head', offset: [0, 0.14, 0.02], raio: 0.15, mult: 1.35, fraca: true },
  { nome: 'tronco', osso: 'Spine1', offset: [0, 0.05, 0], raio: 0.17, mult: 1 },
  { nome: 'quadril', osso: 'Hips', offset: [0, -0.05, 0], raio: 0.15, mult: 0.9 },
  { nome: 'pernas', osso: 'LeftLeg', offset: [-0.07, -0.05, 0], raio: 0.13, mult: 0.8 },
];

// Cada monstro define os próprios pontos fracos e resistências (nada universal).
export const TIPOS = {
  goblin: {
    nome: 'Goblin', vida: 170, defesa: 8, forca: 22, resistStagger: 35, peso: 'leve', vel: 2.4, velCorrer: 3.8, raio: 0.3, massa: 1,
    xp: 40, dp: 25, ameacaBase: 1, arma: 'garra', partes: PARTES_GOBLIN, distPreferida: 1.0,
    ataques: [
      { nome: 'Garra', clip: 'garra', mult: 1.0, stagger: 25, alcance: [0, 1.25], bloqueavel: true, recarga: 1.6, chance: 3 },
      { nome: 'Mordida', clip: 'mordida', mult: 1.1, stagger: 20, alcance: [0, 1.15], bloqueavel: true, recarga: 3.2, chance: 2, boca: true, mov: { t0: 0.42, t1: 0.56, frente: 3 } },
      { nome: 'Agarrão', clip: 'agarrao', mult: 0, stagger: 0, alcance: [0.5, 1.5], bloqueavel: false, recarga: 7, chance: 1, mov: { t0: 0.55, t1: 0.75, frente: 3 } },
    ],
  },
  batedor: {
    nome: 'Goblin Batedor', vida: 120, defesa: 5, forca: 20, resistStagger: 28, peso: 'leve', vel: 3.4, velCorrer: 5.4, raio: 0.28, massa: 0.9,
    xp: 45, dp: 30, ameacaBase: 1.1, arma: 'adaga', partes: PARTES_GOBLIN, distPreferida: 2.6, escala: 0.92,
    ataques: [
      { nome: 'Investida', clip: 'investida', mult: 1.2, stagger: 30, alcance: [1.6, 3.4], bloqueavel: true, recarga: 2.8, chance: 3, mov: { t0: 0.42, t1: 0.72, frente: 6.5 } },
      { nome: 'Pedrada', clip: 'arremesso', mult: 0.8, stagger: 20, alcance: [4, 11], bloqueavel: true, recarga: 3.5, chance: 2, projetil: true },
    ],
  },
  escudeiro: {
    nome: 'Goblin Escudeiro', vida: 230, defesa: 14, forca: 24, resistStagger: 60, peso: 'medio', vel: 2.0, velCorrer: 3.0, raio: 0.32, massa: 1.6,
    xp: 60, dp: 40, ameacaBase: 1.2, arma: 'lanca', partes: PARTES_GOBLIN, distPreferida: 1.8, escudo: true,
    ataques: [{ nome: 'Lançada', clip: 'estocada', mult: 1.15, stagger: 35, alcance: [0.6, 2.0], bloqueavel: true, recarga: 2.2, chance: 1 }],
  },
  bruto: {
    nome: 'Goblin Bruto', vida: 950, defesa: 22, forca: 46, resistStagger: 230, peso: 'gigante', vel: 1.5, velCorrer: 2.6, raio: 0.65, massa: 10,
    xp: 220, dp: 150, ameacaBase: 2.5, arma: 'clava', escala: 2.1, distPreferida: 2.0, imuneProvocacao: true, escalavel: true,
    partes: [
      { nome: 'cabeça', osso: 'Head', offset: [0, 0.12, 0.01], raio: 0.13, mult: 1.8, fraca: true },
      { nome: 'tronco', osso: 'Spine1', offset: [0, 0.03, 0], raio: 0.18, mult: 1 },
      { nome: 'barriga', osso: 'Spine', offset: [0, 0.06, 0.02], raio: 0.15, mult: 1 },
      { nome: 'pernas', osso: 'LeftUpLeg', offset: [-0.07, -0.15, 0], raio: 0.12, mult: 0.85 },
      { nome: 'pernas', osso: 'LeftLeg', offset: [-0.07, -0.1, 0], raio: 0.11, mult: 0.85 },
    ],
    ataques: [
      { nome: 'Clavada', clip: 'clava', mult: 1.6, stagger: 120, alcance: [0, 2.7], bloqueavel: true, recarga: 2.6, chance: 3 },
      { nome: 'Pisão', clip: 'pisao', mult: 1.2, stagger: 140, alcance: [0, 2.4], bloqueavel: false, recarga: 6, chance: 1, area: { raio: 2.6, frente: 1.4 } },
    ],
  },
  morcego: {
    nome: 'Morcegão', vida: 90, defesa: 4, forca: 20, resistStagger: 25, peso: 'leve', vel: 4, raio: 0.35, massa: 0.6,
    xp: 50, dp: 35, ameacaBase: 0.9, voador: true, altitude: 2.6,
    ataques: [{ nome: 'Mergulho', mult: 1.0, stagger: 25, bloqueavel: true, recarga: 3.2 }],
  },
};

let proximoId = 1;

export class Inimigo {
  constructor(tipo, ctx, pos) {
    this.tipo = tipo;
    this.def = TIPOS[tipo];
    this.ctx = ctx;
    this.id = proximoId++;
    this.rig = ctx.estiloModelos === 'classico' ? criarGoblin(tipo, 17 + this.id * 3) : criarGoblinBloco(tipo, 17 + this.id * 3);
    this.escala = this.def.escala || 1;
    this.rig.raiz.position.copy(pos);
    ctx.cena.add(this.rig.raiz);
    this.corpo = new Corpo(this.rig.raiz, this.def.raio, this.def.massa);
    this.anim = new Animador(this.rig.raiz, ctx.clipesGoblin(this.rig.tipoArma), {
      velocidades: { andar: this.def.vel, correr: this.def.velCorrer || this.def.vel * 1.5 },
      variacao: this.peso === 'gigante' ? 0.04 : 0.16, // goblins: ritmo irregular
    });
    this.partes = new Partes(this.def.partes, this.rig.ossos, this.escala);
    this.rastroArma = new RastroArma(this.rig.arma.base, this.rig.arma.ponta);
    this.rastroGarra = new RastroArma(this.rig.garraEsq.base, this.rig.garraEsq.ponta);
    this.vidaMax = this.def.vida;
    this.vida = this.vidaMax;
    this.peso = this.def.peso;
    this.resistStagger = this.def.resistStagger;
    this.staggerAcum = 0;
    this.estado = 'livre';
    this.tEstado = 0;
    this.ataque = null;
    this.recargas = {};
    this.provocadoAte = 0;
    this.guardaQuebradaAte = 0;
    this.ladoCirculo = Math.random() < 0.5 ? -1 : 1;
    this.esperaDecisao = 0.5 + Math.random();
    this.remover = false;
    this.agora = 0;
    this.olhos = this.rig.materiais.olhos;
    // Camada procedural: olham para o herói, inclinam com o movimento e sentem os golpes
    this.proc = new Procedural(this.rig, { escala: this.escala }); // sem tiques aleatórios de cabeça
    this.esquivaRecarga = 0;
    this.ik = new IKPes(this.rig, ctx.mundo, { alturaTornozelo: 0.06, escala: this.escala });
  }

  get vivo() { return this.estado !== 'morto'; }
  get nome() { return this.def.nome; }
  get voador() { return false; }
  get caido() { return this.estado === 'derrubado' && this.tEstado > 0.3 && this.tEstado < 1.4; }
  get vulneravel() { return ['cambaleando', 'repelido', 'derrubado', 'preso'].includes(this.estado) || this.agora < this.guardaQuebradaAte; }
  get guardaErguida() { return this.def.escudo && ['livre', 'bloqueando'].includes(this.estado) && this.agora >= this.guardaQuebradaAte && this.estado !== 'atacando'; }
  get centro() { return this.partes.lista[1].centro; }

  // Ataque em preparo contra o herói (a IA do herói lê isto para defender ou esquivar).
  get ameaca() {
    if (this.estado !== 'atacando' || !this.ataque) return null;
    const a = this.ataque;
    if (a.def.projetil) return null; // a ameaça passa a existir quando a pedra estiver no ar
    const tImpacto = a.tempos.contato ?? (a.tempos.ativo ? a.tempos.ativo[0] : (a.tempos.impacto ?? a.tempos.solta));
    const t = this.anim.tempoAcao;
    if (t > tImpacto + 0.05) return null;
    return { id: a.id, atacante: this, tipo: a.tempos.tipo, bloqueavel: a.def.bloqueavel, restante: tImpacto - t, alcance: a.def.alcance[1] * (this.def.escala || 1) };
  }

  mudar(estado) { this.estado = estado; this.tEstado = 0; }

  podeAtacar(controle) {
    return controle.atacando.size < controle.maxAtacantes || controle.atacando.has(this);
  }

  iniciarAtaque(atq, controle) {
    this.mudar('atacando');
    this.ataque = { def: atq, tempos: ATAQUES_GOBLIN[atq.clip], id: `${this.id}-${this.agora.toFixed(2)}`, acertou: false, soltou: false, impactou: false };
    this.recargas[atq.nome] = atq.recarga * (0.85 + Math.random() * 0.3);
    controle.atacando.add(this);
    this.anim.tocar(atq.clip, { fade: 0.1 });
    this.ctx.audio?.tocar('preparo', this.corpo.pos);
  }

  terminarAtaque(controle) {
    controle.atacando.delete(this);
    this.ataque = null;
    this.mudar('livre');
    this.anim.soltar(0.2);
    this.esperaDecisao = 0.35 + Math.random() * 0.6;
  }

  update(dt, heroi, controle) {
    this.agora += dt;
    this.tEstado += dt;
    this.staggerAcum = Math.max(0, this.staggerAcum - CONFIG.reacao.decaimentoStagger * dt * (this.peso === 'gigante' ? 2.5 : 1));
    for (const k of Object.keys(this.recargas)) this.recargas[k] -= dt;
    const corpo = this.corpo;
    corpo.vel.set(0, 0);
    corpo.velExtra.multiplyScalar(Math.exp(-dt * 6));
    if (this.estado !== 'agarrando' && this.vivo) corpo.semColisaoCorpos = false; // saiu do agarrão (golpe, fuga): volta a colidir

    // Olhos brilham mais forte durante a preparação do golpe (aviso visual).
    const preparando = this.estado === 'atacando' && this.ataque && this.anim.tempoAcao < (this.ataque.tempos.telegrafia ?? 0);
    this.olhos.emissiveIntensity = preparando ? 4 + Math.sin(this.agora * 30) : 1.6;

    switch (this.estado) {
      case 'livre':
      case 'bloqueando':
        this.pensar(dt, heroi, controle);
        break;
      case 'atacando':
        this.executarAtaque(dt, heroi, controle);
        break;
      case 'dano':
        if (this.tEstado > (this.reacaoDur ?? 0.4)) this.voltar();
        break;
      case 'esquivando':
        if (this.tEstado > 0.08 && this.tEstado < 0.35) { const f = corpo.frente; corpo.velExtra.set(-f.x * 4.5, -f.y * 4.5); }
        if (this.tEstado > 0.62) this.voltar();
        break;
      case 'cambaleando':
        if (this.tEstado > (this.reacaoDur ?? 0.9)) this.voltar();
        break;
      case 'repelido':
        if (this.tEstado > 1.1) this.voltar();
        break;
      case 'derrubado':
        if (this.tEstado > 1.9) this.voltar();
        break;
      case 'lancado':
        if (corpo.noChao && this.tEstado > 0.1) { this.mudar('derrubado'); this.anim.tocar('derrubado', { fade: 0.05, inicio: 0.4 }); this.tEstado = 0.4; }
        break;
      case 'preso':
        if (this.tEstado > (this.presoAte ?? 1)) { this.soltarPreso(); }
        break;
      case 'agarrando':
        this.manterAgarrao(dt, heroi, controle);
        break;
      case 'morto':
        if (this.tEstado > 3) this.rig.raiz.position.y -= dt * 0.3;
        if (this.tEstado > 5) this.remover = true;
        break;
    }
    if (this.estado !== 'atacando') controle.atacando.delete(this);

    const queda = corpo.passo(dt, this.ctx.mundo);
    if (queda > 0 && this.estado === 'livre' && queda > 1) { this.mudar('dano'); this.anim.tocar('dano'); }
    const v = corpo.velReal; // velocidade real: parado contra um obstáculo não anda no lugar
    const f = corpo.frente;
    const local = new THREE.Vector2(v.x * f.y - v.y * f.x, v.x * f.x + v.y * f.y);
    const livre = this.estado === 'livre' || this.estado === 'bloqueando';
    this.anim.atualizar(dt, livre ? local : new THREE.Vector2(), null, livre ? corpo.giroMedido : 0);
    // Olha para o herói (menos durante golpes e quedas), com tiques e trancos de impacto
    if (this.vivo) {
      const deitado = ['derrubado', 'lancado'].includes(this.estado);
      this.proc.aplicar(dt, { velMundo: v, giro: corpo.giroMedido, alvo: deitado ? null : heroi.partes.lista[0].centro,
        pesoOlhar: livre ? 1 : this.estado === 'atacando' ? 0.5 : 0.2, inclinar: livre ? 1 : 0.3 });
    }
    this.rig.raiz.updateMatrixWorld(true);
    if (this.vivo) {
      const deitado = ['derrubado', 'lancado', 'esquivando'].includes(this.estado);
      this.ik.aplicar(dt, { travar: livre && corpo.noChao, apoio: (l) => this.anim.peApoiado(l), ligado: corpo.noChao && !deitado });
      // IK das mãos no agarrão: cada mão vai ao ombro do herói (de frente: esquerda ↔ direita)
      if (this.estado === 'agarrando') {
        const O = this.rig.ossos;
        for (const lado of ['Left', 'Right']) {
          doisOssos(O[`${lado}Arm`], O[`${lado}ForeArm`], O[`${lado}Hand`], heroi.pontoAgarrao(lado === 'Left' ? -1 : 1), 1, new THREE.Vector3(-1, 0, 0));
        }
      }
    }
    this.partes.atualizar();
    this.rastroArma.atualizar();
    this.rastroGarra.atualizar();
  }

  voltar() {
    this.mudar('livre');
    this.anim.soltar(0.2);
    // Recupera o equilíbrio: por um instante não é interrompido de novo e revida logo.
    this.staggerAcum = 0;
    this.semInterrupcaoAte = this.agora + CONFIG.reacao.imunidadeLeve;
    this.esperaDecisao = Math.min(this.esperaDecisao, 0.25);
  }

  pensar(dt, heroi, controle) {
    if (!heroi.vivo || heroi.estado === 'vitoria') { return; }
    const corpo = this.corpo;
    const alvo = heroi.corpo.pos;
    const dx = alvo.x - corpo.pos.x, dz = alvo.z - corpo.pos.z;
    const dist = Math.hypot(dx, dz) - heroi.corpo.raio - this.corpo.raio;
    const provocado = this.agora < this.provocadoAte;
    const giro = this.peso === 'gigante' ? 2.2 : 5;
    corpo.olharPara(alvo.x, alvo.z, giro, dt);

    // Escudeiro mantém o escudo erguido enquanto se aproxima.
    // (A guarda da lança já tem o escudo na frente; o estado só muda o ritmo de aproximação.)
    if (this.def.escudo && this.estado === 'livre' && this.agora >= this.guardaQuebradaAte && dist < 4) this.mudar('bloqueando');
    if (this.estado === 'bloqueando' && (dist >= 4 || this.agora < this.guardaQuebradaAte)) this.mudar('livre');

    // Esquiva: pulinho para trás quando o herói prepara um golpe perto (goblins leves e soltos)
    this.esquivaRecarga -= dt;
    const preparoHeroi = heroi.estado === 'acao' && heroi.acao?.fase?.hits?.[0] && heroi.acao.t < heroi.acao.fase.hits[0].t0 - 0.06;
    if (preparoHeroi && heroi.acao !== this.acaoVista) {
      this.acaoVista = heroi.acao;
      const chance = this.tipo === 'batedor' ? 0.45 : 0.25;
      if (this.peso === 'leve' && !this.def.escudo && !this.fixo && dist < 2.3 && this.esquivaRecarga <= 0 && Math.random() < chance) {
        this.esquivaRecarga = 3;
        this.mudar('esquivando');
        this.anim.tocar('esquiva', { fade: 0.05 });
        return;
      }
    }
    this.esperaDecisao -= dt * (provocado ? 2 : 1);
    const frenteOk = anguloAtaque(this, alvo) < 35;
    if (this.esperaDecisao <= 0 && frenteOk && this.podeAtacar(controle) && heroi.estado !== 'agarrado') {
      const opcoes = this.def.ataques.filter((a) => (this.recargas[a.nome] ?? 0) <= 0 && dist >= a.alcance[0] * this.escala * 0.6 && dist <= a.alcance[1] * this.escala);
      if (opcoes.length) {
        let soma = opcoes.reduce((s, a) => s + a.chance, 0) * Math.random();
        const escolhido = opcoes.find((a) => (soma -= a.chance) <= 0) || opcoes[0];
        if (this.estado === 'bloqueando') this.estado = 'livre';
        this.iniciarAtaque(escolhido, controle);
        return;
      }
    }
    // Movimento: aproxima até a distância preferida e circula ao redor.
    const pref = (provocado ? 0.8 : 1) * this.def.distPreferida * (this.def.escala || 1);
    const dir = new THREE.Vector2(dx, dz).normalize();
    let vel = 0;
    let lateral = 0;
    if (dist > pref + 0.4) vel = dist > 4 ? (this.def.velCorrer || this.def.vel) : this.def.vel;
    else if (dist < pref - 0.5) vel = -this.def.vel * 0.6;
    else lateral = this.def.vel * 0.45 * this.ladoCirculo;
    if (this.estado === 'bloqueando') vel *= 0.6;
    if (this.fixo) { vel = 0; lateral = 0; } // fica no lugar (ex.: em cima da plataforma)
    if (Math.random() < dt * 0.2) this.ladoCirculo *= -1;
    const desejo = dir.clone().multiplyScalar(vel).add(new THREE.Vector2(-dir.y, dir.x).multiplyScalar(lateral));
    // Desvia de obstáculos no caminho
    if (vel > 0) {
      const obs = this.ctx.mundo.obstaculoNoCaminho(corpo.pos, alvo, corpo.raio, corpo.pos.y);
      if (obs && obs.t < 0.9) {
        const o = obs.obstaculo;
        const ox = o.x - corpo.pos.x, oz = o.z - corpo.pos.z;
        const lado = ox * dir.y - oz * dir.x > 0 ? 1 : -1;
        desejo.set(-dir.y * lado, dir.x * lado).multiplyScalar(vel).add(dir.clone().multiplyScalar(vel * 0.3));
      }
    }
    corpo.vel.copy(desejo);
  }

  executarAtaque(dt, heroi, controle) {
    const a = this.ataque;
    const t = this.anim.tempoAcao;
    const tempos = a.tempos;
    const corpo = this.corpo;
    if (t < tempos.telegrafia) corpo.olharPara(heroi.corpo.pos.x, heroi.corpo.pos.z, this.peso === 'gigante' ? 1.6 : 4, dt);
    if (a.def.mov && t >= a.def.mov.t0 && t <= a.def.mov.t1) {
      const f = corpo.frente;
      corpo.velExtra.set(f.x * a.def.mov.frente, f.y * a.def.mov.frente);
    }
    // Janela ativa: varre a arma (e a outra garra) contra as partes do herói.
    if (tempos.ativo && !a.acertou && t >= tempos.ativo[0] && t <= tempos.ativo[1] && heroi.vivo) {
      let hit;
      if (a.def.boca) hit = heroi.partes.esferaAtingida(this.rig.boca.getWorldPosition(new THREE.Vector3()), 0.12);
      else hit = heroi.partes.atingida(this.rastroArma.pontos(0, 4).concat(this.rastroGarra.pontos(0, 2)), 0.03);
      if (hit) {
        a.acertou = true;
        if (tempos.tipo === 'agarrao') {
          const r = heroi.serAgarrado(this);
          if (r) { this.mudar('agarrando'); this.anim.tocar('segurando', { loop: true }); controle.atacando.delete(this); return; }
        } else {
          this.golpearHeroi(heroi, a.def, hit.ponto, tempos.tipo);
        }
      }
    }
    // Projétil
    if (a.def.projetil && !a.soltou && t >= tempos.solta) {
      a.soltou = true;
      const mao = this.rig.ossos.RightHand.getWorldPosition(new THREE.Vector3());
      this.ctx.lancarPedra(this, mao, heroi, a.def);
    }
    // Ataque em área (pisão)
    if (a.def.area && !a.impactou && t >= tempos.impacto) {
      a.impactou = true;
      const f = corpo.frente;
      const centro = new THREE.Vector3(corpo.pos.x + f.x * a.def.area.frente, corpo.pos.y, corpo.pos.z + f.y * a.def.area.frente);
      this.ctx.efeitos?.poeira(centro, 2.4);
      this.ctx.tremer?.(0.12);
      this.ctx.audio?.tocar('impactoChao', centro);
      const d = Math.hypot(heroi.corpo.pos.x - centro.x, heroi.corpo.pos.z - centro.z);
      if (d < a.def.area.raio && heroi.corpo.pos.y < 0.8 + corpo.pos.y) this.golpearHeroi(heroi, a.def, heroi.centro.clone(), 'area');
    }
    if (t >= tempos.dur - 0.01) this.terminarAtaque(controle);
  }

  golpearHeroi(heroi, atq, ponto, tipo) {
    const r = heroi.receberGolpe({
      atacante: this, forca: this.def.forca, mult: atq.mult, stagger: atq.stagger, tipo,
      bloqueavel: atq.bloqueavel, origem: this.corpo.pos, ponto,
    });
    if (r === 'perfeito') this.repelir();
    return r;
  }

  manterAgarrao(dt, heroi) {
    this.corpo.semColisaoCorpos = heroi.estado === 'agarrado'; // colado no herói: sem empurrar um ao outro
    // Fica na frente do herói, preso a ele.
    const f = heroi.corpo.frente;
    this.corpo.pos.x = heroi.corpo.pos.x + f.x * 0.42;
    this.corpo.pos.z = heroi.corpo.pos.z + f.y * 0.42;
    this.corpo.yaw = heroi.corpo.yaw + Math.PI;
    if (heroi.estado !== 'agarrado') { this.corpo.semColisaoCorpos = false; this.mudar('cambaleando'); this.anim.tocar('cambalear'); }
  }

  repelir() {
    this.ctx.controle.atacando.delete(this);
    this.ataque = null;
    this.mudar('repelido');
    this.anim.tocar('repelido', { fade: 0.08 });
    const f = this.corpo.frente;
    this.corpo.velExtra.set(-f.x * 3, -f.y * 3);
  }

  prender(duracao) {
    if (this.peso === 'gigante') { this.presoAte = 0.6; } // resiste: solta logo
    else this.presoAte = duracao;
    this.ctx.controle.atacando.delete(this);
    this.ataque = null;
    this.mudar('preso');
    this.anim.tocar('cambalear', { fade: 0.05 });
    return this.peso !== 'gigante';
  }

  soltarPreso() { if (this.estado === 'preso') { this.mudar('cambaleando'); this.anim.tocar('cambalear'); } }

  provocar(duracao) {
    if (this.def.imuneProvocacao) return false;
    this.provocadoAte = this.agora + duracao;
    this.esperaDecisao = Math.min(this.esperaDecisao, 0.3);
    return true;
  }

  // Recebe um golpe do herói. Retorna o resultado para feedback, XP e IA.
  receberGolpe(g) {
    if (!this.vivo) return null;
    const parte = g.parte || this.partes.lista[1];
    let mult = g.mult * (parte.mult || 1);
    let stagger = g.stagger;
    let bloqueado = false;
    // Escudo do escudeiro: bloqueia golpes frontais, a menos que a guarda seja quebrada.
    if (this.guardaErguida && anguloAtaque(this, g.origem) < 70 && g.fonte !== 'area') {
      if (g.efeito === 'quebraGuarda' || stagger >= 75) {
        this.guardaQuebradaAte = this.agora + 3;
        this.staggerAcum = this.resistStagger;
        this.mudar('cambaleando');
        this.anim.tocar('cambalear', { fade: 0.08 });
        this.ctx.audio?.tocar('bloqueio', this.centro);
        return { bloqueado: false, quebrouGuarda: true, dano: 0, parte, reacao: 'cambaleando', alvo: this };
      }
      bloqueado = true;
      mult *= 0.15;
      stagger *= 0.35;
    }
    this.proc.impulso(bloqueado ? 'tronco' : parte.nome, g.origem, Math.min(1.2, (bloqueado ? 0.15 : 0.35) + stagger / this.resistStagger) * (this.peso === 'gigante' ? 0.35 : 1));
    if (this.estado === 'derrubado' && g.bonusCaido) mult *= g.bonusCaido;
    if (this.vulneravel) mult *= 1.15;
    const dano = calcularDano(g.forca, mult, 1, this.def.defesa);
    this.vida -= dano;
    this.staggerAcum += stagger;
    let reacao = 'nenhuma';
    if (this.vida <= 0) {
      this.vida = 0;
      this.morrer(g);
      reacao = 'morte';
    } else if (!bloqueado && this.estado !== 'preso' && this.estado !== 'lancado') {
      reacao = decidirReacao(this, g);
      this.aplicarReacao(reacao, g);
    }
    return { bloqueado, dano, parte, reacao, morreu: reacao === 'morte', alvo: this, fraca: !!parte.fraca };
  }

  aplicarReacao(reacao, g) {
    // Reação leve só interrompe inimigos leves, e não duas vezes seguidas (senão ficam presos
    // levando golpe sem nunca atacar). Durante a janela ativa do golpe eles também não param.
    if (reacao === 'leve') {
      const emJanela = this.estado === 'atacando' && this.ataque?.tempos.ativo && this.anim.tempoAcao >= this.ataque.tempos.ativo[0] - 0.08;
      if (this.peso !== 'leve' || emJanela || this.agora < (this.semInterrupcaoAte ?? 0)) return;
      this.semInterrupcaoAte = this.agora + CONFIG.reacao.imunidadeLeve;
    }
    // Cambaleio também respeita a recuperação de equilíbrio (efeitos fortes ainda derrubam/lançam).
    if (reacao === 'cambaleando' && this.agora < (this.semInterrupcaoAte ?? 0) && !g.efeito) return;
    if (reacao === 'nenhuma') return;
    if (this.estado === 'agarrando') this.ctx.heroiSolto?.();
    this.ctx.controle.atacando.delete(this);
    this.ataque = null;
    const dir = new THREE.Vector2(this.corpo.pos.x - g.origem.x, this.corpo.pos.z - g.origem.z).normalize();
    const parte = g.parte?.nome || 'tronco', angulo = anguloAtaque(this, g.origem);
    const gigante = this.peso === 'gigante';
    if (reacao === 'leve') {
      const clip = escolherReacao(parte, angulo, 'leve');
      this.mudar('dano'); this.reacaoDur = this.anim.clipes[clip].duration * 0.9;
      this.anim.tocar(clip, { fade: 0.08 }); this.corpo.velExtra.set(dir.x * 1.2, dir.y * 1.2);
    }
    if (reacao === 'cambaleando') {
      // Pancada de escudo/trombada empurra (tropeça para trás); golpe muito forte recua; senão cambaleia.
      const empurrao = !gigante && (g.fonte === 'escudo' || g.fonte === 'corpo');
      const clip = empurrao ? 'empurrado' : !gigante && g.stagger >= this.resistStagger * 1.6 ? 'danoForte' : 'cambalear';
      const ts = gigante ? 0.75 : 1; // o gigante reage mais devagar, com peso
      this.mudar('cambaleando'); this.reacaoDur = this.anim.clipes[clip].duration / ts * 0.95;
      this.anim.tocar(clip, { fade: 0.08, ts });
      const v = gigante ? 0.6 : empurrao ? 3.6 : 2.5;
      this.corpo.velExtra.set(dir.x * v, dir.y * v); this.staggerAcum *= 0.5;
    }
    if (reacao === 'derrubado') { this.mudar('derrubado'); this.anim.tocar('derrubado', { fade: 0.08 }); this.corpo.velExtra.set(dir.x * 3.5, dir.y * 3.5); this.staggerAcum = 0; }
    if (reacao === 'lancado') {
      this.mudar('lancado');
      this.anim.tocar('lancado', { fade: 0.08, loop: true });
      this.corpo.pular(g.forcaLancar || 6);
      this.corpo.velExtra.set(dir.x * 2, dir.y * 2);
      this.staggerAcum = 0;
    }
  }

  morrer(g = null) {
    this.ctx.controle.atacando.delete(this);
    if (this.estado === 'agarrando') this.ctx.heroiSolto?.();
    this.ataque = null;
    this.mudar('morto');
    // Golpe de frente derruba para trás; pelas costas ou de lado, cai para a frente
    const deFrente = g && anguloAtaque(this, g.origem) < 80;
    this.anim.tocar(deFrente ? 'morteTras' : 'morte', { fade: 0.06 });
    if (g) { const d = new THREE.Vector2(this.corpo.pos.x - g.origem.x, this.corpo.pos.z - g.origem.z).normalize(); this.corpo.velExtra.set(d.x * 1.5, d.y * 1.5); }
    this.olhos.emissiveIntensity = 0;
    this.corpo.semColisaoCorpos = true;
  }

  destruir() { this.ctx.cena.remove(this.rig.raiz); }
}

// Morcegão: voa em volta do herói, mergulha para atacar e cai quando atingido nas asas.
export class Morcego {
  constructor(ctx, pos) {
    this.tipo = 'morcego';
    this.def = TIPOS.morcego;
    this.ctx = ctx;
    this.id = proximoId++;
    this.rig = criarMorcego();
    this.rig.raiz.position.copy(pos).setY(this.def.altitude);
    ctx.cena.add(this.rig.raiz);
    this.corpo = new Corpo(this.rig.raiz, this.def.raio, this.def.massa);
    this.corpo.voador = true;
    this.corpo.semColisaoCorpos = true;
    // Partes em volta do corpo e nas asas (ponto fraco: asas derrubam o morcego).
    const ossos = { corpo: this.rig.corpo, asaE: this.rig.asas[0].ponta, asaD: this.rig.asas[1].ponta, cabeca: this.rig.cabeca };
    this.partes = new Partes([
      { nome: 'corpo', osso: 'corpo', raio: 0.22, mult: 1 },
      { nome: 'cabeça', osso: 'cabeca', raio: 0.12, mult: 1.3, fraca: true },
      { nome: 'asa', osso: 'asaE', offset: [-0.15, 0, -0.1], raio: 0.22, mult: 0.8, asa: true },
      { nome: 'asa', osso: 'asaD', offset: [0.15, 0, -0.1], raio: 0.22, mult: 0.8, asa: true },
    ], ossos, 1.3);
    this.vidaMax = this.def.vida;
    this.vida = this.vidaMax;
    this.peso = 'leve';
    this.resistStagger = this.def.resistStagger;
    this.staggerAcum = 0;
    this.estado = 'voando';
    this.tEstado = 0;
    this.agora = 0;
    this.angulo = Math.random() * Math.PI * 2;
    this.espera = 2 + Math.random() * 2;
    this.provocadoAte = 0;
    this.remover = false;
    this.olhos = this.rig.materiais.olhos;
    this.ataqueId = 0;
    this.altitudeAtual = this.def.altitude;
  }

  get vivo() { return this.estado !== 'morto'; }
  get nome() { return this.def.nome; }
  get voador() { return this.estado !== 'abatido'; }
  get caido() { return this.estado === 'abatido' && this.tEstado > 0.4; }
  get vulneravel() { return this.estado === 'abatido'; }
  get guardaErguida() { return false; }
  get centro() { return this.partes.lista[0].centro; }
  get ameaca() {
    if (this.estado !== 'preparando' && this.estado !== 'mergulho') return null;
    const restante = this.estado === 'preparando' ? 0.6 - this.tEstado + 0.25 : Math.max(0, this.distHeroi / 9 - 0.05);
    return { id: `m${this.id}-${this.ataqueId}`, atacante: this, tipo: 'investida', bloqueavel: true, restante, alcance: 6 };
  }

  mudar(e) { this.estado = e; this.tEstado = 0; }

  update(dt, heroi, controle) {
    this.agora += dt;
    this.tEstado += dt;
    this.staggerAcum = Math.max(0, this.staggerAcum - 30 * dt);
    const c = this.corpo, p = c.pos;
    const h = heroi.corpo.pos;
    this.distHeroi = Math.hypot(h.x - p.x, h.y + 1.1 - p.y, h.z - p.z);
    let flap = 14;
    const provocado = this.agora < this.provocadoAte;
    switch (this.estado) {
      case 'voando': {
        this.angulo += dt * 0.5;
        const alvo = new THREE.Vector3(h.x + Math.cos(this.angulo) * 3.2, this.def.altitude + Math.sin(this.agora * 1.3) * 0.25, h.z + Math.sin(this.angulo) * 3.2);
        p.lerp(alvo, 1 - Math.exp(-dt * 1.5));
        c.olharPara(h.x, h.z, 4, dt);
        this.espera -= dt * (provocado ? 2.5 : 1);
        if (this.espera <= 0 && heroi.vivo && controle.atacando.size < controle.maxAtacantes) { this.mudar('preparando'); this.ataqueId++; controle.atacando.add(this); this.ctx.audio?.tocar('guincho', p); }
        break;
      }
      case 'preparando':
        p.y += dt * 0.5;
        flap = 22;
        c.olharPara(h.x, h.z, 6, dt);
        this.olhos.emissiveIntensity = 4;
        if (this.tEstado > 0.6) { this.mudar('mergulho'); this.alvoMergulho = new THREE.Vector3(h.x, h.y + 1.1, h.z); this.acertou = false; }
        break;
      case 'mergulho': {
        const d = new THREE.Vector3().subVectors(this.alvoMergulho, p);
        const passo = 9 * dt;
        if (d.length() < passo || this.tEstado > 1.2) { this.mudar('subindo'); controle.atacando.delete(this); break; }
        p.addScaledVector(d.normalize(), passo);
        c.olharPara(this.alvoMergulho.x, this.alvoMergulho.z, 8, dt);
        flap = 6;
        if (!this.acertou && heroi.vivo) {
          const garras = this.rig.garras.getWorldPosition(new THREE.Vector3());
          const hit = heroi.partes.esferaAtingida(garras, 0.25);
          if (hit) {
            this.acertou = true;
            const r = heroi.receberGolpe({ atacante: this, forca: this.def.forca, mult: 1, stagger: 25, tipo: 'investida', bloqueavel: true, origem: p.clone(), ponto: hit.ponto });
            if (r === 'perfeito') this.abater();
            else this.mudar('subindo');
            controle.atacando.delete(this);
          }
        }
        break;
      }
      case 'subindo':
        p.y += dt * 2.2;
        if (p.y >= this.def.altitude) { this.mudar('voando'); this.espera = 2.5 + Math.random() * 2.5; this.olhos.emissiveIntensity = 1.5; }
        break;
      case 'dano':
        if (this.tEstado > 0.35) this.mudar(p.y > 1.5 ? 'voando' : 'subindo');
        break;
      case 'abatido':
        flap = 0;
        if (p.y > 0.25) { this.vy = (this.vy ?? 0) - 12 * dt; p.y = Math.max(0.25, p.y + this.vy * dt); }
        if (this.tEstado > 3.4) { this.mudar('subindo'); this.vy = 0; }
        break;
      case 'morto':
        flap = 0;
        if (p.y > 0.2) { this.vy = (this.vy ?? 0) - 12 * dt; p.y = Math.max(0.2, p.y + this.vy * dt); }
        if (this.tEstado > 4) this.remover = true;
        break;
    }
    if (this.estado !== 'preparando' && this.estado !== 'mergulho') controle.atacando.delete(this);
    // Asas: batidas procedurais; recolhidas quando cai.
    for (const a of this.rig.asas) {
      if (flap > 0) {
        a.ombro.rotation.z = a.lado * Math.sin(this.agora * flap) * 0.6;
        a.ponta.rotation.z = a.lado * Math.sin(this.agora * flap - 0.8) * 0.5;
      } else {
        a.ombro.rotation.z = a.lado * -0.9 + Math.sin(this.agora * 20) * 0.05;
        a.ponta.rotation.z = a.lado * -1.2;
      }
    }
    this.rig.corpo.rotation.x = this.estado === 'mergulho' ? 0.6 : this.estado === 'abatido' ? Math.PI * 0.45 : 0;
    this.ctx.mundo.resolver(c);
    c.raiz.rotation.y = c.yaw;
    this.rig.raiz.updateMatrixWorld(true);
    this.partes.atualizar();
  }

  abater() {
    this.mudar('abatido');
    this.vy = 0;
    this.olhos.emissiveIntensity = 0.8;
    this.ctx.controle.atacando.delete(this);
  }

  provocar(duracao) { this.provocadoAte = this.agora + duracao; this.espera = Math.min(this.espera, 0.4); return true; }
  prender() { return false; }
  repelir() { this.abater(); }

  receberGolpe(g) {
    if (!this.vivo) return null;
    const parte = g.parte || this.partes.lista[0];
    const mult = g.mult * (parte.mult || 1) * (this.estado === 'abatido' && g.bonusCaido ? g.bonusCaido : 1) * (this.estado === 'abatido' ? 1.15 : 1);
    const dano = calcularDano(g.forca, mult, 1, this.def.defesa);
    this.vida -= dano;
    this.staggerAcum += g.stagger;
    let reacao = 'leve';
    if (this.vida <= 0) { this.vida = 0; this.mudar('morto'); this.vy = 0; this.olhos.emissiveIntensity = 0; reacao = 'morte'; this.ctx.controle.atacando.delete(this); }
    else if (this.estado !== 'abatido' && (parte.asa || g.efeito === 'derrubarVoador' || this.staggerAcum >= this.resistStagger * 2)) { this.abater(); reacao = 'derrubado'; }
    else if (this.estado !== 'abatido') { this.mudar('dano'); this.ctx.controle.atacando.delete(this); }
    return { bloqueado: false, dano, parte, reacao, morreu: reacao === 'morte', alvo: this, fraca: !!parte.fraca };
  }

  destruir() { this.ctx.cena.remove(this.rig.raiz); }
}
