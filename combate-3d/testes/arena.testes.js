// Testes automatizados da Arena do Guerreiro (lista obrigatória do pedido + extras).
// Como rodar:
//   1. cd combate-3d && python3 -m http.server 8765
//   2. em outro terminal: npm i playwright && node testes/arena.testes.js [nomeDoTeste,outro]
// Cada teste prepara um cenário pela API window.arena e avança o jogo com arena.simular(segundos),
// em passos fixos de 1/60 s, sem depender da taxa de quadros.
const { chromium } = require('playwright');
const filtro = process.argv[2] ? process.argv[2].split(',') : null;
(async () => {
  const b = await chromium.launch({ args: process.env.SWIFTSHADER ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const ctxB = await b.newContext({ viewport: { width: 900, height: 600 } });
  const p = await ctxB.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push('PAGE ' + e.message + ' ' + (e.stack||'').split('\n').slice(0,4).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await p.goto('http://localhost:8765/arena.html');
  await p.waitForFunction(() => window.arena);
  await p.evaluate(() => {
    const A = window.arena;
    A.setOndas(false);
    window.T = {
      prep({ aprender = [], espada = [], escudo = [], melhorias = [], perfil = 'equilibrado', prefs = {} } = {}) {
        A.limparInimigos();
        A.progresso.apagar();
        A.progresso.liberarTudo();
        for (const id of aprender) A.progresso.aprender(id);
        A.progresso.dados.espada = [...espada, null, null, null].slice(0, 3);
        A.progresso.dados.escudo = [...escudo, null, null, null].slice(0, 3);
        for (const m of melhorias) { A.progresso.aprenderMelhoria(m); A.progresso.alternarMelhoria(m); }
        A.progresso.dados.perfil = perfil;
        Object.assign(A.progresso.dados.prefs, prefs);
        A.progresso.avisar();
        A.heroi.reviver();
        A.ia.alvo = null; A.ia.registro.length = 0; A.ia.respostas.clear(); A.ia.bloqueados.clear();
        for (const k of Object.keys(A.placar)) A.placar[k] = typeof A.placar[k] === 'number' ? 0 : {};
      },
      gerarEm(tipo, x, z) { const e = A.gerar(tipo); if (x !== undefined) { e.corpo.pos.x = x; e.corpo.pos.z = z; } return e; },
      reg() { return A.ia.registro.map((r) => r.txt); },
    };
  });
  const testes = {
    async deteccao() {
      return p.evaluate(() => { T.prep(); const g = T.gerarEm('goblin', 7, 0); arena.simular(20); return { ok: g.vida < g.vidaMax && T.reg().some((r) => r.startsWith('alvo')), vidaGoblin: g.vida, estado: g.estado, reg: T.reg().slice(0, 4) }; });
    },
    async investida() {
      return p.evaluate(() => { T.prep({ espada: ['arrancada'] }); T.gerarEm('goblin', 0, 9); arena.simular(5); const r = T.reg(); return { ok: r.some((x) => x.includes('investida')), reg: r.slice(0, 6) }; });
    },
    async variedade() {
      return p.evaluate(() => {
        T.prep({ aprender: ['corteRecuo', 'arcoAscendente', 'perfuracao', 'rajadaCortes', 'batidasRapidas', 'estocadasProtegidas'], espada: ['arcoAscendente', 'perfuracao', 'rajadaCortes'], escudo: ['pancadaEscudo', 'batidasRapidas', 'estocadasProtegidas'] });
        const tipos = ['goblin', 'escudeiro', 'goblin', 'batedor'];
        let k = 0;
        for (let t = 0; t < 60; t += 0.5) {
          if (arena.inimigos.filter((e) => e.vivo).length < 2) T.gerarEm(tipos[k++ % tipos.length]);
          arena.simular(0.5);
        }
        const habs = T.reg().filter((x) => x.startsWith('habilidade:') || x.startsWith('contra') || x.startsWith('combo') || x.startsWith('golpe')).map((x) => x.split(': ')[1] || x);
        let maxSeq = 1, seq = 1;
        for (let i = 1; i < habs.length; i++) { seq = habs[i] === habs[i - 1] ? seq + 1 : 1; maxSeq = Math.max(maxSeq, seq); }
        const distintos = new Set(habs).size;
        return { ok: distintos >= 4 && maxSeq <= 3, distintos, maxSeq, amostra: habs.slice(0, 14), registro: undefined, heroi: arena.heroi.estado + ' ' + Math.round(arena.heroi.vida), placar: arena.placar };
      });
    },
    async bloqueioEPerfeito() {
      return p.evaluate(() => {
        T.prep({ aprender: ['aparo'], perfil: 'defensivo', prefs: { prioridadeDefesa: 0.8 } });
        const g = T.gerarEm('goblin', 0, 2);
        g.def = { ...g.def, ataques: g.def.ataques.filter((x) => x.nome === 'Garra') }; // só a garra (bloqueável)
        g.vida = g.vidaMax = 99999;
        arena.simular(50);
        const P = arena.placar;
        return { ok: P.bloqueados + P.perfeitos > 3 && P.perfeitos > 0 && P.bloqueados + P.sofridos > 0, bloqueados: P.bloqueados, perfeitos: P.perfeitos, sofridos: P.sofridos };
      });
    },
    async semAparoNaoHaPerfeito() {
      return p.evaluate(() => {
        T.prep({ perfil: 'defensivo' });
        const g = T.gerarEm('goblin', 0, 2); g.def = { ...g.def, ataques: g.def.ataques.filter((x) => x.nome === 'Garra') }; g.vida = g.vidaMax = 99999;
        arena.simular(15);
        return { ok: arena.placar.perfeitos === 0 && arena.placar.bloqueados > 0, ...arena.placar, reacoes: undefined, eventos: undefined };
      });
    },
    async staminaBaixa() {
      return p.evaluate(() => {
        T.prep();
        const g = T.gerarEm('goblin', 0, 1.6); g.vida = g.vidaMax = 99999;
        arena.simular(0.6);
        arena.heroi.stamina = 15;
        const d0 = arena.heroi.distanciaAte(g);
        const estados = new Set();
        for (let i = 0; i < 30; i++) { arena.simular(0.05); estados.add(arena.heroi.estadoIA); }
        return { ok: estados.has('Recuperando'), estados: [...estados], d0: d0.toFixed(2), d1: arena.heroi.distanciaAte(g).toFixed(2), stamina: Math.round(arena.heroi.stamina) };
      });
    },
    async voador() {
      return p.evaluate(() => {
        T.prep({ aprender: ['cortesAscendentes'], espada: ['cortesAscendentes'] });
        const m = T.gerarEm('morcego', 3, 3);
        arena.simular(35);
        const r = T.reg();
        return { ok: r.some((x) => x.includes('anti-aéreo')) && (m.vida < m.vidaMax), usosAntiAereo: r.filter((x) => x.includes('anti-aéreo')).length, vida: m.vida, estado: m.estado, reacoes: arena.placar.reacoes };
      });
    },
    async cercado() {
      return p.evaluate(() => {
        T.prep({ aprender: ['giroLamina'], espada: ['giroLamina'], prefs: { usoArea: 0.9 } });
        for (let i = 0; i < 4; i++) { const g = T.gerarEm('goblin', 1.4 * Math.cos(i * 1.57), 1.4 * Math.sin(i * 1.57)); g.vida = g.vidaMax = 99999; }
        arena.simular(8);
        const r = T.reg();
        return { ok: r.some((x) => x.startsWith('cercado')), reg: r.filter((x) => x.startsWith('cercado') || x.startsWith('habilidade')).slice(0, 6) };
      });
    },
    async gigante() {
      return p.evaluate(() => {
        T.prep({ aprender: ['arcoAscendente', 'arcoAscendenteMaior', 'estocadaDerrubadora'], espada: ['arcoAscendenteMaior'] });
        const b = T.gerarEm('bruto', 0, 3);
        const direto = b.receberGolpe({ forca: 40, mult: 2.5, stagger: 400, efeito: 'lancar', forcaLancar: 8, origem: arena.heroi.corpo.pos.clone(), fonte: 'lamina' });
        b.vida = b.vidaMax = 99999;
        let foiLancado = false, derrubado = false;
        for (let i = 0; i < 400; i++) { arena.simular(0.05); if (b.estado === 'lancado') foiLancado = true; if (b.estado === 'derrubado') derrubado = true; }
        const reac = Object.entries(arena.placar.reacoes).filter(([k]) => k.startsWith('bruto'));
        return { ok: !foiLancado && direto.reacao !== 'lancado', reacaoDireta: direto.reacao, foiLancado, derrubado, reacoes: reac };
      });
    },
    async trocaAlvo() {
      return p.evaluate(() => {
        T.prep();
        const a = T.gerarEm('goblin', 2, 0), c = T.gerarEm('goblin', -5, 4);
        a.vida = 30;
        arena.simular(25);
        const alvos = T.reg().filter((x) => x.startsWith('alvo'));
        return { ok: !a.vivo && alvos.length >= 2 && (c.vida < c.vidaMax), alvos, vivoA: a.vivo, vidaC: c.vida };
      });
    },
    async impulsoEQueda() {
      return p.evaluate(() => {
        T.prep();
        const e = T.gerarEm('batedorPlataforma');
        let maxY = 0;
        for (let i = 0; i < 600; i++) { arena.simular(0.05); maxY = Math.max(maxY, arena.heroi.corpo.pos.y); if (!e.vivo && i > 0 && arena.heroi.corpo.pos.y < 0.1 && maxY > 1) break; }
        arena.simular(3);
        // Queda controlada: a escada e a rampa deixam descer andando, então empurra o herói pela borda oeste (sem escada)
        arena.limparInimigos(); arena.ia.update = () => {};
        const H = arena.heroi; H.reviver(); H.corpo.pos.set(-10.6, 1.25, -2); H.corpo.posAnterior.copy(H.corpo.pos); H.corpo.yaw = -Math.PI / 2; H.ik.zerar();
        for (let i = 0; i < 120; i++) { H.intencao.vel.set(-1.6, 0); arena.simular(1 / 60); }
        arena.ia.update = Object.getPrototypeOf(arena.ia).update.bind(arena.ia);
        const r = T.reg();
        return { ok: r.some((x) => x.includes('Impulso')) && maxY > 1.2 && (arena.placar.eventos.queda || 0) > 0, impulsos: r.filter((x) => x.includes('Impulso')).length, quedas: arena.placar.eventos.queda || 0, alturaHeroiMax: maxY.toFixed(2), inimigo: `${e.estado} ${Math.round(e.vida)}`, pos: arena.heroi.corpo.pos.toArray().map((v) => v.toFixed(1)) };
      });
    },
    async agarrao() {
      return p.evaluate(() => {
        T.prep({ melhorias: ['desvencilhar'] });
        const g = T.gerarEm('goblin', 0, 1.3);
        g.def = { ...g.def, ataques: g.def.ataques.filter((x) => x.nome === 'Agarrão') };
        g.vida = g.vidaMax = 99999;
        arena.heroi.progresso.dados.escudo = [null, null, null];
        arena.heroi.progresso.dados.espada = [null, null, null];
        let agarrou = false, escapou = false;
        arena.simular(0.3);
        arena.heroi.stamina = 0; arena.heroi.ficarExausto();
        const hp = arena.heroi.corpo.pos, f = arena.heroi.corpo.frente;
        g.corpo.pos.set(hp.x + f.x * 0.95, 0, hp.z + f.y * 0.95);
        g.corpo.yaw = Math.atan2(hp.x - g.corpo.pos.x, hp.z - g.corpo.pos.z);
        g.iniciarAtaque(g.def.ataques[0], arena.controle);
        for (let i = 0; i < 400; i++) { arena.simular(0.05); if (arena.heroi.estado === 'agarrado') agarrou = true; if (agarrou && arena.heroi.estado !== 'agarrado') escapou = true; }
        const r = T.reg().filter((x) => x.includes('agarrao'));
        return { ok: agarrou && escapou, respostas: r.slice(0, 5), agarrou, escapou, eventos: arena.placar.eventos };
      });
    },
    async quebraGuarda() {
      return p.evaluate(() => {
        T.prep({ escudo: ['pancadaEscudo'] });
        const e = T.gerarEm('escudeiro', 0, 2.5);
        e.vida = e.vidaMax = 99999;
        arena.simular(25);
        return { ok: arena.placar.guardasQuebradas > 0, guardas: arena.placar.guardasQuebradas, reacoes: arena.placar.reacoes };
      });
    },
    async melhorias() {
      return p.evaluate(() => {
        T.prep();
        const antes = arena.progresso.atributos();
        for (const m of ['vigor', 'bracoForte', 'ombrosLargos']) { arena.progresso.aprenderMelhoria(m); arena.progresso.alternarMelhoria(m); }
        const depois = arena.progresso.atributos();
        // Limite de 6
        for (const m of ['folego', 'desvencilhar', 'furiaFinal', 'leituraCombate']) { arena.progresso.aprenderMelhoria(m); arena.progresso.alternarMelhoria(m); }
        const n = arena.progresso.dados.melhoriasEquipadas.length;
        arena.heroi.aplicarEquipamento();
        arena.heroi.vida = arena.heroi.stats.vidaMax * 0.2;
        const forcaFuria = arena.heroi.forcaAtual;
        return { ok: depois.vidaMax - antes.vidaMax === 100 && depois.forca > antes.forca && depois.carga - antes.carga === 20 && n === 6 && forcaFuria > depois.forca, antes: [antes.vidaMax, antes.forca, antes.carga], depois: [depois.vidaMax, depois.forca, depois.carga], equipadas: n, forcaFuria };
      });
    },
    async progressaoXP() {
      return p.evaluate(() => {
        A = arena; A.limparInimigos(); A.progresso.apagar(); A.heroi.reviver();
        const r0 = A.progresso.rank;
        const g = T.gerarEm('goblin', 2, 0); g.vida = 5;
        A.simular(8);
        window.__dbg = `goblin ${g.estado} vida=${g.vida} heroi=${A.heroi.estado}/${A.heroi.estadoIA} reg=${A.ia.registro.map((r) => r.txt).slice(-6).join(' | ')}`;
        const d = A.progresso.dados;
        const naoPode = A.progresso.podeAprender('giroCompleto');
        return { ok: d.xp > 0 && d.dpTotal > 0 && !naoPode.ok, dbg: window.__dbg, xp: d.xp, dp: d.dp, rank: [r0, A.progresso.rank], bloqueio: naoPode.motivo };
      });
    },
  };
  const resultados = {};
  for (const [nome, fn] of Object.entries(testes)) {
    if (filtro && !filtro.includes(nome)) continue;
    try { resultados[nome] = await fn(); } catch (e) { resultados[nome] = { ok: false, erro: e.message.slice(0, 300) }; }
    console.log(`${resultados[nome].ok ? 'PASSOU' : 'FALHOU'}  ${nome}  ${JSON.stringify(resultados[nome])}`);
  }
  console.log(erros.length ? 'ERROS:\n' + [...new Set(erros)].slice(0, 8).join('\n') : 'sem erros de página');
  await b.close();
})();
