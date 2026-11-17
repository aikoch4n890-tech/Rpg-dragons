// Efeitos visuais da arena: faíscas, poeira, clarão de defesa perfeita, números de dano
// e rastro das lâminas. Tudo físico e discreto: sem magia nem auras coloridas.
import * as THREE from 'three';
import { Faiscas, Rastro } from '../efeitos.js';

export class EfeitosArena {
  constructor(cena, camera, camadaDom) {
    this.cena = cena;
    this.camera = camera;
    this.dom = camadaDom;
    this.faiscas = new Faiscas(cena, 300);
    this.poeiraPts = new Faiscas(cena, 260);
    this.poeiraPts.pontos.material.size = 0.09; // poeira: partículas menores e mais apagadas (cor escura)
    this.rastros = [];
    this.flashes = [];
    this.numeros = [];
    this.mostrarNumeros = true;
  }

  // visivel: função que diz se o rastro deve aparecer neste quadro (janela ativa do golpe).
  rastro(base, ponta, cor, visivel) {
    const r = new Rastro(this.cena, base, ponta, cor, 9);
    r.visivel = visivel;
    this.rastros.push(r);
    return r;
  }
  removerRastro(r) {
    this.cena.remove(r.malha);
    r.malha.geometry.dispose();
    this.rastros = this.rastros.filter((x) => x !== r);
  }

  sangue(p, forte = false) { this.faiscas.emitir(p, 0xb83a26, forte ? 22 : 12, forte ? 2.6 : 1.8); }
  metal(p, forte = false) { this.faiscas.emitir(p, 0xffd27a, forte ? 34 : 18, forte ? 3.2 : 2.4); }

  poeira(centro, raio = 1.5) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * raio * 0.6;
      this.poeiraPts.emitir(new THREE.Vector3(centro.x + Math.cos(a) * r, centro.y + 0.05, centro.z + Math.sin(a) * r), 0x4a4238, 8, 1.6);
    }
  }
  poeiraPes(p) { if (Math.random() < 0.5) this.poeiraPts.emitir(new THREE.Vector3(p.x, p.y + 0.05, p.z), 0x3e382f, 2, 0.8); }

  clarao(p) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(p);
    this.cena.add(m);
    this.flashes.push({ m, vida: 0.22, max: 0.22 });
  }

  numero(p, texto, tipo) {
    if (!this.mostrarNumeros) return;
    const el = document.createElement('div');
    el.className = `numero numero--${tipo}`;
    el.textContent = texto;
    this.dom.appendChild(el);
    this.numeros.push({ el, p: p.clone(), vida: 0.9, dy: 0 });
  }

  update(dt) {
    this.faiscas.update(dt);
    this.poeiraPts.update(dt * 0.6);
    for (const r of this.rastros) r.update(r.visivel());
    for (const f of this.flashes) {
      f.vida -= dt;
      const k = Math.max(0, f.vida / f.max);
      f.m.scale.setScalar(1 + (1 - k) * 2.5);
      f.m.material.opacity = k * 0.9;
    }
    this.flashes = this.flashes.filter((f) => { if (f.vida <= 0) { this.cena.remove(f.m); f.m.geometry.dispose(); return false; } return true; });
    const w = this.dom.clientWidth, h = this.dom.clientHeight;
    for (const n of this.numeros) {
      n.vida -= dt;
      n.dy += dt * 0.8;
      const v = n.p.clone().setY(n.p.y + n.dy).project(this.camera);
      n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      n.el.style.opacity = Math.min(1, n.vida * 2.5);
      if (v.z > 1) n.el.style.opacity = 0;
    }
    this.numeros = this.numeros.filter((n) => { if (n.vida <= 0) { n.el.remove(); return false; } return true; });
  }
}
