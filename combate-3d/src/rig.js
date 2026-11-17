// Personagem low-poly montado em código sobre um esqueleto de ossos (THREE.Bone).
// Cada peça da malha segue um osso só (skin rígido), como em modelos low-poly de jogo.
// Os nomes dos ossos seguem o padrão do Mixamo (sem o prefixo "mixamorig:"),
// então um modelo .glb riggado no Mixamo pode reaproveitar as mesmas animações.
import * as THREE from 'three';

// Paletas: o herói segue a imagem de referência; o adversário é uma troca de cores.
export const PALETAS = {
  heroi: {
    pele: 0xd6a57e, cabelo: 0x4a2f1f, couro: 0x5c412b, couroEscuro: 0x47321f,
    manga: 0x8c8473, punho: 0x5a4130, calca: 0x3d3630, bota: 0x4d3727,
    cinto: 0x2f241c, fivela: 0xa7a7a2, olho: 0x2a1d16,
  },
  adversario: {
    pele: 0xc89270, cabelo: 0x1f1a17, couro: 0x5b2a24, couroEscuro: 0x3f1d19,
    manga: 0x6b665c, punho: 0x3a2c22, calca: 0x2b2a2c, bota: 0x2f2620,
    cinto: 0x1d1714, fivela: 0x8a7a55, olho: 0x161210,
  },
};

// Gerador pseudoaleatório com semente, para o cabelo e as manchas saírem sempre iguais.
export function aleatorio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Textura de couro gasto: cor base com manchas claras e escuras.
const cacheTexturas = new Map();
export function texturaCouro(cor, semente) {
  const chave = `${cor}-${semente}`;
  if (cacheTexturas.has(chave)) return cacheTexturas.get(chave);
  const tam = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tam;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(cor);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, tam, tam);
  const rnd = aleatorio(semente);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * tam, y = rnd() * tam, r = 8 + rnd() * 40;
    const claro = rnd() > 0.55;
    const c = base.clone().offsetHSL(0, claro ? -0.05 : 0.02, claro ? 0.09 : -0.07);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.55)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    // Repete nas bordas para a textura não ter emenda visível.
    for (const dx of [-tam, 0, tam]) for (const dy of [-tam, 0, tam]) {
      ctx.save(); ctx.translate(dx, dy); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    }
  }
  const img = ctx.getImageData(0, 0, tam, tam);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cacheTexturas.set(chave, tex);
  return tex;
}

function texturaMadeira() {
  if (cacheTexturas.has('madeira')) return cacheTexturas.get('madeira');
  const tam = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tam;
  const ctx = canvas.getContext('2d');
  const rnd = aleatorio(7);
  const tabuas = 5;
  for (let i = 0; i < tabuas; i++) {
    const tom = 0.85 + rnd() * 0.3;
    ctx.fillStyle = `rgb(${(110 * tom) | 0},${(74 * tom) | 0},${(44 * tom) | 0})`;
    ctx.fillRect((i * tam) / tabuas, 0, tam / tabuas, tam);
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = `rgba(40,24,12,${0.15 + rnd() * 0.2})`;
      ctx.beginPath();
      const x = (i * tam) / tabuas + rnd() * (tam / tabuas);
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + rnd() * 6 - 3, tam / 3, x + rnd() * 6 - 3, (2 * tam) / 3, x, tam);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(25,15,8,0.8)';
    ctx.fillRect((i * tam) / tabuas, 0, 2, tam);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cacheTexturas.set('madeira', tex);
  return tex;
}

export function material(cor, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: cor, roughness: 0.92, metalness: 0, flatShading: true, ...extra });
}

export function materialCouro(cor, semente) {
  return material(0xffffff, { map: texturaCouro(cor, semente) });
}

// Cria uma malha, posiciona e prende no osso indicado.
export function peca(osso, geometria, mat, { pos = [0, 0, 0], rot = [0, 0, 0], escala = [1, 1, 1] } = {}) {
  const m = new THREE.Mesh(geometria, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...escala);
  m.castShadow = true;
  m.receiveShadow = true;
  osso.add(m);
  return m;
}

