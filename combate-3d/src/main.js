import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { criarPersonagem, PALETAS } from './rig.js';
import { criarClipes, GOLPES } from './poses.js';
import { Lutador } from './combate.js';
import { Faiscas, Rastro } from './efeitos.js';

// ---------- Cena ----------
const tela = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const cena = new THREE.Scene();
const corFundo = new THREE.Color(0x1d1d1f);
cena.background = corFundo;
cena.fog = new THREE.Fog(corFundo, 7, 14);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
const controles = new OrbitControls(camera, tela);
controles.enableDamping = true;
controles.minDistance = 2;
controles.maxDistance = 9;
controles.maxPolarAngle = Math.PI * 0.49;

const VISTA_COMBATE = { pos: [-3.6, 1.8, 3.4], alvo: [0, 0.95, 0.85] };
const VISTA_POSE_T = { pos: [0, 1.05, 4.6], alvo: [0, 0.95, 0] };
function irPara(vista) {
  camera.position.set(...vista.pos);
  controles.target.set(...vista.alvo);
  controles.update();
}
irPara(VISTA_COMBATE);

cena.add(new THREE.HemisphereLight(0xf2e8da, 0x5a4a3e, 1.5));
const sol = new THREE.DirectionalLight(0xfff0dc, 2.6);
sol.position.set(-3, 6, 4);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 15 });
sol.shadow.bias = -0.0005;
sol.shadow.normalBias = 0.02;
cena.add(sol);
const contraluz = new THREE.DirectionalLight(0x9fb4d6, 1.1);
contraluz.position.set(4, 3, -4);
cena.add(contraluz);

// Chão: disco com degradê radial que some no fundo.
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, '#3b3834');
  g.addColorStop(0.6, '#2a2826');
  g.addColorStop(1, '#1d1d1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const chao = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.z = 0.85;
  chao.receiveShadow = true;
  cena.add(chao);
}

// ---------- Personagens ----------
const clipes = criarClipes();

const heroiRig = criarPersonagem(PALETAS.heroi, 3);
cena.add(heroiRig.raiz);
const heroi = new Lutador(heroiRig, clipes);

const advRig = criarPersonagem(PALETAS.adversario, 11);
advRig.raiz.position.z = 1.75;
advRig.raiz.rotation.y = Math.PI;
cena.add(advRig.raiz);
const adversario = new Lutador(advRig, clipes);

const esqueleto = new THREE.SkeletonHelper(heroiRig.raiz);
esqueleto.material.depthTest = false;
esqueleto.material.linewidth = 2;
esqueleto.visible = false;
cena.add(esqueleto);

const faiscas = new Faiscas(cena);
const rastros = [
  [heroi, new Rastro(cena, heroiRig.espada.base, heroiRig.espada.ponta, 0xfff1c9)],
  [adversario, new Rastro(cena, advRig.espada.base, advRig.espada.ponta, 0xffb38a)],
];

// ---------- Interface ----------
const placar = { acertos: 0, defesas: 0, sofridos: 0 };
const elAviso = document.getElementById('aviso');
function atualizarPlacar() {
  document.getElementById('p-acertos').textContent = placar.acertos;
  document.getElementById('p-defesas').textContent = placar.defesas;
  document.getElementById('p-sofridos').textContent = placar.sofridos;
}
let avisoTimer;
function aviso(texto, tipo) {
  elAviso.textContent = texto;
  elAviso.className = `aviso aviso--${tipo}`;
  void elAviso.offsetWidth; // reinicia a animação
  elAviso.classList.add('aviso--ativo');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => elAviso.classList.remove('aviso--ativo'), 700);
}

let demo = false;
let modoPoseT = false;
const btnDemo = document.getElementById('btn-demo');
const btnEsqueleto = document.getElementById('btn-esqueleto');
const btnPoseT = document.getElementById('btn-poseT');

function setDemo(v) {
  demo = v;
  btnDemo.setAttribute('aria-pressed', String(v));
  if (!v) heroi.defender(false);
}
function entradaHumana() { if (demo) setDemo(false); }

