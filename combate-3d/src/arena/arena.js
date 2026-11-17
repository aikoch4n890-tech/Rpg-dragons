// Arena do Guerreiro: combate automático contra ondas de monstros de teste.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';
import { Mundo } from './mundo.js';
import { separarCorpos } from './corpo.js';
import { criarClipesGuerreiro } from './animGuerreiro.js';
import { criarClipesGoblin } from './animGoblin.js';
import { Guerreiro } from './guerreiro.js';
import { IAGuerreiro } from './iaGuerreiro.js';
import { Inimigo, Morcego } from './inimigos.js';
import { Progresso } from './progressao.js';
import { EfeitosArena } from './efeitosArena.js';
import { Audio } from './audio.js';
import { HUD } from './hud.js';
import { Menu } from './menu.js';

// ---------- Renderização ----------
const tela = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const cena = new THREE.Scene();
const fundo = new THREE.Color(0x1d1d1f);
cena.background = fundo;
cena.fog = new THREE.Fog(fundo, 18, 34);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
const controles = new OrbitControls(camera, tela);
controles.enableDamping = true;
controles.maxPolarAngle = Math.PI * 0.47;
controles.minDistance = 2.5;
controles.maxDistance = 22;
cena.add(new THREE.HemisphereLight(0xf2e8da, 0x5a4a3e, 1.4));
const sol = new THREE.DirectionalLight(0xfff0dc, 2.5);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sol.shadow.bias = -0.0006;
sol.shadow.normalBias = 0.03;
cena.add(sol, sol.target);
const contraluz = new THREE.DirectionalLight(0x9fb4d6, 0.9);
contraluz.position.set(6, 5, -8);
cena.add(contraluz);

// ---------- Sistemas ----------
const progresso = new Progresso();
const audio = new Audio(() => progresso.dados.config.volume);
const mundo = new Mundo(cena);
const camadaDom = document.getElementById('camada');
const efeitos = new EfeitosArena(cena, camera, camadaDom);
const clipesHeroi = criarClipesGuerreiro();
const cacheGoblin = {};
const clipesGoblin = (arma) => (cacheGoblin[arma] ||= criarClipesGoblin(arma));

const inimigos = [];
const projeteis = [];
const controle = { atacando: new Set(), maxAtacantes: 2 };
// Contadores para os testes automatizados (e para conferir o comportamento no console)
const placar = { acertos: 0, bloqueados: 0, perfeitos: 0, sofridos: 0, guardasQuebradas: 0, reacoes: {}, eventos: {} };
let tremor = 0;
let pausaGolpe = 0;
let velocidadeJogo = 1;

const ctx = {
  cena, mundo, efeitos, audio, progresso, controle,
  clipes: clipesHeroi,
  clipesGoblin,
  inimigos: () => inimigos,
  projeteis: () => projeteis,
  tremer: (v) => { tremor = Math.max(tremor, Math.min(v, 0.07)); }, // tremor limitado: não atrapalha o combate
  evento: (tipo, dado) => { placar.eventos[tipo] = (placar.eventos[tipo] || 0) + 1; hud.evento(tipo, dado); },
  heroiSolto: () => heroi.soltarAgarrao(),
  lancarPedra,
  aoAcertar(h, inimigo, res, ponto, golpe) {
    const forte = golpe.dano >= 1.8 || res.reacao === 'derrubado' || res.reacao === 'lancado';
    placar.acertos++;
    if (res.quebrouGuarda) placar.guardasQuebradas++;
    const chave = `${inimigo.tipo}:${res.reacao}`;
    placar.reacoes[chave] = (placar.reacoes[chave] || 0) + 1;
    if (res.bloqueado) { efeitos.metal(ponto); audio.tocar('bloqueio'); efeitos.numero(ponto, res.dano, 'bloqueado'); }
    else if (res.quebrouGuarda) { efeitos.metal(ponto, true); audio.tocar('bloqueio'); efeitos.numero(ponto, 'Guarda quebrada', 'info'); }
    else {
      if (golpe.fonte === 'escudo' || golpe.fonte === 'corpo') { efeitos.metal(ponto); audio.tocar('bloqueio'); }
      else { efeitos.sangue(ponto, forte); audio.tocar(inimigo.tipo === 'escudeiro' ? 'impactoArmadura' : 'impactoCarne'); }
      efeitos.numero(ponto, res.dano, res.fraca ? 'critico' : 'dano');
    }
    pausaGolpe = Math.max(pausaGolpe, forte ? 0.08 : 0.045);
    if (forte) { tremor = Math.max(tremor, 0.04); foco = 0.35; }
    if (res.morreu) aoMatar(inimigo);
  },
  aoDefender(h, g, tipo) {
    const p = h.rig.escudo.centro.getWorldPosition(new THREE.Vector3());
    if (tipo === 'perfeito') placar.perfeitos++; else placar.bloqueados++;
    if (tipo === 'perfeito') {
      efeitos.clarao(p); efeitos.metal(p, true); audio.tocar('perfeito');
      pausaGolpe = 0.12; tremor = Math.max(tremor, 0.03); foco = 0.45;
      hud.evento('perfeito');
    } else {
      efeitos.metal(p); audio.tocar('bloqueio');
      pausaGolpe = Math.max(pausaGolpe, 0.05);
    }
  },
  aoSerAtingido(h, g, dano) {
    placar.sofridos++;
    efeitos.sangue(g.ponto || h.centro);
    efeitos.numero(g.ponto || h.centro, dano, 'sofrido');
    audio.tocar('impactoCarne');
    tremor = Math.max(tremor, 0.03 + Math.min(0.04, dano / 600));
    pausaGolpe = Math.max(pausaGolpe, 0.05);
  },
};

