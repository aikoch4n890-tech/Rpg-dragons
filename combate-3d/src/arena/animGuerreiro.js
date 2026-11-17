// Animações do Guerreiro (herói de espada e escudo).
// Reaproveita os clipes do treino (guarda, corte1-3, defesa, dano, poseT) e adiciona
// locomoção, reações e um clipe próprio para cada família de habilidade.
// Direções dos braços: espaço do personagem (olha para +Z, +X é o lado esquerdo dele).
import { clipe, juntar, criarClipes, GUARDA, DEFESA } from '../poses.js';
import { criarPersonagem } from '../rig.js';
import { ciclo } from './animGoblin.js';

const ESPADA_GUARDA = GUARDA.armR;
const ESCUDO_GUARDA = GUARDA.armL;
const ESCUDO_ERGUIDO = DEFESA.armL;
const ESPADA_RECOLHIDA = DEFESA.armR;

// Lâmina em posições típicas (braço, antebraço, punho, lâmina)
const LAMINA = {
  atrasDireita: { up: [-0.7, -0.6, 0.1], fore: [0.3, 0.6, 0.6], hand: [0.2, 0.2, 1], blade: [-0.7, 0.2, -0.6] },
  frente: { up: [-0.1, -0.2, 1], fore: [0.15, 0, 1], hand: [0.15, 0, 1], blade: [0.25, 0.05, 1] },
  esquerda: { up: [0.5, -0.3, 0.8], fore: [0.9, -0.1, 0.4], hand: [0.9, -0.1, 0.4], blade: [0.85, -0.1, -0.5] },
  altoAtras: { up: [-0.2, 0.95, 0.1], fore: [0.1, 0.5, -0.85], hand: [0.1, 0.2, -1], blade: [0.05, -0.25, -1] },
  estocadaRecuo: { up: [-0.3, -0.7, -0.65], fore: [0.05, 0.1, 1], hand: [0, -1, 0.1], blade: [0, 0.05, 1] },
  estocada: { up: [-0.05, -0.05, 1], fore: [0, 0, 1], hand: [0, -1, 0.05], blade: [0, 0, 1] },
  baixoDireita: { up: [-0.3, -0.8, 0.4], fore: [0.1, -0.5, 0.85], hand: [0.1, -0.5, 0.85], blade: [-0.3, -0.8, 0.5] },
  altoEsquerda: { up: [-0.15, 0.6, 0.75], fore: [0, 0.9, 0.4], hand: [0, 0.9, 0.4], blade: [0.3, 0.9, 0.3] },
  baixoEsquerda: { up: [0.2, -0.8, 0.5], fore: [0.4, -0.5, 0.75], hand: [0.4, -0.5, 0.75], blade: [0.4, -0.8, 0.4] },
  altoDireita: { up: [-0.3, 0.6, 0.7], fore: [-0.2, 0.9, 0.4], hand: [-0.2, 0.9, 0.4], blade: [-0.35, 0.9, 0.25] },
};

const PERNAS_LOCO = {
  LeftUpLeg: [-6, 0, 3], LeftLeg: [12, 0, 0], LeftFoot: [-6, 0, 0],
  RightUpLeg: [-6, 0, -3], RightLeg: [12, 0, 0], RightFoot: [-6, 0, 0],
};
const AGACHADO = {
  hips: { pos: [0, -0.16, 0] },
  LeftUpLeg: [-55, 0, 6], LeftLeg: [80, 0, 0], LeftFoot: [-25, 0, 0],
  RightUpLeg: [-35, 0, -6], RightLeg: [75, 0, 0], RightFoot: [-40, 0, 0],
};
const ESTOCADA_PERNAS = { LeftUpLeg: [-48, 0, 5], LeftLeg: [55, 0, 0], LeftFoot: [-5, 12, 0], RightUpLeg: [22, 0, -6], RightLeg: [12, 0, 0], RightFoot: [-32, -8, 0] };
const AJOELHADO = {
  hips: { pos: [0, -0.32, 0.1] },
  LeftUpLeg: [-75, 0, 6], LeftLeg: [100, 0, 0], LeftFoot: [-25, 0, 0],
  RightUpLeg: [15, 0, -6], RightLeg: [100, 0, 0], RightFoot: [-20, 0, 0],
};

