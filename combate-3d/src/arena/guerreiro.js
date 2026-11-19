// Controlador do Guerreiro: estados, movimento, execução de habilidades (por fases),
// hitboxes, defesa e defesa perfeita, agarrão, salto, queda controlada, stamina e reações.
// A IA (iaGuerreiro.js) decide o que fazer; este arquivo só executa e aplica as regras.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { criarPersonagem } from '../rig.js';
import { criarHeroiBloco } from '../modelosBloco.js';
import { Corpo, Animador } from './corpo.js';
import { Partes, RastroArma, calcularDano, anguloAtaque } from './golpes.js';
import { POR_ID, ATAQUES_BASICOS } from './habilidades.js';
import { ITENS } from './equipamentos.js';
import { Procedural } from '../procedural.js';
import { IKPes } from '../ik.js';
import { escolherReacao } from '../reacoes.js';

const PARTES_HEROI = [
  { nome: 'cabeça', osso: 'Head', offset: [0, 0.15, 0.01], raio: 0.15, mult: 1.2 },
  { nome: 'tronco', osso: 'Spine1', offset: [0, 0.08, 0], raio: 0.22, mult: 1 },
  { nome: 'abdômen', osso: 'Spine', offset: [0, 0.05, 0], raio: 0.2, mult: 1 },
  { nome: 'quadril', osso: 'Hips', offset: [0, -0.04, 0], raio: 0.21, mult: 1 },
  { nome: 'coxa', osso: 'LeftUpLeg', offset: [0, -0.2, 0], raio: 0.14, mult: 0.9 },
  { nome: 'coxa', osso: 'RightUpLeg', offset: [0, -0.2, 0], raio: 0.14, mult: 0.9 },
  { nome: 'pernas', osso: 'LeftLeg', offset: [0, -0.15, 0], raio: 0.13, mult: 0.9 },
  { nome: 'pernas', osso: 'RightLeg', offset: [0, -0.15, 0], raio: 0.13, mult: 0.9 },
];

// Clipes que ficam parados na última pose (seguram até a fase acabar).
const CLIPES_SEGURAR = new Set(['arranque', 'giro', 'espetoTorcer', 'muralha', 'pulo']);

export class Guerreiro {
  constructor(ctx) {
    this.ctx = ctx;
    this.progresso = ctx.progresso;
    this.rig = ctx.estiloModelos === 'classico' ? criarPersonagem() : criarHeroiBloco(); // modelos em blocos (padrão) ou os primeiros
    ctx.cena.add(this.rig.raiz);
    this.corpo = new Corpo(this.rig.raiz, CONFIG.guerreiro.raio, 3);
    this.anim = new Animador(this.rig.raiz, ctx.clipes);
    this.partes = new Partes(PARTES_HEROI, this.rig.ossos);
    this.rastro = new RastroArma(this.rig.espada.base, this.rig.espada.ponta);
    this.proc = new Procedural(this.rig);
    this.ik = new IKPes(this.rig, ctx.mundo, { alturaTornozelo: 0.09 });
    this.olharAlvo = null; // a IA aponta o inimigo que o herói acompanha com a cabeça
    this.intencao = { vel: new THREE.Vector2(), olhar: null, correr: false, sprint: false };
    this.estado = 'livre';
    this.tEstado = 0;
    this.acao = null;
    this.agora = 0;
    this.recargas = {};
    this.usoRecente = {};
    this.buffs = {};
    this.contraAte = 0;
    this.atrasoRegen = 0;
    this.staggerAcum = 0;
    this.estadoIA = 'Explorando';
    this.velAtual = new THREE.Vector2();
    this.aplicarEquipamento();
    this.vida = this.stats.vidaMax;
    this.stamina = this.stats.staminaMax;
  }

  // ---------- Atributos e equipamento ----------
  aplicarEquipamento() {
    this.stats = this.progresso.atributos();
    const eq = this.progresso.dados.equip;
    const v = this.rig.visual;
    const vis = new Set(Object.values(eq).map((id) => ITENS[id].visual).filter(Boolean));
    v.elmo.visible = vis.has('elmo');
    v.capa.visible = vis.has('capa');
    v.cota.visible = vis.has('cota');
    for (const b of v.bracais) b.visible = vis.has('bracais');
    for (const g of v.grevas) g.visible = vis.has('grevas');
    this.rig.espada.espada.scale.set(1, 1, this.stats.tamanhoLamina);
    this.rig.escudo.escudo.scale.setScalar(this.stats.tamanhoEscudo);
    if (this.vida !== undefined) {
      this.vida = Math.min(this.vida, this.stats.vidaMax);
      this.stamina = Math.min(this.stamina, this.stats.staminaMax);
    }
  }