const heroi = new Guerreiro(ctx);
const ia = new IAGuerreiro(heroi, ctx);
const hud = new HUD(heroi, progresso, ia, () => inimigos);
efeitos.rastro(heroi.rig.espada.base, heroi.rig.espada.ponta, 0xfff1c9,
  () => heroi.estado === 'acao' && !!heroi.acao?.fase?.hits?.some((h) => heroi.acao.t >= h.t0 - 0.05 && heroi.acao.t <= h.t1 + 0.04));

function aoMatar(inimigo) {
  const r = progresso.ganhar(inimigo.def.xp, inimigo.def.dp);
  progresso.dados.estatisticas.abates++;
  hud.evento('abate', { nome: inimigo.nome, xp: inimigo.def.xp, dp: inimigo.def.dp });
  if (r.subiuNivel) { hud.evento('nivel', progresso.dados.nivel); audio.tocar('nivel'); heroi.aplicarEquipamento(); }
  if (r.subiuRank) { hud.evento('rank', progresso.rank); audio.tocar('nivel'); }
}

// ---------- Projéteis (pedras) ----------
let idPedra = 1;
const geoPedra = new THREE.DodecahedronGeometry(0.09, 0);
const matPedra = new THREE.MeshStandardMaterial({ color: 0x7a7268, flatShading: true });
function lancarPedra(dono, origem, alvo, atq) {
  const destino = alvo.centro.clone();
  const dist = origem.distanceTo(destino);
  const vel = 13;
  const t = dist / vel;
  const v = new THREE.Vector3().subVectors(destino, origem).divideScalar(t);
  v.y += 0.5 * 6 * t; // compensa a gravidade leve
  const m = new THREE.Mesh(geoPedra, matPedra);
  m.position.copy(origem);
  m.castShadow = true;
  cena.add(m);
  projeteis.push({ id: idPedra++, dono, pos: m.position, vel: v, m, atq, vida: 3 });
}

function atualizarProjeteis(dt) {
  for (const p of projeteis) {
    p.vel.y -= 6 * dt;
    p.pos.addScaledVector(p.vel, dt);
    p.m.rotation.x += dt * 8;
    p.vida -= dt;
    if (heroi.vivo && !p.acertou) {
      const hit = heroi.partes.esferaAtingida(p.pos, 0.1);
      const escudo = heroi.rig.escudo.centro.getWorldPosition(new THREE.Vector3());
      if (hit || (heroi.guardaAtiva && p.pos.distanceTo(escudo) < 0.4)) {
        p.acertou = true;
        p.vida = 0;
        const r = heroi.receberGolpe({ atacante: p.dono, forca: p.dono.def.forca, mult: p.atq.mult, stagger: p.atq.stagger, tipo: 'projetil', bloqueavel: true, origem: p.pos.clone().sub(p.vel.clone().setLength(2)), ponto: p.pos.clone() });
        if (r === 'perfeito') efeitos.numero(p.pos, 'Rebatida', 'info');
      }
    }
    if (p.pos.y < 0.05) p.vida = 0;
  }
  for (let i = projeteis.length - 1; i >= 0; i--) if (projeteis[i].vida <= 0) { cena.remove(projeteis[i].m); projeteis.splice(i, 1); }
}

