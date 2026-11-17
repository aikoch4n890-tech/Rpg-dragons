// Animações dos goblins, geradas pelo mesmo solver de poses do herói (src/poses.js).
// Cada arma tem uma guarda própria; os ataques são escritos como desvios dessa guarda.
import { clipe, juntar, medirPassada } from '../poses.js';
import { cicloMarcha, misturarBraco } from '../marcha.js';
import { clipesReacao } from '../reacoes.js';
import { criarGoblin } from './goblin.js';

const PERNAS_GUARDA = {
  LeftUpLeg: [-28, 0, 8], LeftLeg: [42, 0, 0], LeftFoot: [-14, 0, 0],
  RightUpLeg: [-12, 0, -8], RightLeg: [34, 0, 0], RightFoot: [-22, 0, 0],
};

const BASE = {
  hips: { pos: [0, -0.035, 0], rot: [0, 0, 0] },
  Spine: [22, 0, 0], Spine1: [12, 0, 0], Neck: [-15, 0, 0], Head: [-14, 0, 0],
  ...PERNAS_GUARDA,
  armR: { up: [-0.45, -0.75, 0.45], fore: [-0.1, -0.35, 1], hand: [-0.1, -0.5, 1], blade: [0, 0.3, 1] },
  armL: { up: [0.45, -0.75, 0.45], fore: [0.1, -0.35, 1], shield: [1, 0, 0.1] },
};

const GUARDAS = {
  garra: BASE,
  adaga: juntar(BASE, { armR: { up: [-0.4, -0.8, 0.3], fore: [0, -0.2, 1], hand: [0, -0.3, 1], blade: [0, 0.15, 1] } }),
  lanca: juntar(BASE, {
    Spine: [14, 0, 0],
    armR: { up: [-0.35, -0.85, -0.1], fore: [0, -0.1, 1], hand: [0, -1, 0.1], blade: [0, 0.08, 1] },
    armL: { up: [0.3, -0.35, 0.9], fore: [-1, 0.15, 0.15], shield: [0, 0.05, 1] },
  }),
  clava: juntar(BASE, { armR: { up: [-0.35, -0.8, 0.3], fore: [0, 0.2, 1], hand: [0, 0.1, 1], blade: [0.1, 0.85, 0.4] } }),
};

// Duração e janelas de cada ataque (em segundos do clipe).
// telegrafia: até quando o goblin está se preparando (olhos brilham mais forte).
export const ATAQUES_GOBLIN = {
  garra: { dur: 0.95, telegrafia: 0.42, ativo: [0.46, 0.62], tipo: 'horizontal' },
  mordida: { dur: 0.9, telegrafia: 0.4, ativo: [0.45, 0.6], tipo: 'horizontal' },
  investida: { dur: 1.1, telegrafia: 0.38, ativo: [0.45, 0.72], tipo: 'investida' },
  agarrao: { dur: 1.2, telegrafia: 0.5, ativo: [0.58, 0.8], tipo: 'agarrao' },
  arremesso: { dur: 1.0, telegrafia: 0.5, solta: 0.6, tipo: 'projetil' },
  estocada: { dur: 0.9, telegrafia: 0.45, ativo: [0.5, 0.62], tipo: 'vertical' },
  clava: { dur: 1.5, telegrafia: 0.72, ativo: [0.78, 0.95], tipo: 'vertical' },
  pisao: { dur: 1.6, telegrafia: 0.85, impacto: 0.95, tipo: 'area' },
};