export function criarClipesGuerreiro() {
  const c = criarClipes(); // guarda, corte1, corte2, corte3, golpeInimigo, defesa, defesaImpacto, dano, poseT
  const rig = criarPersonagem();
  const k = (nome, chaves, base = GUARDA) => { c[nome] = clipe(rig, nome, chaves, base); };
  const LOCO = juntar(GUARDA, { hips: { rot: [0, -8, 0] }, ...PERNAS_LOCO });

  // ---------- Locomoção ----------
  k('andar', ciclo(0.9, 22, 2, PERNAS_LOCO, 6), LOCO);
  const CORRIDA = juntar(LOCO, {
    armR: { up: [-0.3, -0.9, -0.25], fore: [-0.1, -0.5, 0.85], hand: [-0.1, -0.6, 0.8], blade: [0, 0.4, 1] },
    armL: { up: [0.3, -0.85, 0.25], fore: [-0.35, 0.25, 0.9], shield: [0.6, 0, 0.8] },
  });
  k('correr', ciclo(0.62, 36, 16, PERNAS_LOCO, 6), CORRIDA);
  k('lateral', [
    [0, { LeftUpLeg: [-6, 0, 20], RightUpLeg: [-6, 0, -4], hips: { pos: [0, -0.06, 0] } }],
    [0.35, { LeftUpLeg: [-6, 0, 4], RightUpLeg: [-6, 0, -20], hips: { pos: [0, -0.04, 0] } }],
    [0.7, { LeftUpLeg: [-6, 0, 20], RightUpLeg: [-6, 0, -4], hips: { pos: [0, -0.06, 0] } }],
  ], juntar(LOCO, { hips: { rot: [0, -20, 0] } }));
  k('passoAtras', [[0, {}], [0.12, { hips: { pos: [0, -0.09, -0.06] }, Spine: [12, 8, 0], LeftUpLeg: [-10, 0, 5], RightUpLeg: [30, 0, -6], RightLeg: [30, 0, 0] }], [0.45, {}]]);
  k('preparoPulo', [[0, {}], [0.16, { ...AGACHADO, Spine: [20, 0, 0] }]]);
  const NO_AR = { hips: { pos: [0, 0, 0] }, Spine: [12, 0, 0], LeftUpLeg: [-70, 0, 6], LeftLeg: [90, 0, 0], RightUpLeg: [-30, 0, -6], RightLeg: [80, 0, 0], RightFoot: [-20, 0, 0] };
  k('pulo', [[0, NO_AR], [1, NO_AR]]);
  k('aterrissar', [[0, { ...AGACHADO, Spine: [24, 0, 0] }], [0.35, {}]]);
  // Queda controlada: rolamento para a frente, braços presos ao tronco.
  const ROLO = (graus) => ({
    hips: { pos: [0, -0.62, 0], rot: [graus, 0, 0] }, Spine: [45, 0, 0], Spine1: [30, 0, 0], Head: [30, 0, 0],
    LeftUpLeg: [-115, 0, 10], LeftLeg: [130, 0, 0], RightUpLeg: [-110, 0, -10], RightLeg: [130, 0, 0],
    armR: { espaco: 'tronco', up: [-0.3, -0.6, 0.7], fore: [0.3, 0.5, 0.8], hand: [0.3, 0.5, 0.8], blade: [0, 0.9, -0.4] },
    armL: { espaco: 'tronco', up: [0.3, -0.6, 0.7], fore: [-0.4, 0.4, 0.8], shield: [0, 0, 1] },
  });
  k('rolamento', [[0, { ...AGACHADO, Spine: [35, 0, 0] }], [0.12, ROLO(60)], [0.27, ROLO(150)], [0.42, ROLO(240)], [0.55, ROLO(330)], [0.66, { ...AGACHADO, Spine: [25, 0, 0] }], [0.9, {}]]);

  // ---------- Reações ----------
  k('cambalear', [
    [0, {}],
    [0.15, { Spine: [-18, -25, 0], Head: [-25, 0, 0], hips: { pos: [0, -0.06, -0.12] },
      armR: { up: [-0.8, 0.2, -0.3], fore: [-0.6, 0.6, 0], hand: [-0.6, 0.6, 0], blade: [0, 0.6, -0.8] }, armL: { up: [0.8, 0.2, -0.2], fore: [0.6, 0.6, 0], shield: [0.7, 0.3, 0.5] } }],
    [0.5, { Spine: [8, 15, 0], hips: { pos: [0, -0.08, -0.14] }, LeftLeg: [50, 0, 0], RightLeg: [45, 0, 0] }],
    [0.9, {}],
  ]);
  const DEITADO = {
    hips: { pos: [0, -0.84, -0.3], rot: [-85, 0, 0] }, Spine: [-5, 0, 0], Spine1: [0, 0, 0], Neck: [0, 0, 0], Head: [12, 10, 0],
    LeftUpLeg: [-10, 0, 12], LeftLeg: [15, 0, 0], LeftFoot: [0, 0, 0], RightUpLeg: [5, 0, -10], RightLeg: [25, 0, 0], RightFoot: [0, 0, 0],
    armR: { espaco: 'tronco', up: [-0.9, 0, 0.3], fore: [-0.8, 0.4, 0.3], hand: [-0.8, 0.4, 0.3], blade: [0, 0.3, 1] },
    armL: { espaco: 'tronco', up: [0.9, 0, 0.2], fore: [0.8, 0.3, 0.3], shield: [0, 0, -1] },
  };
  k('derrubado', [
    [0, {}], [0.25, { hips: { pos: [0, -0.4, -0.18], rot: [-45, 0, 0] }, Spine: [-10, 0, 0], Head: [-20, 0, 0] }],
    [0.45, DEITADO], [1.2, DEITADO],
    [1.55, { hips: { pos: [0, -0.4, 0], rot: [25, 0, 0] }, Spine: [40, 0, 0], LeftUpLeg: [-85, 0, 10], LeftLeg: [115, 0, 0], RightUpLeg: [-55, 0, -10], RightLeg: [105, 0, 0] }],
    [1.85, {}],
  ]);
  const LUTANDO = (lado) => ({ Spine: [20, 15 * lado, 0], Head: [-10, -10 * lado, 0], hips: { pos: [0, -0.08, -0.04] },
    armR: { up: [-0.4, 0.1, 0.9], fore: [0.3, 0.3, 0.9], hand: [0.3, 0.3, 0.9], blade: [0, 1, 0] },
    armL: { up: [0.4, 0.1, 0.9], fore: [-0.3, 0.3, 0.9], shield: [0, 0.2, 1] } });
  k('agarrado', [[0, LUTANDO(1)], [0.25, LUTANDO(-1)], [0.5, LUTANDO(1)]]);
  const CANSADO = { Spine: [35, 0, 0], Spine1: [10, 0, 0], Head: [-25, 0, 0], hips: { pos: [0, -0.08, 0] },
    armR: { up: [-0.25, -0.9, 0.35], fore: [0, -0.7, 0.7], hand: [0, -0.7, 0.7], blade: [0, -0.5, 0.8] },
    armL: { up: [0.25, -0.9, 0.35], fore: [0, -0.8, 0.6], shield: [0.8, 0, 0.5] } };
  k('exausto', [[0, CANSADO], [0.6, juntar(CANSADO, { Spine1: [16, 0, 0], Head: [-15, 0, 0] })], [1.2, CANSADO]]);
  k('vitoria', [[0, {}], [0.35, { Spine: [-6, 0, 0], Head: [-12, 0, 0], hips: { rot: [0, 0, 0] },
    armR: { up: [-0.3, 0.95, 0.15], fore: [-0.05, 1, 0.1], hand: [0, 0, 1], blade: [0, 1, 0.05] } }],
    [1, { Spine: [-6, 0, 0], Head: [-12, 0, 0], hips: { rot: [0, 0, 0] }, armR: { up: [-0.3, 0.95, 0.15], fore: [-0.05, 1, 0.1], hand: [0, 0, 1], blade: [0, 1, 0.05] } }]]);

  // ---------- Ataques básicos ----------
  k('golpeCarregado', [
    [0, {}],
    [0.3, { Spine: [-10, -6, 0], Spine1: [-8, 0, 0], hips: { pos: [0, -0.06, -0.03] }, armR: LAMINA.altoAtras }],
    [0.75, { Spine: [-12, -8, 0], Spine1: [-10, 0, 0], hips: { pos: [0, -0.08, -0.04] }, armR: { ...LAMINA.altoAtras, up: [-0.2, 0.97, 0.05] } }],
    [0.86, { Spine: [20, 0, 0], Spine1: [12, 0, 0], hips: { pos: [0, -0.12, 0.08] }, ...ESTOCADA_PERNAS, armR: { up: [-0.1, 0.2, 1], fore: [0, -0.2, 1], hand: [0, -0.2, 1], blade: [0, -0.45, 0.9] } }],
    [0.96, { Spine: [24, 0, 0], Spine1: [12, 0, 0], hips: { pos: [0, -0.13, 0.08] }, ...ESTOCADA_PERNAS, armR: { up: [-0.1, -0.35, 0.95], fore: [0, -0.6, 0.8], hand: [0, -0.6, 0.8], blade: [0, -0.88, 0.45] } }],
    [1.3, {}],
  ]);
  k('ataqueSalto', [
    [0, { ...NO_AR, armR: LAMINA.altoAtras }],
    [0.15, { ...NO_AR, Spine: [-5, 0, 0], armR: LAMINA.altoAtras }],
    [0.3, { ...NO_AR, Spine: [30, 0, 0], armR: { up: [-0.1, -0.2, 1], fore: [0, -0.6, 0.8], hand: [0, -0.6, 0.8], blade: [0, -0.8, 0.6] } }],
    [0.5, { ...NO_AR, Spine: [30, 0, 0], armR: { up: [-0.1, -0.4, 0.9], fore: [0, -0.8, 0.6], hand: [0, -0.8, 0.6], blade: [0, -0.95, 0.3] } }],
  ]);

  // ---------- Fundamentais ----------
  // Sequência rápida (cortes curtos alternados, mais rápidos que o combo básico)
  k('sequenciaA', [
    [0, { armR: { up: [-0.3, -0.5, 0.8], fore: [0, 0.2, 1], hand: [0, 0.2, 1], blade: [-0.4, 0.6, 0.6] } }],
    [0.08, { Spine: [4, -12, 0], armR: LAMINA.altoDireita }],
    [0.17, { Spine: [8, 12, 0], hips: { pos: [0, -0.05, 0.03] }, armR: { up: [0.2, -0.3, 0.95], fore: [0.5, -0.3, 0.8], hand: [0.5, -0.3, 0.8], blade: [0.7, -0.5, 0.4] } }],
    [0.34, { Spine: [6, 6, 0], armR: { up: [0.1, -0.5, 0.85], fore: [0.3, -0.2, 0.9], hand: [0.3, -0.2, 0.9], blade: [0.4, -0.3, 0.85] } }],
  ]);
  k('sequenciaB', [
    [0, { Spine: [6, 6, 0], armR: { up: [0.1, -0.5, 0.85], fore: [0.3, -0.2, 0.9], hand: [0.3, -0.2, 0.9], blade: [0.4, -0.3, 0.85] } }],
    [0.07, { Spine: [6, 14, 0], armR: LAMINA.baixoEsquerda }],
    [0.17, { Spine: [4, -14, 0], hips: { pos: [0, -0.05, 0.03] }, armR: { up: [-0.6, 0.2, 0.75], fore: [-0.6, 0.5, 0.6], hand: [-0.6, 0.5, 0.6], blade: [-0.7, 0.6, 0.1] } }],
    [0.34, { armR: { up: [-0.3, -0.5, 0.8], fore: [0, 0.2, 1], hand: [0, 0.2, 1], blade: [-0.4, 0.6, 0.6] } }],
  ]);
  k('estocada', [
    [0, {}],
    [0.18, { Spine: [0, -25, 0], Spine1: [0, -10, 0], hips: { pos: [0, -0.06, -0.04] }, armR: LAMINA.estocadaRecuo }],
    [0.3, { Spine: [12, 10, 0], hips: { pos: [0, -0.1, 0.12] }, ...ESTOCADA_PERNAS, armR: LAMINA.estocada }],
    [0.45, { Spine: [12, 10, 0], hips: { pos: [0, -0.1, 0.12] }, ...ESTOCADA_PERNAS, armR: LAMINA.estocada }],
    [0.75, {}],
  ]);
  k('trombada', [
    [0, { Spine: [12, 10, 0], hips: { pos: [0, -0.1, 0.12] }, ...ESTOCADA_PERNAS, armR: LAMINA.estocada }],
    [0.15, { Spine: [25, -35, 0], Spine1: [5, -15, 0], hips: { pos: [0, -0.12, 0.14] }, ...ESTOCADA_PERNAS,
      armL: { up: [0.2, -0.6, 0.7], fore: [-0.6, 0.5, 0.6], shield: [0.3, 0, 1] }, armR: { up: [-0.6, -0.6, -0.4], fore: [0, -0.3, 0.9], hand: [0, -0.3, 0.9], blade: [0, 0.6, 0.8] } }],
    [0.35, { Spine: [25, -35, 0], Spine1: [5, -15, 0], hips: { pos: [0, -0.12, 0.14] }, ...ESTOCADA_PERNAS,
      armL: { up: [0.2, -0.6, 0.7], fore: [-0.6, 0.5, 0.6], shield: [0.3, 0, 1] }, armR: { up: [-0.6, -0.6, -0.4], fore: [0, -0.3, 0.9], hand: [0, -0.3, 0.9], blade: [0, 0.6, 0.8] } }],
    [0.65, {}],
  ]);
  k('aparo', [[0, DEFESA], [0.1, juntar(DEFESA, { Spine: [18, -10, 0], hips: { pos: [0, -0.06, 0.08] }, armL: { up: [0.25, -0.15, 1], fore: [-1, 0.2, 0.25], shield: [0, 0.1, 1] } })], [0.4, DEFESA]]);

  // ---------- Espada ----------
  const ARRANQUE = { Spine: [32, 0, 0], Spine1: [8, 0, 0], hips: { pos: [0, -0.12, 0] }, ...ESTOCADA_PERNAS,
    armR: { up: [-0.4, -0.7, -0.5], fore: [-0.3, -0.4, -0.85], hand: [-0.3, -0.4, -0.85], blade: [-0.2, -0.3, -1] } };
  k('arranque', [[0, {}], [0.12, ARRANQUE], [0.5, ARRANQUE]]);
  k('arranqueCorte', [
    [0, ARRANQUE],
    [0.08, { ...ARRANQUE, Spine: [20, -20, 0], armR: { up: [-0.6, -0.6, 0.3], fore: [-0.3, -0.5, 0.8], hand: [-0.3, -0.5, 0.8], blade: [-0.6, -0.3, -0.5] } }],
    [0.18, { Spine: [14, 10, 0], hips: { pos: [0, -0.1, 0.06] }, ...ESTOCADA_PERNAS, armR: { up: [0.1, 0.1, 1], fore: [0.4, 0.3, 0.85], hand: [0.4, 0.3, 0.85], blade: [0.3, 0.5, 0.8] } }],
    [0.28, { Spine: [10, 25, 0], hips: { pos: [0, -0.1, 0.06] }, ...ESTOCADA_PERNAS, armR: { up: [0.5, 0.1, 0.8], fore: [0.9, 0.3, 0.3], hand: [0.9, 0.3, 0.3], blade: [0.85, 0.4, -0.2] } }],
    [0.6, {}],
  ]);
  k('corteRecuo', [
    [0, {}],
    [0.14, { Spine: [2, -28, 0], Spine1: [0, -18, 0], armR: LAMINA.atrasDireita }],
    [0.3, { Spine: [8, 10, 0], hips: { pos: [0, -0.08, -0.08] }, RightUpLeg: [28, 0, -6], RightLeg: [20, 0, 0], armR: { up: [-0.3, -0.1, 1], fore: [0.3, 0, 1], hand: [0.3, 0, 1], blade: [0.4, 0, 0.95] } }],
    [0.4, { Spine: [8, 32, 0], Spine1: [4, 18, 0], hips: { pos: [0, -0.08, -0.1] }, RightUpLeg: [30, 0, -6], RightLeg: [22, 0, 0], armR: { up: [0.6, -0.1, 0.8], fore: [0.95, 0, 0.3], hand: [0.95, 0, 0.3], blade: [0.95, 0, -0.25] } }],
    [0.7, {}],
  ]);
  k('ascendentes', [
    [0, {}],
    [0.1, { Spine: [18, -10, 0], hips: { pos: [0, -0.1, 0] }, armR: LAMINA.baixoDireita }],
    [0.22, { Spine: [-6, 10, 0], hips: { pos: [0, -0.02, 0] }, armR: LAMINA.altoEsquerda }],
    [0.32, { Spine: [18, 10, 0], hips: { pos: [0, -0.1, 0] }, armR: LAMINA.baixoEsquerda }],
    [0.44, { Spine: [-6, -10, 0], hips: { pos: [0, -0.02, 0] }, armR: LAMINA.altoDireita }],
    [0.54, { Spine: [20, 0, 0], hips: { pos: [0, -0.12, 0] }, armR: { ...LAMINA.baixoDireita, blade: [0, -0.9, 0.4] } }],
    [0.68, { Spine: [-12, 0, 0], hips: { pos: [0, 0.0, 0] }, armR: { up: [-0.1, 0.95, 0.3], fore: [0, 1, 0.1], hand: [0, 1, 0.1], blade: [0, 0.4, -0.9] } }],
    [0.95, {}],
  ]);
  k('corteLancador', [
    [0, {}],
    [0.3, { ...AGACHADO, Spine: [32, -22, 0], armR: { up: [-0.5, -0.8, -0.2], fore: [-0.2, -0.8, 0.3], hand: [-0.2, -0.8, 0.3], blade: [0, -0.9, 0.4] } }],
    [0.45, { Spine: [-10, 12, 0], hips: { pos: [0, 0.02, 0.05] }, armR: { up: [-0.1, 0.9, 0.4], fore: [0, 0.95, 0.2], hand: [0, 0.95, 0.2], blade: [0, 0.6, -0.8] } }],
    [0.56, { Spine: [-14, 14, 0], hips: { pos: [0, 0.02, 0.05] }, armR: { up: [-0.1, 0.95, 0.1], fore: [0, 0.8, -0.5], hand: [0, 0.8, -0.5], blade: [0, -0.1, -1] } }],
    [0.9, {}],
  ]);
  const ESPETO = { Spine: [14, 10, 0], hips: { pos: [0, -0.1, 0.12] }, ...ESTOCADA_PERNAS };
  k('espetoTorcer', [
    [0, { ...ESPETO, armR: LAMINA.estocada }],
    [0.12, { ...ESPETO, Spine: [18, 4, 0], armR: { up: [-0.1, -0.1, 1], fore: [0, -0.05, 1], hand: [1, 0, 0.05], blade: [0, 0.05, 1] } }],
    [0.24, { ...ESPETO, Spine: [10, 14, 0], armR: { up: [-0.02, 0, 1], fore: [0.05, 0.05, 1], hand: [0, -1, 0.05], blade: [0.05, 0, 1] } }],
    [0.36, { ...ESPETO, armR: LAMINA.estocada }],
  ]);
  k('espetoPuxar', [[0, { ...ESPETO, armR: LAMINA.estocada }], [0.15, { Spine: [0, -20, 0], hips: { pos: [0, -0.06, -0.04] }, armR: LAMINA.estocadaRecuo }], [0.45, {}]]);
  k('esquiva', [
    [0, {}],
    [0.12, { Spine: [-12, 28, 0], hips: { pos: [0, -0.12, -0.08] }, LeftUpLeg: [-5, 0, 10], RightUpLeg: [40, 0, -10], RightLeg: [45, 0, 0],
      armL: { up: [0.7, -0.4, 0.4], fore: [0.2, 0.3, 0.9], shield: [0.6, 0, 0.8] }, armR: LAMINA.altoDireita }],
    [0.35, { Spine: [0, 20, 0], hips: { pos: [0, -0.1, -0.06] }, armR: LAMINA.altoDireita }],
  ]);
  k('contraCorte', [
    [0, { Spine: [0, 20, 0], hips: { pos: [0, -0.1, -0.06] }, armR: LAMINA.altoDireita }],
    [0.1, { Spine: [10, -15, 0], hips: { pos: [0, -0.08, 0.08] }, ...ESTOCADA_PERNAS, armR: { up: [0.1, -0.2, 1], fore: [0.4, -0.3, 0.9], hand: [0.4, -0.3, 0.9], blade: [0.6, -0.4, 0.7] } }],
    [0.2, { Spine: [12, 15, 0], hips: { pos: [0, -0.08, 0.08] }, ...ESTOCADA_PERNAS, armR: { up: [0.5, -0.4, 0.7], fore: [0.8, -0.5, 0.3], hand: [0.8, -0.5, 0.3], blade: [0.8, -0.6, 0] } }],
    [0.45, {}],
  ]);
  const GIRO = { Spine: [6, 0, 0], hips: { pos: [0, -0.12, 0], rot: [0, 0, 0] }, LeftUpLeg: [-20, 0, 20], LeftLeg: [35, 0, 0], RightUpLeg: [-20, 0, -20], RightLeg: [35, 0, 0], RightFoot: [-15, 0, 0],
    armR: { up: [-1, 0.05, 0.15], fore: [-1, 0, 0.1], hand: [-1, 0, 0.1], blade: [-0.95, 0, 0.3] },
    armL: { up: [0.3, -0.7, 0.4], fore: [-0.6, 0.3, 0.7], shield: [0.7, 0, 0.7] } };
  k('giroPreparo', [[0, {}], [0.2, { ...GIRO, Spine: [6, -35, 0], armR: { ...GIRO.armR, blade: [-0.6, 0, -0.8] } }]]);
  k('giro', [[0, GIRO], [1, GIRO]]);
  k('giroFim', [[0, GIRO], [0.45, {}]]);
  k('descendente', [
    [0, {}],
    [0.3, { Spine: [-8, 0, 0], hips: { pos: [0, -0.03, 0] }, armR: { up: [-0.1, 0.95, 0.25], fore: [0, 0.85, 0.5], hand: [0, 0, 1], blade: [0, -1, 0.15] } }],
    [0.45, { ...AJOELHADO, Spine: [30, 0, 0], armR: { up: [-0.1, -0.3, 0.95], fore: [0, -0.85, 0.5], hand: [0, 0, 1], blade: [0, -1, 0.15] } }],
    [0.68, { ...AJOELHADO, Spine: [32, 0, 0], armR: { up: [-0.1, -0.3, 0.95], fore: [0, -0.85, 0.5], hand: [0, 0, 1], blade: [0, -1, 0.15] } }],
    [0.95, {}],
  ]);
  const FIRME = { hips: { pos: [0, -0.12, 0] }, LeftUpLeg: [-25, 0, 18], LeftLeg: [35, 0, 0], RightUpLeg: [10, 0, -18], RightLeg: [25, 0, 0], RightFoot: [-25, -8, 0],
    Head: [8, 0, 0], armL: ESCUDO_ERGUIDO, armR: { up: [-0.4, -0.85, 0.2], fore: [0, -0.3, 1], hand: [0, -0.3, 1], blade: [0, 1, 0.2] } };
  k('postura', [[0, {}], [0.2, { ...FIRME, hips: { pos: [0, -0.05, 0] } }], [0.32, FIRME], [0.7, FIRME], [1.0, {}]]);
  k('rajada', [
    [0, {}],
    [0.08, { Spine: [10, 8, 0], hips: { pos: [0, -0.07, 0.06] }, armR: LAMINA.estocada }],
    [0.17, { Spine: [4, -15, 0], armR: LAMINA.atrasDireita }],
    [0.26, { Spine: [8, 18, 0], hips: { pos: [0, -0.07, 0.06] }, armR: LAMINA.esquerda }],
    [0.35, { Spine: [10, 8, 0], hips: { pos: [0, -0.07, 0.06] }, armR: LAMINA.estocada }],
    [0.44, { Spine: [6, 18, 0], armR: { ...LAMINA.esquerda, blade: [0.7, 0.3, -0.6] } }],
    [0.53, { Spine: [8, -18, 0], hips: { pos: [0, -0.07, 0.06] }, armR: { up: [-0.7, -0.2, 0.6], fore: [-0.9, 0.2, 0.3], hand: [-0.9, 0.2, 0.3], blade: [-0.75, 0.35, -0.5] } }],
    [0.62, { Spine: [10, 8, 0], hips: { pos: [0, -0.08, 0.07] }, armR: LAMINA.estocada }],
    [0.85, {}],
  ]);
  k('rajadaFinal', [
    [0, {}],
    [0.22, { Spine: [-8, 30, 0], Spine1: [-6, 15, 0], hips: { pos: [0, -0.04, 0] }, armR: { up: [0.4, 0.85, 0.2], fore: [0.5, 0.8, -0.3], hand: [0.5, 0.8, -0.3], blade: [0.3, 0.3, -0.9] } }],
    [0.36, { Spine: [28, -20, 0], Spine1: [10, -10, 0], hips: { pos: [0, -0.14, 0.1] }, ...ESTOCADA_PERNAS, armR: { up: [-0.3, -0.2, 0.95], fore: [-0.4, -0.6, 0.7], hand: [-0.4, -0.6, 0.7], blade: [-0.5, -0.7, 0.5] } }],
    [0.46, { Spine: [30, -30, 0], Spine1: [10, -12, 0], hips: { pos: [0, -0.15, 0.1] }, ...ESTOCADA_PERNAS, armR: { up: [-0.7, -0.4, 0.5], fore: [-0.8, -0.6, 0.1], hand: [-0.8, -0.6, 0.1], blade: [-0.7, -0.7, -0.2] } }],
    [0.8, {}],
  ]);

  // ---------- Escudo ----------
  const BATER = (fase) => ({ armL: { up: [0.25, -0.35, 0.9], fore: [-1, 0.15, 0.1], shield: [0, 0.08, 1] },
    armR: fase ? { up: [-0.3, -0.2, 0.9], fore: [0.8, 0.1, 0.5], hand: [0.8, 0.1, 0.5], blade: [0.2, 0.95, 0.1] }
      : { up: [-0.5, 0.0, 0.7], fore: [0.3, 0.6, 0.6], hand: [0.3, 0.6, 0.6], blade: [-0.2, 0.9, -0.3] } });
  k('provocar', [
    [0, {}], [0.2, BATER(false)], [0.3, BATER(true)], [0.42, BATER(false)], [0.52, BATER(true)],
    [0.72, { Spine: [-12, 0, 0], Head: [-22, 0, 0], hips: { rot: [0, -5, 0] }, armL: { up: [0.6, -0.5, 0.4], fore: [0.3, 0.2, 0.9], shield: [0.7, 0, 0.7] },
      armR: { up: [-0.7, -0.3, 0.3], fore: [-0.5, 0.4, 0.6], hand: [-0.5, 0.4, 0.6], blade: [-0.3, 0.9, 0] } }],
    [1.05, {}],
  ]);
  k('pancadaEscudo', [
    [0, {}],
    [0.13, { Spine: [0, 30, 0], armL: { up: [0.6, -0.6, -0.3], fore: [-0.3, 0.2, 0.9], shield: [0.4, 0, 0.9] }, armR: ESPADA_RECOLHIDA }],
    [0.24, { Spine: [15, -25, 0], hips: { pos: [0, -0.08, 0.12] }, ...ESTOCADA_PERNAS, armL: { up: [0.15, -0.1, 1], fore: [-0.3, 0.1, 0.95], shield: [0, 0.05, 1] }, armR: ESPADA_RECOLHIDA }],
    [0.6, {}],
  ]);
  k('pancadaPesada', [
    [0, {}],
    [0.3, { Spine: [-8, 20, 0], hips: { pos: [0, -0.02, -0.04] }, armL: { up: [0.4, 0.6, 0.3], fore: [-0.2, 0.9, 0.4], shield: [0, 0.4, 0.9] }, armR: ESPADA_RECOLHIDA }],
    [0.42, { Spine: [35, -10, 0], hips: { pos: [0, -0.16, 0.15] }, ...ESTOCADA_PERNAS, armL: { up: [0.1, -0.2, 1], fore: [-0.2, -0.4, 0.9], shield: [0, -0.3, 1] }, armR: ESPADA_RECOLHIDA }],
    [0.9, {}],
  ]);
  const EMPURRA = (x) => ({ Spine: [10, -15 * x, 0], hips: { pos: [0, -0.06, 0.05] }, armL: { up: [0.2 - 0.2 * x, -0.2, 1], fore: [-0.3 - 0.3 * x, 0.1, 0.95], shield: [-0.25 * x, 0.05, 1] }, armR: ESPADA_RECOLHIDA });
  const RECOLHE = { Spine: [4, 15, 0], armL: { up: [0.5, -0.6, 0.4], fore: [-0.2, 0.3, 0.9], shield: [0.3, 0, 0.95] }, armR: ESPADA_RECOLHIDA };
  k('cimbalo', [[0, {}], [0.1, EMPURRA(0)], [0.19, RECOLHE], [0.28, EMPURRA(1)], [0.37, RECOLHE], [0.46, EMPURRA(-0.5)], [0.75, {}]]);
  k('trampolim', [
    [0, {}],
    [0.4, { ...AGACHADO, hips: { pos: [0, -0.24, 0] }, Spine: [25, 0, 0], armL: { up: [0.3, -0.5, 0.8], fore: [-0.8, 0, 0.5], shield: [0, 1, 0.05] }, armR: ESPADA_RECOLHIDA }],
    [0.58, { hips: { pos: [0, 0, 0] }, Spine: [-5, 0, 0], armL: { up: [0.2, 0.6, 0.7], fore: [-0.6, 0.7, 0.3], shield: [0, 1, 0.2] }, armR: ESPADA_RECOLHIDA }],
    [1.0, {}],
  ]);
  const PROTEGIDA = { Spine: [10, 0, 0], hips: { pos: [0, -0.08, 0] }, armL: ESCUDO_ERGUIDO };
  const JAB = { up: [-0.15, -0.25, 1], fore: [0.1, -0.05, 1], hand: [0, -1, 0], blade: [0.1, 0, 1] };
  const PUXA = { up: [-0.4, -0.7, -0.5], fore: [0.1, 0, 1], hand: [0, -1, 0], blade: [0.05, 0, 1] };
  k('estocadaProtegida', [
    [0, { ...PROTEGIDA, armR: PUXA }], [0.1, { ...PROTEGIDA, armR: JAB }], [0.2, { ...PROTEGIDA, armR: PUXA }],
    [0.3, { ...PROTEGIDA, armR: JAB }], [0.4, { ...PROTEGIDA, armR: PUXA }], [0.5, { ...PROTEGIDA, armR: JAB }], [0.62, { ...PROTEGIDA, armR: PUXA }],
  ]);
  const MURALHA = { ...FIRME, Spine: [15, 10, 0], Spine1: [5, 5, 0], hips: { pos: [0, -0.16, 0] }, armL: ESCUDO_ERGUIDO, armR: ESPADA_RECOLHIDA };
  k('muralha', [[0, MURALHA], [0.8, juntar(MURALHA, { hips: { pos: [0, -0.17, 0] } })], [1.6, MURALHA]]);

  return c;
}