// ---------- Ondas de teste ----------
const ONDAS = [
  ['goblin', 'goblin'],
  ['goblin', 'batedorPlataforma'],
  ['escudeiro', 'goblin'],
  ['morcego', 'goblin', 'goblin'],
  ['bruto'],
  ['escudeiro', 'batedor', 'goblin', 'goblin', 'morcego'],
];
let onda = 0;
let ondasAutomaticas = true;
let esperaOnda = 2;

function posicaoLivre(raioMin = 8, raioMax = 12) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = raioMin + Math.random() * (raioMax - raioMin);
    const x = heroi.corpo.pos.x * 0.3 + Math.cos(a) * r, z = heroi.corpo.pos.z * 0.3 + Math.sin(a) * r;
    if (Math.hypot(x, z) > CONFIG.arena.raio - 1.5) continue;
    if (mundo.obstaculos.some((o) => mundo.dentro(o, x, z, 1))) continue;
    return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(10, 0, 0);
}

export function gerar(tipo) {
  let e;
  if (tipo === 'morcego') e = new Morcego(ctx, posicaoLivre());
  else if (tipo === 'batedorPlataforma') {
    e = new Inimigo('batedor', ctx, new THREE.Vector3(-9, 1.25, -2));
    e.fixo = true; // atira pedras lá de cima: o Guerreiro precisa do Impulso para alcançá-lo
  } else e = new Inimigo(tipo, ctx, posicaoLivre());
  e.corpo.yaw = Math.atan2(heroi.corpo.pos.x - e.corpo.pos.x, heroi.corpo.pos.z - e.corpo.pos.z);
  if (tipo !== 'morcego') {
    e.rastroFx = efeitos.rastro(e.rig.arma.base, e.rig.arma.ponta, 0xffb38a,
      () => e.estado === 'atacando' && !!e.ataque?.tempos.ativo && e.anim.tempoAcao >= e.ataque.tempos.ativo[0] - 0.05 && e.anim.tempoAcao <= e.ataque.tempos.ativo[1] + 0.04);
  }
  inimigos.push(e);
  return e;
}

function removerInimigo(e) {
  e.destruir();
  if (e.rastroFx) efeitos.removerRastro(e.rastroFx);
}

function proximaOnda() {
  for (const t of ONDAS[onda % ONDAS.length]) gerar(t);
  hud.evento('onda', onda + 1);
  onda++;
}

function limparInimigos() {
  for (const e of inimigos) removerInimigo(e);
  inimigos.length = 0;
  controle.atacando.clear();
  ia.alvo = null; // sem alvo fantasma (a câmera e a cabeça do herói não miram quem saiu)
  heroi.olharAlvo = null;
}

