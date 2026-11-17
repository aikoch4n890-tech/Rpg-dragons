// IA de combate automático do Guerreiro: percepção, escolha de alvo, leitura de ameaças
// e decisão por utilidade. O jogador configura perfil e preferências no menu de Táticas.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { POR_ID } from './habilidades.js';

function gauss() { // normal padrão aproximada
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.2;
}

export class IAGuerreiro {
  constructor(heroi, ctx) {
    this.h = heroi;
    this.ctx = ctx;
    this.alvo = null;
    this.tPercepcao = 0;
    this.bloqueados = new Map(); // inimigo -> até quando ignorar (inacessível)
    this.respostas = new Map(); // id da ameaça -> plano
    this.respiro = 0;
    this.progressoAlvo = { dist: Infinity, t: 0 };
    this.ultimaAmeaca = -10;
    this.ladoCirculo = 1;
    this.tDetectando = 0;
    this.registro = []; // últimas decisões (para depuração e testes)
  }

  get prefs() { return this.h.progresso.dados.prefs; }
  get perfil() { return CONFIG.perfis[this.h.progresso.dados.perfil] || CONFIG.perfis.equilibrado; }
  get distanciaDesejada() { return this.prefs.distancia > 0 ? this.prefs.distancia : this.perfil.distancia; }

  anotar(txt) {
    this.registro.push({ t: this.h.agora, txt });
    if (this.registro.length > 60) this.registro.shift();
  }

  vivos() { return this.ctx.inimigos().filter((e) => e.vivo); }

  // ---------- Percepção e alvo ----------
  pontuarAlvo(e) {
    const h = this.h;
    const d = Math.hypot(e.corpo.pos.x - h.corpo.pos.x, e.corpo.pos.z - h.corpo.pos.z);
    if (d > CONFIG.ia.raioDeteccao) return 0;
    if ((this.bloqueados.get(e) ?? 0) > h.agora) return 0;
    const pref = this.prefs.prioridadeAlvo;
    let s = (e.def.ameacaBase || 1) * (pref === 'ameaca' ? 1.5 : 1);
    s += (pref === 'proximo' ? 3 : 1.5) / (1 + d * 0.35);
    if (e.estado === 'atacando' || e.estado === 'preparando' || e.estado === 'mergulho') s += 1;
    if (e.estado === 'agarrando') s += 3;
    if (pref === 'fraco') s += 1.5 * (1 - e.vida / e.vidaMax);
    if (e.vulneravel) s += 0.6;
    const olhos = h.corpo.pos.clone().setY(h.corpo.pos.y);
    if (!this.ctx.mundo.temVisao(olhos, e.corpo.pos)) s *= 0.5;
    if (this.alvoAlto(e) && !this.temAntiAereo()) s *= 0.35;
    return s;
  }

  perceber() {
    const h = this.h;
    const candidatos = this.vivos().map((e) => ({ e, s: this.pontuarAlvo(e) })).filter((c) => c.s > 0).sort((a, b) => b.s - a.s);
    const atual = candidatos.find((c) => c.e === this.alvo);
    const melhor = candidatos[0];
    if (!melhor) { this.alvo = null; return; }
    // Histerese: só troca se o novo for claramente melhor (ou o atual sumiu),
    // e não troca de novo logo depois de escolher.
    const recente = h.agora - (this.alvoDesde ?? -10) < 1.5;
    if (!atual || (!recente && melhor.s > atual.s * (1 + CONFIG.ia.trocaAlvoMargem))) {
      if (this.alvo !== melhor.e) {
        this.alvo = melhor.e;
        this.alvoDesde = h.agora;
        this.progressoAlvo = { dist: Infinity, t: 0 };
        this.tDetectando = 0.25;
        this.anotar(`alvo: ${melhor.e.nome}`);
      }
    }
    // Inacessível: sem progresso de aproximação por muito tempo
    if (this.alvo) {
      const d = h.distanciaAte(this.alvo);
      if (d < this.progressoAlvo.dist - 0.25) this.progressoAlvo = { dist: d, t: 0 };
      if (this.progressoAlvo.t > CONFIG.ia.tempoInacessivel && d > 2.5) {
        this.bloqueados.set(this.alvo, h.agora + CONFIG.ia.bloqueioInacessivel);
        this.anotar(`inacessível: ${this.alvo.nome}`);
        this.alvo = null;
      }
    }
  }

