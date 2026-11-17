// Dados das habilidades do Guerreiro (orientado a dados: a lógica de execução fica em guerreiro.js).
//
// Cada fase de uma habilidade:
//   clip: nome do clipe; ts: velocidade do clipe; dur: duração da fase (s de clipe; padrão = duração do clipe)
//   hits: [{ t0, t1, fonte: 'lamina'|'escudo'|'area'|'corpo', dano, stagger, efeito?, raio?, alcanceExtra?, frente? }]
//   mov: [{ t0, t1, frente, lado, cima }]  m/s no espaço do personagem (respeita colisão)
//   giro: { t0, t1, graus }  gira o personagem no próprio eixo
//   guarda: true  escudo protege a frente durante a fase
//   condicao: 'acertou'  a fase só acontece se a fase anterior acertou alguém
//   prende: true  segura o alvo atingido no lugar (se ele não resistir)
// Todos os tempos estão em segundos do clipe.
//
// ia: condições para a IA considerar a habilidade
//   dist: [min, max], alvo: { voador, leve, caido, grande, alto }, cercado, interrompe, esquiva,
//   provocacao, buff, caminhoLivre, prioridade, naoUsar

const F = 'fundamental', E = 'espada', S = 'escudo';

export const HABILIDADES = [
  // ---------------- Fundamentais (sempre ativas depois de aprendidas) ----------------
  {
    id: 'sequencia', nome: 'Sequência de Cortes', categoria: F, familia: 'sequencia', nivel: 'base', rank: 1, dp: 0,
    desc: 'Cortes curtos e encadeados com a espada. Continua enquanto o alvo estiver ao alcance.',
    stamina: 6, recarga: 0, alcance: 1.5, tipoDano: 'corte', efeitoTexto: 'Reação leve',
    sequencia: { clips: ['sequenciaA', 'sequenciaB'], max: 6, hit: { t0: 0.08, t1: 0.2, dano: 0.75, stagger: 10 }, mov: 0.6 },
    ia: { dist: [0, 1.6], prioridade: 1.0 },
  },
  {
    id: 'sequenciaImplacavel', nome: 'Sequência Implacável', categoria: F, familia: 'sequencia', nivel: 'aprimorada', base: 'sequencia', rank: 4, dp: 300,
    desc: 'Versão aprimorada: cadeia mais longa, em ritmo crescente, fechando com um golpe pesado.',
    stamina: 7, recarga: 0, alcance: 1.6, tipoDano: 'corte', efeitoTexto: 'Cambaleio no golpe final',
    sequencia: { clips: ['sequenciaA', 'sequenciaB'], max: 8, hit: { t0: 0.08, t1: 0.2, dano: 0.85, stagger: 12 }, mov: 0.7, acelera: 0.06,
      final: { clip: 'corte3', hits: [{ t0: 0.33, t1: 0.46, fonte: 'lamina', dano: 2.4, stagger: 60 }], mov: [{ t0: 0.28, t1: 0.4, frente: 1.5 }] } },
    ia: { dist: [0, 1.7], prioridade: 1.15 },
  },
  {
    id: 'estocada', nome: 'Estocada', categoria: F, familia: 'estocada', nivel: 'base', rank: 1, dp: 0,
    desc: 'Recua o braço e avança a ponta da lâmina. Alcance maior que um corte; interrompe inimigos leves.',
    stamina: 18, recarga: 2.5, alcance: 2.1, tipoDano: 'perfuracao', efeitoTexto: 'Interrompe inimigos leves',
    fases: [{ clip: 'estocada', hits: [{ t0: 0.24, t1: 0.36, fonte: 'lamina', dano: 1.4, stagger: 40, alcanceExtra: 0.15 }], mov: [{ t0: 0.18, t1: 0.32, frente: 2.4 }] }],
    cancelavel: 0.45,
    ia: { dist: [1.2, 2.2], interrompe: true, prioridade: 0.9 },
  },
  {
    id: 'estocadaDerrubadora', nome: 'Estocada Derrubadora', categoria: F, familia: 'estocada', nivel: 'aprimorada', base: 'estocada', rank: 3, dp: 200,
    desc: 'Estocada seguida de uma trombada com o ombro. Se acertar, derruba inimigos leves e médios.',
    stamina: 34, recarga: 4, alcance: 2.1, tipoDano: 'perfuracao + impacto', efeitoTexto: 'Derruba (leves e médios)',
    fases: [
      { clip: 'estocada', dur: 0.45, hits: [{ t0: 0.24, t1: 0.36, fonte: 'lamina', dano: 1.4, stagger: 40, alcanceExtra: 0.15 }], mov: [{ t0: 0.18, t1: 0.32, frente: 2.4 }] },
      { clip: 'trombada', condicao: 'acertou', hits: [{ t0: 0.08, t1: 0.3, fonte: 'corpo', dano: 1.2, stagger: 90, efeito: 'derrubar' }], mov: [{ t0: 0.05, t1: 0.3, frente: 4.5 }] },
    ],
    ia: { dist: [1.0, 2.2], interrompe: true, prioridade: 1.1 },
  },
  {
    id: 'impulso', nome: 'Impulso', categoria: F, familia: 'impulso', nivel: 'base', rank: 1, dp: 0,
    desc: 'Salto com impulso para transpor obstáculos baixos e subir em plataformas próximas.',
    stamina: 22, recarga: 0.8, alcance: 3, tipoDano: '-', efeitoTexto: '-',
    salto: { altura: 1.45, frente: 3.2 },
    ia: { naoUsar: true }, // usado pelo sistema de movimentação, não como ataque
  },
  {
    id: 'quedaControlada', nome: 'Queda Controlada', categoria: F, familia: 'queda', nivel: 'base', rank: 1, dp: 0,
    desc: 'Ao cair de uma altura, rola no chão e recupera a postura. Reduz o dano e o tempo vulnerável. Não anula quedas extremas.',
    stamina: 0, recarga: 0, alcance: 0, tipoDano: '-', efeitoTexto: '-', passiva: true,
    ia: { naoUsar: true },
  },
  {
    id: 'guarda', nome: 'Guarda', categoria: F, familia: 'guarda', nivel: 'base', rank: 1, dp: 0,
    desc: 'Ergue o escudo contra a ameaça. Bloqueia dano físico frontal; gasta stamina conforme a força do golpe. Agarrões, ataques em área e ataques pelas costas passam.',
    stamina: 0, recarga: 0, alcance: 0, tipoDano: '-', efeitoTexto: '-',
    ia: { naoUsar: true },
  },
  {
    id: 'aparo', nome: 'Aparo', categoria: F, familia: 'guarda', nivel: 'aprimorada', base: 'guarda', rank: 2, dp: 120,
    desc: 'Erguer o escudo no instante certo vira uma defesa perfeita: não perde vida, recupera stamina, desequilibra o agressor e abre um contra-ataque.',
    stamina: 0, recarga: 0, alcance: 0, tipoDano: '-', efeitoTexto: 'Repele o agressor',
    ia: { naoUsar: true },
  },

  // ---------------- Espada ----------------
  {
    id: 'arrancada', nome: 'Arrancada Cortante', categoria: E, familia: 'arrancada', nivel: 'base', rank: 1, dp: 40,
    desc: 'Inclina o tronco, arranca em direção ao alvo e fecha com um corte frontal. Encurta distância e interrompe.',
    stamina: 40, recarga: 3, alcance: 6, tipoDano: 'corte', efeitoTexto: 'Cambaleio',
    fases: [
      { clip: 'arranque', dur: 0.42, mov: [{ t0: 0.1, t1: 0.42, frente: 10 }], paraNoAlvo: 1.1 },
      { clip: 'arranqueCorte', hits: [{ t0: 0.1, t1: 0.26, fonte: 'lamina', dano: 2.0, stagger: 55 }], mov: [{ t0: 0, t1: 0.12, frente: 3 }] },
    ],
    ia: { dist: [3, 6.5], caminhoLivre: true, interrompe: true, prioridade: 1.2 },
  },
  {
    id: 'arrancadaFeroz', nome: 'Arrancada Feroz', categoria: E, familia: 'arrancada', nivel: 'aprimorada', base: 'arrancada', rank: 4, dp: 350,
    desc: 'Versão aprimorada: arrancada mais longa e veloz, com um golpe mais pesado. Precisa de espaço.',
    stamina: 55, recarga: 3.5, alcance: 9, tipoDano: 'corte', efeitoTexto: 'Cambaleio forte',
    fases: [
      { clip: 'arranque', dur: 0.55, mov: [{ t0: 0.08, t1: 0.55, frente: 13 }], paraNoAlvo: 1.1, rastro: true },
      { clip: 'arranqueCorte', hits: [{ t0: 0.1, t1: 0.26, fonte: 'lamina', dano: 2.8, stagger: 80 }], mov: [{ t0: 0, t1: 0.12, frente: 3 }] },
    ],
    ia: { dist: [3.5, 9], caminhoLivre: true, interrompe: true, prioridade: 1.3 },
  },
  {
    id: 'arrancadaRelampago', nome: 'Arrancada Relâmpago', categoria: E, familia: 'arrancada', nivel: 'especial', base: 'arrancadaFeroz', rank: 9, dp: 1500, requerAcessorio: 'anelMestre',
    desc: 'Variante especial (exige o Anel do Mestre de Armas): a arrancada mais rápida e longa, com golpe forte.',
    stamina: 60, recarga: 3.5, alcance: 12, tipoDano: 'corte', efeitoTexto: 'Cambaleio forte',
    fases: [
      { clip: 'arranque', dur: 0.55, mov: [{ t0: 0.05, t1: 0.55, frente: 17 }], paraNoAlvo: 1.1, rastro: true },
      { clip: 'arranqueCorte', ts: 1.2, hits: [{ t0: 0.1, t1: 0.26, fonte: 'lamina', dano: 3.2, stagger: 90 }], mov: [{ t0: 0, t1: 0.12, frente: 3 }] },
    ],
    ia: { dist: [4, 12], caminhoLivre: true, interrompe: true, prioridade: 1.35 },
  },
  {
    id: 'corteRecuo', nome: 'Corte em Recuo', categoria: E, familia: 'corteRecuo', nivel: 'base', rank: 1, dp: 40,
    desc: 'Corte horizontal amplo enquanto dá um passo para trás, criando espaço.',
    stamina: 30, recarga: 2.5, alcance: 1.8, tipoDano: 'corte', efeitoTexto: 'Reação leve, vários alvos',
    fases: [{ clip: 'corteRecuo', hits: [{ t0: 0.2, t1: 0.42, fonte: 'lamina', dano: 1.5, stagger: 30, alcanceExtra: 0.2 }], mov: [{ t0: 0.15, t1: 0.45, frente: -3.2 }] }],
    ia: { dist: [0, 1.6], cercado: true, prioridade: 0.9 },
  },
  {
    id: 'laminaRecuo', nome: 'Lâmina em Recuo', categoria: E, familia: 'corteRecuo', nivel: 'aprimorada', base: 'corteRecuo', rank: 5, dp: 450,
    desc: 'Versão aprimorada: corte mais amplo, com recuo para o lado com menos inimigos e obstáculos.',
    stamina: 36, recarga: 2.5, alcance: 2, tipoDano: 'corte', efeitoTexto: 'Cambaleio, vários alvos',
    fases: [{ clip: 'corteRecuo', hits: [{ t0: 0.2, t1: 0.42, fonte: 'lamina', dano: 2.0, stagger: 45, alcanceExtra: 0.3 }], mov: [{ t0: 0.15, t1: 0.45, frente: -3.4, lado: 'livre' }] }],
    ia: { dist: [0, 1.8], cercado: true, prioridade: 1.0 },
  },
  {
    id: 'cortesAscendentes', nome: 'Cortes Ascendentes', categoria: E, familia: 'ascendentes', nivel: 'base', rank: 2, dp: 80,
    desc: 'Série de cortes de baixo para cima. Prioridade contra voadores baixos e partes altas de monstros grandes.',
    stamina: 35, recarga: 3, alcance: 1.7, tipoDano: 'corte', efeitoTexto: 'Derruba voadores',
    fases: [{ clip: 'ascendentes', hits: [
      { t0: 0.12, t1: 0.24, fonte: 'lamina', dano: 1.0, stagger: 25, alcanceExtra: 0.25 },
      { t0: 0.34, t1: 0.46, fonte: 'lamina', dano: 1.0, stagger: 25, alcanceExtra: 0.25 },
      { t0: 0.56, t1: 0.7, fonte: 'lamina', dano: 1.3, stagger: 40, alcanceExtra: 0.3, efeito: 'derrubarVoador' }],
      mov: [{ t0: 0.5, t1: 0.66, cima: 2.2 }] }],
    ia: { dist: [0, 1.9], alvo: { alto: true }, prioridade: 1.3 },
  },
  {
    id: 'cortesCelestes', nome: 'Cortes Celestes', categoria: E, familia: 'ascendentes', nivel: 'aprimorada', base: 'cortesAscendentes', rank: 5, dp: 450,
    desc: 'Versão aprimorada: mais cortes ascendentes e maior alcance vertical.',
    stamina: 45, recarga: 3, alcance: 2.1, tipoDano: 'corte', efeitoTexto: 'Derruba voadores',
    fases: [
      { clip: 'ascendentes', dur: 0.5, hits: [
        { t0: 0.12, t1: 0.24, fonte: 'lamina', dano: 1.1, stagger: 25, alcanceExtra: 0.4 },
        { t0: 0.34, t1: 0.46, fonte: 'lamina', dano: 1.1, stagger: 25, alcanceExtra: 0.4 }] },
      { clip: 'ascendentes', hits: [
        { t0: 0.12, t1: 0.24, fonte: 'lamina', dano: 1.1, stagger: 25, alcanceExtra: 0.45 },
        { t0: 0.34, t1: 0.46, fonte: 'lamina', dano: 1.1, stagger: 25, alcanceExtra: 0.45 },
        { t0: 0.56, t1: 0.7, fonte: 'lamina', dano: 1.6, stagger: 50, alcanceExtra: 0.55, efeito: 'derrubarVoador' }],
        mov: [{ t0: 0.5, t1: 0.68, cima: 3.4 }] },
    ],
    ia: { dist: [0, 2.2], alvo: { alto: true }, prioridade: 1.4 },
  },
  {
    id: 'arcoAscendente', nome: 'Arco Ascendente', categoria: E, familia: 'arco', nivel: 'base', rank: 2, dp: 100,
    desc: 'Abaixa o centro de gravidade e sobe a lâmina num arco poderoso. Lança inimigos leves; desequilibra médios; grandes só cambaleiam.',
    stamina: 38, recarga: 4, alcance: 1.6, tipoDano: 'corte', efeitoTexto: 'Lança leves',
    fases: [{ clip: 'corteLancador', hits: [{ t0: 0.32, t1: 0.5, fonte: 'lamina', dano: 1.8, stagger: 70, efeito: 'lancar', forca: 6 }], mov: [{ t0: 0.3, t1: 0.45, frente: 1.2 }] }],
    ia: { dist: [0, 1.6], alvo: { leve: true }, prioridade: 1.15 },
  },
  {
    id: 'arcoAscendenteMaior', nome: 'Arco Ascendente Maior', categoria: E, familia: 'arco', nivel: 'aprimorada', base: 'arcoAscendente', rank: 6, dp: 600,
    desc: 'Versão aprimorada: arco mais forte, lança mais alto os leves e derruba os médios.',
    stamina: 46, recarga: 4, alcance: 1.7, tipoDano: 'corte', efeitoTexto: 'Lança leves, derruba médios',
    fases: [{ clip: 'corteLancador', ts: 1.1, hits: [{ t0: 0.32, t1: 0.5, fonte: 'lamina', dano: 2.5, stagger: 110, efeito: 'lancar', forca: 8, alcanceExtra: 0.15 }], mov: [{ t0: 0.3, t1: 0.45, frente: 1.4 }] }],
    ia: { dist: [0, 1.7], alvo: { leve: true }, prioridade: 1.25 },
  },
  {
    id: 'perfuracao', nome: 'Perfuração', categoria: E, familia: 'perfuracao', nivel: 'base', rank: 3, dp: 150,
    desc: 'Avança, crava a lâmina e a mantém presa enquanto aplica golpes curtos. A sequência só acontece se a primeira estocada acertar.',
    stamina: 45, recarga: 5, alcance: 2, tipoDano: 'perfuracao', efeitoTexto: 'Prende o alvo (se não resistir)',
    fases: [
      { clip: 'estocada', dur: 0.42, hits: [{ t0: 0.24, t1: 0.36, fonte: 'lamina', dano: 1.3, stagger: 30, alcanceExtra: 0.15 }], mov: [{ t0: 0.16, t1: 0.32, frente: 3 }], prende: true },
      { clip: 'espetoTorcer', condicao: 'acertou', dur: 1.08, preso: true, hitsRepetidos: { intervalo: 0.36, dano: 0.7, stagger: 22 } },
      { clip: 'espetoPuxar', preso: false, hits: [{ t0: 0.02, t1: 0.12, fonte: 'presa', dano: 1.2, stagger: 50 }] },
    ],
    ia: { dist: [0.8, 2], prioridade: 1.1, alvoGrandeParteAlcancavel: true },
  },
  {
    id: 'perfuracaoProfunda', nome: 'Perfuração Profunda', categoria: E, familia: 'perfuracao', nivel: 'aprimorada', base: 'perfuracao', rank: 7, dp: 800,
    desc: 'Versão aprimorada: sequência maior de golpes com a lâmina cravada.',
    stamina: 55, recarga: 5, alcance: 2.1, tipoDano: 'perfuracao', efeitoTexto: 'Prende o alvo (se não resistir)',
    fases: [
      { clip: 'estocada', dur: 0.42, hits: [{ t0: 0.24, t1: 0.36, fonte: 'lamina', dano: 1.5, stagger: 35, alcanceExtra: 0.2 }], mov: [{ t0: 0.16, t1: 0.32, frente: 3 }], prende: true },
      { clip: 'espetoTorcer', condicao: 'acertou', dur: 1.8, preso: true, hitsRepetidos: { intervalo: 0.3, dano: 0.8, stagger: 24 } },
      { clip: 'espetoPuxar', preso: false, hits: [{ t0: 0.02, t1: 0.12, fonte: 'presa', dano: 1.8, stagger: 70 }] },
    ],
    ia: { dist: [0.8, 2.1], prioridade: 1.2, alvoGrandeParteAlcancavel: true },
  },
  {
    id: 'perfuracaoFatal', nome: 'Perfuração Fatal', categoria: E, familia: 'perfuracao', nivel: 'especial', base: 'perfuracaoProfunda', rank: 9, dp: 1500, requerAcessorio: 'anelMestre',
    desc: 'Variante especial (exige o Anel do Mestre de Armas): estocada e sequência de perfurações mais fortes.',
    stamina: 60, recarga: 5, alcance: 2.1, tipoDano: 'perfuracao', efeitoTexto: 'Prende o alvo (se não resistir)',
    fases: [
      { clip: 'estocada', dur: 0.42, hits: [{ t0: 0.24, t1: 0.36, fonte: 'lamina', dano: 1.8, stagger: 40, alcanceExtra: 0.2 }], mov: [{ t0: 0.16, t1: 0.32, frente: 3 }], prende: true },
      { clip: 'espetoTorcer', condicao: 'acertou', ts: 1.3, dur: 2.3, preso: true, hitsRepetidos: { intervalo: 0.28, dano: 1.0, stagger: 28 } },
      { clip: 'espetoPuxar', preso: false, hits: [{ t0: 0.02, t1: 0.12, fonte: 'presa', dano: 2.4, stagger: 90 }] },
    ],
    ia: { dist: [0.8, 2.1], prioridade: 1.25, alvoGrandeParteAlcancavel: true },
  },
  {
    id: 'esquivaCorte', nome: 'Esquiva e Corte', categoria: E, familia: 'esquiva', nivel: 'base', rank: 3, dp: 150,
    desc: 'Esquiva para trás na diagonal e volta com um corte rápido. Não dá invulnerabilidade: a esquiva funciona por sair do alcance.',
    stamina: 32, recarga: 2.5, alcance: 1.6, tipoDano: 'corte', efeitoTexto: 'Contra-ataque',
    fases: [
      { clip: 'esquiva', mov: [{ t0: 0.02, t1: 0.3, frente: -5.5, lado: 'livre' }] },
      { clip: 'contraCorte', hits: [{ t0: 0.08, t1: 0.22, fonte: 'lamina', dano: 1.8, stagger: 45 }], mov: [{ t0: 0.02, t1: 0.16, frente: 5.5 }] },
    ],
    ia: { esquiva: true, dist: [0, 2.5], prioridade: 1.2 },
  },
  {
    id: 'esquivaVarredura', nome: 'Esquiva e Varredura', categoria: E, familia: 'esquiva', nivel: 'aprimorada', base: 'esquivaCorte', rank: 7, dp: 800,
    desc: 'Versão aprimorada: esquiva clara seguida de uma sequência de cortes de contra-ataque.',
    stamina: 42, recarga: 2.5, alcance: 1.7, tipoDano: 'corte', efeitoTexto: 'Contra-ataque em sequência',
    fases: [
      { clip: 'esquiva', mov: [{ t0: 0.02, t1: 0.3, frente: -5.5, lado: 'livre' }] },
      { clip: 'contraCorte', dur: 0.26, hits: [{ t0: 0.08, t1: 0.22, fonte: 'lamina', dano: 1.6, stagger: 40 }], mov: [{ t0: 0.02, t1: 0.16, frente: 5.5 }] },
      { clip: 'corte2', ts: 1.4, dur: 0.4, hits: [{ t0: 0.13, t1: 0.3, fonte: 'lamina', dano: 1.4, stagger: 35 }] },
      { clip: 'contraCorte', ts: 1.2, hits: [{ t0: 0.08, t1: 0.22, fonte: 'lamina', dano: 1.8, stagger: 50 }], mov: [{ t0: 0.02, t1: 0.16, frente: 2 }] },
    ],
    ia: { esquiva: true, dist: [0, 2.5], prioridade: 1.3 },
  },
  {
    id: 'giroLamina', nome: 'Giro de Lâmina', categoria: E, familia: 'giro', nivel: 'base', rank: 4, dp: 250,
    desc: 'Gira o corpo inteiro com a espada estendida, atingindo tudo ao redor. Recuperação e custo altos.',
    stamina: 60, recarga: 5, alcance: 1.9, tipoDano: 'corte', efeitoTexto: 'Reação, todos ao redor',
    fases: [
      { clip: 'giroPreparo' },
      { clip: 'giro', dur: 0.45, giro: { t0: 0, t1: 0.45, graus: 360 }, hits: [{ t0: 0, t1: 0.45, fonte: 'lamina', dano: 1.8, stagger: 45, alcanceExtra: 0.3 }] },
      { clip: 'giroFim', dur: 0.55 },
    ],
    ia: { cercado: true, dist: [0, 1.9], prioridade: 1.4, area: true },
  },
  {
    id: 'giroCompleto', nome: 'Giro Completo', categoria: E, familia: 'giro', nivel: 'aprimorada', base: 'giroLamina', rank: 8, dp: 1000,
    desc: 'Versão aprimorada: giro mais amplo e repetido. Atinge vários inimigos, com limite de alcance e dano.',
    stamina: 75, recarga: 5, alcance: 2.3, tipoDano: 'corte', efeitoTexto: 'Cambaleio, todos ao redor',
    fases: [
      { clip: 'giroPreparo' },
      { clip: 'giro', dur: 0.8, giro: { t0: 0, t1: 0.8, graus: 720 }, hits: [
        { t0: 0, t1: 0.4, fonte: 'lamina', dano: 1.8, stagger: 45, alcanceExtra: 0.6 },
        { t0: 0.4, t1: 0.8, fonte: 'lamina', dano: 2.0, stagger: 55, alcanceExtra: 0.6 }] },
      { clip: 'giroFim', dur: 0.6 },
    ],
    ia: { cercado: true, dist: [0, 2.3], prioridade: 1.5, area: true },
  },
  {
    id: 'golpeDescendente', nome: 'Golpe Descendente', categoria: E, familia: 'descendente', nivel: 'base', rank: 4, dp: 250,
    desc: 'Ergue a espada e crava de cima para baixo. Para inimigos caídos ou em posição inferior.',
    stamina: 35, recarga: 3, alcance: 1.3, tipoDano: 'perfuracao', efeitoTexto: 'Dano alto em caídos',
    fases: [{ clip: 'descendente', hits: [{ t0: 0.38, t1: 0.52, fonte: 'lamina', dano: 2.6, stagger: 50, bonusCaido: 1.6 }], mov: [{ t0: 0.3, t1: 0.42, frente: 1.5 }] }],
    ia: { dist: [0, 1.5], alvo: { caido: true }, prioridade: 1.5 },
  },
  {
    id: 'golpeSismico', nome: 'Golpe Sísmico', categoria: E, familia: 'descendente', nivel: 'aprimorada', base: 'golpeDescendente', rank: 8, dp: 1000,
    desc: 'Versão aprimorada: golpe mais violento, com impacto no chão que desequilibra quem estiver perto.',
    stamina: 45, recarga: 3.5, alcance: 1.5, tipoDano: 'perfuracao + impacto', efeitoTexto: 'Cambaleio em área pequena',
    fases: [{ clip: 'descendente', hits: [
      { t0: 0.38, t1: 0.52, fonte: 'lamina', dano: 3.0, stagger: 60, bonusCaido: 1.6 },
      { t0: 0.46, t1: 0.5, fonte: 'area', raio: 1.6, frente: 0.7, dano: 1.0, stagger: 80, poeira: true }],
      mov: [{ t0: 0.3, t1: 0.42, frente: 1.5 }] }],
    ia: { dist: [0, 1.7], alvo: { caido: true }, prioridade: 1.6 },
  },
  {
    id: 'golpeEsmagador', nome: 'Golpe Esmagador', categoria: E, familia: 'descendente', nivel: 'especial', base: 'golpeSismico', rank: 9, dp: 1500, requerAcessorio: 'anelMestre',
    desc: 'Variante especial (exige o Anel do Mestre de Armas): impacto pesado contra o chão, com cambaleio elevado.',
    stamina: 55, recarga: 4, alcance: 1.6, tipoDano: 'impacto', efeitoTexto: 'Cambaleio elevado em área',
    fases: [{ clip: 'descendente', ts: 0.85, hits: [
      { t0: 0.38, t1: 0.52, fonte: 'lamina', dano: 3.4, stagger: 80, bonusCaido: 1.6 },
      { t0: 0.46, t1: 0.5, fonte: 'area', raio: 2.1, frente: 0.7, dano: 1.4, stagger: 130, poeira: true }],
      mov: [{ t0: 0.3, t1: 0.42, frente: 1.5 }] }],
    ia: { dist: [0, 1.8], alvo: { caido: true }, prioridade: 1.65 },
  },
  {
    id: 'posturaFirme', nome: 'Postura Firme', categoria: E, familia: 'postura', nivel: 'base', rank: 5, dp: 300,
    desc: 'Firma os pés e reduz a vulnerabilidade a interrupções por um tempo. Não dá invulnerabilidade.',
    stamina: 40, recarga: 20, alcance: 0, tipoDano: '-', efeitoTexto: 'Resistência a cambaleio +60% por 12 s',
    fases: [{ clip: 'postura', guarda: true, efeitoNoInicio: { buff: 'firme', reducaoStagger: 0.6, duracao: 12 } }],
    ia: { buff: true, prioridade: 0.8 },
  },
  {
    id: 'posturaInabalavel', nome: 'Postura Inabalável', categoria: E, familia: 'postura', nivel: 'aprimorada', base: 'posturaFirme', rank: 8, dp: 1000,
    desc: 'Versão aprimorada: resistência maior durante o efeito. Não anula dano.',
    stamina: 50, recarga: 20, alcance: 0, tipoDano: '-', efeitoTexto: 'Resistência a cambaleio +85% por 15 s',
    fases: [{ clip: 'postura', guarda: true, efeitoNoInicio: { buff: 'firme', reducaoStagger: 0.85, duracao: 15 } }],
    ia: { buff: true, prioridade: 0.85 },
  },
  {
    id: 'rajadaCortes', nome: 'Rajada de Cortes', categoria: E, familia: 'rajada', nivel: 'base', rank: 6, dp: 500,
    desc: 'Avança com cortes curtos e agressivos, mantendo o alvo sob pressão.',
    stamina: 50, recarga: 4, alcance: 1.7, tipoDano: 'corte', efeitoTexto: 'Pressão contínua',
    fases: [{ clip: 'rajada', hits: [
      { t0: 0.06, t1: 0.12, fonte: 'lamina', dano: 0.8, stagger: 18 }, { t0: 0.18, t1: 0.27, fonte: 'lamina', dano: 0.8, stagger: 18 },
      { t0: 0.32, t1: 0.38, fonte: 'lamina', dano: 0.8, stagger: 18 }, { t0: 0.45, t1: 0.54, fonte: 'lamina', dano: 0.8, stagger: 18 },
      { t0: 0.58, t1: 0.66, fonte: 'lamina', dano: 1.1, stagger: 30 }],
      mov: [{ t0: 0, t1: 0.66, frente: 1.6 }] }],
    ia: { dist: [0, 1.7], alvo: { vulneravel: true }, prioridade: 1.25 },
  },
  {
    id: 'furiaCortes', nome: 'Fúria de Cortes', categoria: E, familia: 'rajada', nivel: 'aprimorada', base: 'rajadaCortes', rank: 9, dp: 1400,
    desc: 'Versão aprimorada: sequência mais longa e poderosa, fechada com um golpe de grande impacto. Deixa uma janela de recuperação.',
    stamina: 70, recarga: 6, alcance: 1.8, tipoDano: 'corte', efeitoTexto: 'Derruba no golpe final',
    fases: [
      { clip: 'rajada', ts: 1.15, hits: [
        { t0: 0.06, t1: 0.12, fonte: 'lamina', dano: 0.9, stagger: 18 }, { t0: 0.18, t1: 0.27, fonte: 'lamina', dano: 0.9, stagger: 18 },
        { t0: 0.32, t1: 0.38, fonte: 'lamina', dano: 0.9, stagger: 18 }, { t0: 0.45, t1: 0.54, fonte: 'lamina', dano: 0.9, stagger: 18 },
        { t0: 0.58, t1: 0.66, fonte: 'lamina', dano: 1.1, stagger: 25 }], mov: [{ t0: 0, t1: 0.66, frente: 1.8 }], dur: 0.68 },
      { clip: 'rajadaFinal', hits: [{ t0: 0.3, t1: 0.48, fonte: 'lamina', dano: 3.2, stagger: 120, efeito: 'derrubar' }], mov: [{ t0: 0.25, t1: 0.4, frente: 2.2 }], recuperacaoExtra: 0.35 },
    ],
    ia: { dist: [0, 1.8], alvo: { vulneravel: true }, prioridade: 1.35 },
  },

  // ---------------- Escudo ----------------
  {
    id: 'provocacao', nome: 'Provocação', categoria: S, familia: 'provocacao', nivel: 'base', rank: 1, dp: 40,
    desc: 'Bate a espada no escudo e grita, virando o alvo preferido dos inimigos próximos por um tempo. Alguns inimigos são imunes.',
    stamina: 25, recarga: 10, alcance: 7, tipoDano: '-', efeitoTexto: 'Provoca por 8 s',
    fases: [{ clip: 'provocar', efeitoNoTempo: { t: 0.55, provoca: { raio: 7, duracao: 8 } }, guarda: true }],
    ia: { provocacao: true, prioridade: 0.7 },
  },
  {
    id: 'provocacaoRessoante', nome: 'Provocação Ressoante', categoria: S, familia: 'provocacao', nivel: 'aprimorada', base: 'provocacao', rank: 5, dp: 400,
    desc: 'Versão aprimorada: batidas mais fortes e área de provocação maior.',
    stamina: 30, recarga: 10, alcance: 11, tipoDano: '-', efeitoTexto: 'Provoca por 10 s',
    fases: [{ clip: 'provocar', ts: 1.15, efeitoNoTempo: { t: 0.55, provoca: { raio: 11, duracao: 10 } }, guarda: true }],
    ia: { provocacao: true, prioridade: 0.75 },
  },
  {
    id: 'pancadaEscudo', nome: 'Pancada de Escudo', categoria: S, familia: 'pancada', nivel: 'base', rank: 1, dp: 40,
    desc: 'Avança o ombro e bate com o escudo. Dano baixo, mas interrompe, desequilibra e quebra a guarda.',
    stamina: 22, recarga: 2.5, alcance: 1.4, tipoDano: 'impacto', efeitoTexto: 'Interrompe, quebra a guarda',
    fases: [{ clip: 'pancadaEscudo', hits: [{ t0: 0.16, t1: 0.3, fonte: 'escudo', dano: 0.5, stagger: 75, efeito: 'quebraGuarda' }], mov: [{ t0: 0.13, t1: 0.26, frente: 3.5 }] }],
    ia: { dist: [0, 1.5], interrompe: true, quebraGuarda: true, prioridade: 1.1 },
  },
  {
    id: 'seriePancadas', nome: 'Série de Pancadas', categoria: S, familia: 'pancada', nivel: 'aprimorada', base: 'pancadaEscudo', rank: 4, dp: 300,
    desc: 'Versão aprimorada: sequência de impactos com o escudo, pressionando mais a guarda.',
    stamina: 34, recarga: 3, alcance: 1.5, tipoDano: 'impacto', efeitoTexto: 'Interrompe, quebra a guarda',
    fases: [0, 1, 2].map((i) => ({ clip: 'pancadaEscudo', ts: 1.35, dur: i < 2 ? 0.4 : 0.6,
      hits: [{ t0: 0.16, t1: 0.3, fonte: 'escudo', dano: 0.5, stagger: 55, efeito: 'quebraGuarda' }], mov: [{ t0: 0.13, t1: 0.26, frente: 2.5 }] })),
    ia: { dist: [0, 1.5], interrompe: true, quebraGuarda: true, prioridade: 1.2 },
  },
  {
    id: 'impactoConcentrado', nome: 'Impacto Concentrado', categoria: S, familia: 'pancada', nivel: 'especial', base: 'seriePancadas', rank: 9, dp: 1500, requerAcessorio: 'anelMestre',
    desc: 'Variante especial (exige o Anel do Mestre de Armas): um único impacto concentrado, com forte quebra de postura.',
    stamina: 36, recarga: 4, alcance: 1.5, tipoDano: 'impacto', efeitoTexto: 'Derruba (leves e médios)',
    fases: [{ clip: 'pancadaPesada', hits: [{ t0: 0.36, t1: 0.48, fonte: 'escudo', dano: 1.2, stagger: 150, efeito: 'derrubar' }], mov: [{ t0: 0.3, t1: 0.44, frente: 3 }] }],
    ia: { dist: [0, 1.5], interrompe: true, quebraGuarda: true, prioridade: 1.25 },
  },
  {
    id: 'batidasRapidas', nome: 'Batidas Rápidas', categoria: S, familia: 'batidas', nivel: 'base', rank: 2, dp: 100,
    desc: 'Empurrões rápidos com o escudo, alternando os lados. Bom para interromper inimigos próximos.',
    stamina: 28, recarga: 3, alcance: 1.3, tipoDano: 'impacto', efeitoTexto: 'Interrompe',
    fases: [{ clip: 'cimbalo', hits: [
      { t0: 0.07, t1: 0.13, fonte: 'escudo', dano: 0.35, stagger: 30 }, { t0: 0.25, t1: 0.31, fonte: 'escudo', dano: 0.35, stagger: 30 },
      { t0: 0.43, t1: 0.5, fonte: 'escudo', dano: 0.45, stagger: 40 }], mov: [{ t0: 0.05, t1: 0.5, frente: 1.2 }] }],
    ia: { dist: [0, 1.3], interrompe: true, prioridade: 1.0 },
  },
  {
    id: 'batidasIncessantes', nome: 'Batidas Incessantes', categoria: S, familia: 'batidas', nivel: 'aprimorada', base: 'batidasRapidas', rank: 6, dp: 550,
    desc: 'Versão aprimorada: mais batidas e maior duração, com custo de stamina correspondente.',
    stamina: 40, recarga: 3.5, alcance: 1.4, tipoDano: 'impacto', efeitoTexto: 'Interrompe',
    fases: [0, 1].map((i) => ({ clip: 'cimbalo', ts: 1.2, dur: i === 0 ? 0.55 : 0.75, hits: [
      { t0: 0.07, t1: 0.13, fonte: 'escudo', dano: 0.4, stagger: 30 }, { t0: 0.25, t1: 0.31, fonte: 'escudo', dano: 0.4, stagger: 30 },
      { t0: 0.43, t1: 0.5, fonte: 'escudo', dano: 0.5, stagger: 40 }], mov: [{ t0: 0.05, t1: 0.5, frente: 1.2 }] })),
    ia: { dist: [0, 1.4], interrompe: true, prioridade: 1.1 },
  },
  {
    id: 'apoioSalto', nome: 'Apoio de Salto', categoria: S, familia: 'apoio', nivel: 'base', rank: 3, dp: 120,
    desc: 'Firma as pernas e posiciona o escudo para lançar um aliado para cima. Este projeto ainda não tem aliados: a habilidade fica disponível para o futuro e a IA não a usa.',
    stamina: 20, recarga: 2, alcance: 1, tipoDano: '-', efeitoTexto: 'Impulsiona um aliado (sem efeito ofensivo)',
    fases: [{ clip: 'trampolim', guarda: true }],
    ia: { naoUsar: true },
  },
  {
    id: 'apoioSaltoMaior', nome: 'Apoio de Salto Maior', categoria: S, familia: 'apoio', nivel: 'aprimorada', base: 'apoioSalto', rank: 7, dp: 700,
    desc: 'Versão aprimorada: impulso maior. Também aguarda aliados no projeto.',
    stamina: 24, recarga: 2, alcance: 1, tipoDano: '-', efeitoTexto: 'Impulsiona um aliado (sem efeito ofensivo)',
    fases: [{ clip: 'trampolim', ts: 0.9, guarda: true }],
    ia: { naoUsar: true },
  },
  {
    id: 'estocadasProtegidas', nome: 'Estocadas Protegidas', categoria: S, familia: 'protegida', nivel: 'base', rank: 3, dp: 150,
    desc: 'Mantém o escudo erguido e lança estocadas curtas por baixo dele. Protege a frente; laterais e costas ficam expostas.',
    stamina: 34, recarga: 3, alcance: 1.6, tipoDano: 'perfuracao', efeitoTexto: 'Guarda frontal durante o golpe',
    fases: [{ clip: 'estocadaProtegida', guarda: true, hits: [
      { t0: 0.06, t1: 0.13, fonte: 'lamina', dano: 0.7, stagger: 20 }, { t0: 0.26, t1: 0.33, fonte: 'lamina', dano: 0.7, stagger: 20 },
      { t0: 0.46, t1: 0.53, fonte: 'lamina', dano: 0.8, stagger: 25 }], mov: [{ t0: 0, t1: 0.6, frente: 0.8 }] }],
    ia: { dist: [0.6, 1.6], prioridade: 1.05, defensiva: true },
  },
  {
    id: 'avancoProtegido', nome: 'Avanço Protegido', categoria: S, familia: 'protegida', nivel: 'aprimorada', base: 'estocadasProtegidas', rank: 7, dp: 750,
    desc: 'Versão aprimorada: sequência maior de estocadas, sem baixar a guarda frontal.',
    stamina: 44, recarga: 3, alcance: 1.7, tipoDano: 'perfuracao', efeitoTexto: 'Guarda frontal durante o golpe',
    fases: [0, 1].map(() => ({ clip: 'estocadaProtegida', ts: 1.15, guarda: true, hits: [
      { t0: 0.06, t1: 0.13, fonte: 'lamina', dano: 0.8, stagger: 22 }, { t0: 0.26, t1: 0.33, fonte: 'lamina', dano: 0.8, stagger: 22 },
      { t0: 0.46, t1: 0.53, fonte: 'lamina', dano: 0.9, stagger: 26 }], mov: [{ t0: 0, t1: 0.6, frente: 1 }] })),
    ia: { dist: [0.6, 1.7], prioridade: 1.15, defensiva: true },
  },
  {
    id: 'saraivadaProtegida', nome: 'Saraivada Protegida', categoria: S, familia: 'protegida', nivel: 'especial', base: 'avancoProtegido', rank: 9, dp: 1500, requerAcessorio: 'anelMestre',
    desc: 'Variante especial (exige o Anel do Mestre de Armas): sequência de estocadas ainda mais extensa com a guarda frontal mantida.',
    stamina: 52, recarga: 3.5, alcance: 1.7, tipoDano: 'perfuracao', efeitoTexto: 'Guarda frontal durante o golpe',
    fases: [0, 1, 2].map(() => ({ clip: 'estocadaProtegida', ts: 1.3, guarda: true, hits: [
      { t0: 0.06, t1: 0.13, fonte: 'lamina', dano: 0.85, stagger: 22 }, { t0: 0.26, t1: 0.33, fonte: 'lamina', dano: 0.85, stagger: 22 },
      { t0: 0.46, t1: 0.53, fonte: 'lamina', dano: 0.95, stagger: 26 }], mov: [{ t0: 0, t1: 0.6, frente: 1 }] })),
    ia: { dist: [0.6, 1.7], prioridade: 1.2, defensiva: true },
  },
  {
    id: 'muralha', nome: 'Muralha', categoria: S, familia: 'muralha', nivel: 'base', rank: 4, dp: 250,
    desc: 'Postura de defesa contínua: bloqueia com mais eficiência, mas consome stamina por segundo e tem duração limitada.',
    stamina: 15, recarga: 8, alcance: 0, tipoDano: '-', efeitoTexto: 'Bloqueio com 50% menos custo, até 3 s',
    fases: [{ clip: 'muralha', dur: 3, guarda: true, defesaContinua: { custoPorSeg: 18, eficiencia: 0.5 }, cancelavelSemAmeaca: true }],
    ia: { defesaContinua: true, prioridade: 1.0 },
  },
  {
    id: 'muralhaInabalavel', nome: 'Muralha Inabalável', categoria: S, familia: 'muralha', nivel: 'aprimorada', base: 'muralha', rank: 8, dp: 1000,
    desc: 'Versão aprimorada: melhor eficiência de stamina e defesa, ainda limitada por duração e tipo de ataque.',
    stamina: 15, recarga: 8, alcance: 0, tipoDano: '-', efeitoTexto: 'Bloqueio com 70% menos custo, até 4 s',
    fases: [{ clip: 'muralha', dur: 4, guarda: true, defesaContinua: { custoPorSeg: 14, eficiencia: 0.3 }, cancelavelSemAmeaca: true }],
    ia: { defesaContinua: true, prioridade: 1.05 },
  },
];