// Cilindro entre y = topo e y = base (coordenadas do osso).
export function cilindro(rTopo, rBase, topo, base, lados = 7, extra = {}) {
  const g = new THREE.CylinderGeometry(rTopo, rBase, topo - base, lados, 1, extra.aberto ?? false, extra.inicio ?? 0, extra.arco ?? Math.PI * 2);
  g.translate(0, (topo + base) / 2, 0);
  return g;
}

// Esqueleto em pose de descanso: braços caídos, pernas retas, olhando para +Z.
// Comprimentos em metros; o personagem tem cerca de 1,82 m.
export const OSSOS = [
  // nome, pai, posição relativa ao pai
  ['Hips', null, [0, 0.98, 0]],
  ['Spine', 'Hips', [0, 0.08, 0]],
  ['Spine1', 'Spine', [0, 0.2, 0]],
  ['Neck', 'Spine1', [0, 0.23, 0]],
  ['Head', 'Neck', [0, 0.08, 0]],
  ['LeftArm', 'Spine1', [0.2, 0.17, 0]],
  ['LeftForeArm', 'LeftArm', [0, -0.29, 0]],
  ['LeftHand', 'LeftForeArm', [0, -0.26, 0]],
  ['RightArm', 'Spine1', [-0.2, 0.17, 0]],
  ['RightForeArm', 'RightArm', [0, -0.29, 0]],
  ['RightHand', 'RightForeArm', [0, -0.26, 0]],
  ['LeftUpLeg', 'Hips', [0.1, -0.05, 0]],
  ['LeftLeg', 'LeftUpLeg', [0, -0.43, 0]],
  ['LeftFoot', 'LeftLeg', [0, -0.41, 0]],
  ['RightUpLeg', 'Hips', [-0.1, -0.05, 0]],
  ['RightLeg', 'RightUpLeg', [0, -0.43, 0]],
  ['RightFoot', 'RightLeg', [0, -0.41, 0]],
];

export function construirEsqueleto(def = OSSOS) {
  const ossos = {};
  for (const [nome, pai, pos] of def) {
    const b = new THREE.Bone();
    b.name = nome;
    b.position.set(...pos);
    ossos[nome] = b;
    if (pai) ossos[pai].add(b);
  }
  return ossos;
}

function construirCabeca(osso, p, M, semente) {
  const rnd = aleatorio(semente);
  const pele = M.pele;
  // Crânio e queixo
  peca(osso, new THREE.IcosahedronGeometry(1, 1), pele, { pos: [0, 0.13, 0.005], escala: [0.098, 0.118, 0.108] });
  peca(osso, new THREE.IcosahedronGeometry(1, 1), pele, { pos: [0, 0.07, 0.02], escala: [0.072, 0.058, 0.078] });
  // Orelhas
  for (const lado of [-1, 1]) {
    peca(osso, new THREE.IcosahedronGeometry(1, 0), pele, { pos: [0.098 * lado, 0.12, -0.005], escala: [0.015, 0.03, 0.022] });
  }
  // Nariz
  peca(osso, new THREE.ConeGeometry(0.018, 0.045, 4), pele, { pos: [0, 0.11, 0.112], rot: [Math.PI / 2 + 0.5, 0, Math.PI / 4] });
  // Olhos, sobrancelhas franzidas e boca
  const olho = material(p.olho);
  const branco = material(0xe8e0d4);
  for (const lado of [-1, 1]) {
    peca(osso, new THREE.BoxGeometry(0.026, 0.012, 0.01), branco, { pos: [0.034 * lado, 0.135, 0.097], rot: [0, 0.3 * lado, 0] });
    peca(osso, new THREE.BoxGeometry(0.012, 0.013, 0.01), olho, { pos: [0.031 * lado, 0.135, 0.1], rot: [0, 0.3 * lado, 0] });
    peca(osso, new THREE.BoxGeometry(0.045, 0.012, 0.016), M.cabelo, { pos: [0.038 * lado, 0.157, 0.1], rot: [0, 0, -0.22 * lado] });
  }
  peca(osso, new THREE.BoxGeometry(0.035, 0.006, 0.01), material(0x7a4a3a), { pos: [0, 0.068, 0.1] });

  // Cabelo: calota + mechas pontudas para cima/trás + franja caindo na testa.
  const cabelo = M.cabelo;
  peca(osso, new THREE.IcosahedronGeometry(1, 1), cabelo, { pos: [0, 0.17, -0.012], escala: [0.108, 0.105, 0.115] });
  const cone = (r, h) => new THREE.ConeGeometry(r, h, 4);
  for (let i = 0; i < 26; i++) {
    const teta = rnd() * Math.PI * 2;
    const fi = 0.15 + rnd() * 1.2; // ângulo a partir do topo
    const dir = new THREE.Vector3(Math.sin(fi) * Math.sin(teta), Math.cos(fi), Math.sin(fi) * Math.cos(teta));
    if (dir.z > 0.45 && dir.y < 0.75) continue; // deixa o rosto livre
    dir.z -= 0.25; // mechas puxadas para trás
    dir.normalize();
    const h = 0.07 + rnd() * 0.06;
    const m = peca(osso, cone(0.03 + rnd() * 0.015, h), cabelo);
    m.position.set(dir.x * 0.1, 0.17 + dir.y * 0.1 + h * 0.2, dir.z * 0.105);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }
  // Franja
  for (let i = 0; i < 7; i++) {
    const x = -0.075 + i * 0.025 + (rnd() - 0.5) * 0.01;
    const m = peca(osso, cone(0.022, 0.08 + rnd() * 0.03), cabelo);
    m.position.set(x, 0.2, 0.085);
    const dir = new THREE.Vector3(x * 1.5 + (rnd() - 0.5) * 0.4, -1, 0.55).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }
  // Costeletas e nuca
  for (const lado of [-1, 1]) {
    peca(osso, cone(0.025, 0.07), cabelo, { pos: [0.092 * lado, 0.135, 0.02], rot: [Math.PI, 0, -0.15 * lado] });
  }
  for (let i = 0; i < 5; i++) {
    peca(osso, cone(0.03, 0.08), cabelo, { pos: [-0.06 + i * 0.03, 0.08, -0.085], rot: [Math.PI - 0.5, 0, (rnd() - 0.5) * 0.4] });
  }
}