  alvoAlto(e) {
    const baixo = e.partes.maisBaixa;
    return e.voador && baixo > this.h.corpo.pos.y + 1.75;
  }

  temAntiAereo() {
    return this.h.progresso.habilidadesEquipadas.some((x) => x.ia?.alvo?.alto);
  }

  // ---------- Ameaças ----------
  ameacas() {
    const h = this.h;
    const lista = [];
    for (const e of this.vivos()) {
      const a = e.ameaca;
      if (!a) continue;
      const d = h.distanciaAte(e);
      if (!a.projetil && d > a.alcance + 0.8) continue;
      lista.push({ ...a, dist: d });
    }
    for (const p of this.ctx.projeteis()) {
      const rel = new THREE.Vector3().subVectors(h.centro, p.pos);
      const aproximando = rel.dot(p.vel) > 0;
      const t = rel.length() / Math.max(1, p.vel.length());
      if (aproximando && t < 1.0) lista.push({ id: `p${p.id}`, atacante: p.dono, origem: p.pos, tipo: 'projetil', bloqueavel: true, restante: t - 0.05, projetil: p });
    }
    return lista.sort((a, b) => a.restante - b.restante);
  }

  planejar(am) {
    const h = this.h;
    const P = this.perfil, prefs = this.prefs;
    const temAparo = h.progresso.aprendida('aparo');
    const equip = h.progresso.habilidadesEquipadas;
    const esquiva = equip.find((x) => x.ia?.esquiva && h.podeUsar(x));
    const interrupcao = equip.concat([h.progresso.fundamentalAtiva('estocada')].filter(Boolean))
      .filter((x) => x.ia?.interrompe && h.podeUsar(x) && am.dist >= (x.ia.dist?.[0] ?? 0) && am.dist <= (x.ia.dist?.[1] ?? 2))
      .sort((a, b) => (a.fases?.[0]?.hits?.[0]?.t0 ?? 0.3) - (b.fases?.[0]?.hits?.[0]?.t0 ?? 0.3))[0];
    const reacao = Math.max(0.05, CONFIG.ia.reacaoMedia + gauss() * CONFIG.ia.reacaoDesvio);
    const atacanteLeve = am.atacante && ['leve', 'medio'].includes(am.atacante.peso);
    const agressao = P.ataque * (0.6 + prefs.frequenciaHabilidades * 0.8);
    let plano;
    if (am.bloqueavel) {
      // Interromper se dá tempo (o golpe próprio precisa sair antes do impacto inimigo)
      const tGolpe = interrupcao ? (interrupcao.fases?.[0]?.hits?.[0]?.t0 ?? 0.3) + reacao : Infinity;
      if (interrupcao && atacanteLeve && !am.projetil && am.restante > tGolpe + 0.1 && Math.random() < 0.25 * agressao) plano = { tipo: 'interromper', hab: interrupcao.id };
      else if (esquiva && !am.projetil && Math.random() < 0.18 * agressao && h.staminaFracao > 0.4) plano = { tipo: 'esquiva', hab: esquiva.id, em: am.restante - 0.3 };
      else if (temAparo && Math.random() < Math.min(0.9, 0.3 + prefs.prioridadeDefesa * 0.45 + (P.defesa - 1) * 0.3)) {
        // Mira levantar o escudo um pouco antes do impacto, com erro humano.
        const janela = CONFIG.defesa.janelaPerfeita + (h.progresso.melhoriaAtiva('leituraCombate') ? CONFIG.defesa.prescienciaBonus : 0);
        const antecedencia = janela * 0.55 + gauss() * 0.045;
        plano = { tipo: 'perfeito', em: am.restante - antecedencia };
      } else plano = { tipo: 'bloqueio', em: Math.min(am.restante - 0.3, reacao) };
    } else {
      // Agarrão e área atravessam a defesa: esquivar ou interromper.
      if (interrupcao && atacanteLeve && am.restante > 0.45) plano = { tipo: 'interromper', hab: interrupcao.id };
      else if (esquiva) plano = { tipo: 'esquiva', hab: esquiva.id, em: am.restante - 0.32 };
      else plano = { tipo: 'recuo', em: am.restante - 0.3 };
    }
    plano.ameaca = am;
    plano.inicio = h.agora;
    plano.em = Math.max(reacao, plano.em ?? reacao);
    this.anotar(`ameaça ${am.tipo} de ${am.atacante?.nome}: ${plano.tipo}`);
    return plano;
  }

