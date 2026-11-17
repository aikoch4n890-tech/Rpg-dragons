// Animações dos goblins, geradas pelo mesmo solver de poses do herói (src/poses.js).
// Cada arma tem uma guarda própria; os ataques são escritos como desvios dessa guarda.
import { clipe, juntar } from '../poses.js';
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

// Ciclo de passos: pernas alternadas, com o quadril subindo no meio de cada passo.
export function ciclo(passo, amplitude, inclinacao, pernasBase = PERNAS_GUARDA, spineBase = 22) {
  const a = amplitude;
  const L = pernasBase;
  const A = { LeftUpLeg: [L.LeftUpLeg[0] - a, 0, L.LeftUpLeg[2]], LeftLeg: [L.LeftLeg[0] - 12, 0, 0], LeftFoot: [L.LeftFoot[0] + 10, 0, 0],
    RightUpLeg: [L.RightUpLeg[0] + a, 0, L.RightUpLeg[2]], RightLeg: [L.RightLeg[0] + 16, 0, 0], RightFoot: [L.RightFoot[0] - 10, 0, 0] };
  const B = { LeftUpLeg: [L.LeftUpLeg[0] + a, 0, L.LeftUpLeg[2]], LeftLeg: [L.LeftLeg[0] + 16, 0, 0], LeftFoot: [L.LeftFoot[0] - 10, 0, 0],
    RightUpLeg: [L.RightUpLeg[0] - a, 0, L.RightUpLeg[2]], RightLeg: [L.RightLeg[0] - 12, 0, 0], RightFoot: [L.RightFoot[0] + 10, 0, 0] };
  const meio = {};
  for (const k of Object.keys(A)) meio[k] = A[k].map((v, j) => (v + B[k][j]) / 2);
  const corpo = (y) => ({ hips: { pos: [0, y, 0] }, Spine: [spineBase + inclinacao, 0, 0] });
  return [
    [0, { ...A, ...corpo(-0.04) }],
    [passo / 4, { ...meio, ...corpo(-0.015) }],
    [passo / 2, { ...B, ...corpo(-0.04) }],
    [passo * 0.75, { ...meio, ...corpo(-0.015) }],
    [passo, { ...A, ...corpo(-0.04) }],
  ];
}

