// Modelos em estilo de blocos, feitos a partir das folhas de referência (frente, perfil e costas)
// do guerreiro de cota de malha e do goblin. Usam os mesmos esqueletos dos modelos anteriores,
// então animações, IK, hitboxes e equipamentos continuam funcionando.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { aleatorio, construirEsqueleto, construirEspada, construirEscudo } from './rig.js';
import { OSSOS_GOBLIN, construirArma } from './arena/goblin.js';

// ---------------- Texturas pintadas em canvas ----------------
const cache = new Map();
function canvas(chave, tam, desenhar, repetir = null) {
  if (cache.has(chave)) return cache.get(chave);
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  desenhar(c.getContext('2d'), tam);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repetir); }
  cache.set(chave, t);
  return t;
}

function ruido(ctx, tam, forca, semente) {
  const rnd = aleatorio(semente);
  const img = ctx.getImageData(0, 0, tam, tam);
  for (let i = 0; i < img.data.length; i += 4) { const n = (rnd() - 0.5) * forca; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

// Cota de malha: anéis em fileiras desencontradas
const texMalha = () => canvas('malha', 128, (ctx, t) => {
  ctx.fillStyle = '#2c2e31'; ctx.fillRect(0, 0, t, t);
  const p = 8;
  for (let y = 0; y < t + p; y += p * 0.75) {
    for (let x = 0; x < t + p; x += p) {
      const dx = (Math.round(y / (p * 0.75)) % 2) * p / 2;
      ctx.strokeStyle = '#6d7076'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x + dx, y, p * 0.45, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#9a9ca0'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(x + dx, y, p * 0.45, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    }
  }
}, [3, 3]);

// Couro com manchas e borda costurada opcional
function texCouro(cor, chave, borda = null) {
  return canvas(`couro-${chave}`, 128, (ctx, t) => {
    ctx.fillStyle = cor; ctx.fillRect(0, 0, t, t);
    const rnd = aleatorio(chave.length * 7);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * t, y = rnd() * t, r = 6 + rnd() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rnd() > 0.5 ? 'rgba(255,230,200,0.08)' : 'rgba(0,0,0,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (borda) { ctx.strokeStyle = borda; ctx.lineWidth = 7; ctx.strokeRect(3, 3, t - 6, t - 6); }
    ruido(ctx, t, 14, chave.length);
  });
}

// Pano vermelho com barra dourada (tabardo e capa)
const texPano = () => canvas('pano', 128, (ctx, t) => {
  ctx.fillStyle = '#7a1f1c'; ctx.fillRect(0, 0, t, t);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < t; x += 6) ctx.fillRect(x, 0, 2, t);
  ctx.strokeStyle = '#b8863b'; ctx.lineWidth = 4; ctx.strokeRect(10, 6, t - 20, t - 12);
  ruido(ctx, t, 10, 3);
});

// Corda trançada (cinto do goblin)
const texCorda = () => canvas('corda', 64, (ctx, t) => {
  ctx.fillStyle = '#6b5135'; ctx.fillRect(0, 0, t, t);
  ctx.strokeStyle = '#3f2e1d'; ctx.lineWidth = 3;
  for (let x = -t; x < t * 2; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + t * 0.6, t); ctx.stroke(); }
}, [6, 1]);

// Pele do goblin com músculos marcados (peito e abdômen)
const texTroncoGoblin = () => canvas('troncoGoblin', 128, (ctx, t) => {
  ctx.fillStyle = '#6f7d3c'; ctx.fillRect(0, 0, t, t);
  ctx.strokeStyle = 'rgba(40,52,20,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(t / 2, 10); ctx.lineTo(t / 2, t - 10); ctx.stroke(); // linha do peito
  ctx.beginPath(); ctx.arc(t * 0.3, t * 0.38, t * 0.2, 0.1, Math.PI - 0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(t * 0.7, t * 0.38, t * 0.2, 0.3, Math.PI - 0.1); ctx.stroke();
  ruido(ctx, t, 10, 9);
});
const texAbdomenGoblin = () => canvas('abdGoblin', 128, (ctx, t) => {
  ctx.fillStyle = '#6c7a3a'; ctx.fillRect(0, 0, t, t);
  ctx.strokeStyle = 'rgba(40,52,20,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(t / 2, 0); ctx.lineTo(t / 2, t); ctx.stroke();
  for (const y of [t * 0.3, t * 0.62]) { ctx.beginPath(); ctx.moveTo(t * 0.28, y); ctx.lineTo(t * 0.72, y); ctx.stroke(); }
  ruido(ctx, t, 10, 10);
});

// Rosto do guerreiro: sobrancelhas grossas e franzidas, olhos escuros, nariz e boca
const texRostoHeroi = () => canvas('rostoHeroi', 256, (ctx, t) => {
  ctx.fillStyle = '#d59a6e'; ctx.fillRect(0, 0, t, t);
  // sombra do nariz e bochechas
  ctx.fillStyle = 'rgba(150,90,55,0.35)'; ctx.fillRect(t * 0.47, t * 0.48, t * 0.06, t * 0.16);
  // sobrancelhas (ponta de dentro mais baixa: expressão séria)
  ctx.fillStyle = '#3b2416';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(t / 2 + s * t * 0.06, t * 0.44); ctx.lineTo(t / 2 + s * t * 0.33, t * 0.36);
    ctx.lineTo(t / 2 + s * t * 0.34, t * 0.41); ctx.lineTo(t / 2 + s * t * 0.07, t * 0.49); ctx.closePath(); ctx.fill();
  }
  // olhos
  for (const s of [-1, 1]) {
    const cx = t / 2 + s * t * 0.19, cy = t * 0.53;
    ctx.fillStyle = '#efe6da'; ctx.fillRect(cx - t * 0.075, cy - t * 0.03, t * 0.15, t * 0.06);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(cx - t * 0.035 - s * t * 0.01, cy - t * 0.035, t * 0.07, t * 0.07);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - t * 0.02, cy - t * 0.025, t * 0.018, t * 0.018);
  }
  // boca
  ctx.fillStyle = '#7a3f2e'; ctx.fillRect(t * 0.42, t * 0.78, t * 0.16, t * 0.025);
});

