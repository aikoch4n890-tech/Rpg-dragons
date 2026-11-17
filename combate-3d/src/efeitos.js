// Faíscas de impacto e rastro da espada.
import * as THREE from 'three';

export class Faiscas {
  constructor(cena, max = 240) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.cor = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.vida = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.prox = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.cor, 3));
    this.pontos = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.045, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.pontos.frustumCulled = false;
    cena.add(this.pontos);
  }

  emitir(onde, cor, n = 26, forca = 2.4) {
    const c = new THREE.Color(cor);
    for (let k = 0; k < n; k++) {
      const i = this.prox; this.prox = (this.prox + 1) % this.max;
      this.pos.set([onde.x, onde.y, onde.z], i * 3);
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize();
      const v = forca * (0.4 + Math.random() * 0.8);
      this.vel.set([d.x * v, d.y * v + 0.8, d.z * v], i * 3);
      this.vida[i] = 0.25 + Math.random() * 0.3;
      this.base.set([c.r, c.g, c.b], i * 3);
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.vida[i] <= 0) { this.cor[i * 3] = this.cor[i * 3 + 1] = this.cor[i * 3 + 2] = 0; continue; }
      this.vida[i] -= dt;
      this.vel[i * 3 + 1] -= 6 * dt;
      for (let e = 0; e < 3; e++) this.pos[i * 3 + e] += this.vel[i * 3 + e] * dt;
      const f = Math.max(0, Math.min(1, this.vida[i] * 4));
      for (let e = 0; e < 3; e++) this.cor[i * 3 + e] = this.base[i * 3 + e] * f;
    }
    this.pontos.geometry.attributes.position.needsUpdate = true;
    this.pontos.geometry.attributes.color.needsUpdate = true;
  }
}

// Fita entre a base e a ponta da lâmina nas últimas posições, apagando com o tempo.
export class Rastro {
  constructor(cena, base, ponta, cor = 0xfff1c9, n = 10) {
    this.base = base; this.ponta = ponta; this.n = n;
    this.hist = [];
    this.cor = new THREE.Color(cor);
    const g = new THREE.BufferGeometry();
    this.posicoes = new Float32Array(n * 2 * 3);
    this.cores = new Float32Array(n * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.posicoes, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.cores, 3));
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    this.malha = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.malha.frustumCulled = false;
    cena.add(this.malha);
  }

  update(visivel) {
    if (visivel) {
      this.hist.unshift([this.base.getWorldPosition(new THREE.Vector3()), this.ponta.getWorldPosition(new THREE.Vector3())]);
      if (this.hist.length > this.n) this.hist.pop();
    } else if (this.hist.length) {
      this.hist.pop();
    }
    for (let i = 0; i < this.n; i++) {
      const h = this.hist[Math.min(i, this.hist.length - 1)];
      const f = i < this.hist.length ? 0.4 * (1 - i / this.n) ** 2 : 0;
      for (let k = 0; k < 2; k++) {
        const j = (i * 2 + k) * 3;
        if (h) { this.posicoes[j] = h[k].x; this.posicoes[j + 1] = h[k].y; this.posicoes[j + 2] = h[k].z; }
        const fk = f * (k === 1 ? 1 : 0.1); // mais forte na ponta
        this.cores[j] = this.cor.r * fk; this.cores[j + 1] = this.cor.g * fk; this.cores[j + 2] = this.cor.b * fk;
      }
    }
    this.malha.geometry.attributes.position.needsUpdate = true;
    this.malha.geometry.attributes.color.needsUpdate = true;
  }
}