  get vivo() { return this.estado !== 'morto'; }
  get centro() { return this.partes.lista[1].centro; }
  get livre() { return this.estado === 'livre' || this.estado === 'defesa'; }
  get vidaFracao() { return this.vida / this.stats.vidaMax; }
  get staminaFracao() { return this.stamina / this.stats.staminaMax; }
  get exausto() { return this.estado === 'exausto'; }
  get emContra() { return this.agora < this.contraAte; }
  get forcaAtual() {
    let f = this.stats.forca;
    if (this.progresso.melhoriaAtiva('furiaFinal') && this.vidaFracao < CONFIG.melhorias.furiaFinal.limiarVida) f *= 1 + CONFIG.melhorias.furiaFinal.bonusForca;
    return f;
  }
  get fatorCarga() {
    const excesso = Math.max(0, this.stats.peso - this.stats.carga) / this.stats.carga;
    return Math.max(1 - CONFIG.guerreiro.pesoPenalidade, 1 - excesso);
  }
  get guardaAtiva() {
    if (this.estado === 'defesa') return true;
    return this.estado === 'acao' && !!this.acao?.fase?.guarda;
  }

  mudar(estado) { this.estado = estado; this.tEstado = 0; }

  gastar(st) {
    this.stamina -= st;
    this.atrasoRegen = CONFIG.stamina.atrasoRegen;
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.ficarExausto();
    }
  }

  ficarExausto() {
    if (this.estado === 'morto' || this.estado === 'agarrado') return;
    this.acao = null;
    this.mudar('exausto');
    this.anim.tocar('exausto', { loop: true, fade: 0.15 });
    this.ctx.evento?.('exausto');
  }

  // ---------- Pedidos da IA ----------
  podeUsar(h) {
    if (!this.livre) return false;
    if (h.ia?.naoUsar) return false;
    if ((this.recargas[h.id] ?? 0) > 0) return false;
    if (this.stamina < h.stamina) return false;
    return true;
  }

  usarHabilidade(id, alvo) {
    const h = POR_ID[id];
    if (!h || !this.podeUsar(h)) return false;
    this.gastar(h.stamina);
    if (this.estado === 'exausto') return false;
    this.recargas[id] = h.recarga;
    this.usoRecente[id] = this.agora;
    if (h.sequencia) this.iniciarAcao({ tipo: 'habilidade', def: h, alvo, fases: [], seq: { n: 0 } });
    else this.iniciarAcao({ tipo: 'habilidade', def: h, alvo, fases: h.fases.map((f) => ({ ...f })) });
    this.ctx.evento?.('habilidade', h);
    this.ctx.audio?.tocar('habilidade', this.corpo.pos);
    return true;
  }

  // Combo básico: n golpes (1 a 3), ou golpe carregado.
  ataqueBasico(alvo, n = 3, carregado = false) {
    if (!this.livre) return false;
    const seq = carregado ? ['carregado'] : ['corte1', 'corte2', 'corte3'].slice(0, n);
    const custo = seq.reduce((s, k) => s + ATAQUES_BASICOS[k].stamina, 0);
    if (this.stamina < custo * 0.5) return false;
    const fases = seq.map((k, i) => ({ ...ATAQUES_BASICOS[k], fimEm: i < seq.length - 1 ? ATAQUES_BASICOS[k].combo : undefined, custo: ATAQUES_BASICOS[k].stamina }));
    this.iniciarAcao({ tipo: 'basico', def: { id: carregado ? 'carregado' : 'combo', nome: carregado ? 'Golpe Carregado' : 'Combo' }, alvo, fases });
    return true;
  }

  defender(sim) {
    if (sim && this.estado === 'livre') {
      this.mudar('defesa');
      this.inicioDefesa = this.agora;
      this.anim.tocarSuperior('defesa', { fade: 0.06 }); // só o tronco: as pernas continuam andando
    } else if (!sim && this.estado === 'defesa') {
      this.mudar('livre');
      this.anim.soltarSuperior(0.14);
    }
  }

  passoAtras(direcaoLocal = 0) {
    if (!this.livre || this.stamina < 10) return false;
    this.gastar(10);
    if (this.estado === 'exausto') return false;
    this.iniciarAcao({ tipo: 'mov', def: { id: 'passoAtras', nome: 'Recuo' }, fases: [{ clip: 'passoAtras', mov: [{ t0: 0.02, t1: 0.26, frente: -5, lado: direcaoLocal * 2 }] }] });
    return true;
  }

  // Impulso (salto): pula na direção indicada (vetor 2D no mundo).
  saltar(dir, distancia = 3) {
    const h = this.progresso.fundamentalAtiva('impulso');
    if (!h || !this.livre || !this.corpo.noChao || this.stamina < h.stamina || (this.recargas.impulso ?? 0) > 0) return false;
    this.gastar(h.stamina);
    if (this.estado === 'exausto') return false;
    this.recargas.impulso = h.recarga;
    this.corpo.yaw = Math.atan2(dir.x, dir.y);
    this.iniciarAcao({ tipo: 'salto', def: h, fases: [{ clip: 'preparoPulo', dur: 0.16 }], saltoDir: dir.clone().normalize(), saltoDist: Math.min(distancia, h.salto.frente) });
    this.ctx.evento?.('habilidade', h);
    return true;
  }

  ataqueNoAr(alvo) {
    if (this.estado !== 'salto' || this.acao?.ataqueAr) return false;
    this.acao = { tipo: 'basico', def: { id: 'salto', nome: 'Ataque Aéreo' }, alvo, fases: [{ ...ATAQUES_BASICOS.salto }], i: -1, ataqueAr: true, noAr: true };
    this.mudar('acao');
    this.proximaFase();
    return true;
  }

  // Interrompe a ação atual quando possível (cancelamento controlado).
  podeCancelar() {
    if (this.estado !== 'acao' || !this.acao) return this.livre;
    const a = this.acao;
    if (a.tipo === 'basico' && a.fase && a.t > (a.fase.hits?.[0]?.t1 ?? 0)) return true;
    if (a.seq && a.fase && a.t > (a.fase.hits?.[0]?.t1 ?? 0)) return true; // entre cortes da sequência
    if (a.def.cancelavel && a.t >= a.def.cancelavel) return true;
    if (a.fase?.cancelavelSemAmeaca) return true;
    return false;
  }
  cancelar() {
    if (!this.podeCancelar()) return false;
    if (this.acao?.presa) this.acao.presa.soltarPreso?.();
    this.acao = null;
    this.mudar('livre');
    this.anim.soltar(0.1);
    return true;
  }

  // ---------- Execução de ações por fases ----------
  iniciarAcao(acao) {
    if (this.estado === 'defesa') this.anim.soltarSuperior(0.06);
    acao.i = -1;
    acao.acertouAlgum = false;
    this.acao = acao;
    this.mudar('acao');
    // Lado livre para recuos direcionáveis: o lado com menos inimigos e obstáculos.
    acao.ladoLivre = this.ladoMaisLivre();
    this.proximaFase();
  }

  ladoMaisLivre() {
    const lado = this.corpo.lado;
    let pontos = 0;
    for (const e of this.ctx.inimigos()) {
      if (!e.vivo) continue;
      const dx = e.corpo.pos.x - this.corpo.pos.x, dz = e.corpo.pos.z - this.corpo.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4) pontos += Math.sign(dx * lado.x + dz * lado.y) / Math.max(d, 0.5);
    }
    for (const s of [1, -1]) {
      const p = { x: this.corpo.pos.x + lado.x * s * 1.5, z: this.corpo.pos.z + lado.y * s * 1.5 };
      if (this.ctx.mundo.obstaculos.some((o) => this.ctx.mundo.dentro(o, p.x, p.z, 0.5) && o.h > this.corpo.pos.y + 0.2)) pontos += s * 2;
    }
    return pontos > 0 ? -1 : 1; // -1 = direita do personagem, 1 = esquerda
  }

  proximaFase() {
    const a = this.acao;
    const anteriorAcertou = a.fase ? a.acertouFase : true;
    // Sequência contínua: cria a próxima fase enquanto fizer sentido.
    if (a.seq && a.i + 1 >= a.fases.length) {
      const s = a.def.sequencia;
      const alvoOk = a.alvo && a.alvo.vivo && this.distanciaAte(a.alvo) < a.def.alcance + 0.4;
      if (a.seq.n < s.max && alvoOk && !a.pararSeq && this.stamina >= a.def.stamina) {
        if (a.seq.n > 0) this.gastar(a.def.stamina);
        const ts = 1 + (s.acelera || 0) * a.seq.n;
        a.fases.push({ clip: s.clips[a.seq.n % 2], ts, hits: [{ ...s.hit, fonte: 'lamina' }], mov: [{ t0: 0.04, t1: 0.16, frente: s.mov / 0.12 }] });
        a.seq.n++;
      } else if (s.final && !a.seq.final && a.seq.n >= 3) {
        a.seq.final = true;
        a.fases.push({ ...s.final });
      }
    }
    a.i++;
    if (a.i >= a.fases.length || this.estado !== 'acao') { this.terminarAcao(); return; }
    const f = a.fases[a.i];
    if (f.condicao === 'acertou' && !anteriorAcertou) { this.terminarAcao(); return; }
    a.fase = f;
    a.t = 0;
    a.acertouFase = false;
    a.hitsFeitos = (f.hits || []).map(() => new Set());
    a.proximoRepetido = f.hitsRepetidos ? f.hitsRepetidos.intervalo * 0.5 : Infinity;
    a.efeitoFeito = false;
    if (f.custo) this.gastar(f.custo);
    if (this.estado !== 'acao') return;
    const clip = this.ctx.clipes[f.clip];
    a.durFase = f.fimEm ?? f.dur ?? clip.duration;
    // Ciclos de passo (investida) entram na mesma fase da caminhada atual: as pernas não pulam
    const inicio = clip.userData?.passada ? this.anim.fase * clip.duration : 0;
    this.anim.tocar(f.clip, { ts: f.ts || 1, loop: CLIPES_SEGURAR.has(f.clip) && f.clip !== 'pulo', fade: a.i === 0 ? 0.12 + 0.025 * this.corpo.velReal.length() : 0.07, inicio }); // entrada com antecipação, sem tranco
    if (f.efeitoNoInicio?.buff) this.buffs[f.efeitoNoInicio.buff] = { ate: this.agora + f.efeitoNoInicio.duracao, reducaoStagger: f.efeitoNoInicio.reducaoStagger };
    if (f.preso === false && a.presa) { /* golpe final na presa acontece pelos hits com fonte 'presa' */ }
    if (a.def.id === 'carregado' && a.i === 0) this.ctx.audio?.tocar('carregar', this.corpo.pos);
  }

  terminarAcao() {
    const a = this.acao;
    if (a?.presa) a.presa.soltarPreso?.();
    const extra = a?.fase?.recuperacaoExtra ?? 0;
    this.acao = null;
    if (this.estado === 'acao') {
      if (extra > 0) { this.mudar('recuperando'); this.recuperaAte = extra; }
      else this.mudar('livre');
      this.anim.soltar(0.18);
    }
  }

  distanciaAte(e) {
    return Math.hypot(e.corpo.pos.x - this.corpo.pos.x, e.corpo.pos.z - this.corpo.pos.z) - e.corpo.raio - this.corpo.raio;
  }

  executarFase(dt) {
    const a = this.acao, f = a.fase;
    const ts = f.ts || 1;
    a.t += dt * ts;
    const corpo = this.corpo;
    // Mira suave no alvo durante o começo de golpes (não gira instantaneamente).
    if (a.alvo && a.alvo.vivo && !f.giro && a.t < (f.hits?.[0]?.t0 ?? 0.3)) corpo.olharPara(a.alvo.corpo.pos.x, a.alvo.corpo.pos.z, 6, dt);
    // Movimento da habilidade (com colisão; investidas param no alvo)
    corpo.velExtra.set(0, 0);
    for (const m of f.mov || []) {
      if (a.t < m.t0 || a.t > m.t1) continue;
      if (f.paraNoAlvo && a.alvo && this.distanciaAte(a.alvo) < f.paraNoAlvo - 0.8) continue;
      const fr = corpo.frente, ld = corpo.lado;
      const lado = m.lado === 'livre' ? a.ladoLivre * 3 : (m.lado || 0);
      const k = this.fatorCarga;
      corpo.velExtra.set((fr.x * (m.frente || 0) + ld.x * lado) * k, (fr.y * (m.frente || 0) + ld.y * lado) * k);
      if (m.cima && corpo.noChao) corpo.pular(m.cima);
    }
    if (f.paraNoAlvo && a.alvo && this.distanciaAte(a.alvo) < 0.3) { a.t = Math.max(a.t, a.durFase); }
    // Ciclos de corrida tocados como ação (investida): passos no ritmo da velocidade real
    if (this.ctx.clipes[f.clip]?.userData?.passada && this.anim.acao) {
      const alvoTs = THREE.MathUtils.clamp(corpo.velExtra.length() / this.ctx.clipes[f.clip].userData.passada, 0.6, 2.2);
      const ts = this.anim.acao.action.timeScale;
      this.anim.velocidadeAcao = ts + (alvoTs - ts) * (1 - Math.exp(-dt * 10)); // passos aceleram junto com a arrancada
    }
    if (f.giro && a.t >= f.giro.t0 && a.t <= f.giro.t1) corpo.yaw += THREE.MathUtils.degToRad(f.giro.graus) * (dt * ts) / (f.giro.t1 - f.giro.t0);
    if (f.rastro) this.ctx.efeitos?.poeiraPes(corpo.pos);
    // Efeitos com tempo (provocação)
    if (f.efeitoNoTempo && !a.efeitoFeito && a.t >= f.efeitoNoTempo.t) {
      a.efeitoFeito = true;
      const p = f.efeitoNoTempo.provoca;
      if (p) {
        let n = 0;
        for (const e of this.ctx.inimigos()) if (e.vivo && Math.hypot(e.corpo.pos.x - corpo.pos.x, e.corpo.pos.z - corpo.pos.z) < p.raio && e.provocar(p.duracao)) n++;
        this.provocacaoAte = this.agora + p.duracao;
        this.ctx.audio?.tocar('grito', corpo.pos);
        this.ctx.evento?.('provocacao', n);
      }
    }
    // Defesa contínua (Muralha): drena stamina
    if (f.defesaContinua) {
      this.stamina -= f.defesaContinua.custoPorSeg * dt;
      if (this.stamina <= 0) { this.stamina = 0; this.ficarExausto(); return; }
    }
    if (a.t >= a.durFase) this.proximaFase();
  }

  // Detecção de acertos da fase atual (depois de atualizar as matrizes da pose).
  detectarAcertos() {
    const a = this.acao;
    if (!a || !a.fase || this.estado !== 'acao') return;
    const f = a.fase;
    const corpo = this.corpo;
    (f.hits || []).forEach((h, k) => {
      if (a.t < h.t0 || a.t > h.t1) return;
      const feitos = a.hitsFeitos[k];
      if (h.fonte === 'presa') {
        if (a.presa && a.presa.vivo && !feitos.has(a.presa)) { feitos.add(a.presa); this.acertar(a.presa, h, a.presa.centro.clone(), a.presa.partes.lista[1]); }
        return;
      }
      let pontos = null, esfera = null;
      if (h.fonte === 'lamina') pontos = this.rastro.pontos((h.alcanceExtra || 0) + (this.stats.tamanhoLamina - 1) * 0.68, 6);
      else if (h.fonte === 'escudo') esfera = { c: this.rig.escudo.centro.getWorldPosition(new THREE.Vector3()), r: 0.36 * this.stats.tamanhoEscudo };
      else if (h.fonte === 'corpo') esfera = { c: new THREE.Vector3(corpo.pos.x + corpo.frente.x * 0.45, corpo.pos.y + 1.1, corpo.pos.z + corpo.frente.y * 0.45), r: 0.5 };
      else if (h.fonte === 'area') {
        const c = new THREE.Vector3(corpo.pos.x + corpo.frente.x * (h.frente || 0), corpo.pos.y, corpo.pos.z + corpo.frente.y * (h.frente || 0));
        if (!feitos.has('fx')) { feitos.add('fx'); if (h.poeira) { this.ctx.efeitos?.poeira(c, h.raio); this.ctx.tremer?.(0.08); this.ctx.audio?.tocar('impactoChao', c); } }
        for (const e of this.ctx.inimigos()) {
          if (!e.vivo || feitos.has(e)) continue;
          const d = Math.hypot(e.corpo.pos.x - c.x, e.corpo.pos.z - c.z) - e.corpo.raio;
          if (d < h.raio && e.corpo.pos.y < c.y + 1.2) { feitos.add(e); this.acertar(e, h, e.centro.clone(), e.partes.lista[1]); }
        }
        return;
      }
      for (const e of this.ctx.inimigos()) {
        if (!e.vivo || feitos.has(e)) continue;
        const hit = pontos ? e.partes.atingida(pontos) : e.partes.esferaAtingida(esfera.c, esfera.r);
        if (hit) { feitos.add(e); this.acertar(e, h, hit.ponto, hit.parte); }
      }
    });
    // Golpes repetidos na presa (Perfuração)
    if (f.hitsRepetidos && a.presa && a.presa.vivo && a.t >= a.proximoRepetido) {
      a.proximoRepetido += f.hitsRepetidos.intervalo;
      if (a.presa.estado === 'preso' || a.presa.estado === 'cambaleando') this.acertar(a.presa, { ...f.hitsRepetidos, fonte: 'lamina' }, a.presa.centro.clone(), a.presa.partes.lista[1]);
    }
  }

  acertar(inimigo, h, ponto, parte) {
    const a = this.acao;
    const contra = this.emContra;
    const res = inimigo.receberGolpe({
      forca: this.forcaAtual, mult: h.dano * (contra ? CONFIG.defesa.contraBonusDano : 1), stagger: h.stagger * (contra ? 1.3 : 1),
      efeito: h.efeito, forcaLancar: h.forca, bonusCaido: h.bonusCaido, origem: this.corpo.pos.clone(), parte, fonte: h.fonte,
    });
    if (!res) return;
    if (a) { a.acertouFase = true; a.acertouAlgum = true; }
    if (a?.fase?.prende && !res.morreu && !a.presa) {
      const tempoPreso = a.fases.slice(a.i + 1).reduce((s, f) => s + (f.dur ?? this.ctx.clipes[f.clip].duration) / (f.ts || 1), 0);
      if (inimigo.prender(tempoPreso + 0.2)) a.presa = inimigo;
    }
    this.ctx.aoAcertar?.(this, inimigo, res, ponto, h);
  }

  // ---------- Golpes recebidos ----------
  receberGolpe(g) {
    if (!this.vivo || this.estado === 'vitoria') return 'ignorado';
    const D = CONFIG.defesa;
    const frontal = anguloAtaque(this, g.origem) < D.anguloFrontal;
    if (g.bloqueavel && frontal && this.guardaAtiva) {
      const janela = D.janelaPerfeita + (this.progresso.melhoriaAtiva('leituraCombate') ? D.prescienciaBonus : 0);
      const aparo = this.progresso.aprendida('aparo');
      if (aparo && this.estado === 'defesa' && this.agora - this.inicioDefesa <= janela) {
        this.stamina = Math.min(this.stats.staminaMax, this.stamina + D.perfeitaRecompensaStamina);
        this.contraAte = this.agora + D.contraJanela;
        this.anim.tocarSuperior('aparo', { fade: 0.06 });
        this.progresso.dados.estatisticas.defesasPerfeitas++;
        this.ctx.aoDefender?.(this, g, 'perfeito');
        return 'perfeito';
      }
      const dano = calcularDano(g.forca, g.mult, 1, this.stats.defesa);
      const eficiencia = this.acao?.fase?.defesaContinua?.eficiencia ?? 1;
      this.gastar(dano * D.custoStaminaPorDano * this.stats.estabilidadeEscudo * eficiencia * (g.atacante?.peso === 'gigante' ? 1.6 : 1));
      this.vida -= Math.round(dano * (1 - D.reducaoFrontal));
      if (this.estado === 'defesa') this.anim.tocarSuperior('defesaImpacto', { fade: 0.06 });
      this.proc.impulso('tronco', g.origem, Math.min(0.5, dano / 120)); // o braço absorve, o tronco sente um pouco
      this.ctx.aoDefender?.(this, g, 'bloqueado');
      if (this.vida <= 0) this.morrer();
      else if (this.estado === 'exausto') this.ctx.evento?.('guardaQuebrada');
      return 'bloqueado';
    }
    // Acertou: descobre a parte atingida (para a reação e o tranco)
    const dano = calcularDano(g.forca, g.mult, 1, this.stats.defesa);
    const parte = g.ponto ? this.partes.lista.reduce((m, p) => (p.centro.distanceTo(g.ponto) < m.centro.distanceTo(g.ponto) ? p : m)) : this.partes.lista[1];
    this.proc.impulso(parte.nome, g.origem, Math.min(1.2, 0.3 + g.stagger / this.stats.resistStagger));
    this.vida -= dano;
    const reducao = this.buffs.firme && this.buffs.firme.ate > this.agora ? this.buffs.firme.reducaoStagger : 0;
    this.staggerAcum += g.stagger * (1 - reducao);
    this.ctx.aoSerAtingido?.(this, g, dano);
    if (this.vida <= 0) { this.morrer(); return 'acertou'; }
    const res = this.stats.resistStagger;
    const emHabilidade = this.estado === 'acao' && this.acao?.tipo === 'habilidade';
    if (this.estado === 'agarrado') return 'acertou';
    const angulo = anguloAtaque(this, g.origem);
    const efetivo = g.stagger * (1 - reducao);
    const longe = new THREE.Vector2(this.corpo.pos.x - g.origem.x, this.corpo.pos.z - g.origem.z).normalize();
    if (this.staggerAcum >= res * 2 || (g.atacante?.peso === 'gigante' && efetivo >= res * 2.5)) this.reagir('derrubado', longe, 3.5);
    else if (g.tipo === 'area' || (g.atacante?.peso === 'gigante' && efetivo >= res * 1.2)) this.reagir('empurrado', longe, 3.2); // empurrão: tropeça para trás
    else if (this.staggerAcum >= res) this.reagir('cambalear', longe, 2);
    else if (!emHabilidade && efetivo >= res * 0.65) this.reagir(escolherReacao(parte.nome, angulo, 'forte'), longe, 1.6);
    else if (!emHabilidade && efetivo >= res * 0.3) this.reagir(escolherReacao(parte.nome, angulo, 'leve'), longe, 0.8);
    return 'acertou';
  }

  // empurrao: direção (2D) e velocidade inicial do recuo causado pelo golpe
  reagir(tipo, empurrao = null, vel = 0) {
    if (this.acao?.presa) this.acao.presa.soltarPreso?.();
    if (this.estado === 'defesa') this.anim.soltarSuperior(0.05);
    if (empurrao) this.corpo.velExtra.set(empurrao.x * vel, empurrao.y * vel);
    this.acao = null;
    this.mudar('reacao');
    this.reacao = tipo;
    const dur = { dano: 0.4, cambalear: 0.9, derrubado: 1.85, aterrissar: 0.3, aterrissarPesado: 0.6, rolamento: 0.85 }[tipo] ?? this.ctx.clipes[tipo]?.duration ?? 0.5;
    this.reacaoAte = dur;
    this.anim.tocar(tipo, { fade: 0.09 }); // rápido, mas sem tranco
    if (!/^dano/.test(tipo)) this.staggerAcum = 0;
  }

  // Onde as mãos de quem agarra seguram: lados da cintura (lado: +1 esquerda do herói, -1 direita)
  pontoAgarrao(lado) {
    const p = this.rig.ossos.Spine.getWorldPosition(new THREE.Vector3()); // cintura: ao alcance de um goblin
    const l = this.corpo.lado;
    const f = this.corpo.frente;
    return p.set(p.x + l.x * 0.17 * lado + f.x * 0.13, p.y + 0.04, p.z + l.y * 0.17 * lado + f.y * 0.13); // superfície da cintura
  }

  serAgarrado(inimigo) {
    if (['morto', 'agarrado', 'vitoria'].includes(this.estado) || !this.corpo.noChao) return false;
    if (this.acao?.presa) this.acao.presa.soltarPreso?.();
    this.acao = null;
    this.mudar('agarrado');
    this.agarrador = inimigo;
    this.fugaTotal = CONFIG.agarrao.duracaoFuga * (this.progresso.melhoriaAtiva('desvencilhar') ? 1 - CONFIG.melhorias.desvencilhar.reducaoAgarrao : 1);
    this.anim.tocar('agarrado', { loop: true, fade: 0.06 });
    this.ctx.evento?.('agarrado');
    return true;
  }

  soltarAgarrao() {
    if (this.estado !== 'agarrado') return;
    const g = this.agarrador;
    this.agarrador = null;
    if (g && g.vivo && g.estado === 'agarrando') { g.mudar('cambaleando'); g.anim.tocar('cambalear'); const f = this.corpo.frente; g.corpo.velExtra.set(f.x * 3, f.y * 3); }
    this.mudar('livre');
    this.anim.soltar(0.1);
  }

  morrer() {
    this.vida = 0;
    if (this.acao?.presa) this.acao.presa.soltarPreso?.();
    this.acao = null;
    if (this.agarrador) this.soltarAgarrao();
    this.mudar('morto');
    this.anim.tocar('derrubado', { fade: 0.05 });
    this.ctx.evento?.('morte');
  }

  reviver() {
    this.aplicarEquipamento();
    this.vida = this.stats.vidaMax;
    this.stamina = this.stats.staminaMax;
    this.staggerAcum = 0;
    this.acao = null;
    this.corpo.pos.set(0, 0, 0);
    this.ik.zerar();
    this.mudar('livre');
    this.anim.soltar(0.1);
  }

  comemorar() {
    if (!this.livre) return;
    this.mudar('vitoria');
    this.anim.tocar('vitoria', { fade: 0.2 });
  }

  // ---------- Atualização ----------
  update(dt) {
    this.agora += dt;
    this.tEstado += dt;
    for (const k of Object.keys(this.recargas)) this.recargas[k] = Math.max(0, this.recargas[k] - dt);
    this.staggerAcum = Math.max(0, this.staggerAcum - CONFIG.reacao.decaimentoStagger * dt);
    const S = CONFIG.stamina, G = CONFIG.guerreiro;
    const corpo = this.corpo;

    // Regeneração de stamina conforme o esforço
    this.atrasoRegen -= dt;
    if (this.atrasoRegen <= 0 && this.estado !== 'acao' && this.estado !== 'agarrado' && this.estado !== 'morto') {
      const parado = this.velAtual.length() < 0.3;
      const taxa = this.estado === 'defesa' ? S.regenBloqueando : this.estado === 'exausto' ? S.regenParado * 1.2 : parado ? S.regenParado : S.regenAndando;
      this.stamina = Math.min(this.stats.staminaMax, this.stamina + taxa * dt);
    }

    let velDesejada = new THREE.Vector2();
    switch (this.estado) {
      case 'livre':
      case 'defesa': {
        const fator = this.fatorCarga * (this.estado === 'defesa' ? 0.5 : 1);
        velDesejada.copy(this.intencao.vel).multiplyScalar(fator);
        const max = (this.intencao.sprint ? G.velSprint : this.intencao.correr ? G.velCorrer : G.velAndar) * fator;
        if (velDesejada.length() > max) velDesejada.setLength(max);
        const giro = G.giroVel * (this.fatorCarga * 0.5 + 0.5);
        if (this.intencao.olhar) corpo.olharPara(this.intencao.olhar.x, this.intencao.olhar.z, giro, dt);
        else if (velDesejada.length() > 0.3) corpo.virarPara(Math.atan2(velDesejada.x, velDesejada.y), giro, dt);
        break;
      }
      case 'acao':
        if (this.acao.tipo === 'salto' && this.acao.fase?.clip === 'preparoPulo' && this.acao.t + dt >= this.acao.durFase) {
          // Sai do chão no fim da preparação
          const h = this.acao.def.salto.altura;
          corpo.pular(Math.sqrt(2 * G.gravidade * h));
          const vh = this.acao.saltoDist / (2 * Math.sqrt(2 * h / G.gravidade));
          corpo.velExtra.set(this.acao.saltoDir.x * vh, this.acao.saltoDir.y * vh);
          this.saltoVel = corpo.velExtra.clone();
          this.acao = null;
          this.mudar('salto');
          this.anim.tocar('subindo', { fade: 0.08, loop: true });
          break;
        }
        this.executarFase(dt);
        break;
      case 'salto':
        if (this.saltoVel) corpo.velExtra.copy(this.saltoVel);
        // Subida → queda: troca de pose quando a velocidade vertical inverte
        if (!this.acao && corpo.vy < 0.5 && this.anim.nomeAcao === 'subindo') this.anim.tocar('caindo', { fade: 0.22, loop: true });
        if (this.acao) this.executarFase(dt);
        break;
      case 'reacao':
        corpo.velExtra.multiplyScalar(Math.exp(-dt * 5));
        if (this.reacao === 'rolamento' && this.tEstado < 0.55) { const f = corpo.frente; corpo.velExtra.set(f.x * 2.2, f.y * 2.2); }
        if (this.tEstado >= this.reacaoAte) { this.mudar('livre'); this.anim.soltar(0.15); }
        break;
      case 'recuperando':
        corpo.velExtra.set(0, 0);
        if (this.tEstado >= this.recuperaAte) this.mudar('livre');
        break;
      case 'exausto':
        corpo.velExtra.set(0, 0);
        if (this.tEstado >= S.exaustoDuracao) { this.mudar('livre'); this.anim.soltar(0.2); }
        break;
      case 'agarrado': {
        this.vida -= CONFIG.agarrao.danoPorSegundo * dt;
        this.stamina = Math.max(0, this.stamina - 8 * dt * (this.progresso.melhoriaAtiva('folego') ? 0.5 : 1));
        if (this.vida <= 0) { this.morrer(); break; }
        if (this.tEstado >= this.fugaTotal || !this.agarrador?.vivo || this.agarrador?.estado !== 'agarrando') {
          this.soltarAgarrao();
          this.ctx.evento?.('escapou');
        }
        break;
      }
    }
    if (this.estado !== 'acao' && this.estado !== 'salto' && this.estado !== 'reacao') corpo.velExtra.multiplyScalar(Math.exp(-dt * 10));

    // Aceleração e desaceleração (sem mudar de velocidade instantaneamente)
    const k = 1 - Math.exp(-G.aceleracao * dt);
    this.velAtual.lerp(velDesejada, k);
    corpo.vel.copy(this.velAtual);

    const queda = corpo.passo(dt, this.ctx.mundo);
    if (queda > 0) this.aterrissar(queda);
    // Passos: ritmo acompanha a velocidade (corrida soa mais rápida)
    const vel = this.velAtual.length();
    if (corpo.noChao && vel > 0.8 && (this.estado === 'livre' || this.estado === 'defesa')) {
      this.tPasso = (this.tPasso ?? 0) - dt * vel;
      if (this.tPasso <= 0) { this.tPasso = 0.95; this.ctx.audio?.tocar('passo', corpo.pos); }
    }

    // Animação de locomoção com a velocidade no espaço local (x = esquerda, y = frente)
    const f = corpo.frente;
    const v = corpo.velReal;
    const local = new THREE.Vector2(v.x * f.y - v.y * f.x, v.x * f.x + v.y * f.y);
    this.anim.atualizar(dt, this.estado === 'livre' || this.estado === 'defesa' ? local : new THREE.Vector2(), { andar: G.velAndar, correr: G.velCorrer, sprint: G.velSprint }, this.estado === 'livre' || this.estado === 'defesa' ? corpo.giroMedido : 0);
    // Camada procedural: inclinação com aceleração/curva, olhar no alvo, trancos de impacto
    const caido = this.estado === 'reacao' && ['derrubado', 'rolamento'].includes(this.reacao);
    this.proc.aplicar(dt, {
      velMundo: corpo.velReal,
      giro: corpo.giroMedido,
      alvo: this.olharAlvo && !caido ? this.olharAlvo : null,
      pesoOlhar: this.estado === 'acao' ? 0.45 : this.estado === 'livre' || this.estado === 'defesa' ? 1 : 0.3,
      inclinar: this.estado === 'livre' || this.estado === 'defesa' ? 1 : 0.3,
    });
    this.rig.raiz.updateMatrixWorld(true);
    // IK dos pés: trava o pé de apoio na locomoção e adapta ao desnível do chão
    const locomovendo = this.estado === 'livre' || this.estado === 'defesa';
    this.ik.aplicar(dt, { travar: locomovendo && corpo.noChao, apoio: (l) => this.anim.peApoiado(l), ligado: corpo.noChao && !caido });
    this.partes.atualizar();
    this.rastro.atualizar();
    this.detectarAcertos();
  }

  aterrissar(queda) {
    const Q = CONFIG.queda;
    if (this.estado === 'salto' || this.estado === 'livre' || this.estado === 'acao' || this.estado === 'defesa') {
      this.saltoVel = null;
      this.corpo.velExtra.set(0, 0);
      const rola = queda >= Q.alturaRolamento && this.progresso.aprendida('quedaControlada');
      if (queda > Q.alturaDano) {
        const dano = (queda - Q.alturaDano) * Q.danoPorMetro * (rola ? 1 - Q.reducaoRolamento : 1);
        this.vida -= dano;
        if (this.vida <= 0) { this.morrer(); return; }
      }
      if (this.estado === 'acao' && !this.acao?.noAr) return;
      this.acao = null;
      if (rola) { this.reagir('rolamento'); this.ctx.evento?.('queda'); this.ctx.audio?.tocar('queda', this.corpo.pos); }
      else if (queda > 0.85) { this.reagir('aterrissarPesado'); this.ctx.audio?.tocar('queda', this.corpo.pos); }
      else if (queda > 0.3) { this.reagir('aterrissar'); this.ctx.audio?.tocar('passo', this.corpo.pos); }
      else { this.mudar('livre'); this.anim.soltar(0.1); }
    }
  }
}