  responderAmeacas(lista) {
    const h = this.h;
    // Limpa planos antigos
    for (const [id, p] of this.respostas) if (h.agora - p.inicio > 3) this.respostas.delete(id);
    const urgente = lista[0];
    if (!urgente) return false;
    // Ameaça chegando: a sequência contínua para no próximo intervalo entre cortes.
    if (h.estado === 'acao' && h.acao?.seq && urgente.restante < 0.6) h.acao.pararSeq = true;
    // Ameaça ainda distante no tempo: segue lutando (o plano é feito, mas não trava a decisão).
    if (urgente.restante > 0.75 && h.estado !== 'defesa') {
      if (!this.respostas.has(urgente.id)) this.respostas.set(urgente.id, this.planejar(urgente));
      return false;
    }
    if (!this.respostas.has(urgente.id)) this.respostas.set(urgente.id, this.planejar(urgente));
    const p = this.respostas.get(urgente.id);
    if (p.feito) return h.estado === 'defesa';
    const decorrido = h.agora - p.inicio;
    this.ultimaAmeaca = h.agora;
    // Vira para quem ataca (o escudo só protege a frente)
    const origem = urgente.projetil ? urgente.projetil.pos : urgente.atacante.corpo.pos;
    h.intencao.olhar = origem.clone();
    if (p.tipo === 'interromper') {
      if (h.livre || h.podeCancelar()) {
        if (h.estado !== 'livre') { h.defender(false); h.cancelar(); }
        p.feito = h.usarHabilidade(p.hab, urgente.atacante);
        if (p.feito) { h.estadoIA = 'Usando habilidade'; this.anotar(`interrompe com ${POR_ID[p.hab].nome}`); }
        else p.tipo = 'bloqueio';
      }
      return true;
    }
    if (decorrido < p.em) {
      // Esperando a hora: fica pronto, sem iniciar golpes longos
      if (p.tipo === 'bloqueio' || p.tipo === 'perfeito') { h.intencao.vel.set(0, 0); h.estadoIA = 'Defendendo'; }
      return true;
    }
    if (p.tipo === 'esquiva') {
      if (h.estado === 'defesa') h.defender(false);
      if (h.livre || h.cancelar()) {
        p.feito = h.usarHabilidade(p.hab, urgente.atacante) || h.passoAtras(h.ladoMaisLivre());
        h.estadoIA = 'Esquivando';
      }
      return true;
    }
    if (p.tipo === 'recuo') {
      if (h.estado === 'defesa') h.defender(false);
      if (h.livre || h.cancelar()) { p.feito = h.passoAtras(h.ladoMaisLivre()); h.estadoIA = 'Esquivando'; }
      return true;
    }
    // Bloqueio ou tentativa de defesa perfeita
    if (h.estado !== 'defesa') {
      if (h.estado !== 'livre') h.cancelar();
      if (h.estado === 'livre') { h.defender(true); h.estadoIA = p.tipo === 'perfeito' ? 'Defesa perfeita' : 'Defendendo'; }
    }
    p.feito = h.estado === 'defesa';
    return true;
  }