// Rosto do goblin: sobrancelhas franzidas, órbitas escuras, boca aberta com dentes
const texRostoGoblin = (pele) => canvas(`rostoGoblin-${pele}`, 256, (ctx, t) => {
  ctx.fillStyle = pele; ctx.fillRect(0, 0, t, t);
  ctx.fillStyle = 'rgba(35,45,15,0.55)'; // órbitas
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(t / 2 + s * t * 0.2, t * 0.45, t * 0.11, t * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#2f3a12'; // sobrancelhas
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(t / 2 + s * t * 0.05, t * 0.42); ctx.lineTo(t / 2 + s * t * 0.34, t * 0.3);
    ctx.lineTo(t / 2 + s * t * 0.35, t * 0.36); ctx.lineTo(t / 2 + s * t * 0.06, t * 0.48); ctx.closePath(); ctx.fill();
  }
  // rugas da testa
  ctx.strokeStyle = 'rgba(35,45,15,0.5)'; ctx.lineWidth = 3;
  for (const y of [t * 0.18, t * 0.24]) { ctx.beginPath(); ctx.moveTo(t * 0.36, y); ctx.lineTo(t * 0.64, y); ctx.stroke(); }
  // boca aberta
  ctx.fillStyle = '#2a0e0a';
  ctx.beginPath(); ctx.moveTo(t * 0.2, t * 0.68); ctx.lineTo(t * 0.8, t * 0.68); ctx.lineTo(t * 0.72, t * 0.86); ctx.lineTo(t * 0.28, t * 0.86); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e9e1c4'; // dentes de cima e de baixo
  for (let i = 0; i < 6; i++) {
    const x = t * (0.24 + i * 0.09);
    ctx.beginPath(); ctx.moveTo(x, t * 0.68); ctx.lineTo(x + t * 0.07, t * 0.68); ctx.lineTo(x + t * 0.035, t * 0.76); ctx.fill();
  }
  for (let i = 0; i < 5; i++) {
    const x = t * (0.3 + i * 0.085);
    ctx.beginPath(); ctx.moveTo(x, t * 0.86); ctx.lineTo(x + t * 0.065, t * 0.86); ctx.lineTo(x + t * 0.032, t * 0.79); ctx.fill();
  }
  ruido(ctx, t, 8, 12);
});