btnDemo.addEventListener('click', () => setDemo(!demo));
btnEsqueleto.addEventListener('click', () => {
  esqueleto.visible = !esqueleto.visible;
  btnEsqueleto.setAttribute('aria-pressed', String(esqueleto.visible));
});
btnPoseT.addEventListener('click', () => {
  modoPoseT = !modoPoseT;
  btnPoseT.setAttribute('aria-pressed', String(modoPoseT));
  document.body.classList.toggle('pose-t', modoPoseT);
  heroi.defender(false);
  heroi.poseT(modoPoseT);
  advRig.raiz.visible = !modoPoseT;
  // Na pose T o herói fica sem espada e escudo, como na imagem de referência.
  heroiRig.espada.espada.visible = heroiRig.escudo.escudo.visible = !modoPoseT;
  if (!modoPoseT) { adversario.estado = 'guarda'; adversario.tocar('guarda'); }
  irPara(modoPoseT ? VISTA_POSE_T : VISTA_COMBATE);
});

const btnAtacar = document.getElementById('btn-atacar');
const btnDefender = document.getElementById('btn-defender');
btnAtacar.addEventListener('pointerdown', (e) => { e.preventDefault(); entradaHumana(); heroi.atacar(); });
const soltarDefesa = () => heroi.defender(false);
btnDefender.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  entradaHumana();
  btnDefender.setPointerCapture(e.pointerId);
  heroi.defender(true);
});
btnDefender.addEventListener('pointerup', soltarDefesa);
btnDefender.addEventListener('pointercancel', soltarDefesa);
for (const b of [btnAtacar, btnDefender]) b.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat || modoPoseT) return;
  if (e.code === 'KeyJ' || e.code === 'Space') { e.preventDefault(); entradaHumana(); heroi.atacar(); }
  if (e.code === 'KeyK' || e.key === 'Shift') { entradaHumana(); heroi.defender(true); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyK' || e.key === 'Shift') heroi.defender(false);
});
window.addEventListener('blur', soltarDefesa);

// ---------- Comportamento do adversário ----------
const ia = { espera: 1.6, defesa: 0, golpeVisto: 0 };

function pensarAdversario(dt) {
  if (ia.defesa > 0) {
    ia.defesa -= dt;
    if (ia.defesa <= 0) adversario.defender(false);
  }
  // Às vezes reage ao seu ataque levantando o escudo.
  if (heroi.estado === 'golpe' && heroi.idGolpe !== ia.golpeVisto) {
    ia.golpeVisto = heroi.idGolpe;
    if (adversario.estado === 'guarda' && Math.random() < 0.3) { adversario.defender(true); ia.defesa = 0.7; }
  }
  if (adversario.estado !== 'guarda') return;
  ia.espera -= dt;
  if (ia.espera > 0) return;
  ia.espera = 1.3 + Math.random() * 1.3;
  if (Math.random() < 0.72) adversario.iniciarGolpe('golpeInimigo');
  else { adversario.defender(true); ia.defesa = 0.8 + Math.random() * 0.6; }
}

// ---------- Modo demonstração (o herói luta sozinho) ----------
const demoIA = { espera: 0.6, golpesRestantes: 0, golpeInimigoVisto: 0, vaiDefender: false };
function pensarDemo(dt) {
  const inimigoAtacando = adversario.estado === 'golpe';
  if (inimigoAtacando) {
    if (adversario.idGolpe !== demoIA.golpeInimigoVisto) {
      demoIA.golpeInimigoVisto = adversario.idGolpe;
      demoIA.vaiDefender = Math.random() < 0.85;
    }
    if (demoIA.vaiDefender && adversario.tempo > 0.4) heroi.defender(true);
    return;
  }
  if (heroi.segurandoDefesa && adversario.estado !== 'defesaImpacto') heroi.defender(false);
  if (heroi.estado === 'golpe') {
    const g = GOLPES[heroi.golpe];
    if (demoIA.golpesRestantes > 0 && g.combo !== null && heroi.tempo >= g.combo - 0.05) {
      demoIA.golpesRestantes--;
      heroi.atacar();
    }
    return;
  }
  if (heroi.estado !== 'guarda') return;
  demoIA.espera -= dt;
  if (demoIA.espera <= 0) {
    demoIA.espera = 0.3 + Math.random() * 0.6;
    demoIA.golpesRestantes = Math.floor(Math.random() * 3);
    heroi.atacar();
  }
}

