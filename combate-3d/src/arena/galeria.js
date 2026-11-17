// Galeria: mostra os goblins, o morcego e o herói lado a lado, com as animações de cada um.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { criarGoblin, criarMorcego } from './goblin.js';
import { criarClipesGoblin } from './animGoblin.js';
import { criarPersonagem } from '../rig.js';
import { criarClipesGuerreiro } from './animGuerreiro.js';

const tela = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x1d1d1f);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
const controles = new OrbitControls(camera, tela);
camera.position.set(0, 1.6, 7.5);
controles.target.set(0, 0.9, 0);
cena.add(new THREE.HemisphereLight(0xf2e8da, 0x5a4a3e, 1.5));
const sol = new THREE.DirectionalLight(0xfff0dc, 2.4);
sol.position.set(-3, 6, 5);
sol.castShadow = true;
Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 5, bottom: -2 });
cena.add(sol);
const chao = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 1 }));
chao.rotation.x = -Math.PI / 2;
chao.receiveShadow = true;
cena.add(chao);

const modelos = [];
function adicionar(rig, clipes, x) {
  rig.raiz.position.x = x;
  cena.add(rig.raiz);
  const mixer = new THREE.AnimationMixer(rig.raiz);
  modelos.push({ rig, clipes, mixer });
}

const so = new URLSearchParams(location.search).get('so'); // ?so=heroi ou ?so=goblin
const clipesPorArma = {};
const tipos = [['goblin', -3.4], ['batedor', -2.1], ['escudeiro', -0.8], ['bruto', 1.6]];
for (const [tipo, x] of so && so !== 'goblins' ? tipos.filter(([t]) => t === so) : so === 'heroi' ? [] : tipos) {
  const g = criarGoblin(tipo, 21 + x * 10);
  clipesPorArma[g.tipoArma] ||= criarClipesGoblin(g.tipoArma);
  adicionar(g, clipesPorArma[g.tipoArma], x);
}
const heroi = criarPersonagem();
if (!so || so === 'heroi') adicionar(heroi, criarClipesGuerreiro(), so === 'heroi' ? 0 : 3.6);
const morcego = criarMorcego();
morcego.raiz.position.set(0.4, 2.6, 0);
if (!so) cena.add(morcego.raiz);

function tocar(nome) {
  for (const m of modelos) {
    m.mixer.stopAllAction();
    const clip = m.clipes[nome] || m.clipes.guarda;
    m.mixer.clipAction(clip).reset().play();
  }
}
const nomes = new Set();
for (const m of modelos) Object.keys(m.clipes).forEach((n) => nomes.add(n));
const botoes = document.getElementById('botoes');
for (const n of nomes) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.type = 'button';
  b.textContent = n;
  b.addEventListener('click', () => tocar(n));
  botoes.appendChild(b);
}
tocar(new URLSearchParams(location.search).get('anim') || 'poseT');

function redimensionar() {
  renderer.setSize(tela.clientWidth, tela.clientHeight, false);
  camera.aspect = tela.clientWidth / tela.clientHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();
const relogio = new THREE.Timer();
renderer.setAnimationLoop((t) => {
  relogio.update(t);
  const dt = THREE.MathUtils.clamp(relogio.getDelta(), 0, 0.05);
  for (const m of modelos) m.mixer.update(dt);
  const f = t * 0.012;
  for (const a of morcego.asas) { a.ombro.rotation.z = a.lado * Math.sin(f) * 0.6; a.ponta.rotation.z = a.lado * Math.sin(f - 0.8) * 0.5; }
  morcego.raiz.position.y = 2.6 + Math.sin(f) * 0.08;
  controles.update();
  renderer.render(cena, camera);
});
window.galeria = { tocar, modelos, camera, controles };
