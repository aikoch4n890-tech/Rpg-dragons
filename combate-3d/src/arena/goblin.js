// Goblin low-poly (baseado na folha de referência frente/perfil/costas) e variantes de teste.
// Usa os mesmos nomes de ossos do herói, então o mesmo solver de poses gera as animações.
import * as THREE from 'three';
import { aleatorio, material, materialCouro, peca, cilindro, construirEsqueleto, construirEscudo } from '../rig.js';

// Proporções do goblin: cerca de 1,2 m contando as orelhas, cabeça grande e membros finos.
const OSSOS_GOBLIN = [
  ['Hips', null, [0, 0.65, 0]],
  ['Spine', 'Hips', [0, 0.06, 0]],
  ['Spine1', 'Spine', [0, 0.14, 0]],
  ['Neck', 'Spine1', [0, 0.16, 0]],
  ['Head', 'Neck', [0, 0.05, 0]],
  ['LeftArm', 'Spine1', [0.15, 0.12, 0]],
  ['LeftForeArm', 'LeftArm', [0, -0.21, 0]],
  ['LeftHand', 'LeftForeArm', [0, -0.19, 0]],
  ['RightArm', 'Spine1', [-0.15, 0.12, 0]],
  ['RightForeArm', 'RightArm', [0, -0.21, 0]],
  ['RightHand', 'RightForeArm', [0, -0.19, 0]],
  ['LeftUpLeg', 'Hips', [0.075, -0.04, 0]],
  ['LeftLeg', 'LeftUpLeg', [0, -0.28, 0]],
  ['LeftFoot', 'LeftLeg', [0, -0.27, 0]],
  ['RightUpLeg', 'Hips', [-0.075, -0.04, 0]],
  ['RightLeg', 'RightUpLeg', [0, -0.28, 0]],
  ['RightFoot', 'RightLeg', [0, -0.27, 0]],
];

export const PALETAS_GOBLIN = {
  goblin: { pele: 0x6f7244, faixa: 0x5a4434, tanga: 0x6d5644, cinto: 0x4a3828, olho: 0xff3a1c },
  batedor: { pele: 0x8e8a46, faixa: 0x4c3b30, tanga: 0x5d4a3a, cinto: 0x3e2f24, olho: 0xffb020 },
  escudeiro: { pele: 0x6c7240, faixa: 0x5a4434, tanga: 0x58483c, cinto: 0x3a2c22, olho: 0xff3a1c },
  bruto: { pele: 0x5c6236, faixa: 0x3f3026, tanga: 0x4a3a2e, cinto: 0x2c2119, olho: 0xff2a10 },
};

// Saia de couro com a barra rasgada em pontas.
function tangaRasgada(rTopo, rBase, topo, base, semente) {
  const lados = 16;
  const g = new THREE.CylinderGeometry(rTopo, rBase, topo - base, lados, 1, true);
  g.translate(0, (topo + base) / 2, 0);
  const pos = g.attributes.position;
  const rnd = aleatorio(semente);
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < (topo + base) / 2) {
      // Pontas alternadas de comprimentos diferentes.
      const k = Math.round((Math.atan2(pos.getX(i), pos.getZ(i)) / (Math.PI * 2)) * lados);
      const ponta = k % 2 === 0 ? 0.03 + rnd() * 0.07 : -0.01 - rnd() * 0.03;
      pos.setY(i, pos.getY(i) - ponta);
    }
  }
  g.computeVertexNormals();
  return g;
}

