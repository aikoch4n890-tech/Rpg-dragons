// Máquina de estados de um lutador: guarda, golpe, defesa, impacto na defesa, dano.
import * as THREE from 'three';
import { GOLPES } from './poses.js';

let contagemGolpes = 0;
const BUFFER_ATAQUE = 0.3; // um toque até 0,3 s antes da hora ainda conta (buffer de comando)

export class Lutador {
  constructor(rig, clipes) {
    this.rig = rig;
    this.mixer = new THREE.AnimationMixer(rig.raiz);
    this.acoes = {};
    for (const [nome, clip] of Object.entries(clipes)) {
      const a = this.mixer.clipAction(clip);
      if (nome !== 'guarda') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.acoes[nome] = a;
    }
    this.estado = 'guarda';
    this.atual = this.acoes.guarda;
    this.atual.play();
    this.golpe = null; // nome do golpe em andamento
    this.acertou = false; // o golpe atual já acertou?
    this.bufferAtaque = 0;
    this.segurandoDefesa = false;
    this.pausa = 0; // hitstop
    this.flash = 0;
    this.materiais = [];
    rig.raiz.traverse((o) => { if (o.isMesh && !this.materiais.includes(o.material)) this.materiais.push(o.material); });
  }

  tocar(nome, fade = 0.08) {
    const nova = this.acoes[nome];
    nova.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    if (this.atual && this.atual !== nova) this.atual.fadeOut(fade);
    this.atual = nova;
  }

  get tempo() { return this.atual.time; }

  atacar() { this.bufferAtaque = BUFFER_ATAQUE; }
  defender(segurar) { this.segurandoDefesa = segurar; }

  iniciarGolpe(nome) {
    this.estado = 'golpe';
    this.golpe = nome;
    this.idGolpe = ++contagemGolpes; // identifica cada golpe, para a IA reagir uma vez só
    this.acertou = false;
    this.bufferAtaque = 0;
    this.tocar(nome, nome === 'corte1' || nome === 'golpeInimigo' ? 0.08 : 0.05);
  }

  // Está com o escudo levantado o suficiente para segurar um golpe?
  get defendendo() {
    return (this.estado === 'defesa' && this.tempo >= 0.06) || this.estado === 'defesaImpacto';
  }

  // Janela ativa do golpe: a lâmina machuca.
  get golpeAtivo() {
    if (this.estado !== 'golpe' || this.acertou) return false;
    const [ini, fim] = GOLPES[this.golpe].ativo;
    return this.tempo >= ini && this.tempo <= fim;
  }

  // O rastro da espada aparece um pouco antes e some um pouco depois da janela ativa.
  get rastroVisivel() {
    if (this.estado !== 'golpe') return false;
    const [ini, fim] = GOLPES[this.golpe].ativo;
    return this.tempo >= ini - 0.06 && this.tempo <= fim + 0.05;
  }

  // Chamado quando um golpe chega. Retorna 'defendido' ou 'acertou'.
  receberGolpe() {
    if (this.defendendo) {
      this.estado = 'defesaImpacto';
      this.tocar('defesaImpacto', 0.04);
      return 'defendido';
    }
    this.estado = 'dano';
    this.golpe = null;
    this.flash = 1;
    this.tocar('dano', 0.04);
    return 'acertou';
  }

  poseT(ligar) {
    this.estado = ligar ? 'poseT' : 'guarda';
    this.tocar(ligar ? 'poseT' : 'guarda', 0.3);
  }

  update(dt) {
    if (this.pausa > 0) {
      this.pausa -= dt;
      this.mixer.update(0);
    } else {
      this.mixer.update(dt);
    }
    this.bufferAtaque = Math.max(0, this.bufferAtaque - dt);

    // Flash vermelho ao levar dano.
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      for (const m of this.materiais) if (m.emissive) m.emissive.setRGB(0.6 * this.flash, 0.05 * this.flash, 0);
    }

    const terminou = this.atual.time >= this.atual.getClip().duration - 1e-4;
    switch (this.estado) {
      case 'guarda':
        if (this.segurandoDefesa) { this.estado = 'defesa'; this.tocar('defesa', 0.06); }
        else if (this.bufferAtaque > 0) this.iniciarGolpe('corte1');
        break;
      case 'golpe': {
        const g = GOLPES[this.golpe];
        const [, fimAtivo] = g.ativo;
        if (g.proximo && this.bufferAtaque > 0 && this.tempo >= g.combo) this.iniciarGolpe(g.proximo);
        else if (this.segurandoDefesa && this.tempo > fimAtivo) { this.estado = 'defesa'; this.golpe = null; this.tocar('defesa', 0.06); }
        else if (terminou) { this.estado = 'guarda'; this.golpe = null; this.tocar('guarda', 0.15); }
        break;
      }
      case 'defesa':
        if (!this.segurandoDefesa) { this.estado = 'guarda'; this.tocar('guarda', 0.12); }
        break;
      case 'defesaImpacto':
        if (terminou) {
          this.estado = this.segurandoDefesa ? 'defesa' : 'guarda';
          if (this.estado === 'defesa') { this.tocar('defesa', 0.05); this.atual.time = 0.12; }
          else this.tocar('guarda', 0.12);
        }
        break;
      case 'dano':
        if (terminou) { this.estado = 'guarda'; this.tocar('guarda', 0.12); }
        break;
    }
  }
}
