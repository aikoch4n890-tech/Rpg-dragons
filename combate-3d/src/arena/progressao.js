// Progressão do Guerreiro: XP, nível, Pontos de Disciplina (DP), rank da vocação, desbloqueios,
// slots de habilidades, melhorias passivas (até 6 equipadas), equipamentos e salvamento.
import { CONFIG } from './config.js';
import { HABILIDADES, POR_ID } from './habilidades.js';
import { ITENS, EQUIP_INICIAL, INVENTARIO_INICIAL } from './equipamentos.js';

const CHAVE = 'arena-guerreiro-v1';

export const MELHORIAS = [
  { id: 'folego', nome: 'Fôlego de Carga', resumo: '-50% de stamina ao carregar objetos ou agarrar inimigos (não vale para escalar).' },
  { id: 'vigor', nome: 'Vigor', resumo: '+100 de vida máxima.' },
  { id: 'desvencilhar', nome: 'Desvencilhar', resumo: 'Escapa de agarrões na metade do tempo.' },
  { id: 'ombrosLargos', nome: 'Ombros Largos', resumo: '+20 kg de capacidade de carga.' },
  { id: 'furiaFinal', nome: 'Fúria Final', resumo: '+35% de força com a vida abaixo de 30%.' },
  { id: 'leituraCombate', nome: 'Leitura de Combate', resumo: 'Janela da defesa perfeita mais longa (não defende sozinho).' },
  { id: 'bracoForte', nome: 'Braço Forte', resumo: '+10% de força.' },
].map((m) => ({ ...m, ...CONFIG.melhorias[m.id] }));

export const PREFERENCIAS_PADRAO = {
  frequenciaHabilidades: 0.5, // 0 = quase só ataques básicos, 1 = habilidades sempre que fizer sentido
  prioridadeDefesa: 0.5, // chance de tentar defesa perfeita em vez de só bloquear/esquivar
  distancia: 0, // 0 = usa a do perfil; senão, metros
  prioridadeAlvo: 'ameaca', // 'ameaca' | 'proximo' | 'fraco'
  usoArea: 0.5,
  economiaStamina: 0.5,
};

function dadosIniciais() {
  return {
    versao: 1,
    nome: 'Aldren',
    nivel: 1, xp: 0, dp: 300, dpTotal: 0,
    aprendidas: ['sequencia', 'estocada', 'impulso', 'quedaControlada', 'guarda', 'arrancada', 'pancadaEscudo'],
    espada: ['arrancada', null, null],
    escudo: ['pancadaEscudo', null, null],
    melhoriasAprendidas: [],
    melhoriasEquipadas: [],
    equip: { ...EQUIP_INICIAL },
    inventario: [...INVENTARIO_INICIAL],
    perfil: 'equilibrado',
    prefs: { ...PREFERENCIAS_PADRAO },
    config: { volume: 0.6, cameraAuto: true, mostrarDano: true },
    estatisticas: { abates: 0, defesasPerfeitas: 0 },
  };
}

export class Progresso {
  constructor() {
    this.dados = this.carregar() || dadosIniciais();
    this.ouvintes = [];
  }

  aoMudar(fn) { this.ouvintes.push(fn); }
  avisar() { this.salvar(); for (const f of this.ouvintes) f(); }

