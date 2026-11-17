// Reações a golpes para qualquer humanoide com o esqueleto padrão.
// Os deslocamentos são somados à postura base da criatura (goblin curvado, guerreiro ereto),
// então a mesma reação funciona para os dois sem parecer copiada.
//
//   danoCabeca  cabeça e tronco vão para trás
//   danoTronco  o tronco dobra (golpe no abdômen)
//   danoPernas  um joelho cede e o corpo perde o equilíbrio
//   danoCostas  golpe pelas costas: o corpo arqueia para a frente
//   danoForte   recuo grande com um passo para trás
//   empurrado   empurrão (knockback): tropeça para trás em passos curtos
import { clipe } from './poses.js';

const EULER = ['Spine', 'Spine1', 'Neck', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];

// Soma deltas (graus / metros) à postura base. Braços em "braços" são absolutos (direções).
function rel(base, d = {}, bracos = {}) {
  const o = {};
  for (const k of EULER) if (d[k]) o[k] = (base[k] || [0, 0, 0]).map((v, i) => v + d[k][i]);
  const hp = base.hips?.pos || [0, 0, 0], hr = base.hips?.rot || [0, 0, 0];
  o.hips = { pos: hp.map((v, i) => v + (d.pos?.[i] || 0)), rot: hr.map((v, i) => v + (d.rot?.[i] || 0)) };
  return { ...o, ...bracos };
}

const ABERTOS = {
  armR: { up: [-0.8, 0.1, 0.25], fore: [-0.6, 0.45, 0.5], hand: [-0.6, 0.45, 0.5], blade: [0, 0.7, 0.7] },
  armL: { up: [0.8, 0.1, 0.25], fore: [0.6, 0.45, 0.5], shield: [0.7, 0.2, 0.6] },
};
const ENCOLHIDOS = {
  armR: { up: [-0.25, -0.8, 0.4], fore: [0.4, 0.1, 0.9], hand: [0.4, 0.1, 0.9], blade: [0.2, 0.9, 0.3] },
  armL: { up: [0.25, -0.8, 0.4], fore: [-0.4, 0.1, 0.9], shield: [0.2, 0.1, 1] },
};

export function clipesReacao(rig, base, { lado = 1 } = {}) {
  const k = (nome, chaves) => clipe(rig, nome, chaves, base);
  const B = base;
  return {
    danoCabeca: k('danoCabeca', [
      [0, {}],
      [0.07, rel(B, { Head: [-32, 10 * lado, 6], Neck: [-12, 0, 0], Spine1: [-10, 4, 0], Spine: [-5, 6, 0], pos: [0, -0.02, -0.04] }), 'freia'],
      [0.2, rel(B, { Head: [-18, 6, 3], Spine1: [-6, 2, 0], pos: [0, -0.03, -0.05] })],
      [0.5, {}],
    ]),
    danoTronco: k('danoTronco', [
      [0, {}],
      [0.08, rel(B, { Spine: [22, 0, 0], Spine1: [14, 0, 0], Head: [10, 0, 0], pos: [0, -0.07, -0.07], LeftLeg: [15, 0, 0], RightLeg: [15, 0, 0] }, ENCOLHIDOS), 'freia'],
      [0.28, rel(B, { Spine: [16, 0, 0], Spine1: [8, 0, 0], Head: [4, 0, 0], pos: [0, -0.06, -0.06], LeftLeg: [10, 0, 0], RightLeg: [10, 0, 0] })],
      [0.55, {}],
    ]),
    danoPernas: k('danoPernas', [
      [0, {}],
      [0.1, rel(B, { LeftLeg: [50, 0, 0], LeftUpLeg: [-12, 0, 0], LeftFoot: [-30, 0, 0], RightLeg: [12, 0, 0], pos: [0, -0.12, 0], rot: [0, 0, 7], Spine: [12, 0, -9], Head: [-8, 0, 6] }, ABERTOS), 'freia'],
      [0.35, rel(B, { LeftLeg: [35, 0, 0], LeftFoot: [-20, 0, 0], pos: [0, -0.09, 0], rot: [0, 0, 4], Spine: [8, 0, -5] })],
      [0.65, {}],
    ]),
    danoCostas: k('danoCostas', [
      [0, {}],
      [0.08, rel(B, { Spine: [-18, 0, 0], Spine1: [-10, 0, 0], Head: [-16, 0, 0], pos: [0, -0.03, 0.09] }, ABERTOS), 'freia'],
      [0.25, rel(B, { Spine: [-8, 0, 0], Head: [-6, 0, 0], pos: [0, -0.03, 0.07] })],
      [0.5, {}],
    ]),
    danoForte: k('danoForte', [
      [0, {}],
      [0.1, rel(B, { Spine: [-22, -18 * lado, 0], Spine1: [-10, -8, 0], Head: [-26, 0, 0], pos: [0, -0.06, -0.15], RightUpLeg: [26, 0, 0], RightLeg: [30, 0, 0] }, ABERTOS), 'freia'],
      [0.4, rel(B, { Spine: [12, 6, 0], Head: [-6, 0, 0], pos: [0, -0.1, -0.16], LeftLeg: [30, 0, 0], RightLeg: [35, 0, 0] })],
      [0.8, {}],
    ]),
    empurrado: k('empurrado', [
      [0, {}],
      [0.1, rel(B, { Spine: [-20, 0, 0], Head: [-20, 0, 0], pos: [0, -0.04, -0.1] }, ABERTOS), 'freia'],
      [0.3, rel(B, { Spine: [-10, 8, 0], pos: [0, -0.07, -0.1], RightUpLeg: [30, 0, 0], RightLeg: [35, 0, 0], LeftUpLeg: [-15, 0, 0] }, ABERTOS)],
      [0.5, rel(B, { Spine: [-4, -8, 0], pos: [0, -0.06, -0.08], LeftUpLeg: [28, 0, 0], LeftLeg: [35, 0, 0], RightUpLeg: [-10, 0, 0] })],
      [0.72, rel(B, { Spine: [8, 0, 0], pos: [0, -0.08, -0.04], LeftLeg: [25, 0, 0], RightLeg: [25, 0, 0] })],
      [1.0, {}],
    ]),
  };
}

// Escolhe a reação pela parte atingida, pela direção do golpe e pela intensidade.
//   parte: nome da parte (cabeça, tronco, abdômen, quadril, pernas, coxa...)
//   angulo: graus entre a frente do personagem e a origem do golpe
//   intensidade: 'leve' | 'forte' | 'empurrao'
export function escolherReacao(parte = '', angulo = 0, intensidade = 'leve') {
  if (intensidade === 'empurrao') return 'empurrado';
  if (intensidade === 'forte') return 'danoForte';
  if (angulo > 110) return 'danoCostas';
  if (/cabe/.test(parte)) return 'danoCabeca';
  if (/perna|coxa/.test(parte)) return 'danoPernas';
  return 'danoTronco';
}
