// HUD de combate: só o necessário (vida, stamina, alvo, habilidades equipadas, avisos).
import { icone } from './icones.js';
import { POR_ID } from './habilidades.js';

export class HUD {
  constructor(heroi, progresso, ia, inimigos) {
    this.h = heroi;
    this.p = progresso;
    this.ia = ia;
    this.inimigos = inimigos;
    this.el = {
      nome: document.getElementById('h-nome'),
      nivel: document.getElementById('h-nivel'),
      vida: document.getElementById('h-vida'),
      vidaTxt: document.getElementById('h-vida-txt'),
      stamina: document.getElementById('h-stamina'),
      staminaTxt: document.getElementById('h-stamina-txt'),
      xp: document.getElementById('h-xp'),
      painel: document.getElementById('h-painel'),
      alvo: document.getElementById('h-alvo'),
      alvoNome: document.getElementById('h-alvo-nome'),
      alvoVida: document.getElementById('h-alvo-vida'),
      estado: document.getElementById('h-estado'),
      habs: document.getElementById('h-habs'),
      aviso: document.getElementById('h-aviso'),
      perfeito: document.getElementById('h-perfeito'),
      onda: document.getElementById('h-onda'),
      log: document.getElementById('h-log'),
    };
    this.p.aoMudar(() => this.montarHabilidades());
    this.montarHabilidades();
    this.tAviso = 0;
  }

  montarHabilidades() {
    const d = this.p.dados;
    const slots = [...d.espada.map((id) => ['espada', id]), ...d.escudo.map((id) => ['escudo', id])];
    this.el.habs.innerHTML = '';
    this.slots = slots.map(([cat, id]) => {
      const div = document.createElement('div');
      div.className = `hab hab--${cat}`;
      const h = id ? POR_ID[id] : null;
      div.innerHTML = h ? `${icone(h.familia)}<span class="hab__recarga"></span>` : '';
      div.title = h ? h.nome : 'Slot vazio';
      if (!h) div.classList.add('hab--vazia');
      this.el.habs.appendChild(div);
      return { div, h, recarga: div.querySelector('.hab__recarga') };
    });
  }

  avisar(texto, tipo = 'info', dur = 1.6) {
    const a = this.el.aviso;
    a.textContent = texto;
    a.className = `aviso-arena aviso-arena--${tipo} aviso-arena--ativo`;
    this.tAviso = dur;
  }

  registrar(texto) {
    const li = document.createElement('li');
    li.textContent = texto;
    this.el.log.prepend(li);
    while (this.el.log.children.length > 4) this.el.log.lastChild.remove();
  }

  evento(tipo, dado) {
    switch (tipo) {
      case 'habilidade': if (dado.categoria !== 'fundamental' || dado.id === 'impulso') this.avisar(dado.nome, 'hab', 1.1); break;
      case 'perfeito':
        this.el.perfeito.classList.remove('ativo'); void this.el.perfeito.offsetWidth; this.el.perfeito.classList.add('ativo');
        break;
      case 'abate': this.registrar(`${dado.nome} derrotado  +${dado.xp} XP  +${dado.dp} DP`); break;
      case 'nivel': this.avisar(`Nível ${dado}!`, 'bom', 2.2); break;
      case 'rank': this.avisar(`Rank da vocação ${dado}! Novas habilidades disponíveis`, 'bom', 2.8); break;
      case 'onda': this.el.onda.textContent = `Onda ${dado}`; this.registrar(`Onda ${dado} começou`); break;
      case 'agarrado': this.avisar('Agarrado! Lutando para escapar', 'ruim', 1.4); break;
      case 'escapou': this.registrar('Escapou do agarrão'); break;
      case 'exausto': this.avisar('Sem fôlego', 'ruim', 1.2); break;
      case 'guardaQuebrada': this.avisar('Guarda quebrada', 'ruim', 1.2); break;
      case 'provocacao': this.registrar(`Provocou ${dado} inimigo(s)`); break;
      case 'queda': this.registrar('Queda controlada'); break;
      case 'morte': this.avisar('Derrotado... recomeçando a onda', 'ruim', 3.2); break;
    }
  }

  atualizar(dt) {
    const h = this.h, d = this.p.dados, e = this.el;
    e.nome.textContent = d.nome;
    e.nivel.textContent = `Nv ${d.nivel} · Guerreiro rank ${this.p.rank}`;
    const fv = Math.max(0, h.vida / h.stats.vidaMax);
    e.vida.style.width = `${fv * 100}%`;
    e.vidaTxt.textContent = `${Math.ceil(Math.max(0, h.vida))} / ${h.stats.vidaMax}`;
    e.stamina.style.width = `${(h.stamina / h.stats.staminaMax) * 100}%`;
    e.staminaTxt.textContent = `${Math.round(h.stamina)} / ${h.stats.staminaMax}`;
    e.stamina.classList.toggle('barra__fill--exausto', h.exausto);
    e.xp.style.width = `${(d.xp / this.p.xpProximoNivel) * 100}%`;
    e.painel.classList.toggle('critico', fv < 0.3 && h.vivo);
    e.estado.textContent = h.estadoIA;
    const alvo = this.ia.alvo;
    e.alvo.hidden = !alvo || !alvo.vivo;
    if (alvo && alvo.vivo) {
      e.alvoNome.textContent = alvo.nome + (alvo.vulneravel ? ' · vulnerável' : '');
      e.alvoVida.style.width = `${(alvo.vida / alvo.vidaMax) * 100}%`;
    }
    for (const s of this.slots) {
      if (!s.h) continue;
      const rec = h.recargas[s.h.id] ?? 0;
      s.recarga.style.height = `${Math.min(1, rec / (s.h.recarga || 1)) * 100}%`;
      s.div.classList.toggle('hab--sem-stamina', h.stamina < s.h.stamina);
      s.div.classList.toggle('hab--usando', h.acao?.def?.id === s.h.id);
    }
    if (this.tAviso > 0) { this.tAviso -= dt; if (this.tAviso <= 0) e.aviso.classList.remove('aviso-arena--ativo'); }
  }
}