function construirCabecaGoblin(osso, M) {
  const pele = M.pele;
  peca(osso, new THREE.IcosahedronGeometry(1, 1), pele, { pos: [0, 0.12, -0.005], escala: [0.1, 0.115, 0.105] });
  // Testa saliente e mandíbula larga
  peca(osso, new THREE.BoxGeometry(0.15, 0.03, 0.05), pele, { pos: [0, 0.14, 0.075], rot: [0.2, 0, 0] });
  peca(osso, new THREE.IcosahedronGeometry(1, 1), pele, { pos: [0, 0.05, 0.03], escala: [0.085, 0.055, 0.082] });
  // Nariz comprido e um pouco caído
  peca(osso, new THREE.ConeGeometry(0.022, 0.07, 4), pele, { pos: [0, 0.095, 0.115], rot: [Math.PI / 2 + 0.6, 0, Math.PI / 4] });
  // Orelhas longas e pontudas para os lados
  for (const lado of [-1, 1]) {
    const orelha = peca(osso, new THREE.ConeGeometry(0.05, 0.26, 4), pele, { pos: [0.19 * lado, 0.14, -0.01], escala: [1, 1, 0.3] });
    orelha.rotation.set(0, 0, -lado * (Math.PI / 2 - 0.22));
  }
  // Olhos vermelhos brilhantes, sobrancelhas franzidas
  const olhoMat = new THREE.MeshStandardMaterial({ color: M.corOlho, emissive: M.corOlho, emissiveIntensity: 1.6, flatShading: true });
  M.olhos = olhoMat;
  for (const lado of [-1, 1]) {
    peca(osso, new THREE.BoxGeometry(0.03, 0.016, 0.012), material(0x1a1208), { pos: [0.035 * lado, 0.118, 0.092], rot: [0, 0.35 * lado, 0] });
    peca(osso, new THREE.IcosahedronGeometry(0.009, 0), olhoMat, { pos: [0.035 * lado, 0.118, 0.098] });
    peca(osso, new THREE.BoxGeometry(0.045, 0.014, 0.02), pele, { pos: [0.037 * lado, 0.136, 0.092], rot: [0, 0.3 * lado, 0.35 * lado] });
  }
  // Boca e presas inferiores
  peca(osso, new THREE.BoxGeometry(0.06, 0.008, 0.01), material(0x2a1a10), { pos: [0, 0.058, 0.108] });
  const dente = material(0xe9e2c8);
  for (const lado of [-1, 1]) peca(osso, new THREE.ConeGeometry(0.008, 0.028, 4), dente, { pos: [0.022 * lado, 0.065, 0.106] });
}

function construirBracoGoblin(ossos, lado, M, comGarras) {
  const braco = ossos[`${lado}Arm`], ante = ossos[`${lado}ForeArm`], mao = ossos[`${lado}Hand`];
  peca(braco, new THREE.IcosahedronGeometry(0.05, 0), M.pele);
  peca(braco, cilindro(0.042, 0.033, 0, -0.21), M.pele);
  peca(ante, new THREE.IcosahedronGeometry(0.036, 0), M.pele);
  peca(ante, cilindro(0.034, 0.028, 0, -0.19), M.pele);
  // Faixa de couro no pulso
  peca(ante, cilindro(0.042, 0.038, -0.07, -0.18, 7), M.faixa);
  peca(ante, cilindro(0.044, 0.044, -0.1, -0.115, 7), M.faixaEscura);
  peca(ante, cilindro(0.044, 0.044, -0.145, -0.16, 7), M.faixaEscura);
  peca(mao, new THREE.BoxGeometry(0.045, 0.06, 0.06), M.pele, { pos: [0, -0.03, 0] });
  if (comGarras) {
    const unha = material(0x2a2a1e);
    for (const dz of [-0.02, 0, 0.02]) peca(mao, new THREE.ConeGeometry(0.01, 0.05, 4), unha, { pos: [0, -0.08, dz], rot: [Math.PI, 0, 0] });
  }
}

function construirPernaGoblin(ossos, lado, M) {
  const coxa = ossos[`${lado}UpLeg`], canela = ossos[`${lado}Leg`], pe = ossos[`${lado}Foot`];
  peca(coxa, cilindro(0.058, 0.044, 0.02, -0.28), M.pele);
  peca(canela, new THREE.IcosahedronGeometry(0.045, 0), M.pele);
  peca(canela, cilindro(0.045, 0.034, 0, -0.27), M.pele);
  peca(canela, cilindro(0.052, 0.045, -0.1, -0.25, 7), M.faixa);
  peca(canela, cilindro(0.054, 0.054, -0.13, -0.145, 7), M.faixaEscura);
  // Pé descalço grande
  peca(pe, new THREE.BoxGeometry(0.075, 0.045, 0.15), M.pele, { pos: [0, -0.03, 0.04] });
  for (const dx of [-0.022, 0, 0.022]) peca(pe, new THREE.BoxGeometry(0.02, 0.025, 0.03), M.pele, { pos: [dx, -0.04, 0.125] });
}