// Duração e janelas de cada ataque (em segundos do clipe).
// telegrafia: até quando o goblin está se preparando (olhos brilham mais forte).
export const ATAQUES_GOBLIN = {
  garra: { dur: 0.95, telegrafia: 0.42, ativo: [0.46, 0.62], tipo: 'horizontal' },
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
  const k = (nome, chaves) => { c[nome] = clipe(rig, nome, chaves, G); };

  k('guarda', [[0, {}], [0.6, { hips: { pos: [0, -0.05, 0] }, Spine: [25, 0, 0], Head: [-10, 6, 0] }], [1.2, {}]]);
  k('andar', ciclo(0.62, 18, 4));
  k('correr', ciclo(0.42, 30, 16));

  const golpe = (sp) => ({ Spine: sp });
  if (tipoArma === 'garra') {
    k('garra', [
      [0, {}],
      [0.42, { ...golpe([10, -30, 0]), armR: { up: [-0.9, 0.3, -0.3], fore: [-0.4, 0.6, -0.6], hand: [-0.4, 0.6, -0.6], blade: [-0.5, 0.5, -0.7] } }],
      [0.55, { ...golpe([28, 10, 0]), hips: { pos: [0, -0.05, 0.04] }, armR: { up: [-0.1, -0.2, 1], fore: [0.3, -0.1, 1], hand: [0.3, -0.1, 1], blade: [0.5, -0.2, 0.85] } }],
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
      [0.66, { ...golpe([35, 0, 0]), hips: { pos: [0, -0.02, 0.1] }, ...bracosFrente }],
      [0.85, { ...golpe([35, 0, 0]), hips: { pos: [0, -0.02, 0.1] }, ...bracosFrente }],
      [1.2, {}],
    ]);
    k('segurando', [
      [0, { ...golpe([30, 0, 0]), ...bracosFrente, Head: [-20, 0, 0] }],
      [0.3, { ...golpe([36, 0, 0]), ...bracosFrente, Head: [10, 0, 0] }],
      [0.6, { ...golpe([30, 0, 0]), ...bracosFrente, Head: [-20, 0, 0] }],
    ]);
  }
  if (tipoArma === 'adaga') {
    k('investida', [
      [0, {}],
      [0.36, { hips: { pos: [0, -0.1, -0.05] }, Spine: [32, 0, 0], LeftUpLeg: [-45, 0, 8], LeftLeg: [70, 0, 0], RightUpLeg: [-5, 0, -8], RightLeg: [60, 0, 0],
        armR: { up: [-0.5, -0.4, -0.75], fore: [0, 0.2, 1], hand: [0, 0.2, 1], blade: [0, 0.2, 1] } }],
      [0.52, { hips: { pos: [0, 0.02, 0.1] }, Spine: [30, 0, 0], LeftUpLeg: [-55, 0, 8], LeftLeg: [25, 0, 0], RightUpLeg: [30, 0, -8], RightLeg: [10, 0, 0],
        armR: { up: [-0.1, 0, 1], fore: [0, 0, 1], hand: [0, -1, 0], blade: [0, 0, 1] } }],
      [0.75, { hips: { pos: [0, -0.06, 0.08] }, Spine: [30, 0, 0], armR: { up: [-0.1, -0.1, 1], fore: [0, -0.1, 1], hand: [0, -1, 0], blade: [0, -0.1, 1] } }],
      [1.1, {}],
    ]);
    k('arremesso', [
      [0, {}],
      [0.5, { Spine: [-8, -25, 0], armR: { up: [-0.4, 0.9, -0.2], fore: [0, 0.4, -1], hand: [0, 0.2, -1], blade: [0, 1, 0] } }],
      [0.62, { Spine: [28, 12, 0], armR: { up: [-0.2, 0.4, 1], fore: [0, -0.2, 1], hand: [0, -0.4, 1], blade: [0, 1, 0.3] } }],
      [1.0, {}],
    ]);
  }
  if (tipoArma === 'lanca') {
    k('estocada', [
      [0, {}],
      [0.45, { Spine: [8, -10, 0], hips: { pos: [0, -0.05, -0.04] }, armR: { up: [-0.4, -0.6, -0.6], fore: [0, -0.1, 1], hand: [0, -1, 0.1], blade: [0, 0.05, 1] } }],
      [0.56, { Spine: [30, 8, 0], hips: { pos: [0, -0.04, 0.08] }, armR: { up: [-0.1, -0.1, 1], fore: [0, 0, 1], hand: [0, -1, 0], blade: [0, 0, 1] } }],
      [0.9, {}],
    ]);
  }
  if (tipoArma === 'clava') {
    k('clava', [
      [0, {}],
      [0.7, { Spine: [-12, -8, 0], hips: { pos: [0, -0.02, -0.03] }, armR: { up: [-0.2, 0.95, -0.1], fore: [0, 0.5, -0.85], hand: [0, 0.2, -1], blade: [0, -0.2, -1] },
        armL: { up: [0.6, -0.3, 0.5], fore: [0.2, 0.3, 0.9], shield: [1, 0, 0] } }],
      [0.85, { Spine: [35, 0, 0], hips: { pos: [0, -0.08, 0.06] }, armR: { up: [-0.1, 0, 1], fore: [0, -0.4, 0.9], hand: [0, -0.4, 0.9], blade: [0, -0.7, 0.7] } }],
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
        armL: { up: [0.1, -0.5, 0.85], fore: [0, -0.9, 0.4], shield: [1, 0, 0] } }],
      [1.6, {}],
    ]);
  }

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
  ]);
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
  return c;
}