// ---------------- Peças ----------------
const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.9, flatShading: true, ...extra });
const matTex = (tex, extra = {}) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, ...extra });

// Bloco de cantos arredondados preso a um osso. pos = centro, em metros, no espaço do osso.
function bloco(osso, [w, h, d], material, pos = [0, 0, 0], rot = [0, 0, 0], raio = 0.018) {
  const r = Math.min(raio, w / 2.2, h / 2.2, d / 2.2);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.castShadow = m.receiveShadow = true;
  osso.add(m);
  return m;
}
// Bloco do topo (y = topo) até a base (y = base), centralizado em x/z
const coluna = (osso, w, d, topo, base, material, x = 0, z = 0, raio) => bloco(osso, [w, topo - base, d], material, [x, (topo + base) / 2, z], [0, 0, 0], raio);

// Placa recortada (tanga, pele de bicho, abas): polígono no plano XY extrudado em Z
function placa(osso, pontos, espessura, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const forma = new THREE.Shape(pontos.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(forma, { depth: espessura, bevelEnabled: false });
  g.translate(0, 0, -espessura / 2);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.castShadow = m.receiveShadow = true;
  osso.add(m);
  return m;
}
// Borda inferior serrilhada (pontas de comprimentos diferentes)
function serrilhado(largura, altura, pontas, semente, fundo = 0.08) {
  const rnd = aleatorio(semente);
  const pts = [[-largura / 2, 0], [largura / 2, 0]];
  for (let i = pontas; i >= 0; i--) {
    const x = -largura / 2 + (largura * i) / pontas;
    pts.push([x, -altura - (i % 2 ? rnd() * fundo : 0)]);
    if (i > 0) pts.push([x - largura / pontas / 2, -altura + fundo * 0.6 + rnd() * 0.02]);
  }
  return pts;
}

// Cabeça em bloco com textura de rosto só na frente
function cabeca(osso, [w, h, d], texRosto, corPele, pos) {
  const pele = mat(corPele);
  const rosto = matTex(texRosto);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [pele, pele, pele, pele, rosto, pele]);
  m.position.set(...pos);
  m.castShadow = m.receiveShadow = true;
  osso.add(m);
  return m;
}