// ---------- Câmera ----------
let cameraAuto = progresso.dados.config.cameraAuto;
const alvoCamera = new THREE.Vector3();
let usuarioMexeu = 0;
controles.addEventListener('start', () => { usuarioMexeu = 4; });
let distCamera = 9, foco = 0, fracColisao = 1;
const fovBase = () => (camera.aspect < 0.8 ? 60 : 45);
function atualizarCamera(dt) {
  const p = heroi.corpo.pos;
  // Enquadramento: o foco puxa um pouco na direção do alvo para o inimigo ficar na tela
  const alvo = ia.alvo?.vivo ? ia.alvo.corpo.pos : null;
  const sep = alvo ? Math.hypot(alvo.x - p.x, alvo.z - p.z) : 0;
  const puxa = alvo && sep < 12 ? 0.3 : 0;
  const centro = new THREE.Vector3(p.x, p.y + 1.0, p.z);
  if (puxa) centro.lerp(new THREE.Vector3(alvo.x, alvo.y + 1.0, alvo.z), puxa);
  alvoCamera.lerp(centro, 1 - Math.exp(-dt * 3.5));
  const delta = new THREE.Vector3().subVectors(alvoCamera, controles.target);
  controles.target.add(delta);
  camera.position.add(delta);
  usuarioMexeu -= dt;
  if (cameraAuto && usuarioMexeu <= 0 && !menu.aberto) {
    // Vista elevada atrás e ao lado; afasta um pouco quando o alvo está longe (sem movimentos bruscos)
    distCamera += (THREE.MathUtils.clamp(8.5 + sep * 0.35, 8.5, 12.5) - distCamera) * (1 - Math.exp(-dt * 1.2));
    const off = new THREE.Vector3().subVectors(camera.position, controles.target);
    const dist = THREE.MathUtils.lerp(off.length(), distCamera, 1 - Math.exp(-dt * 1.5));
    off.y = THREE.MathUtils.lerp(off.y, dist * 0.55, 1 - Math.exp(-dt * 1.5));
    off.setLength(dist);
    camera.position.copy(controles.target).add(off);
  }
  // Não atravessa rochas: se houver uma entre o foco e a câmera, aproxima a câmera até antes dela
  const c = camera.position, t = controles.target;
  let tMin = 1;
  for (const o of mundo.obstaculos) {
    const hit = mundo.intersecao(o, t.x, t.z, c.x, c.z, 0.4);
    if (hit === null || hit <= 0.02) continue;
    const yRaio = t.y + (c.y - t.y) * hit; // altura do raio nesse ponto
    if (o.h > yRaio - 0.2) tMin = Math.min(tMin, hit);
  }
  // Aproxima rápido quando uma rocha entra na frente e volta devagar quando ela sai (sem saltos)
  const fracAlvo = tMin < 1 ? Math.max(0.25, tMin - 0.08) : 1;
  // Enquanto houver obstáculo, a distância automática não volta a empurrar a câmera para dentro dele
  if (tMin < 1) distCamera = Math.min(distCamera, Math.max(3, c.distanceTo(t) * fracAlvo));
  fracColisao += (fracAlvo - fracColisao) * (1 - Math.exp(-dt * (fracAlvo < fracColisao ? 14 : 2.5)));
  if (fracColisao < 0.999) camera.position.lerpVectors(t, c, fracColisao);
  // Enquadramento discreto em momentos importantes (defesa perfeita, golpes pesados): fecha 3° de FOV
  foco = Math.max(0, foco - dt);
  const fovAlvo = fovBase() - (foco > 0 ? 3 : 0);
  if (Math.abs(camera.fov - fovAlvo) > 0.01) { camera.fov += (fovAlvo - camera.fov) * (1 - Math.exp(-dt * 6)); camera.updateProjectionMatrix(); }
  sol.position.set(p.x - 6, 12, p.z + 7);
  sol.target.position.set(p.x, 0, p.z);
}
camera.position.set(-6, 6, 8);
controles.target.set(0, 1, 0);