// Armas dos goblins. Todas apontam para +Z da mão; base e ponta servem para a hitbox.
function construirArma(mao, tipo) {
  const g = new THREE.Group();
  g.position.set(0, -0.035, 0);
  mao.add(g);
  const madeira = material(0x5a3e26);
  const ferro = new THREE.MeshStandardMaterial({ color: 0x8b8880, metalness: 0.7, roughness: 0.45, flatShading: true });
  let base, ponta;
  if (tipo === 'adaga') {
    peca(g, new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5), madeira, { rot: [Math.PI / 2, 0, 0] });
    peca(g, new THREE.ConeGeometry(0.022, 0.2, 4), ferro, { pos: [0, 0, 0.14], rot: [Math.PI / 2, 0, 0], escala: [1, 1, 0.35] });
    base = [0, 0, 0.05]; ponta = [0, 0, 0.24];
  } else if (tipo === 'lanca') {
    peca(g, new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), madeira, { pos: [0, 0, 0.15], rot: [Math.PI / 2, 0, 0] });
    peca(g, new THREE.ConeGeometry(0.03, 0.12, 4), ferro, { pos: [0, 0, 0.65], rot: [Math.PI / 2, 0, 0] });
    base = [0, 0, 0.3]; ponta = [0, 0, 0.7];
  } else if (tipo === 'clava') {
    peca(g, cilindro(0.06, 0.025, 0.55, 0, 7), madeira, { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 4; i++) peca(g, new THREE.ConeGeometry(0.014, 0.05, 4), ferro, { pos: [0.05 * Math.cos(i * 1.6), 0.05 * Math.sin(i * 1.6), 0.42], rot: [0, 0, i * 1.6 - Math.PI / 2] });
    base = [0, 0, 0.15]; ponta = [0, 0, 0.55];
  } else {
    // Garras: a "lâmina" é a própria mão.
    base = [0, 0.01, 0]; ponta = [0, -0.06, 0.06];
  }
  const oBase = new THREE.Object3D(); oBase.position.set(...base); g.add(oBase);
  const oPonta = new THREE.Object3D(); oPonta.position.set(...ponta); g.add(oPonta);
  return { grupo: g, base: oBase, ponta: oPonta };
}

// Cria um goblin. tipo: 'goblin' | 'batedor' | 'escudeiro' | 'bruto'
export function criarGoblin(tipo = 'goblin', semente = 21) {
  const p = PALETAS_GOBLIN[tipo];
  const M = {
    pele: material(p.pele),
    faixa: materialCouro(p.faixa, semente),
    faixaEscura: material(new THREE.Color(p.faixa).offsetHSL(0, 0, -0.06).getHex()),
    tanga: materialCouro(p.tanga, semente + 1),
    cinto: material(p.cinto),
    corOlho: p.olho,
  };
  M.tanga.side = THREE.DoubleSide;
  const raiz = new THREE.Group();
  const ossos = construirEsqueleto(OSSOS_GOBLIN);
  raiz.add(ossos.Hips);

  // Quadril: cinto e tanga rasgada
  peca(ossos.Hips, cilindro(0.115, 0.11, 0.05, -0.06, 8), M.pele, { escala: [1, 1, 0.8] });
  peca(ossos.Hips, cilindro(0.128, 0.128, 0.06, 0.01, 9), M.cinto, { escala: [1, 1, 0.82] });
  peca(ossos.Hips, tangaRasgada(0.125, 0.17, 0.02, -0.21, semente), M.tanga, { escala: [1, 1, 0.82] });

  // Tronco magro, peito marcado, ombros ossudos
  const barriga = tipo === 'bruto' ? 1.18 : 1;
  peca(ossos.Spine, cilindro(0.105, 0.11 * barriga, 0.15, -0.01, 8), M.pele, { escala: [1, 1, 0.8 * barriga] });
  peca(ossos.Spine1, cilindro(0.14, 0.11, 0.16, -0.01, 8), M.pele, { escala: [1, 1, 0.72] });
  peca(ossos.Spine1, new THREE.BoxGeometry(0.16, 0.05, 0.03), M.pele, { pos: [0, 0.08, 0.085], rot: [-0.25, 0, 0] });
  peca(ossos.Neck, cilindro(0.035, 0.04, 0.07, -0.02, 6), M.pele);

  construirCabecaGoblin(ossos.Head, M);
  construirBracoGoblin(ossos, 'Left', M, tipo !== 'escudeiro');
  construirBracoGoblin(ossos, 'Right', M, tipo === 'goblin');
  construirPernaGoblin(ossos, 'Left', M);
  construirPernaGoblin(ossos, 'Right', M);

  const tipoArma = { goblin: 'garra', batedor: 'adaga', escudeiro: 'lanca', bruto: 'clava' }[tipo];
  const arma = construirArma(ossos.RightHand, tipoArma);
  let escudo = null;
  if (tipo === 'escudeiro') escudo = construirEscudo(ossos.LeftForeArm, 0.2, 0.05);
  // Garra esquerda também machuca (agarrão usa as duas mãos).
  const garraEsq = construirArma(ossos.LeftHand, 'garra');

  if (tipo === 'escudeiro') {
    // Capuz de couro simples
    peca(ossos.Head, new THREE.SphereGeometry(0.112, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), M.faixa, { pos: [0, 0.135, -0.01] });
  }
  if (tipo === 'batedor') raiz.scale.setScalar(0.92);
  if (tipo === 'bruto') raiz.scale.setScalar(2.1);

  raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { raiz, ossos, arma, garraEsq, escudo, materiais: M, tipo, tipoArma };
}