// ---------------- Guerreiro de cota de malha ----------------
export function criarHeroiBloco(semente = 4) {
  const M = {
    pele: mat(0xd59a6e), malha: matTex(texMalha(), { metalness: 0.5, roughness: 0.6 }),
    couro: matTex(texCouro('#4a3020', 'couro')), couroEscuro: matTex(texCouro('#2f2622', 'couroEsc', '#5b3a24')),
    calca: mat(0x2f2a27), bota: matTex(texCouro('#5a3a24', 'bota')), botaFaixa: mat(0x3e2818),
    pano: matTex(texPano(), { side: THREE.DoubleSide }), panoLiso: mat(0x7a1f1c, { side: THREE.DoubleSide }),
    cabelo: mat(0x3c2416), cabeloClaro: mat(0x4e301d), barba: mat(0x3a2416), metal: mat(0x9a9590, { metalness: 0.7, roughness: 0.4 }),
    bronze: mat(0x8a6a3a, { metalness: 0.6, roughness: 0.45 }),
  };
  const raiz = new THREE.Group();
  const ossos = construirEsqueleto();
  raiz.add(ossos.Hips);
  const O = ossos;

  // Tronco de cota de malha, cinto, alça diagonal
  coluna(O.Spine1, 0.52, 0.3, 0.26, -0.03, M.malha, 0, 0, 0.04);
  coluna(O.Spine, 0.48, 0.28, 0.22, -0.04, M.malha, 0, 0, 0.03);
  coluna(O.Hips, 0.48, 0.28, 0.09, -0.06, M.calca);
  bloco(O.Hips, [0.51, 0.075, 0.31], M.couro, [0, 0.05, 0]);
  bloco(O.Hips, [0.075, 0.06, 0.02], M.metal, [0, 0.05, 0.16]); // fivela
  bloco(O.Hips, [0.035, 0.03, 0.025], M.couro, [0, 0.05, 0.165]);
  bloco(O.Spine1, [0.05, 0.55, 0.02], M.couro, [-0.03, 0.06, 0.158], [0, 0, -0.55]); // alça diagonal no peito
  bloco(O.Spine1, [0.05, 0.53, 0.02], M.couro, [-0.03, 0.06, -0.158], [0, 0, 0.55]);
  // Capa vermelha sobre os ombros, caindo em diagonal na frente (ombro direito) e cobrindo as costas
  bloco(O.Spine1, [0.56, 0.065, 0.34], M.panoLiso, [0, 0.265, 0], [0, 0, 0.05]);
  placa(O.Spine1, [[-0.28, 0.29], [0.07, 0.29], [-0.02, 0.12], [-0.13, 0.0], [-0.28, -0.07]], 0.02, M.pano, [0, 0, 0.162]);
  placa(O.Spine1, [[-0.28, 0.29], [0.28, 0.29], [0.28, 0.08], [0.0, -0.07], [-0.28, -0.14]], 0.02, M.pano, [0, 0, -0.165]);
  const broche = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), M.bronze);
  broche.rotation.x = Math.PI / 2; broche.position.set(-0.17, 0.2, 0.18); O.Spine1.add(broche);
  bloco(O.Spine1, [0.03, 0.03, 0.015], M.metal, [-0.17, 0.2, 0.193], [0, 0, Math.PI / 4]);
  // Túnica de couro: abas que seguem as coxas (não atravessam as pernas) e tabardo vermelho
  for (const [lado, x] of [['Left', 1], ['Right', -1]]) {
    const coxa = O[`${lado}UpLeg`];
    bloco(coxa, [0.24, 0.36, 0.025], M.couroEscuro, [x * 0.02, -0.12, 0.14]);
    bloco(coxa, [0.24, 0.36, 0.025], M.couroEscuro, [x * 0.02, -0.12, -0.14]);
    bloco(coxa, [0.025, 0.34, 0.27], M.couroEscuro, [x * 0.135, -0.11, 0]);
  }
  placa(O.Hips, [[-0.07, 0.02], [0.07, 0.02], [0.07, -0.42], [0, -0.48], [-0.07, -0.42]], 0.018, M.pano, [0, 0, 0.185]);
  placa(O.Hips, [[-0.07, 0.02], [0.07, 0.02], [0.07, -0.42], [0, -0.48], [-0.07, -0.42]], 0.018, M.pano, [0, 0, -0.185]);
  // Pescoço e cabeça
  coluna(O.Neck, 0.13, 0.13, 0.1, -0.02, M.pele);
  cabeca(O.Head, [0.33, 0.33, 0.31], texRostoHeroi(), 0xd59a6e, [0, 0.17, 0.01]);
  // Barba curta, costeletas e bigode
  bloco(O.Head, [0.33, 0.09, 0.07], M.barba, [0, 0.04, 0.14]);
  for (const s of [-1, 1]) bloco(O.Head, [0.035, 0.16, 0.22], M.barba, [s * 0.16, 0.085, 0.06]);
  bloco(O.Head, [0.14, 0.032, 0.03], M.barba, [0, 0.09, 0.17]);
  bloco(O.Head, [0.055, 0.06, 0.035], M.pele, [0, 0.13, 0.17]); // nariz
  // Base do cabelo (calota) por baixo dos cachos
  bloco(O.Head, [0.37, 0.13, 0.36], M.cabelo, [0, 0.33, -0.01], [0, 0, 0], 0.05);
  bloco(O.Head, [0.37, 0.24, 0.12], M.cabelo, [0, 0.22, -0.13], [0, 0, 0], 0.04);
  // Cabelo cacheado volumoso: tufos irregulares em cima, dos lados e atrás
  const rnd = aleatorio(semente + 31);
  for (let i = 0; i < 95; i++) {
    const teta = rnd() * Math.PI * 2, fi = rnd() * Math.PI * 0.62;
    const dir = new THREE.Vector3(Math.sin(fi) * Math.sin(teta), Math.cos(fi), Math.sin(fi) * Math.cos(teta));
    const frente = dir.z > 0.35;
    if (frente && dir.y < 0.62) continue; // deixa a testa e o rosto livres
    const r = 0.07 + rnd() * 0.045;
    const tufo = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rnd() > 0.35 ? M.cabelo : M.cabeloClaro);
    tufo.position.set(dir.x * 0.2, 0.24 + dir.y * 0.15, -0.01 + dir.z * 0.19);
    tufo.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    tufo.castShadow = true;
    O.Head.add(tufo);
  }
  for (let i = 0; i < 9; i++) { // nuca e laterais mais baixas
    const lado = i < 3 ? -1 : i < 6 ? 1 : 0;
    const tufo = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), M.cabelo);
    tufo.position.set(lado ? lado * 0.19 : (i - 7) * 0.1, 0.14 + (i % 3) * 0.06, lado ? -0.03 - (i % 3) * 0.04 : -0.18);
    tufo.rotation.set(i, i * 2, i * 3);
    O.Head.add(tufo);
  }
  // Braços: ombro e braço de cota, antebraço de couro com faixas, mão em bloco
  for (const lado of ['Left', 'Right']) {
    bloco(O[`${lado}Arm`], [0.22, 0.13, 0.23], M.malha, [0, -0.02, 0], [0, 0, 0], 0.03);
    coluna(O[`${lado}Arm`], 0.2, 0.21, 0.0, -0.3, M.malha);
    coluna(O[`${lado}ForeArm`], 0.195, 0.205, 0.02, -0.26, M.couro);
    for (const y of [-0.06, -0.2]) bloco(O[`${lado}ForeArm`], [0.21, 0.045, 0.22], M.botaFaixa, [0, y, 0]);
    bloco(O[`${lado}Hand`], [0.15, 0.13, 0.16], M.pele, [0, -0.055, 0]);
  }
  // Pernas: calça escura, botas largas com faixas
  for (const lado of ['Left', 'Right']) {
    coluna(O[`${lado}UpLeg`], 0.21, 0.22, 0.03, -0.44, M.calca);
    coluna(O[`${lado}Leg`], 0.2, 0.21, 0.02, -0.18, M.calca);
    coluna(O[`${lado}Leg`], 0.23, 0.25, -0.15, -0.42, M.bota);
    for (const y of [-0.18, -0.29]) bloco(O[`${lado}Leg`], [0.245, 0.05, 0.265], M.botaFaixa, [0, y, 0]);
    bloco(O[`${lado}Foot`], [0.23, 0.09, 0.32], M.bota, [0, -0.045, 0.06]);
    bloco(O[`${lado}Foot`], [0.24, 0.025, 0.33], M.botaFaixa, [0, -0.085, 0.06]);
  }

  const espada = construirEspada(O.RightHand);
  espada.espada.position.set(0, -0.055, 0);
  const escudo = construirEscudo(O.LeftForeArm, 0.3, 0.135);
  const visual = equipamentoBloco(O);
  raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { raiz, ossos, espada, escudo, visual, materiais: M, estilo: 'bloco' };
}

