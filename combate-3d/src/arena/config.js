// Todos os números de balanceamento ficam aqui. Escala própria do projeto:
// vida e stamina na casa das centenas, dano por golpe na casa das dezenas, distâncias em metros.
// Ranks e custos de DP são uma adaptação para este projeto, não os valores de nenhum jogo existente.

export const CONFIG = {
  guerreiro: {
    vidaBase: 420,
    staminaBase: 300,
    forcaBase: 30,
    defesaBase: 20,
    resistStaggerBase: 40,
    cargaBase: 60, // kg
    raio: 0.32,
    velAndar: 1.8,
    velCorrer: 4.2,
    velLateral: 1.5,
    aceleracao: 14,
    giroVel: 7, // rad/s
    pesoPenalidade: 0.35, // a velocidade cai até 35% quando a carga passa do limite
    gravidade: 18,
    vidaPorNivel: 18,
    forcaPorNivel: 1.5,
    staminaPorNivel: 6,
  },
  stamina: {
    regenParado: 55, // por segundo
    regenAndando: 38,
    regenBloqueando: 10,
    regenEsforco: 0, // durante habilidades
    atrasoRegen: 0.6, // s depois de gastar
    exaustoDuracao: 1.6,
    exaustoVelocidade: 0.55,
    correrCusto: 0, // correr não gasta (só segura a regeneração)
  },
  defesa: {
    reducaoFrontal: 0.92, // 92% do dano físico frontal é bloqueado
    custoStaminaPorDano: 1.1,
    anguloFrontal: 75, // graus de cada lado
    janelaPerfeita: 0.16, // s depois de erguer o escudo
    prescienciaBonus: 0.1, // aumento da janela pela melhoria passiva
    perfeitaRecompensaStamina: 25,
    contraJanela: 1.1, // s de bônus de contra-ataque depois de defesa perfeita
    contraBonusDano: 1.5,
  },
  queda: {
    alturaRolamento: 1.0, // m: acima disso a queda controlada é usada
    alturaDano: 2.4,
    danoPorMetro: 45,
    reducaoRolamento: 0.6,
  },
  dano: {
    // dano = forca * multiplicador do golpe * fator da parte * 100 / (100 + defesa)
    variacao: 0.08,
    critParteFraca: 1.6,
  },
  // Reações: o golpe soma "stagger" no alvo; passando da resistência, o alvo cambaleia.
  reacao: {
    leveSeAcima: 0.15, // fração da resistência para uma reação leve
    derrubarMultiplo: 2.2, // stagger acumulado acima de resistência * isto derruba
    decaimentoStagger: 30, // por segundo
    imunidadeLeve: 1.3, // s sem nova interrupção leve depois de uma
    pesosQuePodemSerLancados: ['leve'],
    pesosQuePodemSerDerrubados: ['leve', 'medio'],
  },
  ia: {
    raioDeteccao: 16,
    intervaloPercepcao: 0.25,
    trocaAlvoMargem: 0.3, // o novo alvo precisa ser 30% melhor para trocar
    tempoInacessivel: 3.5, // s sem progresso até desistir do alvo
    bloqueioInacessivel: 6, // s ignorando o alvo inacessível
    cercadoRaio: 2.8,
    cercadoQtd: 3,
    vidaCritica: 0.3,
    staminaBaixa: 0.25,
    reacaoMedia: 0.1, // s, tempo de reação "humano" (com variação)
    reacaoDesvio: 0.05,
    alcanceBasico: 1.45,
    variacaoRitmo: 0.25, // ±25% nos intervalos para não parecer robótico
    penalidadeRepeticao: 0.45, // multiplicador na pontuação da habilidade recém usada
    memoriaRepeticao: 4, // s
  },
  // Perfis de tática: multiplicadores e preferências padrão.
  perfis: {
    equilibrado: { nome: 'Equilibrado', ataque: 1, defesa: 1, habilidades: 1, distancia: 1.6, stamina: 0.5, provocacao: 0.6 },
    agressivo: { nome: 'Agressivo', ataque: 1.35, defesa: 0.7, habilidades: 1.4, distancia: 1.3, stamina: 0.3, provocacao: 0.4 },
    defensivo: { nome: 'Defensivo', ataque: 0.75, defesa: 1.5, habilidades: 0.8, distancia: 2.0, stamina: 0.75, provocacao: 0.5 },
    protetor: { nome: 'Protetor', ataque: 0.9, defesa: 1.2, habilidades: 1, distancia: 1.7, stamina: 0.55, provocacao: 1.8 },
  },
  progressao: {
    xpPorNivel: (n) => Math.round(120 * Math.pow(n, 1.45)),
    // Rank da vocação sobe com a disciplina acumulada (não gasta).
    rankLimiares: [0, 120, 320, 640, 1100, 1700, 2500, 3500, 4800],
    rankMax: 9,
    slotsEspada: 3,
    slotsEscudo: 3,
    slotsMelhorias: 6,
  },
  // Melhorias passivas (as sete do Guerreiro). Valores conforme o pedido do projeto.
  melhorias: {
    folego: { rank: 2, dp: 80, reducaoCarregar: 0.5 },
    vigor: { rank: 2, dp: 80, vidaExtra: 100 },
    desvencilhar: { rank: 5, dp: 250, reducaoAgarrao: 0.5 },
    ombrosLargos: { rank: 5, dp: 250, cargaExtra: 20 },
    furiaFinal: { rank: 7, dp: 600, limiarVida: 0.3, bonusForca: 0.35 },
    leituraCombate: { rank: 7, dp: 600 },
    bracoForte: { rank: 8, dp: 900, bonusForca: 0.1 },
  },
  agarrao: {
    duracaoFuga: 2.2, // s lutando para escapar
    danoPorSegundo: 14,
  },
  arena: {
    raio: 15,
  },
};