function construirBraco(ossos, lado, M) {
  const L = lado === 'Left' ? 1 : -1;
  const braco = ossos[`${lado}Arm`], ante = ossos[`${lado}ForeArm`], mao = ossos[`${lado}Hand`];
  peca(braco, new THREE.IcosahedronGeometry(0.068, 0), M.manga);
  peca(braco, cilindro(0.06, 0.05, 0, -0.29), M.manga);
  peca(ante, new THREE.IcosahedronGeometry(0.052, 0), M.manga);
  peca(ante, cilindro(0.05, 0.043, 0, -0.14), M.manga);
  peca(ante, cilindro(0.062, 0.055, -0.1, -0.25, 7), M.punho);
  // Mão fechada (punho) com polegar
  peca(mao, new THREE.BoxGeometry(0.055, 0.085, 0.085), M.pele, { pos: [0, -0.045, 0] });
  peca(mao, new THREE.BoxGeometry(0.03, 0.05, 0.03), M.pele, { pos: [-0.025 * L, -0.03, 0.04], rot: [0.4, 0, 0] });
}

function construirPerna(ossos, lado, M) {
  const coxa = ossos[`${lado}UpLeg`], canela = ossos[`${lado}Leg`], pe = ossos[`${lado}Foot`];
  peca(coxa, cilindro(0.09, 0.07, 0.02, -0.43), M.calca);
  peca(canela, new THREE.IcosahedronGeometry(0.07, 0), M.calca);
  peca(canela, cilindro(0.07, 0.064, 0, -0.2), M.calca);
  // Bota com cano dobrado
  peca(canela, cilindro(0.066, 0.06, -0.18, -0.41), M.bota);
  peca(canela, cilindro(0.083, 0.077, -0.15, -0.25, 8), M.botaDobra);
  peca(pe, new THREE.BoxGeometry(0.105, 0.085, 0.24), M.bota, { pos: [0, -0.045, 0.055] });
  peca(pe, new THREE.BoxGeometry(0.11, 0.02, 0.25), material(0x241a13), { pos: [0, -0.085, 0.055] });
}

