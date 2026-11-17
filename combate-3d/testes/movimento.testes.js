// Testes de movimento e animação (pés, terreno, giro, transições, reações, camadas, IK).
// Como rodar: cd combate-3d && python3 -m http.server 8765; em outro terminal:
//   npm i playwright && node testes/movimento.testes.js [teste,outro]
// Tudo é medido pela API window.arena, com arena.simular() em passos fixos de 1/60 s.
const { chromium } = require('playwright');
const filtro = process.argv[2] ? process.argv[2].split(',') : null;
const args = process.env.SWIFTSHADER ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];

(async () => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(`http://localhost:${process.env.PORTA || 8765}/arena.html`);
  await p.waitForFunction(() => window.arena);
  await p.evaluate(() => {
    const A = window.arena;
    A.setOndas(false);
    window.M = {
      prep(pos, yaw = 0) {
        A.limparInimigos(); A.ia.update = () => {};
        const H = A.heroi; H.reviver(); H.corpo.pos.set(...pos); H.corpo.posAnterior.copy(H.corpo.pos); H.corpo.yaw = yaw; H.ik.zerar();
        H.velAtual.set(0, 0); H.intencao.olhar = null; H.intencao.correr = false; H.intencao.sprint = false;
        return H;
      },
      // Folga do tornozelo sobre o chão sob cada pé (negativo = pé atravessando)
      folgaPes(ent, altura) {
        return ['LeftFoot', 'RightFoot'].map((n) => {
          const v = ent.rig.ossos[n].getWorldPosition(ent.rig.ossos[n].position.clone());
          return v.y - A.mundo.alturaChao(v.x, v.z, ent.corpo.pos.y + 0.4) - altura * 0.85;
        });
      },
      escorregamento(ent, setup, seg = 3) {
        const pes = [ent.rig.ossos.LeftFoot, ent.rig.ossos.RightFoot];
        const hist = pes.map(() => []);
        for (let i = 0; i < seg * 60; i++) { setup(); A.simular(1 / 60); pes.forEach((pe, k) => { const v = pe.getWorldPosition(pe.position.clone()); hist[k].push([v.x, v.y, v.z]); }); }
        const med = hist.map((h) => {
          const parte = h.slice(60), q = [];
          for (let i = 1; i < parte.length; i++) q.push({ y: parte[i][1], v: Math.hypot(parte[i][0] - parte[i - 1][0], parte[i][2] - parte[i - 1][2]) * 60 });
          q.sort((a, b) => a.y - b.y);
          const baixo = q.slice(0, Math.round(q.length * 0.35)).map((x) => x.v).sort((a, b) => a - b);
          return baixo[Math.floor(baixo.length / 2)];
        });
        return +((med[0] + med[1]) / 2).toFixed(3);
      },
    };
  });

  const testes = {
    // Pé de apoio parado no chão em todas as direções e velocidades (m/s de deslize)
    async escorregamento() {
      return p.evaluate(() => {
        const r = {};
        const casos = { andar: [0, 1.8, 0, 0, [4, 0, -12]], correr: [0, 4.2, 1, 0, [4, 0, -12]], sprint: [0, 6.2, 1, 1, [4, 0, -12]],
          recuar: [0, -1.5, 0, 0, [4, 0, 6], 1], lateralEsq: [1.5, 0, 0, 0, [-4, 0, 9], 1], lateralDir: [-1.5, 0, 0, 0, [5, 0, 9], 1], diagonal: [1.2, 1.2, 0, 0, [-4, 0, -10], 1] };
        for (const [n, [vx, vz, c, s, pos, olha]] of Object.entries(casos)) {
          const H = M.prep(pos);
          r[n] = M.escorregamento(H, () => { H.intencao.vel.set(vx, vz); H.intencao.correr = !!c; H.intencao.sprint = !!s; H.intencao.olhar = olha ? H.corpo.pos.clone().setZ(H.corpo.pos.z + 5) : null; });
        }
        arena.limparInimigos(); arena.heroi.corpo.pos.set(14, 0, 0);
        for (const [n, vel] of [['goblinAndar', 2.4], ['goblinCorrer', 3.8]]) {
          arena.limparInimigos();
          const g = arena.gerar('goblin'); g.corpo.pos.set(4, 0, -12); g.corpo.posAnterior.copy(g.corpo.pos); g.corpo.yaw = 0;
          g.pensar = function () { this.corpo.vel.set(0, vel); };
          r[n] = M.escorregamento(g, () => {});
        }
        return { ok: Object.values(r).every((v) => v < 0.15), deslizeMedio: r };
      });
    },
    async escada() {
      return p.evaluate(() => {
        const H = M.prep([-3.5, 0, -2], -Math.PI / 2);
        let folgaMin = 9, pulou = false, maxDy = 0, yAnt = 0;
        for (let i = 0; i < 300; i++) {
          H.intencao.vel.set(-1.6, 0); arena.simular(1 / 60);
          if (H.estado === 'salto' || H.estado === 'reacao') pulou = true;
          const fp = M.folgaPes(H, 0.09);
          if (Math.min(...fp) < folgaMin && Math.min(...fp) < -0.03) window.__pior = `quadro ${i} raiz=${H.corpo.pos.x.toFixed(2)},${H.corpo.pos.y.toFixed(2)} folgas=${fp.map((v) => v.toFixed(3))} quadril=${H.ik.quadril.toFixed(3)} pesos=${H.ik.pes.map((q) => q.peso.toFixed(1))}`;
          folgaMin = Math.min(folgaMin, ...fp);
          maxDy = Math.max(maxDy, H.corpo.pos.y - yAnt); yAnt = H.corpo.pos.y;
        }
        return { ok: H.corpo.pos.y > 1.2 && !pulou && folgaMin > -0.03 && maxDy < 0.08, pior: window.__pior, alturaFinal: +H.corpo.pos.y.toFixed(2), pulou, folgaMinPes: +folgaMin.toFixed(3), maiorSubidaPorQuadro: +maxDy.toFixed(3) };
      });
    },
    async descerEscada() {
      return p.evaluate(() => {
        const H = M.prep([-8.2, 1.25, -2], Math.PI / 2);
        let reacoes = 0, folgaMin = 9;
        for (let i = 0; i < 240; i++) { H.intencao.vel.set(1.6, 0); arena.simular(1 / 60); if (H.estado === 'reacao') reacoes++; folgaMin = Math.min(folgaMin, ...M.folgaPes(H, 0.09)); }
        return { ok: H.corpo.pos.y < 0.05 && reacoes === 0 && folgaMin > -0.03, alturaFinal: +H.corpo.pos.y.toFixed(2), quadrosEmReacao: reacoes, folgaMinPes: +folgaMin.toFixed(3) };
      });
    },
    async rampa() {
      return p.evaluate(() => {
        const H = M.prep([-9, 0, -9.2], 0);
        let folgaMin = 9, pulou = false;
        for (let i = 0; i < 300; i++) { H.intencao.vel.set(0, 1.6); arena.simular(1 / 60); if (H.estado !== 'livre') pulou = true; folgaMin = Math.min(folgaMin, ...M.folgaPes(H, 0.09)); }
        return { ok: H.corpo.pos.y > 1.2 && !pulou && folgaMin > -0.03, alturaFinal: +H.corpo.pos.y.toFixed(2), folgaMinPes: +folgaMin.toFixed(3) };
      });
    },
    // Giro: nada de virar instantaneamente; acelera, freia e dá passinhos no lugar
    async giro() {
      return p.evaluate(() => {
        const H = M.prep([4, 0, 4], 0);
        let maxPasso = 0, yaw0 = H.corpo.yaw, pesoVirar = 0, quadros = 0;
        for (let i = 0; i < 90; i++) {
          H.intencao.vel.set(0, 0); H.intencao.olhar = H.corpo.pos.clone().setZ(H.corpo.pos.z - 5);
          const antes = H.corpo.yaw; arena.simular(1 / 60);
          const d = Math.abs(Math.atan2(Math.sin(H.corpo.yaw - antes), Math.cos(H.corpo.yaw - antes)));
          maxPasso = Math.max(maxPasso, d); pesoVirar = Math.max(pesoVirar, H.anim.pesosLoco.virar || 0);
          if (Math.abs(Math.atan2(Math.sin(H.corpo.yaw - Math.PI), Math.cos(H.corpo.yaw - Math.PI))) > 0.05) quadros++;
        }
        const grausPorQuadro = maxPasso * 180 / Math.PI;
        return { ok: grausPorQuadro < 6 && quadros > 15 && pesoVirar > 0.3, maiorGiroPorQuadroGraus: +grausPorQuadro.toFixed(2), quadrosAteVirar180: quadros, pesoPassinhos: +pesoVirar.toFixed(2) };
      });
    },
    // Transições sem tranco: golpe rápido pode ser rápido, mas a velocidade de cada osso não pode
    // mudar de repente (tranco = aceleração angular alta). Fora dos golpes, a velocidade também é limitada.
    async transicoes() {
      return p.evaluate(() => {
        const A = arena;
        A.limparInimigos();
        A.ia.update = Object.getPrototypeOf(A.ia).update.bind(A.ia);
        A.heroi.reviver();
        A.progresso.liberarTudo();
        for (const id of ['aparo', 'arcoAscendente', 'corteRecuo', 'batidasRapidas']) A.progresso.aprender(id);
        A.progresso.dados.espada = ['arrancada', 'arcoAscendente', 'corteRecuo']; A.progresso.dados.escudo = ['pancadaEscudo', 'batidasRapidas', null];
        const ossos = ['Spine', 'Spine1', 'Head', 'RightArm', 'RightForeArm', 'LeftArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
        const ant = {}, vAnt = {}, tranco = [], trancoTransicao = [], velLoco = [];
        for (let i = 0; i < 25 * 60; i++) {
          if (A.inimigos.filter((e) => e.vivo).length < 2) A.gerar(i % 2 ? 'goblin' : 'escudeiro');
          A.simular(1 / 60);
          // Locomoção pura (sem camada de ação) e fora da janela de impacto dos golpes
          const loco = ['livre', 'defesa'].includes(A.heroi.estado) && A.heroi.anim.pesoAcao < 0.05;
          const ac = A.heroi.acao;
          const impacto = ac?.fase && (ac.fase.hits || []).some((h) => ac.t >= h.t0 - 0.08 && ac.t <= h.t1 + 0.08);
          let maxT = 0, maxV = 0;
          for (const n of ossos) {
            const q = A.heroi.rig.ossos[n].quaternion;
            if (ant[n]) {
              const v = ant[n].angleTo(q) * 57.3;
              if (vAnt[n] !== undefined && !A.heroi.acao?.fase?.giro && !impacto) maxT = Math.max(maxT, Math.abs(v - vAnt[n]));
              vAnt[n] = v; maxV = Math.max(maxV, v);
            }
            ant[n] = q.clone();
          }
          tranco.push(maxT);
          // Quadros de transição: alguma camada entrando ou saindo (fade cruzado)
          const an = A.heroi.anim;
          const transicao = (an.pesoAcao > 0.02 && an.pesoAcao < 0.98) || an.anterior || (an.sup && an.sup.peso > 0.02 && an.sup.peso < 0.98);
          if (transicao) trancoTransicao.push(maxT);
          if (loco) velLoco.push(maxT); // tranco na locomoção pura (joelho rápido na corrida é normal; mudança brusca não)
        }
        const p = (arr, k) => { const s = [...arr].sort((a, b) => a - b); return +s[Math.floor(s.length * k)].toFixed(1); };
        const r = { trancoTransicoesP99: p(trancoTransicao, 0.99), trancoTransicoesMediana: p(trancoTransicao, 0.5), trancoGeralP99: p(tranco, 0.99),
          trancoLocomocaoP99: p(velLoco, 0.99), quadrosDeTransicao: trancoTransicao.length };
        // Referência: a versão anterior (sem marcha nem IK) media pior 1% de 20,7° e mediana 0,8°.
        // O resíduo vem de golpes rápidos que entram a partir da corrida (pernas em movimento largo).
        return { ok: r.trancoTransicoesMediana < 2 && r.trancoTransicoesP99 < 25 && r.trancoLocomocaoP99 < 25, ...r, quadros: tranco.length };
      });
    },
    // Reação depende da parte atingida, da direção e da força
    async reacoes() {
      return p.evaluate(() => {
        const A = arena;
        const casos = [['cabeça', 0, 0], ['abdômen', 2, 0], ['pernas', 6, 0], ['costas', 1, Math.PI]]; // índice da hurtbox atingida
        const r = {};
        for (const [nome, osso, giro] of casos) {
          const H = M.prep([4, 0, 4], 0);
          A.simular(0.3);
          const origem = H.corpo.pos.clone().add({ x: Math.sin(giro) * 1.2, y: 0, z: Math.cos(giro) * 1.2 });
          const ponto = H.partes.lista[osso].centro.clone();
          H.receberGolpe({ atacante: { peso: 'leve' }, forca: 10, mult: 0.2, stagger: H.stats.resistStagger * 0.35, tipo: 'horizontal', bloqueavel: false, origem, ponto });
          r[nome] = H.anim.nomeAcao + (H.anim.nomeAcao === 'danoCostas' || nome !== 'costas' ? '' : ` (yaw ${H.corpo.yaw.toFixed(2)}, estado ${H.estado})`);
        }
        const H = M.prep([4, 0, 4], 0); A.simular(0.3);
        H.receberGolpe({ atacante: { peso: 'gigante' }, forca: 10, mult: 0.2, stagger: H.stats.resistStagger * 1.3, tipo: 'area', bloqueavel: false, origem: H.corpo.pos.clone().add({ x: 0, y: 0, z: 2 }), ponto: H.centro.clone() });
        r.empurrao = H.anim.nomeAcao;
        const esperado = { 'cabeça': 'danoCabeca', 'abdômen': 'danoTronco', pernas: 'danoPernas', costas: 'danoCostas', empurrao: 'empurrado' };
        return { ok: Object.entries(esperado).every(([k, v]) => r[k].startsWith(v) && r[k] === v), reacoes: r };
      });
    },
    // Defender andando: escudo erguido (camada superior) e pernas no ciclo lateral, sem escorregar
    async defesaAndando() {
      return p.evaluate(() => {
        const H = M.prep([-4, 0, 9], 0);
        H.defender(true);
        let pesoSup = 0, pesoLateral = 0;
        const desl = M.escorregamento(H, () => { H.intencao.vel.set(1.2, 0); H.intencao.olhar = H.corpo.pos.clone().setZ(H.corpo.pos.z + 5); pesoSup = Math.max(pesoSup, H.anim.sup?.peso || 0); pesoLateral = Math.max(pesoLateral, H.anim.pesosLoco.lateralE || 0); }, 2.5);
        return { ok: H.estado === 'defesa' && pesoSup > 0.9 && pesoLateral > 0.5 && desl < 0.15, estado: H.estado, pesoEscudo: +pesoSup.toFixed(2), pesoPassoLateral: +pesoLateral.toFixed(2), deslize: desl };
      });
    },
    // IK das mãos: no agarrão as mãos do goblin ficam nos ombros do herói
    async maosAgarrao() {
      return p.evaluate(() => {
        const A = arena; const H = M.prep([4, 0, 4], 0);
        const g = A.gerar('goblin'); const f = H.corpo.frente;
        g.corpo.pos.set(H.corpo.pos.x + f.x * 0.42, 0, H.corpo.pos.z + f.y * 0.42);
        H.serAgarrado(g); g.mudar('agarrando'); g.anim.tocar('segurando', { loop: true });
        A.simular(0.5);
        const d = [['LeftHand', -1], ['RightHand', 1]].map(([m, lado]) => g.rig.ossos[m].getWorldPosition(g.rig.ossos[m].position.clone()).distanceTo(H.pontoAgarrao(lado)));
        return { ok: d.every((x) => x < 0.1), distanciaMaoOmbro: d.map((x) => +x.toFixed(3)) };
      });
    },
    // Câmera: começa atrás de uma rocha; tem de sair de trás dela sem saltos e sem atravessá-la
    async camera() {
      return p.evaluate(() => {
        const A = arena; const H = M.prep([-5, 0, 5.6], Math.PI);
        A.reposicionarCamera(new A.camera.position.constructor(-5, 1, 5.6), new A.camera.position.constructor(-5, 3.2, 0.6)); // atrás da rocha em (-5; 3,5)
        let maxPasso = 0, ant = A.camera.position.clone();
        const bloqueada = () => A.mundo.obstaculos.some((o) => {
          const t = A.mundo.intersecao(o, A.controles.target.x, A.controles.target.z, A.camera.position.x, A.camera.position.z, 0.2);
          return t !== null && t > 0.02 && t < 0.98 && o.h > A.controles.target.y + (A.camera.position.y - A.controles.target.y) * t;
        });
        for (let i = 0; i < 120; i++) {
          A.simular(1 / 60); A.passoCamera(1 / 60);
          if (i > 10 && A.camera.position.distanceTo(ant) > maxPasso) // os primeiros quadros são a correção inicial (começou atrás da rocha) { maxPasso = A.camera.position.distanceTo(ant); window.__cam = `quadro ${i} de ${ant.toArray().map((v) => v.toFixed(2))} para ${A.camera.position.toArray().map((v) => v.toFixed(2))} alvo=${A.controles.target.toArray().map((v) => v.toFixed(2))} alvoIA=${A.ia.alvo ? A.ia.alvo.nome + ' ' + A.ia.alvo.vivo : '-'}`; }
          ant = A.camera.position.clone();
        }
        return { ok: !bloqueada() && maxPasso < 0.6, onde: window.__cam, bloqueadaNoFim: bloqueada(), maiorPassoPorQuadro: +maxPasso.toFixed(3) };
      });
    },
  };

  for (const [nome, fn] of Object.entries(testes)) {
    if (filtro && !filtro.includes(nome)) continue;
    let r;
    try { r = await fn(); } catch (e) { r = { ok: false, erro: e.message.slice(0, 300) }; }
    console.log(`${r.ok ? 'PASSOU' : 'FALHOU'}  ${nome}  ${JSON.stringify(r)}`);
  }
  console.log(erros.length ? 'ERROS:\n' + [...new Set(erros)].slice(0, 6).join('\n') : 'sem erros de página');
  await b.close();
})();