// Peças de equipamento opcionais (escondidas) no tamanho do modelo em blocos
function equipamentoBloco(O) {
  const ferro = mat(0x8a8781, { metalness: 0.75, roughness: 0.42 });
  const pano = mat(0x5b2620, { side: THREE.DoubleSide });
  const grupo = (osso) => { const g = new THREE.Group(); g.visible = false; osso.add(g); return g; };
  const elmo = grupo(O.Head);
  bloco(elmo, [0.4, 0.17, 0.39], ferro, [0, 0.32, -0.005], [0, 0, 0], 0.05);
  bloco(elmo, [0.42, 0.04, 0.41], ferro, [0, 0.24, -0.005]);
  bloco(elmo, [0.035, 0.12, 0.03], ferro, [0, 0.19, 0.2]);
  const capa = grupo(O.Spine1);
  bloco(capa, [0.46, 0.85, 0.02], pano, [0, -0.15, -0.165], [0.1, 0, 0]);
  const cota = grupo(O.Spine1); // peitoral de aço por cima da malha
  bloco(cota, [0.4, 0.28, 0.04], ferro, [0, 0.08, 0.15]);
  const bracais = ['Left', 'Right'].map((l) => { const g = grupo(O[`${l}ForeArm`]); bloco(g, [0.19, 0.16, 0.2], ferro, [0, -0.13, 0]); return g; });
  const grevas = ['Left', 'Right'].map((l) => { const g = grupo(O[`${l}Leg`]); bloco(g, [0.2, 0.18, 0.06], ferro, [0, -0.08, 0.1]); return g; });
  return { elmo, capa, cota, bracais, grevas, pano };
}