  // ---------- Decisão ----------
  update(dt) {
    const h = this.h;
    h.intencao.vel.set(0, 0);
    h.intencao.olhar = null;
    h.intencao.correr = false;
    h.intencao.sprint = false;
    if (!h.vivo) { h.estadoIA = 'Derrotado'; return; }
    const rotulo = { reacao: h.reacao === 'derrubado' ? 'Derrubado' : /^aterr|rolamento/.test(h.reacao || '') ? 'Recuperando' : 'Cambaleando', exausto: 'Recuperando', agarrado: 'Agarrado', recuperando: 'Recuperando', vitoria: 'Vitória' }[h.estado];
    if (rotulo) h.estadoIA = rotulo;
    if (['reacao', 'exausto', 'agarrado', 'morto', 'recuperando'].includes(h.estado)) return;

    this.tPercepcao -= dt;
    if (this.tPercepcao <= 0) { this.perceber(); this.tPercepcao = CONFIG.ia.intervaloPercepcao; }
    // A cabeça acompanha o alvo (ou quem está atacando agora)
    h.olharAlvo = this.alvo?.vivo ? this.alvo.partes.lista[0].centro : null;
    this.progressoAlvo.t += dt;

    // Ataque no ar se estiver pulando sobre um inimigo
    if (h.estado === 'salto') {
      if (this.alvo && h.distanciaAte(this.alvo) < 1.6 && h.corpo.vy < 0) h.ataqueNoAr(this.alvo);
      return;
    }

    const ameacas = this.ameacas();
    if (ameacas.length && this.responderAmeacas(ameacas)) return;
    // Sem ameaça: baixa o escudo depois de um instante (a não ser que esteja em Muralha)
    if (h.estado === 'defesa' && h.agora - this.ultimaAmeaca > 0.35) h.defender(false);
    // Muralha: cancela quando não há mais ameaça por perto
    if (h.estado === 'acao' && h.acao?.fase?.cancelavelSemAmeaca && h.agora - this.ultimaAmeaca > 0.9 && h.acao.t > 0.6) h.cancelar();
    // Sequência contínua: para se surgir ameaça urgente ou o alvo sair do alcance (tratado em guerreiro.js)
    if (h.estado === 'acao' && h.acao?.seq && ameacas.some((a) => a.restante < 0.4)) h.acao.pararSeq = true;

    if (!h.livre) { if (h.estado === 'acao') h.estadoIA = h.acao?.tipo === 'habilidade' ? 'Usando habilidade' : h.emContra ? 'Contra-atacando' : 'Atacando'; return; }

    const vivos = this.vivos();
    if (!vivos.length) { h.estadoIA = 'Explorando'; this.vagar(dt); return; }
    if (!this.alvo || !this.alvo.vivo) { this.perceber(); if (!this.alvo) { h.estadoIA = 'Explorando'; this.vagar(dt); return; } }
    if (this.tDetectando > 0) {
      this.tDetectando -= dt;
      h.estadoIA = 'Detectando inimigo';
      h.intencao.olhar = this.alvo.corpo.pos.clone();
      return;
    }
    this.decidir(dt, vivos);
  }

  vagar() {
    const h = this.h;
    const d = Math.hypot(h.corpo.pos.x, h.corpo.pos.z);
    if (d > 2) h.intencao.vel.set(-h.corpo.pos.x, -h.corpo.pos.z).setLength(1.5);
  }