// ---------- Resolução dos golpes ----------
let tremor = 0;
const tmp = new THREE.Vector3();
function resolver(atacante, alvo, atacanteEhHeroi) {
  if (!atacante.golpeAtivo) return;
  atacante.acertou = true;
  const dano = GOLPES[atacante.golpe].dano;
  const resultado = alvo.receberGolpe();
  if (resultado === 'defendido') {
    alvo.rig.escudo.centro.getWorldPosition(tmp);
    faiscas.emitir(tmp, 0xffd27a, 36, 2.8);
    atacante.pausa = alvo.pausa = 0.08;
    tremor = Math.max(tremor, 0.035);
    if (atacanteEhHeroi) aviso('Bloqueado', 'neutro');
    else { placar.defesas++; aviso('Defendido!', 'bom'); }
  } else {
    atacante.rig.espada.ponta.getWorldPosition(tmp);
    const peito = alvo.rig.ossos.Spine1.getWorldPosition(new THREE.Vector3());
    tmp.lerp(peito, 0.5);
    faiscas.emitir(tmp, 0xff6a3d, 20 + dano * 10, 2 + dano);
    atacante.pausa = alvo.pausa = 0.06 + 0.03 * dano;
    tremor = Math.max(tremor, 0.04 * dano);
    if (atacanteEhHeroi) { placar.acertos++; aviso(dano > 1 ? 'Golpe pesado!' : 'Acertou!', 'bom'); }
    else { placar.sofridos++; aviso('Você levou um golpe', 'ruim'); }
  }
  atualizarPlacar();
}

// ---------- Laço principal ----------
function redimensionar() {
  const w = tela.clientWidth, h = tela.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Em tela estreita (celular em pé), afasta a câmera para caber os dois.
  camera.fov = w / h < 0.8 ? 55 : 38;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', redimensionar);
redimensionar();

const relogio = new THREE.Timer();
relogio.connect(document);
renderer.setAnimationLoop((t) => {
  relogio.update(t);
  // O primeiro quadro pode vir com tempo negativo; limita entre 0 e 1/20 s.
  const dt = THREE.MathUtils.clamp(relogio.getDelta(), 0, 1 / 20);

  if (!modoPoseT) {
    pensarAdversario(dt);
    if (demo) pensarDemo(dt);
  }
  heroi.update(dt);
  adversario.update(dt);
  if (!modoPoseT) {
    resolver(heroi, adversario, true);
    resolver(adversario, heroi, false);
  }

  // Aviso do golpe inimigo: a lâmina brilha enquanto ele prepara.
  const lam = advRig.espada.lamina.material;
  const preparando = adversario.estado === 'golpe' && adversario.golpe === 'golpeInimigo' && adversario.tempo > 0.25 && adversario.tempo < 0.76;
  lam.emissive.setRGB(preparando ? 0.9 + 0.3 * Math.sin(t * 0.03) : 0, preparando ? 0.35 : 0, 0);

  for (const [lutador, rastro] of rastros) rastro.update(lutador.rastroVisivel);
  faiscas.update(dt);
  controles.update();

  // Tremor de câmera: desloca só para este quadro.
  const desloc = new THREE.Vector3();
  if (tremor > 0) {
    desloc.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(tremor);
    tremor = Math.max(0, tremor - dt * 0.25);
  }
  camera.position.add(desloc);
  renderer.render(cena, camera);
  camera.position.sub(desloc);
});

// Para testes e para inspecionar no console do navegador.
window.jogo = { heroi, adversario, setDemo, cena, camera, controles };
