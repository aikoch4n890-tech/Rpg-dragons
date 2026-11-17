// Gerador de ciclos de marcha (andar, correr, recuar, passo lateral, girar no lugar) para qualquer
// personagem com o esqueleto padrão. Produz chaves para clipe(); o clipe deve ser criado com { ciclo: true }.
//
// Fase do pé esquerdo φ ∈ [0,1): 0 = contato (pé à frente), 0,5 = impulso (pé atrás); o direito anda meio ciclo depois.
// Parâmetros (graus/metros):
//   periodo, amplitude (coxa), joelhoApoio, joelhoBalanco, inclinacao (tronco), giroQuadril, balancoQuadril,
//   sobeDesce, pernasBase ({ LeftUpLeg, ... } da postura), spineBase (inclinação base do tronco),
//   direcao: 'frente' | 'tras' | 'esq' | 'dir', bracos(fase) => { armR, armL } (balanço dos braços),
//   assimetria: 0..1 (mancar/irregularidade: perna direita mais curta no passo), cabeca: compensação da cabeça
const TAU = Math.PI * 2;
const r = (v) => Math.round(v * 10) / 10;
const THREE_clamp = (v) => Math.max(0, Math.min(1, v)); // levanta → move → pousa

export function cicloMarcha(p) {
  const P = {
    periodo: 1, amplitude: 22, joelhoApoio: 12, joelhoBalanco: 45, inclinacao: 4, giroQuadril: 6,
    balancoQuadril: 3, sobeDesce: 0.025, spineBase: 0, direcao: 'frente', assimetria: 0, cabeca: 1,
    pernasBase: { LeftUpLeg: [0, 0, 3], LeftLeg: [8, 0, 0], LeftFoot: [-4, 0, 0], RightUpLeg: [0, 0, -3], RightLeg: [8, 0, 0], RightFoot: [-4, 0, 0] },
    ...p,
  };
  const B = P.pernasBase;
  const fases = Array.from({ length: 17 }, (_, i) => i / 16);
  const lateral = P.direcao === 'esq' || P.direcao === 'dir';
  const tras = P.direcao === 'tras';

  // Uma perna em sua fase φ
  const perna = (lado, phi, escala) => {
    const base = { up: B[`${lado}UpLeg`], kn: B[`${lado}Leg`], ft: B[`${lado}Foot`] };
    let coxaX = base.up[0], coxaZ = base.up[2], joelho = base.kn[0];
    let apoio;
    if (!lateral) {
      apoio = phi < 0.5;
      // No apoio a coxa gira em ritmo constante (o pé recua na mesma velocidade do corpo e não
      // escorrega); no balanço volta suavizada e chega à frente em φ = 0,92 para descer devagar.
      const s = tras ? 1 : -1;
      const g = apoio ? 1 - 4 * phi : -Math.cos(Math.PI * THREE_clamp((phi - 0.56) / 0.36));
      coxaX += s * P.amplitude * escala * g;
    } else {
      // Passo lateral "abre e fecha": uma perna fica plantada enquanto a outra se desloca.
      // Mesma convenção de fase da marcha para frente (apoio em [0; 0,5)), para que diagonais misturem
      // os ciclos sem conflito de qual pé está apoiado.
      apoio = phi < 0.5;
      const sinal = P.direcao === 'esq' ? 1 : -1;
      const g = apoio ? 1 - 4 * phi : -Math.cos(Math.PI * THREE_clamp((phi - 0.56) / 0.36));
      coxaZ += sinal * (P.amplitude / 2) * escala * g;
    }
    // Joelho: dobra um pouco ao receber o peso (apoio) e bastante no balanço, segurando até o fim.
    const uApoio = phi, uBal = phi - 0.5;
    if (apoio) joelho += P.joelhoApoio * escala * Math.sin(Math.PI * (uApoio / 0.5));
    else joelho += P.joelhoBalanco * escala * Math.pow(Math.sin(Math.PI * Math.min(1, uBal / 0.47)), 0.55); // dobra rápido: o pé sai do chão antes de se deslocar
    // Pé: compensa coxa e joelho para ficar nivelado; ponta sobe no contato e desce no impulso.
    let extra = 0;
    if (!lateral) {
      if (tras) extra = phi < 0.08 ? 10 : phi < 0.45 ? 0 : phi < 0.6 ? -8 : 4; // recuando: pousa a ponta primeiro
      else extra = phi < 0.08 ? -12 : phi < 0.42 ? 0 : phi < 0.58 ? 16 : -6;
    }
    const pe = -(coxaX - base.up[0]) - (joelho - base.kn[0]) + base.ft[0] + extra;
    return {
      [`${lado}UpLeg`]: [r(coxaX), r(base.up[1]), r(coxaZ)],
      [`${lado}Leg`]: [r(joelho), 0, 0],
      [`${lado}Foot`]: [r(pe), r(base.ft[1]), r(lateral ? -(coxaZ - base.up[2]) : 0)],
    };
  };

  return fases.map((phi) => {
    const fL = phi % 1, fR = (phi + 0.5) % 1;
    const esquerda = perna('Left', fL, 1);
    const direita = perna('Right', fR, 1 - P.assimetria * 0.35);
    // Quadril: desce no contato e sobe na passagem; gira para o lado da perna da frente; inclina para o lado do balanço.
    const y = -P.sobeDesce * (0.5 + 0.5 * Math.cos(2 * TAU * phi)) * (1 - P.assimetria * 0.4 * (phi >= 0.5 ? 1 : 0));
    const giro = lateral ? 0 : (tras ? 1 : -1) * P.giroQuadril * (phi < 0.5 ? 1 - 4 * phi : -Math.cos(Math.PI * ((phi - 0.5) / 0.5)));
    const rola = P.balancoQuadril * Math.sin(TAU * phi);
    const pose = {
      ...esquerda, ...direita,
      hips: { pos: [0, y, 0], rot: [0, r(giro + (P.giroBase || 0)), r(rola)] },
      Spine: [r(P.spineBase + P.inclinacao + 1.5 * Math.cos(2 * TAU * phi)), r(-giro * 1.3), r(-rola * 0.6)],
      Head: [r(-P.inclinacao * 0.6 * P.cabeca), r(giro * 0.4 * P.cabeca), 0],
      ...(P.bracos ? P.bracos(phi) : {}),
    };
    return [phi * P.periodo, pose];
  });
}

// Interpola duas especificações de braço (direções) para o balanço.
export function misturarBraco(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => v + (b[k][i] - v) * t) : a[k];
  return o;
}
