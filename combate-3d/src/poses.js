// Poses-chave e geração dos AnimationClips.
//
// Tronco e pernas usam rotações em graus [x, y, z] no espaço do próprio osso.
// Os braços são descritos por direções no espaço do personagem (que olha para +Z;
// +X é o lado esquerdo dele, +Y é para cima):
//   armR: { up: braço, fore: antebraço, blade: para onde aponta a lâmina, hand?: dica do punho }
//   armL: { up: braço, fore: antebraço, shield: para onde a face do escudo aponta }
// Um pequeno solver converte essas direções em rotações dos ossos.
import * as THREE from 'three';
import { criarPersonagem } from './rig.js';

export const GUARDA = {
  hips: { pos: [0, -0.035, 0], rot: [0, -20, 0] },
  Spine: [4, 8, 0], Spine1: [3, 4, 0], Neck: [0, 4, 0], Head: [-4, 4, 0],
  LeftUpLeg: [-22, 0, 5], LeftLeg: [24, 0, 0], LeftFoot: [-2, 12, 0],
  RightUpLeg: [10, 0, -6], RightLeg: [10, 0, 0], RightFoot: [-20, -8, 0],
  armR: { up: [-0.3, -0.85, 0.3], fore: [0.15, 0.3, 1], hand: [0.1, -0.3, 1], blade: [0, 1, 0.35] },
  armL: { up: [0.35, -0.75, 0.45], fore: [-0.6, 0.25, 0.75], shield: [0.35, 0.1, 1] },
};

export const DEFESA = {
  Spine: [8, 6, 0], Spine1: [5, 6, 0], Head: [10, 6, 0],
  armL: { up: [0.3, -0.3, 0.9], fore: [-1, 0.15, 0.1], shield: [0, 0.08, 1] },
  armR: { up: [-0.4, -0.85, -0.05], fore: [0.1, 0.45, 0.9], hand: [0.05, -0.2, 1], blade: [0.05, 1, 0.3] },
};

// Junta a pose base com as alterações (dois níveis, para trocar só a lâmina, por exemplo).
export function juntar(...poses) {
  const r = {};
  for (const p of poses) {
    for (const [k, v] of Object.entries(p)) {
      r[k] = v && !Array.isArray(v) && typeof v === 'object' ? { ...(r[k] || {}), ...v } : v;
    }
  }
  return r;
}

const V = (a) => new THREE.Vector3(...a).normalize();
const A0 = new THREE.Vector3(0, -1, 0); // direção do osso em repouso (para baixo)
const R0 = new THREE.Vector3(0, 0, 1); // lado da frente em repouso
const BASE_REPOUSO = new THREE.Matrix4().makeBasis(A0, R0, new THREE.Vector3().crossVectors(A0, R0));
const BASE_REPOUSO_T = BASE_REPOUSO.clone().transpose();

// Gira o osso para que seu eixo aponte em `a` e sua frente fique em `r`.
// `exato` diz qual dos dois é obedecido à risca; o outro é ajustado para ficar perpendicular.
function mirar(osso, a, r, exato = 'a') {
  a = a.clone().normalize();
  r = r.clone().normalize();
  if (exato === 'a') {
    r.addScaledVector(a, -r.dot(a));
    if (r.lengthSq() < 1e-6) r.set(0, 0, 1).addScaledVector(a, -a.z);
    r.normalize();
  } else {
    a.addScaledVector(r, -a.dot(r));
    if (a.lengthSq() < 1e-6) a.set(0, -1, 0).addScaledVector(r, r.y);
    a.normalize();
  }
  const c = new THREE.Vector3().crossVectors(a, r);
  const alvo = new THREE.Matrix4().makeBasis(a, r, c).multiply(BASE_REPOUSO_T);
  const qMundo = new THREE.Quaternion().setFromRotationMatrix(alvo);
  const qPai = osso.parent.getWorldQuaternion(new THREE.Quaternion());
  osso.quaternion.copy(qPai.invert().multiply(qMundo));
  osso.updateMatrixWorld(true);
}

