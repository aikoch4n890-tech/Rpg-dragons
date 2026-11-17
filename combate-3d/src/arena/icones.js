// Ícones simples em SVG (traço dourado), um por família de habilidade e por atributo.
const T = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;

const ESPADA = '<path d="M4 20l9-9M13 11l6-6v-1h-1l-6 6M7 15l2 2M5 17l2 2"/>';
const ESCUDO = '<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/>';

export const ICONES = {
  sequencia: T(ESPADA, '<path d="M15 18c2-1 3-3 3-5" stroke-dasharray="2 2"/>'),
  estocada: T('<path d="M3 12h14M17 12l-3-3M17 12l-3 3M17 12h4"/>'),
  impulso: T('<path d="M5 19c2-8 6-12 14-14M15 5h4v4"/>'),
  queda: T('<circle cx="12" cy="12" r="6"/><path d="M12 6v-3M9 4l3-1 3 1"/>'),
  guarda: T(ESCUDO),
  arrancada: T(ESPADA, '<path d="M2 8h5M1 12h5M2 16h4"/>'),
  corteRecuo: T('<path d="M4 10c4-5 12-5 16 0"/><path d="M12 15v5M9 18l3 3 3-3"/>'),
  ascendentes: T('<path d="M6 20l4-8M12 20l4-8M10 12l-1-6M16 12l1-6"/><path d="M9 6l0-1M17 6l0-1"/>'),
  arco: T('<path d="M5 18c0-8 6-13 14-13M19 5l-4 0M19 5l0 4"/>'),
  perfuracao: T('<path d="M3 12h11"/><circle cx="17" cy="12" r="3"/><path d="M14 12h6"/>'),
  esquiva: T('<path d="M15 5c-5 0-9 3-9 7M6 12l-3-2M6 12l2-3"/><path d="M14 19l6-6"/>'),
  giro: T('<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M17 3v3h3"/>'),
  descendente: T('<path d="M12 3v14M12 17l-3-3M12 17l3-3"/><path d="M6 21h12"/>'),
  postura: T('<path d="M8 21v-6l-3-3M16 21v-6l3-3M12 3v9"/><circle cx="12" cy="4" r="1.5"/>'),
  rajada: T('<path d="M4 8l5 4-5 4M10 8l5 4-5 4M16 8l5 4-5 4"/>'),
  provocacao: T(ESCUDO, '<path d="M2 9c-1 2-1 4 0 6M22 9c1 2 1 4 0 6"/>'),
  pancada: T(ESCUDO, '<path d="M20 12h3M19 8l2-1M19 16l2 1"/>'),
  batidas: T('<path d="M4 8v8M9 6v12M14 8v8M19 10v4"/>'),
  apoio: T('<path d="M4 16h16M12 16V5M8 9l4-4 4 4"/>'),
  protegida: T(ESCUDO, '<path d="M9 13h12M18 10l3 3-3 3"/>'),
  muralha: T('<path d="M3 9h18v11H3zM3 9l2-4h14l2 4M9 9v11M15 9v11"/>'),
  // Atributos
  vida: T('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  stamina: T('<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>'),
  forca: T(ESPADA),
  defesa: T(ESCUDO),
  armadura: T('<path d="M7 4l5 2 5-2 3 4-3 3v9H7v-9L4 8z"/>'),
  peso: T('<path d="M6 20h12l-2-11H8zM9 9a3 3 0 0 1 6 0"/>'),
};

export function icone(nome) { return ICONES[nome] || ICONES.sequencia; }