  // ---- Persistência (localStorage pode não existir ou falhar: o jogo continua sem salvar) ----
  salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(this.dados)); return true; } catch { return false; }
  }
  carregar() {
    try {
      const txt = localStorage.getItem(CHAVE);
      if (!txt) return null;
      const d = JSON.parse(txt);
      const base = dadosIniciais();
      // Mescla com os padrões para tolerar saves antigos; descarta ids que não existem mais.
      const r = { ...base, ...d, prefs: { ...base.prefs, ...(d.prefs || {}) }, config: { ...base.config, ...(d.config || {}) }, equip: { ...base.equip, ...(d.equip || {}) } };
      r.aprendidas = (r.aprendidas || []).filter((id) => POR_ID[id]);
      r.espada = (r.espada || []).map((id) => (POR_ID[id] ? id : null)).concat([null, null, null]).slice(0, CONFIG.progressao.slotsEspada);
      r.escudo = (r.escudo || []).map((id) => (POR_ID[id] ? id : null)).concat([null, null, null]).slice(0, CONFIG.progressao.slotsEscudo);
      for (const [slot, id] of Object.entries(r.equip)) if (!ITENS[id]) r.equip[slot] = base.equip[slot];
      return r;
    } catch { return null; }
  }
  apagar() {
    try { localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
    this.dados = dadosIniciais();
    this.avisar();
  }

  // ---- Rank, XP e DP ----
  get rank() {
    const L = CONFIG.progressao.rankLimiares;
    let r = 1;
    for (let i = 0; i < L.length; i++) if (this.dados.dpTotal >= L[i]) r = i + 1;
    return Math.min(r, CONFIG.progressao.rankMax);
  }
  get proximoRank() { const L = CONFIG.progressao.rankLimiares; return this.rank < L.length ? L[this.rank] : null; }
  get xpProximoNivel() { return CONFIG.progressao.xpPorNivel(this.dados.nivel); }

  ganhar(xp, dp) {
    const rankAntes = this.rank, nivelAntes = this.dados.nivel;
    this.dados.xp += xp;
    this.dados.dp += dp;
    this.dados.dpTotal += dp;
    while (this.dados.xp >= this.xpProximoNivel) { this.dados.xp -= this.xpProximoNivel; this.dados.nivel++; }
    this.avisar();
    return { subiuNivel: this.dados.nivel > nivelAntes, subiuRank: this.rank > rankAntes };
  }

  // ---- Habilidades ----
  aprendida(id) { return this.dados.aprendidas.includes(id); }
  equipada(id) { return this.dados.espada.includes(id) || this.dados.escudo.includes(id); }
  // Fundamentais ativas: a versão mais forte aprendida de cada família.
  fundamentalAtiva(familia) {
    const hs = HABILIDADES.filter((h) => h.categoria === 'fundamental' && h.familia === familia && this.aprendida(h.id));
    return hs.find((h) => h.nivel === 'aprimorada') || hs[0] || null;
  }

  estadoHabilidade(h) {
    if (this.equipada(h.id)) return 'equipada';
    if (this.aprendida(h.id)) return 'aprendida';
    return this.podeAprender(h.id).ok ? 'disponivel' : 'bloqueada';
  }

  podeAprender(id) {
    const h = POR_ID[id];
    if (this.aprendida(id)) return { ok: false, motivo: 'Já aprendida' };
    if (this.rank < h.rank) return { ok: false, motivo: `Exige rank ${h.rank}` };
    if (h.base && !this.aprendida(h.base)) return { ok: false, motivo: `Exige ${POR_ID[h.base].nome}` };
    if (h.requerAcessorio && this.dados.equip.acessorio !== h.requerAcessorio) return { ok: false, motivo: 'Exige o Anel do Mestre de Armas equipado' };
    if (this.dados.dp < h.dp) return { ok: false, motivo: `Faltam ${h.dp - this.dados.dp} DP` };
    return { ok: true };
  }

  aprender(id) {
    const r = this.podeAprender(id);
    if (!r.ok) return r;
    this.dados.dp -= POR_ID[id].dp;
    this.dados.aprendidas.push(id);
    this.avisar();
    return { ok: true };
  }

  // Equipa no primeiro slot livre da categoria (ou no slot indicado). Variante especial exige o anel.
  equiparHabilidade(id, slot = null) {
    const h = POR_ID[id];
    if (!this.aprendida(id) || !['espada', 'escudo'].includes(h.categoria)) return { ok: false, motivo: 'Não pode ser equipada' };
    if (h.requerAcessorio && this.dados.equip.acessorio !== h.requerAcessorio) return { ok: false, motivo: 'Exige o Anel do Mestre de Armas equipado' };
    const lista = this.dados[h.categoria];
    if (lista.includes(id)) return { ok: true };
    const i = slot ?? lista.indexOf(null);
    if (i < 0) return { ok: false, motivo: 'Slots cheios: desequipe uma habilidade primeiro' };
    lista[i] = id;
    this.avisar();
    return { ok: true };
  }
  desequiparHabilidade(id) {
    for (const cat of ['espada', 'escudo']) this.dados[cat] = this.dados[cat].map((x) => (x === id ? null : x));
    this.avisar();
  }
  moverHabilidade(cat, de, para) {
    const l = this.dados[cat];
    [l[de], l[para]] = [l[para], l[de]];
    this.avisar();
  }
  get habilidadesEquipadas() {
    return [...this.dados.espada, ...this.dados.escudo].filter(Boolean).map((id) => POR_ID[id])
      .filter((h) => !h.requerAcessorio || this.dados.equip.acessorio === h.requerAcessorio);
  }

  // ---- Melhorias ----
  melhoriaAprendida(id) { return this.dados.melhoriasAprendidas.includes(id); }
  melhoriaAtiva(id) { return this.dados.melhoriasEquipadas.includes(id); }
  aprenderMelhoria(id) {
    const m = MELHORIAS.find((x) => x.id === id);
    if (this.melhoriaAprendida(id)) return { ok: false, motivo: 'Já aprendida' };
    if (this.rank < m.rank) return { ok: false, motivo: `Exige rank ${m.rank}` };
    if (this.dados.dp < m.dp) return { ok: false, motivo: `Faltam ${m.dp - this.dados.dp} DP` };
    this.dados.dp -= m.dp;
    this.dados.melhoriasAprendidas.push(id);
    this.avisar();
    return { ok: true };
  }
  alternarMelhoria(id) {
    const eq = this.dados.melhoriasEquipadas;
    if (eq.includes(id)) { eq.splice(eq.indexOf(id), 1); this.avisar(); return { ok: true }; }
    if (!this.melhoriaAprendida(id)) return { ok: false, motivo: 'Aprenda primeiro' };
    if (eq.length >= CONFIG.progressao.slotsMelhorias) return { ok: false, motivo: `Máximo de ${CONFIG.progressao.slotsMelhorias} melhorias` };
    eq.push(id);
    this.avisar();
    return { ok: true };
  }

  // ---- Equipamento e atributos ----
  equiparItem(id) {
    const it = ITENS[id];
    this.dados.equip[it.slot] = id;
    // Tirar o anel desequipa as variantes especiais.
    if (it.slot === 'acessorio' && id !== 'anelMestre') {
      for (const cat of ['espada', 'escudo']) this.dados[cat] = this.dados[cat].map((x) => (x && POR_ID[x].requerAcessorio ? null : x));
    }
    this.avisar();
  }

  atributos(equip = this.dados.equip) {
    const G = CONFIG.guerreiro, d = this.dados;
    const itens = Object.values(equip).map((id) => ITENS[id]);
    const soma = (k) => itens.reduce((s, it) => s + (it[k] || 0), 0);
    const ativa = (id) => this.melhoriaAtiva(id);
    let forca = G.forcaBase + (d.nivel - 1) * G.forcaPorNivel + soma('forca');
    if (ativa('bracoForte')) forca *= 1 + CONFIG.melhorias.bracoForte.bonusForca;
    const carga = G.cargaBase + (ativa('ombrosLargos') ? CONFIG.melhorias.ombrosLargos.cargaExtra : 0);
    const escudo = ITENS[equip.escudo];
    return {
      vidaMax: Math.round(G.vidaBase + (d.nivel - 1) * G.vidaPorNivel + (ativa('vigor') ? CONFIG.melhorias.vigor.vidaExtra : 0)),
      staminaMax: Math.round(G.staminaBase + (d.nivel - 1) * G.staminaPorNivel + soma('staminaExtra')),
      forca: Math.round(forca),
      defesa: Math.round(G.defesaBase + soma('defesa')),
      resistStagger: Math.round(G.resistStaggerBase + soma('resistStagger')),
      carga,
      peso: soma('peso'),
      estabilidadeEscudo: escudo.estabilidade ?? 1,
      tamanhoLamina: ITENS[equip.espada].tamanhoLamina ?? 1,
      tamanhoEscudo: escudo.tamanhoEscudo ?? 1,
    };
  }

  // Modo de teste: libera ranks e DP para experimentar tudo.
  liberarTudo() {
    this.dados.dpTotal = Math.max(this.dados.dpTotal, CONFIG.progressao.rankLimiares.at(-1));
    this.dados.dp += 30000;
    this.avisar();
  }
}