// Criatura voadora de teste: morcego gigante com asas articuladas (animação procedural).
export function criarMorcego(semente = 5) {
  const raiz = new THREE.Group();
  const corpo = new THREE.Group();
  raiz.add(corpo);
  const pelo = material(0x3d3230);
  const membrana = material(0x5a4038, { side: THREE.DoubleSide });
  const olho = new THREE.MeshStandardMaterial({ color: 0xffc040, emissive: 0xffa020, emissiveIntensity: 1.5, flatShading: true });
  peca(corpo, new THREE.IcosahedronGeometry(1, 1), pelo, { escala: [0.16, 0.14, 0.24] });
  const cabeca = new THREE.Group(); cabeca.position.set(0, 0.06, 0.24); corpo.add(cabeca);
  peca(cabeca, new THREE.IcosahedronGeometry(0.1, 1), pelo);
  for (const lado of [-1, 1]) {
    peca(cabeca, new THREE.ConeGeometry(0.04, 0.14, 4), pelo, { pos: [0.06 * lado, 0.1, -0.02], rot: [0, 0, -0.35 * lado] });
    peca(cabeca, new THREE.IcosahedronGeometry(0.016, 0), olho, { pos: [0.04 * lado, 0.02, 0.085] });
    peca(cabeca, new THREE.ConeGeometry(0.01, 0.04, 4), material(0xe9e2c8), { pos: [0.02 * lado, -0.05, 0.07], rot: [Math.PI, 0, 0] });
  }
  const asas = [];
  for (const lado of [-1, 1]) {
    const ombro = new THREE.Group(); ombro.position.set(0.12 * lado, 0.04, 0.02); corpo.add(ombro);
    const g1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0.45 * lado, 0.04, 0.05), new THREE.Vector3(0, 0, -0.14),
      new THREE.Vector3(0.45 * lado, 0.04, 0.05), new THREE.Vector3(0.4 * lado, 0, -0.22), new THREE.Vector3(0, 0, -0.14),
    ]);
    g1.computeVertexNormals();
    peca(ombro, g1, membrana);
    peca(ombro, new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), pelo, { pos: [0.225 * lado, 0.02, 0.085], rot: [0, 0, Math.PI / 2] });
    const ponta = new THREE.Group(); ponta.position.set(0.45 * lado, 0.04, 0.05); ombro.add(ponta);
    const g2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.4 * lado, -0.02, -0.06), new THREE.Vector3(-0.05 * lado, -0.04, -0.27),
    ]);
    g2.computeVertexNormals();
    peca(ponta, g2, membrana);
    asas.push({ ombro, ponta, lado });
  }
  const garras = new THREE.Object3D(); garras.position.set(0, -0.14, 0.05); corpo.add(garras);
  raiz.scale.setScalar(1.3);
  raiz.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { raiz, corpo, cabeca, asas, garras, materiais: { olhos: olho, pelo, membrana } };
}
