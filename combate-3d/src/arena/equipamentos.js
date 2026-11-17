// Catálogo de equipamentos. Atributos somam aos do personagem; "visual" liga peças no modelo.
export const SLOTS = [
  ['cabeca', 'Cabeça'], ['torso', 'Torso'], ['bracos', 'Braços'], ['pernas', 'Pernas'],
  ['capa', 'Capa'], ['espada', 'Espada'], ['escudo', 'Escudo'], ['acessorio', 'Acessório'],
];

export const ITENS = {
  // Cabeça
  nenhumCabeca: { slot: 'cabeca', nome: 'Nenhum', peso: 0 },
  elmoFerro: { slot: 'cabeca', nome: 'Elmo de Ferro', defesa: 8, resistStagger: 4, peso: 3, visual: 'elmo' },
  // Torso
  tunica: { slot: 'torso', nome: 'Túnica de Couro', defesa: 6, peso: 4 },
  cotaMalha: { slot: 'torso', nome: 'Cota de Malha', defesa: 18, resistStagger: 10, peso: 12, visual: 'cota' },
  // Braços
  nenhumBracos: { slot: 'bracos', nome: 'Nenhum', peso: 0 },
  bracaisFerro: { slot: 'bracos', nome: 'Braçais de Ferro', defesa: 5, peso: 3, visual: 'bracais' },
  // Pernas
  botasCouro: { slot: 'pernas', nome: 'Botas de Couro', defesa: 3, peso: 2 },
  grevasFerro: { slot: 'pernas', nome: 'Grevas de Ferro', defesa: 7, resistStagger: 6, peso: 5, visual: 'grevas' },
  // Capa
  nenhumaCapa: { slot: 'capa', nome: 'Nenhuma', peso: 0 },
  capaViajante: { slot: 'capa', nome: 'Capa de Viajante', defesa: 2, peso: 1, visual: 'capa' },
  // Espada
  espadaCurta: { slot: 'espada', nome: 'Espada Curta', forca: 0, peso: 4, tamanhoLamina: 0.9 },
  espadaLonga: { slot: 'espada', nome: 'Espada Longa de Aço', forca: 12, peso: 6, tamanhoLamina: 1.12 },
  // Escudo
  escudoMadeira: { slot: 'escudo', nome: 'Escudo de Madeira', defesa: 4, estabilidade: 1.0, peso: 5 },
  escudoReforcado: { slot: 'escudo', nome: 'Escudo Reforçado', defesa: 9, estabilidade: 0.7, peso: 9, tamanhoEscudo: 1.15 },
  // Acessório
  nenhumAcessorio: { slot: 'acessorio', nome: 'Nenhum', peso: 0 },
  anelVigor: { slot: 'acessorio', nome: 'Anel de Vigor', staminaExtra: 60, peso: 0 },
  anelMestre: { slot: 'acessorio', nome: 'Anel do Mestre de Armas', peso: 0, descricao: 'Libera as variantes especiais de habilidades (exige rank 9).' },
};

export const EQUIP_INICIAL = {
  cabeca: 'nenhumCabeca', torso: 'tunica', bracos: 'nenhumBracos', pernas: 'botasCouro',
  capa: 'nenhumaCapa', espada: 'espadaCurta', escudo: 'escudoMadeira', acessorio: 'nenhumAcessorio',
};

// Todos os itens começam no inventário para testar a comparação e a pré-visualização.
export const INVENTARIO_INICIAL = Object.keys(ITENS);
