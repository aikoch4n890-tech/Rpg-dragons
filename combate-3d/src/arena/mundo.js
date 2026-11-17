// Arena de teste: chão, rochas altas (bloqueiam visão), caixas baixas e uma plataforma de pedra.
// Colisão simples em 2D (XZ) com altura: dá para subir em cima de obstáculos baixos com o Impulso.
import * as THREE from 'three';
import { CONFIG } from './config.js';

// Altura máxima de degrau que se sobe andando (escada); acima disso precisa do Impulso.
export const DEGRAU = 0.35;

export class Mundo {
  constructor(cena) {
    this.cena = cena;
    this.obstaculos = [];
    this.raio = CONFIG.arena.raio;
    this.criarChao();
    const pedra = new THREE.MeshStandardMaterial({ color: 0x6b655d, roughness: 0.95, flatShading: true });
    const madeira = new THREE.MeshStandardMaterial({ color: 0x6d4e30, roughness: 0.9, flatShading: true });
    const laje = new THREE.MeshStandardMaterial({ color: 0x57524b, roughness: 0.95, flatShading: true });
    this.rocha(-5, 3.5, 1.1, 2.2, pedra);
    this.rocha(6.5, -4.5, 1.3, 2.6, pedra);
    this.rocha(-3, -8.5, 0.9, 1.8, pedra);
    this.rocha(8.5, 6, 1.0, 2.0, pedra);
    this.caixa(1.2, -4.2, 1.6, 0.45, 0.6, madeira, true);
    this.caixa(-9, -2, 2.2, 2.2, 1.25, laje, false);
    // Escada de três degraus (31 cm cada) do lado leste da plataforma
    this.caixa(-6.55, -2, 0.25, 0.8, 0.94, laje, false);
    this.caixa(-6.05, -2, 0.25, 0.8, 0.63, laje, false);
    this.caixa(-5.55, -2, 0.25, 0.8, 0.31, laje, false);
    // Rampa do lado sul da plataforma (sobe 1,25 m em 3,2 m)
    this.rampa(-9, -7.4, -4.2, 1.0, 1.25, laje);
  }