const GRAUS = THREE.MathUtils.DEG2RAD;
const NOMES_EULER = ['Spine', 'Spine1', 'Neck', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];

function aplicarPose(rig, pose, posRepousoHips) {
  const { raiz, ossos } = rig;
  for (const b of Object.values(ossos)) b.quaternion.identity();
  const h = pose.hips || { pos: [0, 0, 0], rot: [0, 0, 0] };
  ossos.Hips.position.copy(posRepousoHips).add(new THREE.Vector3(...(h.pos || [0, 0, 0])));
  ossos.Hips.rotation.set(...(h.rot || [0, 0, 0]).map((g) => g * GRAUS));
  for (const n of NOMES_EULER) if (pose[n]) ossos[n].rotation.set(...pose[n].map((g) => g * GRAUS));
  raiz.updateMatrixWorld(true);

  // Com espaco: 'tronco', as direções dos braços giram junto com o peito (rolamento, queda).
  const qTronco = ossos.Spine1.getWorldQuaternion(new THREE.Quaternion());
  const dir = (spec, v) => (spec.espaco === 'tronco' ? V(v).applyQuaternion(qTronco) : V(v));
  const d = pose.armR;
  if (d) {
    const lamina = dir(d, d.blade);
    mirar(ossos.RightArm, dir(d, d.up), lamina);
    mirar(ossos.RightForeArm, dir(d, d.fore), lamina);
    mirar(ossos.RightHand, dir(d, d.hand || d.fore), lamina, 'r');
  }
  const e = pose.armL;
  if (e) {
    // A face do escudo é o +X local do antebraço esquerdo, que corresponde a -(a × r).
    // Com r = a × n, temos a × r = -n: a face aponta para n.
    const n = dir(e, e.shield);
    const fore = dir(e, e.fore);
    const ante = fore.clone().addScaledVector(n, -fore.dot(n)).normalize();
    const r = new THREE.Vector3().crossVectors(ante, n);
    mirar(ossos.LeftArm, dir(e, e.up), r);
    mirar(ossos.LeftForeArm, ante, r);
    mirar(ossos.LeftHand, ante, r);
  }
}