  decidir(dt, vivos) {
    const h = this.h, alvo = this.alvo;
    const P = this.perfil, prefs = this.prefs, I = CONFIG.ia;
    const pos = h.corpo.pos, ap = alvo.corpo.pos;
    const dist = h.distanciaAte(alvo);
    const dir = new THREE.Vector2(ap.x - pos.x, ap.z - pos.z).normalize();
    const perto = vivos.filter((e) => h.distanciaAte(e) < I.cercadoRaio && !e.voador);
    let cercado = perto.length >= I.cercadoQtd;
    if (perto.length >= 2) {
      // Inimigos em lados opostos também contam como cercado
      const angs = perto.map((e) => Math.atan2(e.corpo.pos.x - pos.x, e.corpo.pos.z - pos.z));
      for (let i = 0; i < angs.length; i++) for (let j = i + 1; j < angs.length; j++) if (Math.abs(Math.cos(angs[i] - angs[j])) > 0.85 && Math.cos(angs[i] - angs[j]) < 0) cercado = true;
    }
    const vidaCritica = h.vidaFracao < I.vidaCritica;
    const staminaBaixa = h.staminaFracao < I.staminaBaixa * (0.6 + prefs.economiaStamina * 0.8 + (P.stamina - 0.5) * 0.4);
    const alto = this.alvoAlto(alvo);
    const desnivel = ap.y - pos.y;
    h.intencao.olhar = ap.clone();
    this.respiro -= dt;

    // 1. Stamina baixa: recua, recupera, só defende quando precisa
    if (staminaBaixa && !h.emContra) {
      h.estadoIA = 'Recuperando';
      if (dist < 3.5) this.mover(dir.clone().negate(), 1.8, false);
      else this.circular(dir, 0.6);
      return;
    }
    // 2. Contra-ataque depois de defesa perfeita
    if (h.emContra && dist < 2.2) {
      const hab = this.escolherHabilidade(alvo, dist, { contra: true, cercado });
      if (hab ? h.usarHabilidade(hab.id, alvo) : h.ataqueBasico(alvo, 3)) { h.estadoIA = 'Contra-atacando'; this.anotar(`contra-ataque: ${hab ? hab.nome : 'combo'}`); this.respiro = 0.1; }
      return;
    }
    // 3. Cercado: golpe em área ou reposicionar (por pouco tempo; depois luta assim mesmo)
    if (cercado && h.agora > (this.ignorarCercoAte ?? 0)) {
      if (!this.reposicionandoDesde) this.reposicionandoDesde = h.agora;
      if (h.agora - this.reposicionandoDesde > 1.4) { this.ignorarCercoAte = h.agora + 3; this.reposicionandoDesde = 0; }
      const area = h.progresso.habilidadesEquipadas.find((x) => (x.ia?.cercado || x.ia?.area) && h.podeUsar(x));
      if (area && Math.random() < 0.4 + prefs.usoArea * 0.6) {
        if (h.usarHabilidade(area.id, alvo)) { h.estadoIA = 'Usando habilidade'; this.anotar(`cercado: ${area.nome}`); return; }
      }
      const centro = new THREE.Vector2();
      perto.forEach((e) => centro.add(new THREE.Vector2(e.corpo.pos.x, e.corpo.pos.z)));
      centro.divideScalar(perto.length);
      const fuga = new THREE.Vector2(pos.x - centro.x, pos.z - centro.y);
      if (fuga.lengthSq() < 0.01) fuga.set(-dir.y, dir.x);
      h.estadoIA = 'Reposicionando';
      this.mover(fuga.normalize(), 3, true);
      return;
    }
    if (!cercado) this.reposicionandoDesde = 0;
    // 4. Alvo voador alto
    if (alto) {
      const hab = h.progresso.habilidadesEquipadas.find((x) => x.ia?.alvo?.alto && h.podeUsar(x));
      const horiz = Math.hypot(ap.x - pos.x, ap.z - pos.z);
      if (hab && horiz < 1.6 && alvo.partes.maisBaixa < pos.y + 2.9) { if (h.usarHabilidade(hab.id, alvo)) { h.estadoIA = 'Usando habilidade'; this.anotar(`anti-aéreo: ${hab.nome}`); } return; }
      const prov = h.progresso.habilidadesEquipadas.find((x) => x.ia?.provocacao && h.podeUsar(x));
      if (prov && Math.random() < 0.02 * P.provocacao) { h.usarHabilidade(prov.id, alvo); return; }
      h.estadoIA = 'Circulando';
      if (horiz > 1.2) this.mover(dir, 2.2, false); else this.circular(dir, 0.4);
      return;
    }
    // 5. Alvo em cima de uma plataforma (ou o herói em cima e o alvo embaixo)
    if (desnivel > 0.5) {
      const horiz = Math.hypot(ap.x - pos.x, ap.z - pos.z);
      const obs = this.ctx.mundo.obstaculoNoCaminho(pos, ap, h.corpo.raio, pos.y);
      if (obs && obs.obstaculo.h <= POR_ID.impulso.salto.altura - 0.15 && obs.t * horiz < 1.3 && h.corpo.noChao) {
        if (h.saltar(dir, Math.min(3.2, obs.t * horiz + 1.6))) { h.estadoIA = 'Aproximando'; this.anotar('Impulso para subir'); return; }
      }
      h.estadoIA = 'Aproximando';
      this.mover(dir, 3.5, horiz > 4, ap);
      return;
    }
    // 6. Vida crítica: joga na defensiva
    if (vidaCritica && !alvo.vulneravel && dist < 2.4) {
      h.estadoIA = 'Defendendo';
      this.circular(dir, -0.3);
      return;
    }
    // 7. Longe: investida (se o caminho estiver livre) ou aproximação
    const alcance = I.alcanceBasico * (h.stats.tamanhoLamina);
    if (dist > alcance + 0.3) {
      const investida = h.progresso.habilidadesEquipadas.find((x) => x.ia?.caminhoLivre && h.podeUsar(x) && dist >= x.ia.dist[0] && dist <= x.ia.dist[1]);
      if (investida && this.caminhoLivre(alvo) && this.respiro <= 0 && Math.random() < Math.min(0.9, 0.6 * this.fatorHabilidades())) {
        if (h.usarHabilidade(investida.id, alvo)) { h.estadoIA = 'Usando habilidade'; this.anotar(`investida: ${investida.nome}`); this.respiro = this.ritmo(0.3); return; }
      }
      const obs = this.ctx.mundo.obstaculoNoCaminho(pos, ap, h.corpo.raio, pos.y);
      if (obs && obs.obstaculo.h <= 0.75 && obs.t * dist < 1.2 && dist > 2.5 && h.saltar(dir, 3)) { this.anotar('Impulso sobre obstáculo'); return; }
      h.estadoIA = 'Aproximando';
      this.mover(dir, dist > 8 ? 6.2 : dist > 4 ? 4.2 : 1.8, dist > 4, ap);
      return;
    }
    // 8. No alcance: ritmo entre ações (circula um pouco para não parecer robótico)
    if (this.respiro > 0 && !alvo.vulneravel) {
      h.estadoIA = 'Circulando';
      const desejada = Math.min(this.distanciaDesejada, alcance);
      if (dist < desejada - 0.6) this.mover(dir.clone().negate(), 1.2, false);
      else this.circular(dir, 0);
      return;
    }
    const hab = this.escolherHabilidade(alvo, dist, { cercado });
    let ok = false;
    if (hab) ok = h.usarHabilidade(hab.id, alvo);
    if (!ok) {
      const pesado = alvo.vulneravel && h.stamina > 40 && Math.random() < 0.4;
      const n = 1 + Math.floor(Math.random() * 3);
      ok = h.ataqueBasico(alvo, n, pesado);
      if (ok) { h.estadoIA = 'Atacando'; this.anotar(pesado ? 'golpe carregado' : `combo x${n}`); }
    } else { h.estadoIA = 'Usando habilidade'; this.anotar(`habilidade: ${hab.nome}`); }
    if (ok) this.respiro = this.ritmo(0.45 / P.ataque);
  }