  criarChao() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#3e3a35'); g.addColorStop(0.75, '#2c2a27'); g.addColorStop(1, '#1d1d1f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,240,220' : '0,0,0'},${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const chao = new THREE.Mesh(new THREE.CircleGeometry(this.raio + 6, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    this.cena.add(chao);
    // Anel de pedras marcando a borda da arena
    const borda = new THREE.Mesh(new THREE.TorusGeometry(this.raio + 0.3, 0.25, 4, 48), new THREE.MeshStandardMaterial({ color: 0x4a453f, flatShading: true, roughness: 1 }));
    borda.rotation.x = Math.PI / 2;
    borda.position.y = 0.05;
    this.cena.add(borda);
  }

  rocha(x, z, r, h, mat) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mat);
    m.scale.set(r, h / 2, r);
    m.position.set(x, h / 2 - 0.05, z);
    m.rotation.y = x * z;
    m.castShadow = m.receiveShadow = true;
    this.cena.add(m);
    this.obstaculos.push({ tipo: 'circulo', x, z, r: r * 0.92, h });
  }

  caixa(x, z, hx, hz, h, mat, empilhadas) {
    if (empilhadas) {
      // Fileira de caixotes
      const n = Math.round(hx / 0.45);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry((hx * 2) / n - 0.04, h, hz * 2), mat);
        m.position.set(x - hx + ((i + 0.5) * hx * 2) / n, h / 2, z);
        m.rotation.y = (i % 2 ? 0.04 : -0.03);
        m.castShadow = m.receiveShadow = true;
        this.cena.add(m);
      }
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, h, hz * 2), mat);
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      this.cena.add(m);
    }
    this.obstaculos.push({ tipo: 'caixa', x, z, hx, hz, h });
  }

  rampa(x, z0, z1, hx, h, mat) {
    const L = z1 - z0;
    const forma = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), new THREE.Vector2(L, h)]);
    const g = new THREE.ExtrudeGeometry(forma, { depth: hx * 2, bevelEnabled: false });
    g.rotateY(-Math.PI / 2); // eixo da forma vira +Z do mundo
    g.translate(x + hx, 0, z0);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    this.cena.add(m);
    this.obstaculos.push({ tipo: 'rampa', x, z: (z0 + z1) / 2, z0, z1, hx, hz: L / 2, h });
  }

  alturaRampa(o, x, z) {
    if (Math.abs(x - o.x) > o.hx || z < o.z0 || z > o.z1) return null;
    return (o.h * (z - o.z0)) / (o.z1 - o.z0);
  }

  dentro(o, x, z, folga = 0) {
    if (o.tipo === 'circulo') return Math.hypot(x - o.x, z - o.z) < o.r + folga;
    return Math.abs(x - o.x) < o.hx + folga && Math.abs(z - o.z) < o.hz + folga;
  }

  // Altura do chão sob um ponto, considerando só topos que o corpo já alcançou.
  alturaChao(x, z, y) {
    let h = 0;
    for (const o of this.obstaculos) {
      if (o.tipo === 'caixa' && this.dentro(o, x, z) && o.h <= y + DEGRAU && o.h > h) h = o.h;
      if (o.tipo === 'rampa') { const hr = this.alturaRampa(o, x, z); if (hr !== null && hr <= y + DEGRAU && hr > h) h = hr; }
    }
    return h;
  }

  // Empurra o corpo para fora de obstáculos mais altos que ele e da borda da arena.
  resolver(corpo) {
    const p = corpo.pos;
    for (const o of this.obstaculos) {
      if (o.h <= p.y + DEGRAU && o.tipo === 'caixa') continue; // em cima, ou degrau que dá para subir
      if (o.tipo === 'rampa') {
        // Rampa: anda por cima; pelas laterais, onde está alta demais, é parede
        const hr = this.alturaRampa(o, p.x, p.z);
        if (hr !== null && hr > p.y + DEGRAU) { p.x = o.x + Math.sign(p.x - o.x || 1) * (o.hx + corpo.raio); corpo.bateu = true; }
        continue;
      }
      if (o.tipo === 'circulo') {
        const dx = p.x - o.x, dz = p.z - o.z;
        const d = Math.hypot(dx, dz), min = o.r + corpo.raio;
        if (d < min && d > 1e-4) { p.x = o.x + (dx / d) * min; p.z = o.z + (dz / d) * min; corpo.bateu = true; }
      } else {
        const cx = THREE.MathUtils.clamp(p.x, o.x - o.hx, o.x + o.hx);
        const cz = THREE.MathUtils.clamp(p.z, o.z - o.hz, o.z + o.hz);
        const dx = p.x - cx, dz = p.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < corpo.raio) {
          if (d > 1e-4) { p.x = cx + (dx / d) * corpo.raio; p.z = cz + (dz / d) * corpo.raio; }
          else { // centro dentro da caixa: sai pelo lado mais próximo
            const ox = o.hx - Math.abs(p.x - o.x), oz = o.hz - Math.abs(p.z - o.z);
            if (ox < oz) p.x = o.x + Math.sign(p.x - o.x || 1) * (o.hx + corpo.raio);
            else p.z = o.z + Math.sign(p.z - o.z || 1) * (o.hz + corpo.raio);
          }
          corpo.bateu = true;
        }
      }
    }
    const r = Math.hypot(p.x, p.z), lim = this.raio - corpo.raio;
    if (r > lim) { p.x *= lim / r; p.z *= lim / r; corpo.bateu = true; }
  }

  // Interseção de um segmento (XZ) com um obstáculo inflado por "folga". Retorna t em [0,1] ou null.
  intersecao(o, ax, az, bx, bz, folga) {
    if (o.tipo === 'circulo') {
      const dx = bx - ax, dz = bz - az, fx = ax - o.x, fz = az - o.z;
      const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - (o.r + folga) ** 2;
      const disc = b * b - 4 * a * c;
      if (disc < 0 || a < 1e-8) return null;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      return t >= 0 && t <= 1 ? t : (c < 0 ? 0 : null);
    }
    // Caixa: teste de lâmina (slab) no retângulo inflado
    let t0 = 0, t1 = 1;
    for (const [p, d, c, h] of [[ax, bx - ax, o.x, o.hx + folga], [az, bz - az, o.z, o.hz + folga]]) {
      if (Math.abs(d) < 1e-8) { if (p < c - h || p > c + h) return null; continue; }
      let ta = (c - h - p) / d, tb = (c + h - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return null;
    }
    return t0;
  }

  // Linha de visão entre dois pontos: só obstáculos mais altos que os olhos bloqueiam.
  temVisao(a, b) {
    const altura = Math.min(a.y, b.y) + 1.2;
    for (const o of this.obstaculos) {
      if (o.h < altura) continue;
      if (this.intersecao(o, a.x, a.z, b.x, b.z, 0) !== null) return false;
    }
    return true;
  }

  // Primeiro obstáculo no caminho (considerando o raio do corpo). Ignora obstáculos que o corpo já está em cima.
  obstaculoNoCaminho(a, b, raio, y = 0) {
    let melhor = null, tMin = Infinity;
    for (const o of this.obstaculos) {
      if ((o.tipo === 'caixa' && o.h <= y + DEGRAU) || o.tipo === 'rampa') continue; // dá para passar andando
      const t = this.intersecao(o, a.x, a.z, b.x, b.z, raio);
      if (t !== null && t < tMin) { tMin = t; melhor = o; }
    }
    return melhor ? { obstaculo: melhor, t: tMin } : null;
  }
}
