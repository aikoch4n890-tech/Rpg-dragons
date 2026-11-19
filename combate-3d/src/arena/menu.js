// Menu medieval: Continuar, Personagem, Equipamento, Habilidades, Melhorias, Táticas,
// Atributos e Configurações. Todas as ações mexem no gameplay de verdade (via Progresso).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { HABILIDADES, POR_ID } from './habilidades.js';
import { MELHORIAS } from './progressao.js';
import { ITENS, SLOTS } from './equipamentos.js';
import { icone } from './icones.js';

const SECOES = [
  ['continuar', 'Continuar'], ['personagem', 'Personagem'], ['equipamento', 'Equipamento'], ['habilidades', 'Habilidades'],
  ['melhorias', 'Melhorias'], ['taticas', 'Táticas'], ['atributos', 'Atributos'], ['config', 'Configurações'],
];
const NIVEL_TXT = { base: 'Base', aprimorada: 'Aprimorada', especial: 'Variante especial' };
const ESTADO_TXT = { bloqueada: 'Bloqueada', disponivel: 'Disponível', aprendida: 'Aprendida', equipada: 'Equipada' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Menu {
  constructor(opts) {
    this.o = opts;
    this.p = opts.progresso;
    this.h = opts.heroi;
    this.raiz = document.getElementById('menu');
    this.nav = document.getElementById('menu-nav');
    this.conteudo = document.getElementById('menu-conteudo');
    this.aberto = false;
    this.secao = 'personagem';
    this.abaHab = 'espada';
    this.habSel = null;
    this.slotSel = 'torso';
    this.preview = null;
    this.confirmarApagar = false;
    for (const [id, nome] of SECOES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu-nav__item';
      b.dataset.secao = id;
      b.textContent = nome;
      b.addEventListener('click', () => { this.o.audio.tocar('ui'); if (id === 'continuar') this.fechar(); else this.ir(id); });
      this.nav.appendChild(b);
    }
    document.getElementById('menu-fechar').addEventListener('click', () => this.fechar());
  }

  alternar() { if (this.aberto) this.fechar(); else this.abrir(); }
  abrir(secao = this.secao) {
    this.aberto = true;
    this.raiz.hidden = false;
    document.body.classList.add('menu-aberto');
    this.o.focarPersonagem(true);
    this.ir(secao);
  }
  fechar() {
    this.aberto = false;
    this.raiz.hidden = true;
    document.body.classList.remove('menu-aberto');
    this.pararPreview();
    this.h.aplicarEquipamento();
    this.o.focarPersonagem(false);
    this.o.aoFechar();
  }

  ir(secao) {
    this.secao = secao;
    for (const b of this.nav.children) b.setAttribute('aria-current', b.dataset.secao === secao ? 'page' : 'false');
    this.render();
  }

  render() {
    const f = { personagem: this.personagem, equipamento: this.equipamento, habilidades: this.habilidades, melhorias: this.melhorias,
      taticas: this.taticas, atributos: this.atributos, config: this.config }[this.secao];
    this.conteudo.innerHTML = '';
    f.call(this);
  }

  html(s) { const d = document.createElement('div'); d.innerHTML = s; while (d.firstChild) this.conteudo.appendChild(d.firstChild); }
  botao(texto, fn, cls = 'btn', desativado = false) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = texto; b.disabled = desativado;
    b.addEventListener('click', () => { this.o.audio.tocar('ui'); fn(); });
    return b;
  }

  barra(rotulo, valor, max, cls = '') {
    return `<div class="stat-barra ${cls}"><span>${rotulo}</span><div class="barra"><div class="barra__fill" style="width:${Math.min(100, (valor / max) * 100)}%"></div></div><b>${Math.round(valor)} / ${Math.round(max)}</b></div>`;
  }

  // ---------- Personagem ----------
  personagem() {
    const d = this.p.dados, s = this.h.stats;
    const prox = this.p.proximoRank;
    this.html(`
      <h2 class="menu-titulo">${esc(d.nome)}</h2>
      <p class="menu-sub">Nível ${d.nivel} · Vocação: Guerreiro · Rank ${this.p.rank}${prox ? ` (próximo em ${prox - d.dpTotal} DP ganhos)` : ' (máximo)'}</p>
      ${this.barra('XP', d.xp, this.p.xpProximoNivel, 'stat-barra--xp')}
      ${this.barra('Vida', this.h.vida, s.vidaMax, 'stat-barra--vida')}
      ${this.barra('Stamina', this.h.stamina, s.staminaMax, 'stat-barra--stamina')}
      <dl class="atributos">
        <div>${icone('forca')}<dt>Força</dt><dd>${s.forca}</dd></div>
        <div>${icone('defesa')}<dt>Defesa física</dt><dd>${s.defesa}</dd></div>
        <div>${icone('postura')}<dt>Resistência a cambaleio</dt><dd>${s.resistStagger}</dd></div>
        <div>${icone('peso')}<dt>Peso carregado</dt><dd>${s.peso} / ${s.carga} kg</dd></div>
        <div>${icone('stamina')}<dt>Disciplina (DP)</dt><dd>${d.dp}</dd></div>
      </dl>
      <p class="menu-dica">Arraste a cena para girar o personagem.</p>`);
  }

  // ---------- Equipamento ----------
  equipamento() {
    const eq = this.p.dados.equip;
    this.html('<h2 class="menu-titulo">Equipamento</h2>');
    const grade = document.createElement('div');
    grade.className = 'slots-equip';
    for (const [slot, nome] of SLOTS) {
      const b = this.botao('', () => { this.slotSel = slot; this.render(); }, `slot-equip${slot === this.slotSel ? ' slot-equip--sel' : ''}`);
      b.innerHTML = `<small>${nome}</small><span>${esc(ITENS[eq[slot]].nome)}</span>`;
      grade.appendChild(b);
    }
    this.conteudo.appendChild(grade);
    const lista = document.createElement('div');
    lista.className = 'lista-itens';
    const atual = this.p.atributos();
    for (const id of this.p.dados.inventario.filter((i) => ITENS[i].slot === this.slotSel)) {
      const it = ITENS[id];
      const novo = this.p.atributos({ ...eq, [this.slotSel]: id });
      const comp = [['vidaMax', 'Vida'], ['staminaMax', 'Stamina'], ['forca', 'Força'], ['defesa', 'Defesa'], ['resistStagger', 'Res. cambaleio'], ['peso', 'Peso']]
        .map(([k, n]) => { const dlt = novo[k] - atual[k]; if (!dlt) return ''; const bom = k === 'peso' ? dlt < 0 : dlt > 0; return `<span class="${bom ? 'mais' : 'menos'}">${n} ${dlt > 0 ? '+' : ''}${dlt}</span>`; }).join(' ');
      const linha = document.createElement('div');
      linha.className = `item${eq[this.slotSel] === id ? ' item--equipado' : ''}`;
      linha.innerHTML = `<div><b>${esc(it.nome)}</b><p>${comp || 'Sem diferença nos atributos'}${it.descricao ? `<br><i>${esc(it.descricao)}</i>` : ''}</p></div>`;
      const acoes = document.createElement('div');
      acoes.className = 'item__acoes';
      if (it.visual || it.tamanhoLamina || it.tamanhoEscudo) acoes.appendChild(this.botao('Ver', () => this.previewItem(id)));
      acoes.appendChild(this.botao(eq[this.slotSel] === id ? 'Equipado' : 'Equipar', () => { this.p.equiparItem(id); this.h.aplicarEquipamento(); this.o.audio.tocar('confirmar'); this.render(); }, 'btn btn--ouro', eq[this.slotSel] === id));
      linha.appendChild(acoes);
      lista.appendChild(linha);
    }
    this.conteudo.appendChild(lista);
  }

  previewItem(id) {
    // Mostra o item no modelo sem equipar (volta ao fechar ou trocar de tela)
    const eq = this.p.dados.equip;
    const antigo = eq[ITENS[id].slot];
    eq[ITENS[id].slot] = id;
    this.h.aplicarEquipamento();
    eq[ITENS[id].slot] = antigo;
    this.h.stats = this.p.atributos();
  }

  // ---------- Habilidades ----------
  habilidades() {
    const d = this.p.dados;
    this.html(`<h2 class="menu-titulo">Habilidades</h2><p class="menu-sub">Rank ${this.p.rank} · ${d.dp} DP disponíveis. A IA só usa habilidades aprendidas e equipadas; as fundamentais ficam sempre ativas.</p>`);
    const abas = document.createElement('div');
    abas.className = 'abas';
    abas.setAttribute('role', 'tablist');
    for (const [id, nome] of [['fundamental', 'Fundamentais'], ['espada', 'Espada'], ['escudo', 'Escudo']]) {
      const b = this.botao(nome, () => { this.abaHab = id; this.habSel = null; this.render(); }, 'aba');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(this.abaHab === id));
      abas.appendChild(b);
    }
    this.conteudo.appendChild(abas);
    if (this.abaHab !== 'fundamental') {
      const slots = document.createElement('div');
      slots.className = 'slots-hab';
      d[this.abaHab].forEach((id, i) => {
        const h = id ? POR_ID[id] : null;
        const b = this.botao('', () => { if (h) { this.habSel = id; this.render(); } }, `slot-hab${h ? '' : ' slot-hab--vazio'}`);
        b.innerHTML = h ? `${icone(h.familia)}<span>${esc(h.nome)}</span>` : `<span>Slot ${i + 1} vazio</span>`;
        slots.appendChild(b);
        if (h && i > 0) slots.appendChild(this.botao('◀', () => { this.p.moverHabilidade(this.abaHab, i, i - 1); this.render(); }, 'btn btn--mini'));
      });
      this.conteudo.appendChild(slots);
    }
    const grade = document.createElement('div');
    grade.className = 'grade-hab';
    for (const h of HABILIDADES.filter((x) => x.categoria === this.abaHab)) {
      const est = this.p.estadoHabilidade(h);
      const b = this.botao('', () => { this.habSel = h.id; this.render(); }, `card-hab card-hab--${est}${this.habSel === h.id ? ' card-hab--sel' : ''}`);
      b.innerHTML = `${icone(h.familia)}<span class="card-hab__nome">${esc(h.nome)}</span><small>${NIVEL_TXT[h.nivel]} · R${h.rank} · ${h.dp} DP</small><em>${ESTADO_TXT[est]}</em>`;
      grade.appendChild(b);
    }
    this.conteudo.appendChild(grade);
    if (this.habSel) this.detalheHabilidade(POR_ID[this.habSel]);
  }

  detalheHabilidade(h) {
    const est = this.p.estadoHabilidade(h);
    const req = this.p.podeAprender(h.id);
    const det = document.createElement('section');
    det.className = 'detalhe-hab';
    det.innerHTML = `
      <h3>${icone(h.familia)} ${esc(h.nome)} <small>${NIVEL_TXT[h.nivel]}</small></h3>
      <p>${esc(h.desc)}</p>
      <dl class="ficha">
        <div><dt>Estado</dt><dd>${ESTADO_TXT[est]}</dd></div>
        <div><dt>Rank necessário</dt><dd>${h.rank}</dd></div>
        <div><dt>Custo</dt><dd>${h.dp} DP</dd></div>
        <div><dt>Stamina</dt><dd>${h.stamina}</dd></div>
        <div><dt>Recarga</dt><dd>${h.recarga ? `${h.recarga} s` : '-'}</dd></div>
        <div><dt>Alcance</dt><dd>${h.alcance ? `${h.alcance} m` : '-'}</dd></div>
        <div><dt>Tipo de dano</dt><dd>${esc(h.tipoDano)}</dd></div>
        <div><dt>Efeito</dt><dd>${esc(h.efeitoTexto)}</dd></div>
        ${h.base ? `<div><dt>Requer</dt><dd>${esc(POR_ID[h.base].nome)}</dd></div>` : ''}
      </dl>
      ${!req.ok && est === 'bloqueada' ? `<p class="aviso-req">${esc(req.motivo)}</p>` : ''}`;
    const acoes = document.createElement('div');
    acoes.className = 'item__acoes';
    if (est === 'bloqueada' || est === 'disponivel') acoes.appendChild(this.botao(`Aprender (${h.dp} DP)`, () => { const r = this.p.aprender(h.id); if (r.ok) this.o.audio.tocar('confirmar'); this.render(); }, 'btn btn--ouro', !req.ok));
    if (h.categoria !== 'fundamental' && est === 'aprendida') acoes.appendChild(this.botao('Equipar', () => { const r = this.p.equiparHabilidade(h.id); if (!r.ok) this.erro(r.motivo); else this.o.audio.tocar('confirmar'); this.render(); }, 'btn btn--ouro'));
    if (est === 'equipada') acoes.appendChild(this.botao('Desequipar', () => { this.p.desequiparHabilidade(h.id); this.render(); }));
    if (h.fases || h.sequencia) acoes.appendChild(this.botao('Ver demonstração', () => this.demonstrar(h)));
    det.appendChild(acoes);
    this.conteudo.appendChild(det);
  }

  erro(txt) { this.html(`<p class="aviso-req" role="alert">${esc(txt)}</p>`); }

  // Demonstração: toca as fases da habilidade no modelo do menu (sem acertar ninguém).
  demonstrar(h) {
    const fases = h.sequencia ? [...Array(4)].map((_, i) => ({ clip: h.sequencia.clips[i % 2] })).concat(h.sequencia.final ? [h.sequencia.final] : []) : h.fases;
    this.preview = { fases, i: -1, t: 0, yaw: this.h.corpo.yaw };
    this.proximaFasePreview();
  }
  proximaFasePreview() {
    const pv = this.preview;
    pv.i++;
    if (pv.i >= pv.fases.length) { this.pararPreview(); return; }
    const f = pv.fases[pv.i];
    pv.t = 0;
    pv.dur = (f.dur ?? this.o.clipes[f.clip].duration) / (f.ts || 1);
    pv.giro = f.giro ? THREE.MathUtils.degToRad(f.giro.graus) / ((f.giro.t1 - f.giro.t0) / (f.ts || 1)) : 0;
    this.h.anim.tocar(f.clip, { ts: f.ts || 1, loop: ['giro', 'espetoTorcer', 'muralha'].includes(f.clip) });
  }
  pararPreview() {
    if (!this.preview) return;
    this.h.corpo.yaw = this.preview.yaw;
    this.h.rig.raiz.rotation.y = this.preview.yaw;
    this.preview = null;
    this.h.anim.soltar(0.2);
  }
  atualizarPreview(dt) {
    if (this.preview) {
      const pv = this.preview;
      pv.t += dt;
      if (pv.giro) { this.h.corpo.yaw += pv.giro * dt; this.h.rig.raiz.rotation.y = this.h.corpo.yaw; }
      if (pv.t >= pv.dur) this.proximaFasePreview();
    }
    this.h.anim.atualizar(dt, new THREE.Vector2());
  }

  // ---------- Melhorias ----------
  melhorias() {
    const n = this.p.dados.melhoriasEquipadas.length;
    this.html(`<h2 class="menu-titulo">Melhorias</h2><p class="menu-sub">Passivas aprendidas ao subir o rank. Equipadas: ${n} / ${CONFIG.progressao.slotsMelhorias}. ${this.p.dados.dp} DP disponíveis.</p>`);
    const lista = document.createElement('div');
    lista.className = 'lista-itens';
    for (const m of MELHORIAS) {
      const aprendida = this.p.melhoriaAprendida(m.id), ativa = this.p.melhoriaAtiva(m.id);
      const linha = document.createElement('div');
      linha.className = `item${ativa ? ' item--equipado' : ''}`;
      linha.innerHTML = `<div><b>${esc(m.nome)}</b> <small>Rank ${m.rank} · ${m.dp} DP</small><p>${esc(m.resumo)}</p></div>`;
      const acoes = document.createElement('div');
      acoes.className = 'item__acoes';
      if (!aprendida) {
        const pode = this.p.rank >= m.rank && this.p.dados.dp >= m.dp;
        acoes.appendChild(this.botao(this.p.rank < m.rank ? `Rank ${m.rank}` : 'Aprender', () => { const r = this.p.aprenderMelhoria(m.id); if (r.ok) this.o.audio.tocar('confirmar'); this.render(); }, 'btn btn--ouro', !pode));
      } else {
        acoes.appendChild(this.botao(ativa ? 'Desequipar' : 'Equipar', () => { const r = this.p.alternarMelhoria(m.id); if (!r.ok) this.erro(r.motivo); this.h.aplicarEquipamento(); this.render(); }, ativa ? 'btn' : 'btn btn--ouro'));
      }
      linha.appendChild(acoes);
      lista.appendChild(linha);
    }
    this.conteudo.appendChild(lista);
  }

  // ---------- Táticas ----------
  taticas() {
    const d = this.p.dados;
    this.html('<h2 class="menu-titulo">Táticas</h2><p class="menu-sub">O perfil e as preferências mudam as decisões da IA durante o combate.</p>');
    const perfis = document.createElement('div');
    perfis.className = 'perfis';
    const desc = {
      equilibrado: 'Alterna ataque, defesa e habilidades.',
      agressivo: 'Procura aberturas e usa mais habilidades, sem gastar toda a stamina.',
      defensivo: 'Prioriza defesa perfeita, contra-ataques e sobrevivência.',
      protetor: 'Provoca para atrair os inimigos para si. Sem aliados no projeto ainda, só a provocação muda.',
    };
    for (const [id, p] of Object.entries(CONFIG.perfis)) {
      const b = this.botao('', () => { d.perfil = id; this.p.avisar(); this.render(); }, `perfil${d.perfil === id ? ' perfil--sel' : ''}`);
      b.setAttribute('aria-pressed', String(d.perfil === id));
      b.innerHTML = `<b>${p.nome}</b><small>${desc[id]}</small>`;
      perfis.appendChild(b);
    }
    this.conteudo.appendChild(perfis);
    const pr = d.prefs;
    const campos = [
      ['frequenciaHabilidades', 'Frequência de habilidades', 'Pouca: mais ataques básicos. Muita: habilidades sempre que fizer sentido.'],
      ['prioridadeDefesa', 'Prioridade de defesa', 'Chance de tentar a defesa perfeita em vez de só bloquear.'],
      ['usoArea', 'Uso de habilidades de área', 'Quanto prefere giros e golpes em área quando há vários inimigos.'],
      ['economiaStamina', 'Economia de stamina', 'Alta: guarda fôlego e recua mais cedo para recuperar.'],
    ];
    const form = document.createElement('div');
    form.className = 'prefs';
    for (const [k, nome, ajuda] of campos) {
      const id = `pref-${k}`;
      const linha = document.createElement('div');
      linha.className = 'pref';
      linha.innerHTML = `<label for="${id}">${nome} <output>${Math.round(pr[k] * 100)}%</output></label><input id="${id}" type="range" min="0" max="1" step="0.05" value="${pr[k]}"><small>${ajuda}</small>`;
      const input = linha.querySelector('input'), out = linha.querySelector('output');
      input.addEventListener('input', () => { pr[k] = +input.value; out.textContent = `${Math.round(pr[k] * 100)}%`; this.p.salvar(); });
      form.appendChild(linha);
    }
    const dist = document.createElement('div');
    dist.className = 'pref';
    dist.innerHTML = `<label for="pref-dist">Distância desejada do inimigo <output>${pr.distancia > 0 ? `${pr.distancia} m` : 'do perfil'}</output></label><input id="pref-dist" type="range" min="0" max="3.5" step="0.1" value="${pr.distancia}"><small>0 usa a distância do perfil.</small>`;
    dist.querySelector('input').addEventListener('input', (e) => { pr.distancia = +e.target.value; dist.querySelector('output').textContent = pr.distancia > 0 ? `${pr.distancia.toFixed(1)} m` : 'do perfil'; this.p.salvar(); });
    form.appendChild(dist);
    const alvo = document.createElement('div');
    alvo.className = 'pref';
    alvo.innerHTML = `<label for="pref-alvo">Prioridade de alvos</label><select id="pref-alvo"><option value="ameaca">Mais perigoso</option><option value="proximo">Mais próximo</option><option value="fraco">Mais ferido</option></select>`;
    const sel = alvo.querySelector('select');
    sel.value = pr.prioridadeAlvo;
    sel.addEventListener('change', () => { pr.prioridadeAlvo = sel.value; this.p.salvar(); });
    form.appendChild(alvo);
    this.conteudo.appendChild(form);
  }

  // ---------- Atributos ----------
  atributos() {
    const s = this.h.stats, d = this.p.dados;
    this.html(`
      <h2 class="menu-titulo">Atributos</h2>
      <dl class="atributos">
        <div>${icone('vida')}<dt>Vida máxima</dt><dd>${s.vidaMax}</dd></div>
        <div>${icone('stamina')}<dt>Stamina máxima</dt><dd>${s.staminaMax}</dd></div>
        <div>${icone('forca')}<dt>Força (atual)</dt><dd>${Math.round(this.h.forcaAtual)}</dd></div>
        <div>${icone('defesa')}<dt>Defesa física</dt><dd>${s.defesa}</dd></div>
        <div>${icone('postura')}<dt>Resistência a cambaleio</dt><dd>${s.resistStagger}</dd></div>
        <div>${icone('peso')}<dt>Carga</dt><dd>${s.peso} / ${s.carga} kg</dd></div>
        <div>${icone('guarda')}<dt>Estabilidade do escudo</dt><dd>${Math.round((1 / s.estabilidadeEscudo) * 100)}%</dd></div>
        <div>${icone('sequencia')}<dt>Inimigos derrotados</dt><dd>${d.estatisticas.abates}</dd></div>
        <div>${icone('guarda')}<dt>Defesas perfeitas</dt><dd>${d.estatisticas.defesasPerfeitas}</dd></div>
      </dl>
      <h3 class="menu-titulo menu-titulo--menor">Últimas decisões da IA</h3>
      <ol class="registro-ia">${this.o.ia.registro.slice(-10).reverse().map((r) => `<li>${r.t.toFixed(1)} s · ${esc(r.txt)}</li>`).join('')}</ol>`);
  }

  // ---------- Configurações ----------
  config() {
    const c = this.p.dados.config, T = this.o.testes;
    this.html('<h2 class="menu-titulo">Configurações</h2>');
    const form = document.createElement('div');
    form.className = 'prefs';
    const vol = document.createElement('div');
    vol.className = 'pref';
    vol.innerHTML = `<label for="cfg-vol">Volume <output>${Math.round(c.volume * 100)}%</output></label><input id="cfg-vol" type="range" min="0" max="1" step="0.05" value="${c.volume}">`;
    vol.querySelector('input').addEventListener('input', (e) => { c.volume = +e.target.value; vol.querySelector('output').textContent = `${Math.round(c.volume * 100)}%`; this.p.salvar(); this.o.audio.tocar('ui'); });
    form.appendChild(vol);
    this.conteudo.appendChild(form);
    const linha = document.createElement('div');
    linha.className = 'item__acoes item__acoes--wrap';
    const cam = this.botao(`Câmera automática: ${c.cameraAuto ? 'ligada' : 'desligada'}`, () => { T.setCameraAuto(!c.cameraAuto); this.render(); });
    cam.setAttribute('aria-pressed', String(c.cameraAuto));
    linha.appendChild(cam);
    linha.appendChild(this.botao(`Velocidade: ${T.velocidade}x`, () => { T.setVelocidade(T.velocidade === 1 ? 2 : T.velocidade === 2 ? 0.5 : 1); this.render(); }));
    const estilo = c.modelos || 'bloco';
    linha.appendChild(this.botao(`Modelos: ${estilo === 'bloco' ? 'em blocos' : 'clássicos'} (recarrega)`, () => {
      c.modelos = estilo === 'bloco' ? 'classico' : 'bloco';
      this.p.salvar();
      location.reload();
    }));
    this.conteudo.appendChild(linha);

    this.html('<h3 class="menu-titulo menu-titulo--menor">Área de teste</h3><p class="menu-sub">Gere monstros específicos para testar o comportamento do Guerreiro. Feche o menu para ver a luta.</p>');
    const testes = document.createElement('div');
    testes.className = 'item__acoes item__acoes--wrap';
    for (const [tipo, nome] of [['goblin', 'Goblin'], ['batedor', 'Batedor (rápido)'], ['escudeiro', 'Escudeiro (escudo)'], ['bruto', 'Bruto (grande)'], ['morcego', 'Morcegão (voador)'], ['batedorPlataforma', 'Batedor na plataforma']]) {
      testes.appendChild(this.botao(`+ ${nome}`, () => T.gerar(tipo)));
    }
    testes.appendChild(this.botao('Próxima onda', () => T.proximaOnda()));
    testes.appendChild(this.botao('Remover inimigos', () => T.limparInimigos()));
    testes.appendChild(this.botao(`Ondas automáticas: ${T.ondasAutomaticas ? 'ligadas' : 'desligadas'}`, () => { T.alternarOndas(); this.render(); }));
    this.conteudo.appendChild(testes);

    this.html('<h3 class="menu-titulo menu-titulo--menor">Progresso</h3>');
    const prog = document.createElement('div');
    prog.className = 'item__acoes item__acoes--wrap';
    prog.appendChild(this.botao('Modo de teste: liberar rank 9 e DP', () => { this.p.liberarTudo(); this.render(); }));
    prog.appendChild(this.botao(this.confirmarApagar ? 'Confirmar: apagar tudo' : 'Apagar progresso salvo', () => {
      if (!this.confirmarApagar) { this.confirmarApagar = true; this.render(); return; }
      this.confirmarApagar = false;
      this.p.apagar();
      this.h.aplicarEquipamento();
      this.render();
    }, this.confirmarApagar ? 'btn btn--perigo' : 'btn'));
    this.conteudo.appendChild(prog);
    const salvo = this.p.salvar();
    this.html(`<p class="menu-dica">${salvo ? 'O progresso é salvo automaticamente neste navegador.' : 'Este navegador não permite salvar: o progresso some ao fechar a página.'}</p>`);
  }
}