export function criarClipesGoblin(tipoArma) {
  const rig = criarGoblin('goblin');
  const G = GUARDAS[tipoArma];
  const c = {};
  const k = (nome, chaves, op = {}) => { c[nome] = clipe(rig, nome, chaves, G, op); };
  const loop = { ciclo: true };

  // Guarda nervosa: respira rápido, olha para os lados aos trancos, sobe os ombros
  k('guarda', [
    [0, {}],
    [0.35, { hips: { pos: [0, -0.05, 0] }, Spine: [25, 0, 0], Head: [-12, 4, 0] }],
    [0.7, { Head: [-16, 28, 4] }, 'freia'],
    [1.1, { hips: { pos: [0.012, -0.04, 0], rot: [0, 6, 2] }, Spine: [24, 0, 0], Head: [-16, 26, 4] }],
    [1.4, { hips: { pos: [0, -0.05, 0] }, Spine: [26, 0, 0], Head: [-8, -18, -3] }, 'freia'],
    [2.0, { Head: [-10, -14, -3], Spine1: [16, 0, 0] }],
    [2.6, {}],
  ], loop);

  // Marcha agachada e irregular: passo esquerdo maior que o direito (manca de leve), braços soltos
  const PERNAS_ANDAR = { LeftUpLeg: [-16, 0, 9], LeftLeg: [34, 0, 0], LeftFoot: [-18, 0, 0], RightUpLeg: [-16, 0, -9], RightLeg: [34, 0, 0], RightFoot: [-18, 0, 0] };
  const TAU = Math.PI * 2, vai = (phi) => 0.5 - 0.5 * Math.cos(TAU * phi);
  const bR = G.armR, bL = G.armL;
  const bracos = (amp) => (phi) => ({
    armR: misturarBraco({ ...bR, up: [bR.up[0], bR.up[1], bR.up[2] + 0.35 * amp] }, { ...bR, up: [bR.up[0], bR.up[1], bR.up[2] - 0.45 * amp] }, vai(phi)),
    armL: misturarBraco({ ...bL, up: [bL.up[0], bL.up[1], bL.up[2] - 0.45 * amp] }, { ...bL, up: [bL.up[0], bL.up[1], bL.up[2] + 0.35 * amp] }, vai(phi)),
  });
  const ampBraco = tipoArma === 'lanca' ? 0.25 : tipoArma === 'clava' ? 0.6 : 1;
  k('andar', cicloMarcha({ periodo: 0.62, amplitude: 22, joelhoApoio: 14, joelhoBalanco: 68, inclinacao: 4, spineBase: 22, giroQuadril: 9, balancoQuadril: 5, sobeDesce: 0.03, assimetria: 0.35, pernasBase: PERNAS_ANDAR, bracos: bracos(ampBraco) }), loop);
  k('correr', cicloMarcha({ periodo: 0.44, amplitude: 34, joelhoApoio: 24, joelhoBalanco: 112, inclinacao: 18, spineBase: 22, giroQuadril: 12, balancoQuadril: 6, sobeDesce: 0.05, assimetria: 0.2, pernasBase: PERNAS_ANDAR, cabeca: 1.6, bracos: bracos(ampBraco * 1.5) }), loop);
  k('recuar', cicloMarcha({ direcao: 'tras', periodo: 0.55, amplitude: 16, joelhoApoio: 18, joelhoBalanco: 40, inclinacao: -2, spineBase: 22, giroQuadril: 5, sobeDesce: 0.02, pernasBase: PERNAS_ANDAR, bracos: bracos(0.3 * ampBraco) }), loop);
  for (const [nome, dir] of [['lateralE', 'esq'], ['lateralD', 'dir']]) {
    k(nome, cicloMarcha({ direcao: dir, periodo: 0.5, amplitude: 16, joelhoApoio: 12, joelhoBalanco: 55, inclinacao: 2, spineBase: 22, sobeDesce: 0.02, balancoQuadril: 4, pernasBase: PERNAS_ANDAR }), loop);
  }
  k('virar', cicloMarcha({ periodo: 0.5, amplitude: 6, joelhoApoio: 8, joelhoBalanco: 34, inclinacao: 2, spineBase: 22, sobeDesce: 0.012, pernasBase: PERNAS_ANDAR }), loop);

  const golpe = (sp) => ({ Spine: sp });
  if (tipoArma === 'garra') {
    k('garra', [
      [0, {}],
      [0.42, { ...golpe([10, -30, 0]), armR: { up: [-0.9, 0.3, -0.3], fore: [-0.4, 0.6, -0.6], hand: [-0.4, 0.6, -0.6], blade: [-0.5, 0.5, -0.7] } }],
      [0.55, { ...golpe([28, 10, 0]), hips: { pos: [0, -0.05, 0.04] }, armR: { up: [-0.1, -0.2, 1], fore: [0.3, -0.1, 1], hand: [0.3, -0.1, 1], blade: [0.5, -0.2, 0.85] } }, 'acelera'],
      [0.64, { ...golpe([28, 30, 0]), hips: { pos: [0, -0.05, 0.04] }, armR: { up: [0.5, -0.4, 0.75], fore: [0.9, -0.3, 0.3], hand: [0.9, -0.3, 0.3], blade: [0.9, -0.3, -0.2] } }],
      [0.95, {}],
    ]);
    const bracosAbertos = {
      armR: { up: [-0.9, 0.2, 0.3], fore: [-0.6, 0.4, 0.7], hand: [-0.6, 0.4, 0.7], blade: [0, 0.3, 1] },
      armL: { up: [0.9, 0.2, 0.3], fore: [0.6, 0.4, 0.7], shield: [0.3, 1, 0] },
    };
    const bracosFrente = {
      armR: { up: [-0.2, 0.1, 1], fore: [0.25, 0, 1], hand: [0.25, 0, 1], blade: [0, 1, 0] },
      armL: { up: [0.2, 0.1, 1], fore: [-0.25, 0, 1], shield: [0, 1, 0] },
    };
    k('agarrao', [
      [0, {}],
      [0.5, { ...golpe([5, 0, 0]), hips: { pos: [0, -0.07, -0.03] }, ...bracosAbertos }],
      [0.66, { ...golpe([35, 0, 0]), hips: { pos: [0, -0.02, 0.1] }, ...bracosFrente }, 'acelera'],
      [0.85, { ...golpe([35, 0, 0]), hips: { pos: [0, -0.02, 0.1] }, ...bracosFrente }],
      [1.2, {}],
    ]);
    k('segurando', [
      [0, { ...golpe([30, 0, 0]), ...bracosFrente, Head: [-20, 0, 0] }],
      [0.3, { ...golpe([36, 0, 0]), ...bracosFrente, Head: [10, 0, 0] }],
      [0.6, { ...golpe([30, 0, 0]), ...bracosFrente, Head: [-20, 0, 0] }],
    ], loop);
  }
  if (tipoArma === 'adaga') {
    k('investida', [
      [0, {}],
      [0.36, { hips: { pos: [0, -0.1, -0.05] }, Spine: [32, 0, 0], LeftUpLeg: [-45, 0, 8], LeftLeg: [70, 0, 0], RightUpLeg: [-5, 0, -8], RightLeg: [60, 0, 0],
        armR: { up: [-0.5, -0.4, -0.75], fore: [0, 0.2, 1], hand: [0, 0.2, 1], blade: [0, 0.2, 1] } }],
      [0.52, { hips: { pos: [0, 0.02, 0.1] }, Spine: [30, 0, 0], LeftUpLeg: [-55, 0, 8], LeftLeg: [25, 0, 0], RightUpLeg: [30, 0, -8], RightLeg: [10, 0, 0],
        armR: { up: [-0.1, 0, 1], fore: [0, 0, 1], hand: [0, -1, 0], blade: [0, 0, 1] } }, 'acelera'],
      [0.75, { hips: { pos: [0, -0.06, 0.08] }, Spine: [30, 0, 0], armR: { up: [-0.1, -0.1, 1], fore: [0, -0.1, 1], hand: [0, -1, 0], blade: [0, -0.1, 1] } }],
      [1.1, {}],
    ]);
    k('arremesso', [
      [0, {}],
      [0.5, { Spine: [-8, -25, 0], armR: { up: [-0.4, 0.9, -0.2], fore: [0, 0.4, -1], hand: [0, 0.2, -1], blade: [0, 1, 0] } }],
      [0.62, { Spine: [28, 12, 0], armR: { up: [-0.2, 0.4, 1], fore: [0, -0.2, 1], hand: [0, -0.4, 1], blade: [0, 1, 0.3] } }, 'acelera'],
      [1.0, {}],
    ]);
  }
  if (tipoArma === 'lanca') {
    k('estocada', [
      [0, {}],
      [0.45, { Spine: [8, -10, 0], hips: { pos: [0, -0.05, -0.04] }, armR: { up: [-0.4, -0.6, -0.6], fore: [0, -0.1, 1], hand: [0, -1, 0.1], blade: [0, 0.05, 1] } }],
      [0.56, { Spine: [30, 8, 0], hips: { pos: [0, -0.04, 0.08] }, armR: { up: [-0.1, -0.1, 1], fore: [0, 0, 1], hand: [0, -1, 0], blade: [0, 0, 1] } }, 'acelera'],
      [0.9, {}],
    ]);
  }
  if (tipoArma === 'clava') {
    k('clava', [
      [0, {}],
      [0.7, { Spine: [-12, -8, 0], hips: { pos: [0, -0.02, -0.03] }, armR: { up: [-0.2, 0.95, -0.1], fore: [0, 0.5, -0.85], hand: [0, 0.2, -1], blade: [0, -0.2, -1] },
        armL: { up: [0.6, -0.3, 0.5], fore: [0.2, 0.3, 0.9], shield: [1, 0, 0] } }],
      [0.85, { Spine: [35, 0, 0], hips: { pos: [0, -0.08, 0.06] }, armR: { up: [-0.1, 0, 1], fore: [0, -0.4, 0.9], hand: [0, -0.4, 0.9], blade: [0, -0.7, 0.7] } }, 'acelera'],
      [0.95, { Spine: [40, 0, 0], hips: { pos: [0, -0.09, 0.06] }, armR: { up: [-0.1, -0.35, 0.95], fore: [0, -0.6, 0.8], hand: [0, -0.6, 0.8], blade: [0, -0.95, 0.3] } }],
      [1.5, {}],
    ]);
    k('pisao', [
      [0, {}],
      [0.82, { Spine: [-15, 0, 0], hips: { pos: [0, 0.0, -0.02] },
        armR: { up: [-0.15, 1, 0], fore: [0.1, 0.9, 0.3], hand: [0.1, 0.9, 0.3], blade: [0.1, 0.3, -1] },
        armL: { up: [0.15, 1, 0], fore: [-0.1, 0.9, 0.3], shield: [1, 0, 0] } }],
      [0.95, { Spine: [45, 0, 0], hips: { pos: [0, -0.15, 0.05] }, LeftLeg: [70, 0, 0], RightLeg: [60, 0, 0],
        armR: { up: [-0.1, -0.5, 0.85], fore: [0, -0.9, 0.4], hand: [0, -0.9, 0.4], blade: [0, -0.4, 1] },
        armL: { up: [0.1, -0.5, 0.85], fore: [0, -0.9, 0.4], shield: [1, 0, 0] } }, 'acelera'],
      [1.6, {}],
    ]);
  }

  // Esquiva: pulinho para trás, encolhido
  k('esquiva', [
    [0, {}],
    [0.1, { hips: { pos: [0, -0.1, 0.02] }, Spine: [30, 0, 0], LeftLeg: [70, 0, 0], RightLeg: [65, 0, 0], LeftUpLeg: [-40, 0, 8], RightUpLeg: [-28, 0, -8] }, 'freia'],
    [0.25, { hips: { pos: [0, 0.04, 0] }, Spine: [10, 0, 0], Head: [-25, 0, 0], LeftUpLeg: [-55, 0, 10], LeftLeg: [80, 0, 0], RightUpLeg: [-40, 0, -10], RightLeg: [75, 0, 0],
      armR: { up: [-0.7, 0.3, 0.4], fore: [-0.3, 0.6, 0.7], hand: [-0.3, 0.6, 0.7], blade: [0, 0.3, 1] }, armL: { up: [0.7, 0.3, 0.4], fore: [0.3, 0.6, 0.7], shield: [0.3, 1, 0] } }],
    [0.4, { hips: { pos: [0, -0.1, 0] }, Spine: [30, 0, 0], LeftLeg: [75, 0, 0], RightLeg: [70, 0, 0], LeftUpLeg: [-38, 0, 8], RightUpLeg: [-30, 0, -8] }],
    [0.62, {}],
  ]);
  if (tipoArma === 'garra') {
    // Mordida: puxa a cabeça para trás e bota o bote com a boca aberta, garras abertas
    k('mordida', [
      [0, {}],
      [0.4, { Spine: [12, 0, 0], Neck: [-20, 0, 0], Head: [-25, 0, 0], hips: { pos: [0, -0.08, -0.05] },
        armR: { up: [-0.8, 0.1, 0.4], fore: [-0.4, 0.5, 0.8], hand: [-0.4, 0.5, 0.8], blade: [0, 0.3, 1] }, armL: { up: [0.8, 0.1, 0.4], fore: [0.4, 0.5, 0.8], shield: [0.3, 1, 0] } }],
      [0.52, { Spine: [42, 0, 0], Spine1: [14, 0, 0], Neck: [10, 0, 0], Head: [-5, 0, 0], hips: { pos: [0, -0.02, 0.13] },
        LeftUpLeg: [-50, 0, 8], LeftLeg: [40, 0, 0], RightUpLeg: [20, 0, -8], RightLeg: [20, 0, 0],
        armR: { up: [-0.3, 0, 1], fore: [0.2, -0.2, 1], hand: [0.2, -0.2, 1], blade: [0, 1, 0] }, armL: { up: [0.3, 0, 1], fore: [-0.2, -0.2, 1], shield: [0, 1, 0] } }, 'acelera'],
      [0.62, { Spine: [44, 0, 0], Spine1: [14, 0, 0], Neck: [14, 0, 0], Head: [0, 0, 0], hips: { pos: [0, -0.03, 0.13] } }],
      [0.9, {}],
    ]);
  }
  // Reações por parte atingida, intensidade e direção (mesmos nomes do herói)
  Object.assign(c, clipesReacao(rig, G, { lado: 0.8 }));
  // Morte para trás (golpe de frente empurra o corpo para trás)
  k('morteTras', [
    [0, {}],
    [0.18, { hips: { pos: [0, -0.06, -0.08] }, Spine: [-20, 10, 0], Head: [-35, 0, 0], RightUpLeg: [25, 0, -8], RightLeg: [30, 0, 0] }, 'freia'],
    [0.45, { hips: { pos: [0, -0.3, -0.25], rot: [-50, 0, 0] }, Spine: [-10, 0, 0], Head: [-20, 0, 0], LeftLeg: [60, 0, 0], RightLeg: [50, 0, 0] }],
    [0.8, { hips: { pos: [0, -0.52, -0.3], rot: [-88, 0, 0] }, Spine: [-5, 0, 0], Spine1: [0, 0, 0], Neck: [0, 0, 0], Head: [10, 30, 0],
      LeftUpLeg: [-15, 0, 12], LeftLeg: [25, 0, 0], LeftFoot: [0, 0, 0], RightUpLeg: [0, 0, -10], RightLeg: [10, 0, 0], RightFoot: [0, 0, 0],
      armR: { espaco: 'tronco', up: [-0.9, 0.1, 0.3], fore: [-0.8, 0.4, 0.3], hand: [-0.8, 0.4, 0.3], blade: [0, 1, 0] }, armL: { espaco: 'tronco', up: [0.9, -0.1, 0.3], fore: [0.8, 0.3, 0.3], shield: [0, 1, 0] } }],
  ]);

  // Reações (comuns a todos)
  k('dano', [[0, {}], [0.08, { Spine: [0, 15, 0], Head: [-30, 10, 0], hips: { pos: [0, -0.04, -0.06] } }], [0.4, {}]]);
  k('cambalear', [
    [0, {}],
    [0.15, { Spine: [-15, -20, 0], Head: [-25, 0, 0], hips: { pos: [0, -0.06, -0.1] }, armR: { up: [-0.8, 0.3, -0.2], fore: [-0.5, 0.6, 0], blade: [0, 1, 0] }, armL: { up: [0.8, 0.3, -0.2], fore: [0.5, 0.6, 0], shield: [0, 1, 0] } }],
    [0.45, { Spine: [5, 20, 10], Head: [-5, 0, 0], hips: { pos: [0, -0.08, -0.12] } }],
    [0.9, {}],
  ]);
  k('repelido', [
    [0, {}],
    [0.12, { Spine: [-25, -25, 0], Head: [-30, 0, 0], hips: { pos: [0, -0.04, -0.15] }, armR: { up: [-0.6, 0.7, -0.4], fore: [-0.3, 0.9, -0.3], blade: [0, 0.4, -1] }, armL: { up: [0.8, 0.4, -0.2], fore: [0.5, 0.7, 0], shield: [0, 1, 0] } }],
    [0.6, { Spine: [-10, 10, 0], Head: [-10, 0, 0], hips: { pos: [0, -0.1, -0.15] }, LeftLeg: [60, 0, 0], RightLeg: [60, 0, 0] }],
    [1.1, {}],
  ]);
  const deitado = {
    hips: { pos: [0, -0.5, -0.2], rot: [-85, 0, 0] }, Spine: [-5, 0, 0], Spine1: [0, 0, 0], Neck: [0, 0, 0], Head: [10, 10, 0],
    LeftUpLeg: [-10, 0, 15], LeftLeg: [20, 0, 0], LeftFoot: [0, 0, 0], RightUpLeg: [5, 0, -12], RightLeg: [10, 0, 0], RightFoot: [0, 0, 0],
    armR: { up: [-0.9, 0.1, 0.3], fore: [-0.9, 0.3, 0.2], hand: [-0.9, 0.3, 0.2], blade: [0, 1, 0] },
    armL: { up: [0.9, 0.1, 0.3], fore: [0.9, 0.3, 0.2], shield: [0, 1, 0] },
  };
  k('derrubado', [
    [0, {}],
    [0.25, { hips: { pos: [0, -0.25, -0.12], rot: [-45, 0, 0] }, Spine: [-10, 0, 0], Head: [-20, 0, 0] }],
    [0.45, deitado],
    [1.3, deitado],
    [1.6, { hips: { pos: [0, -0.3, 0], rot: [20, 0, 0] }, Spine: [40, 0, 0], LeftUpLeg: [-80, 0, 10], LeftLeg: [110, 0, 0], RightUpLeg: [-60, 0, -10], RightLeg: [100, 0, 0] }],
    [1.9, {}],
  ]);
  k('lancado', [
    [0, { hips: { pos: [0, 0, 0], rot: [-30, 0, 0] }, Spine: [-15, 0, 0], LeftUpLeg: [-50, 0, 10], LeftLeg: [70, 0, 0], RightUpLeg: [-20, 0, -10], RightLeg: [60, 0, 0],
      armR: { up: [-0.7, 0.7, 0], fore: [-0.5, 0.8, 0.3], blade: [0, 0.3, 1] }, armL: { up: [0.7, 0.7, 0], fore: [0.5, 0.8, 0.3], shield: [0, 1, 0] } }],
    [0.25, { hips: { pos: [0, 0, 0], rot: [-40, 0, 0] }, Spine: [-20, 0, 0], LeftUpLeg: [-20, 0, 10], LeftLeg: [50, 0, 0], RightUpLeg: [-50, 0, -10], RightLeg: [70, 0, 0],
      armR: { up: [-0.9, 0.4, 0.2], fore: [-0.7, 0.6, 0.3], blade: [0, 0.3, 1] }, armL: { up: [0.9, 0.4, 0.2], fore: [0.7, 0.6, 0.3], shield: [0, 1, 0] } }],
    [0.5, { hips: { pos: [0, 0, 0], rot: [-30, 0, 0] }, Spine: [-15, 0, 0], LeftUpLeg: [-50, 0, 10], LeftLeg: [70, 0, 0], RightUpLeg: [-20, 0, -10], RightLeg: [60, 0, 0],
      armR: { up: [-0.7, 0.7, 0], fore: [-0.5, 0.8, 0.3], blade: [0, 0.3, 1] }, armL: { up: [0.7, 0.7, 0], fore: [0.5, 0.8, 0.3], shield: [0, 1, 0] } }],
  ], loop);
  k('morte', [
    [0, {}],
    [0.3, { hips: { pos: [0, -0.22, 0] }, Spine: [40, 0, 0], LeftLeg: [100, 0, 0], RightLeg: [90, 0, 0], LeftUpLeg: [-60, 0, 8], RightUpLeg: [-50, 0, -8] }],
    [0.75, { hips: { pos: [0, -0.52, 0.22], rot: [85, 0, 0] }, Spine: [5, 0, 0], Spine1: [0, 0, 0], Head: [-20, 30, 0],
      LeftUpLeg: [-5, 0, 10], LeftLeg: [10, 0, 0], RightUpLeg: [10, 0, -10], RightLeg: [20, 0, 0],
      armR: { up: [-0.6, -0.2, 0.8], fore: [-0.5, -0.1, 0.9], blade: [0, 1, 0] }, armL: { up: [0.7, -0.2, 0.7], fore: [0.6, -0.2, 0.8], shield: [0, 1, 0] } }],
  ]);
  const T = {
    hips: { pos: [0, 0, 0], rot: [0, 0, 0] }, Spine: [0, 0, 0], Spine1: [0, 0, 0], Neck: [0, 0, 0], Head: [0, 0, 0],
    LeftUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], LeftFoot: [0, 0, 0], RightUpLeg: [0, 0, 0], RightLeg: [0, 0, 0], RightFoot: [0, 0, 0],
    armR: { up: [-1, 0, 0], fore: [-1, 0, 0], hand: [-1, 0, 0], blade: [0, 0, 1] },
    armL: { up: [1, 0, 0], fore: [1, 0, 0], shield: [0, 0, 1] },
  };
  k('poseT', [[0, T], [1, T]]);
  for (const [nome, eixo] of [['andar', 'z'], ['correr', 'z'], ['recuar', 'z'], ['lateralE', 'x'], ['lateralD', 'x'], ['virar', 'z']]) {
    c[nome].userData = { passada: medirPassada(rig, c[nome], eixo) };
  }
  return c;
}