export function construirEspada(mao) {
  const espada = new THREE.Group();
  espada.name = 'Espada';
  const aco = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.3, flatShading: true });
  const ferro = new THREE.MeshStandardMaterial({ color: 0x6d6a66, metalness: 0.7, roughness: 0.45, flatShading: true });
  const empunhadura = material(0x3a2618);
  // Lâmina: perfil desenhado no plano XY e depois girado para apontar em +Z.
  const forma = new THREE.Shape();
  forma.moveTo(0, -0.026); forma.lineTo(0.72, -0.022); forma.lineTo(0.8, 0);
  forma.lineTo(0.72, 0.022); forma.lineTo(0, 0.026); forma.closePath();
  const gLamina = new THREE.ExtrudeGeometry(forma, { depth: 0.012, bevelEnabled: false });
  gLamina.translate(0, 0, -0.006);
  gLamina.rotateY(-Math.PI / 2);
  const lamina = new THREE.Mesh(gLamina, aco);
  lamina.position.z = 0.1;
  lamina.castShadow = true;
  espada.add(lamina);
  const guarda = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), ferro);
  guarda.position.z = 0.09;
  espada.add(guarda);
  const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.17, 6), empunhadura);
  cabo.rotation.x = Math.PI / 2;
  espada.add(cabo);
  const pomo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), ferro);
  pomo.position.z = -0.1;
  espada.add(pomo);
  // A mão fechada fica em y = -0.045; a lâmina sai pelo lado do polegar (+Z do osso).
  espada.position.set(0, -0.045, 0);
  mao.add(espada);
  // Pontos usados para o rastro e para saber onde o golpe encosta.
  const base = new THREE.Object3D(); base.position.z = 0.2; espada.add(base);
  const ponta = new THREE.Object3D(); ponta.position.z = 0.88; espada.add(ponta);
  return { espada, base, ponta, lamina };
}

export function construirEscudo(antebraco, raio = 0.3, deslocX = 0.085) {
  const escudo = new THREE.Group();
  escudo.name = 'Escudo';
  const madeira = new THREE.MeshStandardMaterial({ map: texturaMadeira(), roughness: 0.85, flatShading: true });
  const ferro = new THREE.MeshStandardMaterial({ color: 0x75716b, metalness: 0.75, roughness: 0.4, flatShading: true });
  // Disco com a face voltada para +X (lado de fora do antebraço esquerdo).
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(raio, raio, 0.035, 12), madeira);
  disco.rotation.z = Math.PI / 2;
  disco.castShadow = true;
  escudo.add(disco);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(raio, 0.02, 4, 12), ferro);
  aro.rotation.y = Math.PI / 2;
  escudo.add(aro);
  const bossa = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), ferro);
  bossa.rotation.z = -Math.PI / 2;
  bossa.position.x = 0.017;
  escudo.add(bossa);
  for (const ang of [0, Math.PI / 2]) {
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(0.01, raio * 1.93, 0.04), ferro);
    faixa.position.x = 0.019;
    faixa.rotation.x = ang;
    escudo.add(faixa);
  }
  escudo.position.set(deslocX, -0.15, 0);
  antebraco.add(escudo);
  const centro = new THREE.Object3D(); centro.position.x = 0.05; escudo.add(centro);
  return { escudo, centro };
}