export const POR_ID = Object.fromEntries(HABILIDADES.map((h) => [h.id, h]));

// Ataques básicos (não ocupam slot): combo leve de 3 golpes, pesado carregado, ataque no ar.
export const ATAQUES_BASICOS = {
  corte1: { clip: 'corte1', hits: [{ t0: 0.15, t1: 0.3, fonte: 'lamina', dano: 1.0, stagger: 15 }], combo: 0.28, proximo: 'corte2', mov: [{ t0: 0.12, t1: 0.24, frente: 1.2 }], stamina: 0 },
  corte2: { clip: 'corte2', hits: [{ t0: 0.13, t1: 0.28, fonte: 'lamina', dano: 1.0, stagger: 15 }], combo: 0.26, proximo: 'corte3', mov: [{ t0: 0.1, t1: 0.22, frente: 1.2 }], stamina: 0 },
  corte3: { clip: 'corte3', hits: [{ t0: 0.33, t1: 0.46, fonte: 'lamina', dano: 1.8, stagger: 45 }], mov: [{ t0: 0.28, t1: 0.4, frente: 1.6 }], stamina: 8 },
  carregado: { clip: 'golpeCarregado', hits: [{ t0: 0.8, t1: 0.96, fonte: 'lamina', dano: 3.0, stagger: 95, efeito: 'derrubar' }], mov: [{ t0: 0.78, t1: 0.9, frente: 2 }], stamina: 25 },
  salto: { clip: 'ataqueSalto', hits: [{ t0: 0.15, t1: 0.45, fonte: 'lamina', dano: 1.6, stagger: 40, alcanceExtra: 0.2 }], stamina: 12 },
};

export const ACESSORIOS_ESPECIAIS = { anelMestre: 'Anel do Mestre de Armas' };