// ---------- Menu ----------
const menu = new Menu({
  progresso, heroi, ia, audio, clipes: clipesHeroi,
  aoAbrir: () => {},
  aoFechar: () => { heroi.aplicarEquipamento(); },
  focarPersonagem: (sim) => focarPersonagem(sim),
  testes: {
    gerar, proximaOnda, limparInimigos,
    alternarOndas: () => (ondasAutomaticas = !ondasAutomaticas),
    get ondasAutomaticas() { return ondasAutomaticas; },
    setVelocidade: (v) => { velocidadeJogo = v; },
    get velocidade() { return velocidadeJogo; },
    setCameraAuto: (v) => { cameraAuto = v; progresso.dados.config.cameraAuto = v; progresso.salvar(); },
  },
});
document.getElementById('btn-menu').addEventListener('click', () => { audio.destravar(); menu.abrir(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { audio.destravar(); menu.alternar(); } });
addEventListener('pointerdown', () => audio.destravar(), { once: false });

// Vista do personagem no menu (modelo 3D que o jogador pode girar)
let camSalva = null;
function focarPersonagem(sim) {
  if (sim && !camSalva) {
    camSalva = { pos: camera.position.clone(), alvo: controles.target.clone() };
    const p = heroi.corpo.pos;
    // Procura, a partir da frente do herói, um ângulo sem rocha entre a câmera e ele.
    let melhor = null;
    for (const d of [0.35, -0.35, 0.9, -0.9, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const ang = heroi.corpo.yaw + d;
      const c = new THREE.Vector3(p.x + Math.sin(ang) * 4.3, p.y + 1.55, p.z + Math.cos(ang) * 4.3);
      if (Math.hypot(c.x, c.z) > CONFIG.arena.raio - 0.5) continue;
      const obs = mundo.obstaculoNoCaminho(c, p, 0.35, 0);
      if (!obs || obs.obstaculo.h < 0.9) { melhor = c; break; }
    }
    camera.position.copy(melhor || new THREE.Vector3(p.x + 2.4, p.y + 1.6, p.z + 2.4));
    controles.target.set(p.x, p.y + 0.95, p.z);
    // No computador o painel ocupa a direita: desloca a vista para o herói aparecer à esquerda.
    if (innerWidth > 760) {
      const dir = new THREE.Vector3().subVectors(controles.target, camera.position).setY(0).normalize();
      const direita = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(1.15);
      camera.position.add(direita);
      controles.target.add(direita);
    }
  } else if (!sim && camSalva) {
    camera.position.copy(camSalva.pos);
    controles.target.copy(camSalva.alvo);
    camSalva = null;
  }
}

// ---------- Laço ----------
function redimensionar() {
  const w = tela.clientWidth, h = tela.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = fovBase();
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();

// Um passo da simulação (lógica + animação), separado da renderização.
function simular(dt) {
  // Hitstop: congela o mundo por uma fração de segundo nos impactos
  if (pausaGolpe > 0) { pausaGolpe -= dt; dt *= 0.08; }

  ia.update(dt);
  heroi.update(dt);
  for (const e of inimigos) e.update(dt, heroi, controle);
  separarCorpos([heroi.corpo, ...inimigos.filter((e) => e.vivo && !e.def.voador).map((e) => e.corpo)]);
  atualizarProjeteis(dt);
  for (let i = inimigos.length - 1; i >= 0; i--) if (inimigos[i].remover) { removerInimigo(inimigos[i]); inimigos.splice(i, 1); }

  // Ondas
  const vivos = inimigos.filter((e) => e.vivo).length;
  if (heroi.vivo && vivos === 0 && ondasAutomaticas) {
    if (esperaOnda === 2 && heroi.livre) heroi.comemorar();
    esperaOnda -= dt;
    if (esperaOnda <= 0) {
      esperaOnda = 2;
      if (heroi.estado === 'vitoria') { heroi.mudar('livre'); heroi.anim.soltar(0.3); }
      proximaOnda();
    }
  }
  // Derrota: revive depois de alguns segundos e recomeça a onda
  if (!heroi.vivo) {
    mortoHa += dt;
    if (mortoHa > 3.5) { mortoHa = 0; limparInimigos(); onda = Math.max(0, onda - 1); heroi.reviver(); esperaOnda = 1; }
  }

  efeitos.update(dt);
}

const relogio = new THREE.Timer();
relogio.connect(document);
let mortoHa = 0;
renderer.setAnimationLoop((t) => {
  relogio.update(t);
  let dt = THREE.MathUtils.clamp(relogio.getDelta(), 0, 1 / 20) * velocidadeJogo;
  if (dt > 0.05) dt = 0.05;
  if (menu.aberto) {
    // Jogo pausado: só o personagem do menu (pré-visualização) se mexe
    menu.atualizarPreview(dt);
    controles.update();
    renderer.render(cena, camera);
    return;
  }
  simular(dt);
  atualizarCamera(dt);
  controles.update();
  hud.atualizar(dt);

  const desloc = new THREE.Vector3();
  if (tremor > 0) { desloc.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(tremor); tremor = Math.max(0, tremor - dt * 0.6); }
  camera.position.add(desloc);
  renderer.render(cena, camera);
  camera.position.sub(desloc);
});

// Exposto para testes automatizados e depuração no console
window.arena = { heroi, ia, inimigos, progresso, placar, gerar, proximaOnda, limparInimigos, controle, menu, mundo, camera, controles,
  setOndas: (v) => { ondasAutomaticas = v; }, setVelocidade: (v) => { velocidadeJogo = v; },
  // Avança o jogo sem depender da taxa de quadros (testes automatizados)
  simular: (segundos) => { for (let t = 0; t < segundos; t += 1 / 60) simular(1 / 60); },
  passoCamera: (dt) => { atualizarCamera(dt); controles.update(); },
  reposicionarCamera: (alvo, pos) => { alvoCamera.copy(alvo); controles.target.copy(alvo); camera.position.copy(pos); fracColisao = 1; },
  get onda() { return onda; } };
proximaOnda();