// Monta o personagem completo. Retorna a raiz, os ossos e os pontos de referência.
export function criarPersonagem(paleta = PALETAS.heroi, semente = 3) {
  const p = paleta;
  const M = {
    pele: material(p.pele),
    cabelo: material(p.cabelo),
    couro: materialCouro(p.couro, semente),
    couroEscuro: materialCouro(p.couroEscuro, semente + 1),
    manga: material(p.manga),
    punho: materialCouro(p.punho, semente + 2),
    calca: material(p.calca),
    bota: materialCouro(p.bota, semente + 3),
    botaDobra: materialCouro(new THREE.Color(p.bota).offsetHSL(0, 0, 0.04).getHex(), semente + 4),
    cinto: material(p.cinto),
  };
  const raiz = new THREE.Group();
  const ossos = construirEsqueleto();
  raiz.add(ossos.Hips);

  // Quadril: calça, cinto com fivela e saia da túnica (aberta na frente).
  peca(ossos.Hips, cilindro(0.165, 0.16, 0.06, -0.1, 8), M.calca, { escala: [1, 1, 0.75] });
  const abertura = 0.4;
  const saia = cilindro(0.19, 0.27, 0.04, -0.38, 9, { aberto: true, inicio: abertura / 2, arco: Math.PI * 2 - abertura });
  const couroDupla = M.couro.clone();
  couroDupla.side = THREE.DoubleSide;
  peca(ossos.Hips, saia, couroDupla, { escala: [1, 1, 0.78] });
  peca(ossos.Hips, cilindro(0.185, 0.185, 0.07, 0.01, 9), M.cinto, { escala: [1, 1, 0.8] });
  const fivela = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 3, 4), material(p.fivela, { metalness: 0.7, roughness: 0.4 }));
  fivela.rotation.z = Math.PI / 4;
  fivela.position.set(0.035, 0.04, 0.15);
  ossos.Hips.add(fivela);

  // Tronco: túnica, ombreira larga (capa curta) e gola da camisa de baixo.
  peca(ossos.Spine, cilindro(0.18, 0.18, 0.21, -0.02, 9), M.couro, { escala: [1, 1, 0.72] });
  peca(ossos.Spine1, cilindro(0.2, 0.185, 0.2, -0.01, 9), M.couro, { escala: [1, 1, 0.7] });
  peca(ossos.Spine1, cilindro(0.13, 0.275, 0.24, 0.07, 8), M.couroEscuro, { escala: [1, 1, 0.74] });
  peca(ossos.Spine1, cilindro(0.075, 0.09, 0.27, 0.22, 8), M.manga);
  peca(ossos.Neck, cilindro(0.05, 0.055, 0.1, -0.02, 7), M.pele);

  construirCabeca(ossos.Head, p, M, semente + 10);
  construirBraco(ossos, 'Left', M);
  construirBraco(ossos, 'Right', M);
  construirPerna(ossos, 'Left', M);
  construirPerna(ossos, 'Right', M);
  const espada = construirEspada(ossos.RightHand);
  const escudo = construirEscudo(ossos.LeftForeArm);
  const visual = construirEquipamentoVisual(ossos);

  return { raiz, ossos, espada, escudo, visual, materiais: M };
}

// Peças de armadura opcionais, ligadas pelo menu de equipamento (começam escondidas).
function construirEquipamentoVisual(ossos) {
  const ferro = new THREE.MeshStandardMaterial({ color: 0x8a8781, metalness: 0.75, roughness: 0.42, flatShading: true });
  const malha = new THREE.MeshStandardMaterial({ color: 0x77746f, metalness: 0.6, roughness: 0.6, flatShading: true });
  const pano = material(0x5b2620, { side: THREE.DoubleSide });
  const grupo = (osso) => { const g = new THREE.Group(); g.visible = false; osso.add(g); return g; };

  const elmo = grupo(ossos.Head);
  peca(elmo, new THREE.SphereGeometry(0.125, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), ferro, { pos: [0, 0.15, -0.005], escala: [1, 1, 1.05] });
  peca(elmo, new THREE.BoxGeometry(0.018, 0.09, 0.02), ferro, { pos: [0, 0.13, 0.125] });
  peca(elmo, new THREE.TorusGeometry(0.122, 0.012, 3, 10), ferro, { pos: [0, 0.165, -0.005], rot: [Math.PI / 2, 0, 0] });

  const capa = grupo(ossos.Spine1);
  peca(capa, new THREE.BoxGeometry(0.44, 0.78, 0.015), pano, { pos: [0, -0.16, -0.17], rot: [0.14, 0, 0] });

  const cota = grupo(ossos.Spine1);
  peca(cota, cilindro(0.212, 0.195, 0.2, -0.02, 9), malha, { escala: [1, 1, 0.72] });
  peca(cota, cilindro(0.19, 0.19, 0.0, -0.22, 9), malha, { escala: [1, 1, 0.74] });

  const bracais = [grupo(ossos.LeftForeArm), grupo(ossos.RightForeArm)];
  for (const b of bracais) peca(b, cilindro(0.068, 0.06, -0.08, -0.24, 7), ferro);

  const grevas = [grupo(ossos.LeftLeg), grupo(ossos.RightLeg)];
  for (const g of grevas) peca(g, cilindro(0.074, 0.068, -0.02, -0.17, 7), ferro, { pos: [0, 0, 0.012] });

  return { elmo, capa, cota, bracais, grevas, pano };
}