// ---------------- Goblin em blocos ----------------
const PELES = { goblin: '#6f7d3c', batedor: '#7f8a44', escudeiro: '#66733a', bruto: '#56622f' };

export function criarGoblinBloco(tipo = 'goblin', semente = 21) {
  const corPele = PELES[tipo] || PELES.goblin;
  const M = {
    pele: mat(new THREE.Color(corPele)), tronco: matTex(texTroncoGoblin()), abdomen: matTex(texAbdomenGoblin()),
    faixa: mat(0x3d2a1c), pelo: matTex(texCouro('#4e3423', 'peloGob'), { side: THREE.DoubleSide }),
    corda: matTex(texCorda()), unha: mat(0x262619),
  };
  // Variantes: tingem as texturas de pele (pintadas no verde do goblin comum) com a cor da variante
  const base = new THREE.Color(PELES.goblin), alvo = new THREE.Color(corPele);
  for (const m of [M.tronco, M.abdomen]) m.color.setRGB(alvo.r / base.r, alvo.g / base.g, alvo.b / base.b);
  const raiz = new THREE.Group();
  const ossos = construirEsqueleto(OSSOS_GOBLIN);
  raiz.add(ossos.Hips);
  const O = ossos;

  // Tronco musculoso
  coluna(O.Spine1, 0.37, 0.22, 0.17, -0.02, M.tronco, 0, 0, 0.03);
  coluna(O.Spine, 0.31 * (tipo === 'bruto' ? 1.12 : 1), 0.21 * (tipo === 'bruto' ? 1.15 : 1), 0.15, -0.03, M.abdomen, 0, 0, 0.025);
  coluna(O.Hips, 0.32, 0.22, 0.06, -0.06, M.pele);
  // Cinto de corda e tanga rasgada (abas presas às coxas para não atravessarem as pernas)
  bloco(O.Hips, [0.34, 0.055, 0.24], M.corda, [0, 0.05, 0], [0, 0, 0], 0.02);
  for (const [lado, x] of [['Left', 1], ['Right', -1]]) {
    const coxa = O[`${lado}UpLeg`];
    placa(coxa, serrilhado(0.16, 0.24, 4, semente + x * 3), 0.015, M.pelo, [x * 0.01, 0.06, 0.1]);
    placa(coxa, serrilhado(0.16, 0.26, 4, semente + x * 5), 0.015, M.pelo, [x * 0.01, 0.06, -0.1]);
    placa(coxa, serrilhado(0.17, 0.22, 3, semente + x * 7), 0.015, M.pelo, [x * 0.085, 0.06, 0], [0, Math.PI / 2, 0]);
  }
  // Pele de bicho sobre o ombro direito (frente e costas)
  placa(O.Spine1, [[-0.2, 0.2], [0.02, 0.2], ...serrilhado(0.22, 0.2, 4, semente + 11).slice(2).map(([x, y]) => [x - 0.09, y + 0.2])], 0.02, M.pelo, [0, 0, 0.11], [0, 0, -0.25]);
  placa(O.Spine1, [[-0.2, 0.2], [0.02, 0.2], ...serrilhado(0.22, 0.24, 4, semente + 13).slice(2).map(([x, y]) => [x - 0.09, y + 0.2])], 0.02, M.pelo, [0, 0, -0.11], [0, 0, 0.2]);
  bloco(O.Spine1, [0.13, 0.05, 0.23], M.pelo, [-0.12, 0.18, 0], [0, 0, 0.3]);
  // Cabeça grande, orelhas largas e pontudas, nariz e olhos que brilham no aviso de golpe
  coluna(O.Neck, 0.1, 0.1, 0.08, -0.02, M.pele);
  cabeca(O.Head, [0.29, 0.29, 0.26], texRostoGoblin(corPele), corPele, [0, 0.15, 0.02]);
  bloco(O.Head, [0.05, 0.07, 0.05], M.pele, [0, 0.13, 0.16], [0.3, 0, 0]); // nariz
  bloco(O.Head, [0.3, 0.06, 0.08], M.pele, [0, 0.235, 0.09]); // testa saliente
  for (const s of [-1, 1]) {
    const orelha = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 4), M.pele);
    orelha.scale.set(1, 1, 0.35);
    orelha.rotation.set(0, 0, -s * (Math.PI / 2 - 0.25));
    orelha.position.set(s * 0.24, 0.17, 0);
    orelha.castShadow = true;
    O.Head.add(orelha);
  }
  const olhoMat = new THREE.MeshStandardMaterial({ color: 0xe0a640, emissive: 0xffa020, emissiveIntensity: 1.6, flatShading: true });
  M.olhos = olhoMat;
  for (const s of [-1, 1]) bloco(O.Head, [0.05, 0.03, 0.01], olhoMat, [s * 0.055, 0.145, 0.146], [0, 0, s * 0.2], 0.004);
  // Braços grossos com faixas, mãos com garras
  for (const lado of ['Left', 'Right']) {
    coluna(O[`${lado}Arm`], 0.15, 0.15, 0.03, -0.22, M.pele);
    coluna(O[`${lado}ForeArm`], 0.14, 0.14, 0.01, -0.19, M.pele);
    for (const y of [-0.07, -0.13]) bloco(O[`${lado}ForeArm`], [0.15, 0.03, 0.15], M.faixa, [0, y, 0]);
    bloco(O[`${lado}Hand`], [0.11, 0.1, 0.11], M.pele, [0, -0.045, 0]);
    if (tipo === 'goblin' || lado === 'Left') for (const dz of [-0.03, 0, 0.03]) {
      const unha = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 4), M.unha);
      unha.rotation.x = Math.PI; unha.position.set(0, -0.1, dz); O[`${lado}Hand`].add(unha);
    }
  }
  // Pernas com faixas nas canelas e pés descalços grandes
  for (const lado of ['Left', 'Right']) {
    coluna(O[`${lado}UpLeg`], 0.16, 0.16, 0.03, -0.29, M.pele);
    coluna(O[`${lado}Leg`], 0.145, 0.15, 0.01, -0.27, M.pele);
    for (const y of [-0.11, -0.17]) bloco(O[`${lado}Leg`], [0.155, 0.035, 0.16], M.faixa, [0, y, 0]);
    bloco(O[`${lado}Foot`], [0.155, 0.06, 0.23], M.pele, [0, -0.03, 0.045]);
    for (const dx of [-0.04, 0, 0.04]) bloco(O[`${lado}Foot`], [0.035, 0.035, 0.04], M.pele, [dx, -0.04, 0.165], [0, 0, 0], 0.01);
  }

  const tipoArma = { goblin: 'garra', batedor: 'adaga', escudeiro: 'lanca', bruto: 'clava' }[tipo];
  const arma = construirArma(O.RightHand, tipoArma);
  const garraEsq = construirArma(O.LeftHand, 'garra');
  let escudo = null;
  if (tipo === 'escudeiro') {
    escudo = construirEscudo(O.LeftForeArm, 0.2, 0.08);
    bloco(O.Head, [0.29, 0.1, 0.28], M.faixa, [0, 0.26, 0.01], [0, 0, 0], 0.04); // capuz de couro
  }
  const boca = new THREE.Object3D();
  boca.position.set(0, 0.06, 0.14);
  O.Head.add(boca);
  if (tipo === 'batedor') raiz.scale.setScalar(0.92);
  if (tipo === 'bruto') raiz.scale.setScalar(2.1);
  raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { raiz, ossos, arma, garraEsq, escudo, boca, materiais: M, tipo, tipoArma, estilo: 'bloco' };
}