// Cada chave: [tempo, alterações sobre a pose base]
export function clipe(rig, nome, chaves, base = GUARDA) {
  if (!rig.posRepousoHips) rig.posRepousoHips = rig.ossos.Hips.position.clone();
  const posRepouso = rig.posRepousoHips;
  const nomes = Object.keys(rig.ossos);
  const tempos = chaves.map((c) => c[0]);
  const quats = Object.fromEntries(nomes.map((n) => [n, []]));
  const posHips = [];
  const anterior = {};
  for (const [, mudancas] of chaves) {
    aplicarPose(rig, juntar(base, mudancas), posRepouso);
    for (const n of nomes) {
      const q = rig.ossos[n].quaternion.clone();
      // Mantém o mesmo hemisfério do quaternion anterior para interpolar pelo caminho curto.
      if (anterior[n] && anterior[n].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      anterior[n] = q;
      quats[n].push(q.x, q.y, q.z, q.w);
    }
    posHips.push(...rig.ossos.Hips.position.toArray());
  }
  const trilhas = nomes.map((n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, tempos, quats[n]));
  trilhas.push(new THREE.VectorKeyframeTrack('Hips.position', tempos, posHips));
  return new THREE.AnimationClip(nome, tempos[tempos.length - 1], trilhas);
}

// Dados de combate de cada golpe (em segundos do clipe):
//   ativo: janela em que a lâmina machuca; combo: a partir de quando dá para emendar o próximo golpe.
export const GOLPES = {
  corte1: { ativo: [0.15, 0.3], combo: 0.2, proximo: 'corte2', dano: 1 },
  corte2: { ativo: [0.13, 0.28], combo: 0.2, proximo: 'corte3', dano: 1 },
  corte3: { ativo: [0.33, 0.46], combo: null, proximo: null, dano: 2 },
  golpeInimigo: { ativo: [0.74, 0.86], combo: null, proximo: null, dano: 1 },
};

export function criarClipes() {
  // O solver trabalha numa cópia do personagem que não vai para a cena.
  const rig = criarPersonagem();
  rig.posRepousoHips = rig.ossos.Hips.position.clone();
  const c = {};

  c.guarda = clipe(rig, 'guarda', [
    [0, {}],
    [1.2, { hips: { pos: [0, -0.05, 0] }, Spine1: [6, 4, 0], Head: [-2, 4, 0],
      armR: { fore: [0.15, 0.25, 1], blade: [0.05, 1, 0.3] }, armL: { fore: [-0.6, 0.2, 0.75] } }],
    [2.4, {}],
  ]);

  c.corte1 = clipe(rig, 'corte1', [
    [0, {}],
    [0.13, { Spine: [2, -22, 0], Spine1: [0, -18, 0],
      armR: { up: [-0.7, -0.6, 0.1], fore: [0.3, 0.6, 0.6], hand: [0.2, 0.2, 1], blade: [-0.7, 0.2, -0.6] } }],
    [0.22, { Spine: [6, 2, 0], Spine1: [4, 0, 0], hips: { pos: [0, -0.05, 0.03] },
      armR: { up: [-0.1, -0.2, 1], fore: [0.15, 0, 1], hand: [0.15, 0, 1], blade: [0.25, 0.05, 1] } }],
    [0.31, { Spine: [6, 22, 0], Spine1: [4, 18, 0], hips: { pos: [0, -0.05, 0.03] },
      armR: { up: [0.5, -0.3, 0.8], fore: [0.9, -0.1, 0.4], hand: [0.9, -0.1, 0.4], blade: [0.85, -0.1, -0.5] } }],
    [0.55, {}],
  ]);

  c.corte2 = clipe(rig, 'corte2', [
    [0, { Spine: [6, 22, 0], Spine1: [4, 18, 0],
      armR: { up: [0.5, -0.3, 0.8], fore: [0.9, -0.1, 0.4], hand: [0.9, -0.1, 0.4], blade: [0.85, -0.1, -0.5] } }],
    [0.1, { Spine: [4, 28, 0], Spine1: [2, 22, 0],
      armR: { up: [0.5, -0.5, 0.7], fore: [0.8, 0.3, 0.1], hand: [0.6, -0.2, 0.6], blade: [0.6, 0.15, -0.75] } }],
    [0.2, { Spine: [6, 0, 0], Spine1: [4, 0, 0], hips: { pos: [0, -0.05, 0.03] },
      armR: { up: [-0.1, -0.15, 1], fore: [-0.1, 0.15, 1], hand: [-0.1, 0.1, 1], blade: [-0.3, 0.3, 0.92] } }],
    [0.29, { Spine: [4, -24, 0], Spine1: [2, -20, 0], hips: { pos: [0, -0.05, 0.03] },
      armR: { up: [-0.75, -0.1, 0.6], fore: [-0.9, 0.25, 0.3], hand: [-0.9, 0.25, 0.3], blade: [-0.75, 0.45, -0.5] } }],
    [0.55, {}],
  ]);

  const golpeAlto = (tPreparo, tSegura, tCorte, tSegue, tFim) => [
    [0, {}],
    [tPreparo, { Spine: [-10, -6, 0], Spine1: [-8, 0, 0], Head: [-2, 4, 0], hips: { pos: [0, -0.02, -0.02] },
      armR: { up: [-0.2, 0.95, 0.1], fore: [0.1, 0.5, -0.85], hand: [0.1, 0.2, -1], blade: [0.05, -0.25, -1] },
      armL: { up: [0.45, -0.7, 0.2], fore: [-0.2, 0.2, 0.9], shield: [0.6, 0.1, 0.8] } }],
    ...(tSegura ? [[tSegura, { Spine: [-12, -8, 0], Spine1: [-9, 0, 0], Head: [-2, 4, 0], hips: { pos: [0, -0.02, -0.03] },
      armR: { up: [-0.2, 0.97, 0.05], fore: [0.1, 0.45, -0.9], hand: [0.1, 0.15, -1], blade: [0.05, -0.3, -1] },
      armL: { up: [0.45, -0.7, 0.2], fore: [-0.2, 0.2, 0.9], shield: [0.6, 0.1, 0.8] } }]] : []),
    [tCorte, { Spine: [18, 0, 0], Spine1: [10, 0, 0], Head: [-8, 4, 0], hips: { pos: [0, -0.1, 0.07] },
      LeftUpLeg: [-38, 0, 5], LeftLeg: [42, 0, 0], RightUpLeg: [18, 0, -6], RightLeg: [12, 0, 0], RightFoot: [-30, -8, 0],
      armR: { up: [-0.1, 0.2, 1], fore: [0, -0.15, 1], hand: [0, -0.15, 1], blade: [0, -0.4, 0.92] } }],
    [tSegue, { Spine: [22, 0, 0], Spine1: [12, 0, 0], Head: [-10, 4, 0], hips: { pos: [0, -0.11, 0.07] },
      LeftUpLeg: [-38, 0, 5], LeftLeg: [42, 0, 0], RightUpLeg: [18, 0, -6], RightLeg: [12, 0, 0], RightFoot: [-30, -8, 0],
      armR: { up: [-0.1, -0.35, 0.95], fore: [0, -0.6, 0.8], hand: [0, -0.6, 0.8], blade: [0, -0.85, 0.5] } }],
    [tFim, {}],
  ];
  c.corte3 = clipe(rig, 'corte3', golpeAlto(0.26, null, 0.4, 0.5, 0.85));
  // O adversário usa o golpe alto com uma pausa longa no alto: é o aviso para você defender.
  c.golpeInimigo = clipe(rig, 'golpeInimigo', golpeAlto(0.35, 0.7, 0.82, 0.92, 1.3));

  c.defesa = clipe(rig, 'defesa', [[0, {}], [0.12, DEFESA]]);
  c.defesaImpacto = clipe(rig, 'defesaImpacto', [
    [0, DEFESA],
    [0.06, juntar(DEFESA, { Spine: [-6, 6, 0], Spine1: [-4, 6, 0], hips: { pos: [0, -0.04, -0.06] } })],
    [0.3, DEFESA],
  ]);
  c.dano = clipe(rig, 'dano', [
    [0, {}],
    [0.08, { Spine: [-16, 12, 0], Spine1: [-8, 6, 0], Head: [-22, 10, 0], hips: { pos: [0, -0.05, -0.08] },
      armR: { up: [-0.6, -0.6, -0.3], fore: [-0.2, 0.3, 0.9], hand: [-0.1, 0, 1], blade: [0.2, 0.9, 0.2] },
      armL: { up: [0.6, -0.6, -0.1], fore: [0.2, -0.2, 0.9], shield: [0.9, 0.1, 0.3] } }],
    [0.45, {}],
  ]);
  const zero = [0, 0, 0];
  c.poseT = clipe(rig, 'poseT', [[0, {
    hips: { pos: zero, rot: zero }, Spine: zero, Spine1: zero, Neck: zero, Head: zero,
    LeftUpLeg: zero, LeftLeg: zero, LeftFoot: zero, RightUpLeg: zero, RightLeg: zero, RightFoot: zero,
    armR: { up: [-1, 0, 0], fore: [-1, 0, 0], hand: [-1, 0, 0], blade: [0, 0, 1] },
    armL: { up: [1, 0, 0], fore: [1, 0, 0], shield: [0, -1, 0] },
  }], [1, {
    hips: { pos: zero, rot: zero }, Spine: zero, Spine1: zero, Neck: zero, Head: zero,
    LeftUpLeg: zero, LeftLeg: zero, LeftFoot: zero, RightUpLeg: zero, RightLeg: zero, RightFoot: zero,
    armR: { up: [-1, 0, 0], fore: [-1, 0, 0], hand: [-1, 0, 0], blade: [0, 0, 1] },
    armL: { up: [1, 0, 0], fore: [1, 0, 0], shield: [0, -1, 0] },
  }]]);
  return c;
}