  fatorHabilidades() { return this.perfil.habilidades * (0.4 + this.prefs.frequenciaHabilidades * 1.2); }
  ritmo(base) { return base * (1 + (Math.random() * 2 - 1) * CONFIG.ia.variacaoRitmo); }

  caminhoLivre(alvo) {
    const h = this.h;
    if (this.ctx.mundo.obstaculoNoCaminho(h.corpo.pos, alvo.corpo.pos, h.corpo.raio, h.corpo.pos.y)) return false;
    // Outro inimigo no caminho bloqueia a investida
    const a = h.corpo.pos, b = alvo.corpo.pos;
    for (const e of this.vivos()) {
      if (e === alvo) continue;
      const t = ((e.corpo.pos.x - a.x) * (b.x - a.x) + (e.corpo.pos.z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
      if (t <= 0 || t >= 1) continue;
      const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
      if (Math.hypot(e.corpo.pos.x - px, e.corpo.pos.z - pz) < e.corpo.raio + h.corpo.raio) return false;
    }
    return true;
  }

  // Pontua habilidades equipadas (e fundamentais) e sorteia entre as melhores.
  escolherHabilidade(alvo, dist, { contra = false, cercado = false } = {}) {
    const h = this.h, prefs = this.prefs, P = this.perfil;
    const lista = [...h.progresso.habilidadesEquipadas];
    for (const fam of ['sequencia', 'estocada']) { const f = h.progresso.fundamentalAtiva(fam); if (f) lista.push(f); }
    const opcoes = [];
    for (const x of lista) {
      const ia = x.ia || {};
      if (ia.naoUsar || ia.esquiva || ia.caminhoLivre || !h.podeUsar(x)) continue;
      if (ia.dist && (dist < ia.dist[0] - 0.2 || dist > ia.dist[1])) continue;
      let s = ia.prioridade || 1;
      if (x.categoria !== 'fundamental') s *= this.fatorHabilidades();
      if (ia.alvo?.leve) { if (alvo.peso === 'leve') s *= 1.5; else if (alvo.peso === 'gigante') s *= 0.4; }
      if (ia.alvo?.caido) { if (alvo.caido) s *= 2.5; else continue; }
      if (ia.alvo?.vulneravel) s *= alvo.vulneravel ? 1.6 : 0.7;
      if (ia.alvo?.alto) s *= this.alvoAlto(alvo) || (alvo.peso === 'gigante' && alvo.partes.lista[0].fraca) ? 1.4 : 0.5;
      if (ia.quebraGuarda) s *= alvo.guardaErguida ? 2.2 : 0.9;
      if (ia.cercado || ia.area) s *= cercado ? 1.6 : 0.35 + prefs.usoArea * 0.3;
      if (ia.buff) { if (h.buffs.firme?.ate > h.agora) continue; s *= h.ctx.inimigos().filter((e) => e.vivo).length >= 2 || alvo.peso === 'gigante' ? 1.2 : 0.3; }
      if (ia.provocacao) { if ((h.provocacaoAte ?? 0) > h.agora) continue; s *= 0.4 * P.provocacao; }
      if (ia.defesaContinua) { s *= (P.defesa - 0.7) * (h.vidaFracao < 0.5 ? 1.5 : 0.6); if (!this.vivos().some((e) => e.estado === 'atacando')) continue; }
      if (ia.defensiva) s *= P.defesa;
      if (ia.alvoGrandeParteAlcancavel && alvo.peso === 'gigante') s *= 1.2;
      if (contra) s *= (x.fases?.some((f) => f.hits?.some((k) => k.dano >= 1.5)) ? 1.5 : 1);
      // Custo de stamina pesa mais com economia alta
      const sobra = (h.stamina - x.stamina) / h.stats.staminaMax;
      if (sobra < 0.15) s *= 0.3 + (1 - prefs.economiaStamina) * 0.5;
      s *= 1 - prefs.economiaStamina * (x.stamina / 100) * 0.5;
      // Não repetir a mesma coisa sem motivo
      const desde = h.agora - (h.usoRecente[x.id] ?? -100);
      if (desde < CONFIG.ia.memoriaRepeticao) s *= CONFIG.ia.penalidadeRepeticao;
      opcoes.push({ x, s: s * (0.85 + Math.random() * 0.3) });
    }
    // Ataque básico também concorre (peso do perfil)
    opcoes.push({ x: null, s: 1.0 * P.ataque * (1.2 - prefs.frequenciaHabilidades * 0.6) * (0.85 + Math.random() * 0.3) });
    opcoes.sort((a, b) => b.s - a.s);
    return opcoes[0].x;
  }

  // Movimento com desvio de obstáculos
  mover(dir, vel, correr, alvoPos = null) {
    const h = this.h;
    const pos = h.corpo.pos;
    const destino = alvoPos || new THREE.Vector3(pos.x + dir.x * 3, pos.y, pos.z + dir.y * 3);
    let d = dir.clone();
    const obs = this.ctx.mundo.obstaculoNoCaminho(pos, destino, h.corpo.raio + 0.1, pos.y);
    if (obs && obs.t < 0.95) {
      const o = obs.obstaculo;
      const ox = o.x - pos.x, oz = o.z - pos.z;
      const lado = ox * dir.y - oz * dir.x > 0 ? 1 : -1;
      d = new THREE.Vector2(-dir.y * lado, dir.x * lado).multiplyScalar(0.9).add(dir.clone().multiplyScalar(0.3)).normalize();
    }
    h.intencao.vel.copy(d.multiplyScalar(vel));
    h.intencao.correr = correr;
    h.intencao.sprint = vel > 5; // longe do alvo: corrida acelerada
  }

  circular(dir, aproximar) {
    const h = this.h;
    if (Math.random() < 0.01) this.ladoCirculo *= -1;
    const lat = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(this.ladoCirculo * 1.2);
    h.intencao.vel.copy(lat.add(dir.clone().multiplyScalar(aproximar)));
  }
}
