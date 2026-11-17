# Treino de combate 3D

Herói low-poly feito a partir da folha de referência (frente, perfil e costas), com esqueleto,
espada e escudo, treinando contra um adversário que ataca e defende.

Feito com three.js r186, que fica em `vendor/three` (MIT). Não precisa de build nem de internet.

## Como rodar

Módulos JavaScript não abrem direto do arquivo, então use um servidor local:

```bash
cd combate-3d
python3 -m http.server 8000
# depois abra http://localhost:8000
```

## Controles

- **Atacar:** `J` ou `Espaço`. Aperte de novo no meio do golpe para emendar o combo:
  corte horizontal → corte de volta → golpe alto, que é mais pesado.
- **Defender:** segure `K` ou `Shift`. A espada do adversário brilha em laranja enquanto ele prepara
  o golpe: é a hora de levantar o escudo.
- **Celular:** botões Atacar e Defender (segure para manter a defesa).
- **Demonstração:** o herói luta sozinho. Qualquer comando seu desliga.
- **Mostrar esqueleto:** mostra os ossos do rig.
- **Pose T:** coloca o herói na mesma pose da imagem de referência, sem espada e escudo.
- Arraste a cena para girar a câmera; use a roda do mouse ou a pinça para aproximar.

## Estrutura

```
index.html        página, HUD e botões
src/rig.js        modelo low-poly, esqueleto, espada e escudo
src/poses.js      poses-chave, solver dos braços e geração dos AnimationClips
src/combate.js    máquina de estados do lutador (guarda, golpe, defesa, impacto, dano)
src/efeitos.js    faíscas e rastro da espada
src/main.js       cena, câmera, IA do adversário, modo demonstração e laço principal
src/styles.css    visual da interface
vendor/three/     three.js r186 (core + OrbitControls)
```

## Como o rig funciona

- O esqueleto tem 17 ossos (`THREE.Bone`) com os nomes do Mixamo, sem o prefixo `mixamorig:`:
  `Hips`, `Spine`, `Spine1`, `Neck`, `Head`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftUpLeg`, `LeftLeg`,
  `LeftFoot` e os equivalentes `Right…`.
- Cada peça do modelo segue um osso só (skin rígido). É o jeito comum em personagens low-poly, mas
  não há pintura de pesos: as juntas são cobertas por esferas, não por malha que dobra.
- As poses dos braços são descritas por direções: para onde aponta o braço, o antebraço, a lâmina e a face
  do escudo. Um solver transforma isso em rotações dos ossos. Para criar um golpe novo, adicione chaves em
  `src/poses.js` e os dados de combate (janela ativa, combo, dano) em `GOLPES`.
- O adversário usa as mesmas animações num segundo personagem com outra paleta. Funciona porque
  os nomes dos ossos são iguais nos dois.

## Dados de combate

| Golpe | Duração | Janela ativa | Combo a partir de | Dano |
| --- | --- | --- | --- | --- |
| Corte 1 (horizontal) | 0,55 s | 0,15–0,30 s | 0,20 s | 1 |
| Corte 2 (de volta) | 0,55 s | 0,13–0,28 s | 0,20 s | 1 |
| Corte 3 (golpe alto) | 0,85 s | 0,33–0,46 s | não tem | 2 |
| Golpe do adversário | 1,30 s | 0,74–0,86 s | não tem | 1 |

Comandos apertados até 0,3 s antes da hora ficam guardados (buffer). Os acertos dão hitstop (o jogo
congela por uma fração de segundo), tremor de câmera e faíscas.

## Próximos passos

- Trocar o modelo por um `.glb` esculpido e riggado no Mixamo ou no Blender (Rigify). Com os mesmos
  nomes de ossos, as animações daqui podem ser reaproveitadas.
- Movimento pelo cenário, esquiva e barra de vida.
- Sons de impacto e de defesa.

---

# Arena do Guerreiro (combate automático)

O Guerreiro luta sozinho contra ondas de monstros. O jogador configura e evolui o personagem:
escolhe equipamentos, aprende e equipa habilidades, escolhe as melhorias passivas e ajusta as táticas.
Abra `arena.html`, com o mesmo servidor do treino. A `galeria.html` mostra todos os modelos e animações.

As mecânicas da vocação seguem o pedido do projeto (prompt do Fighter). Os nomes das habilidades e
melhorias são próprios, e a interface usa o visual medieval deste projeto: nenhum nome, arte ou
interface de jogos existentes foi copiado.

## Controles

- O combate é automático. Arraste para girar a câmera e use a roda do mouse ou a pinça para aproximar.
- `M` ou `Esc` (ou o botão Menu) pausa e abre o menu.
- Em **Configurações** há uma área de teste: gerar cada tipo de monstro, controlar as ondas, mudar a velocidade,
  ligar o modo de teste (rank 9 e DP para experimentar tudo) e apagar o progresso.

## Monstros de teste (`src/arena/inimigos.js`)

| Monstro | Peso | O que testa |
| --- | --- | --- |
| Goblin | leve | Garra horizontal e agarrão (atravessa a defesa). Pode ser lançado |
| Goblin Batedor | leve, rápido | Investida com adaga e pedradas (projétil). Uma versão fica em cima da plataforma |
| Goblin Escudeiro | médio | Escudo frontal que só cai com quebra de guarda; lançada vertical |
| Goblin Bruto | gigante (2,1x) | Clavada vertical pesada e pisão em área. Imune a provocação e a lançamento; ponto fraco na cabeça |
| Morcegão | leve, voador | Voa alto e mergulha. Cai quando atingido nas asas ou por cortes ascendentes |

Cada monstro define as próprias partes (hurtboxes), pontos fracos, peso e resistências.
Antes de cada golpe o monstro avisa (olhos brilham mais forte); o herói lê esse aviso para defender,
esquivar ou interromper.

## Arquitetura (`src/arena/`)

| Arquivo | Papel |
| --- | --- |
| `config.js` | Todos os números de balanceamento |
| `habilidades.js` | Dados de cada habilidade: custos, alcance, fases (clipe, movimento, hitboxes), cancelamento, uso pela IA |
| `animGuerreiro.js`, `animGoblin.js` | Clipes de animação gerados pelo solver de poses (`src/poses.js`) |
| `guerreiro.js` | Controlador do herói: estados, movimento, execução das habilidades por fases, defesa e defesa perfeita, agarrão, salto, queda, stamina |
| `iaGuerreiro.js` | IA de combate: percepção, escolha de alvo, leitura de ameaças, decisão por utilidade, perfis |
| `inimigos.js` | Contrato de combate dos inimigos e a IA de cada um |
| `golpes.js` | Hitbox pela trajetória real da arma (varre a lâmina entre quadros), dano e reações |
| `corpo.js` | Física simples (aceleração, salto, queda, colisão) e animador em camadas |
| `mundo.js` | Arena: rochas, caixotes, plataforma, linha de visão |
| `progressao.js` | XP, DP, rank, desbloqueios, slots, melhorias e salvamento (localStorage) |
| `equipamentos.js` | Catálogo de itens |
| `hud.js`, `menu.js`, `icones.js`, `arena.css` | Interface |
| `audio.js` | Sons sintetizados (placeholders) |
| `efeitosArena.js` | Faíscas, poeira, clarão, números de dano, rastros |

Para adicionar outra vocação: crie um arquivo de dados de habilidades no mesmo formato e um
conjunto de clipes. `guerreiro.js` executa qualquer habilidade descrita por fases, e as melhorias
já ficam registradas por id, independentes da vocação.

## Rank, DP e custos

Escala própria deste projeto, adaptada e não oficial. O rank sobe com a disciplina total ganha
(limiares em `config.js`). Cada habilidade tem rank mínimo e custo em DP. As versões aprimoradas exigem a
base aprendida. As variantes especiais exigem rank 9 e o acessório **Anel do Mestre de Armas** equipado.

## Placeholders e limitações

- **Áudio:** sintetizado com Web Audio. Para trocar por arquivos, troque as funções em `SONS` no `audio.js`.
- **Modelos:** low-poly feitos em código, com skin rígido. Para usar `.glb` do Mixamo/Blender, mantenha os nomes dos ossos.
- **Escalada:** a escalada de monstros grandes não foi implementada. O Bruto já é marcado como `escalavel`,
  mas o estado de escalar e o ataque de escalada ainda faltam.
- **Aliados:** não existem. O Apoio de Salto fica disponível, mas a IA não usa; o perfil Protetor só muda a frequência de provocação.
- **Fôlego de Carga:** o projeto não tem carregar objetos; a melhoria só vale para o agarrão.
- **Caminhos:** o desvio de obstáculos é local (sem navmesh). Alvos inalcançáveis são ignorados por alguns segundos.
- **Transições:** o tranco nas transições ficou no mesmo nível da versão anterior (pior 1% ≈ 21–25° por quadro), com muito mais movimento. O resíduo vem de golpes rápidos que começam a partir da corrida.

## Movimentação e animação

Tudo vale para o herói e para os monstros (mesmo esqueleto e mesmos módulos).

| Módulo | O que faz |
| --- | --- |
| `src/poses.js` | Chaves de pose viram curvas (Catmull-Rom amostrada), não interpolação linear: o golpe acelera até o impacto, continua (follow through) e assenta devagar. Mede a passada de cada ciclo. Cria versões aditivas só do tronco |
| `src/marcha.js` | Gerador de ciclos de passo: contato, passagem e impulso; o pé de apoio recua em ritmo constante, levanta antes de avançar e desce devagar; quadril sobe/desce e gira, tronco gira em contrabalanço, braços balançam. Frente, trás, lado e giro no lugar |
| `src/arena/corpo.js` (Animador) | Blend tree: guarda ↔ andar ↔ correr ↔ sprint por velocidade, e frente/trás/esquerda/direita por direção. Os ciclos andam na mesma fase e a velocidade de cada um vem da passada medida. Camada superior aditiva (escudo erguido enquanto as pernas andam). Giro com aceleração angular |
| `src/procedural.js` | Inclinação com aceleração e curvas, cabeça acompanhando o alvo, trancos de impacto por parte do corpo (molas), tiques dos goblins |
| `src/ik.js` | IK de dois ossos. Pés: travam no chão na fase de apoio, acompanham degraus e rampa, quadril desce quando preciso, nunca atravessam o chão. Mãos: o goblin segura a cintura do herói no agarrão |
| `src/reacoes.js` | Reações por parte (cabeça, abdômen, pernas, costas), forte, empurrão; o gigante reage mais devagar e só a golpes grandes |

A arena ganhou uma escada de três degraus e uma rampa até a plataforma; degraus de até 35 cm se sobem andando.
A câmera enquadra também o alvo, se aproxima quando uma rocha entra na frente e tem tremor limitado.

Clipes que podem ser trocados por animações finais (mesmos nomes): `guarda`, `andar`, `correr`, `sprint`, `recuar`,
`lateralE`, `lateralD`, `virar`, `subindo`, `caindo`, `aterrissar`, `aterrissarPesado`, `danoCabeca`, `danoTronco`,
`danoPernas`, `danoCostas`, `danoForte`, `empurrado`, `cambalear`, `derrubado`, e os golpes de cada habilidade.
Se trocar um ciclo, defina `userData.passada` (ou use `medirPassada`) para manter os pés sem escorregar.

## Testes

`testes/movimento.testes.js` mede: escorregamento dos pés em cada direção e velocidade, escada e rampa sem atravessar
o chão, descida de degraus sem queda, giro gradual com passinhos, tranco nas transições, reação por parte do corpo,
defesa andando, mãos no agarrão e câmera sem atravessar rochas.

`testes/arena.testes.js` roda 15 cenários com Playwright: detecção, investida, variedade de habilidades,
bloqueio e defesa perfeita, ausência de defesa perfeita sem o Aparo, recuo com stamina baixa, voador,
cercado, gigante não lançado, troca de alvo, Impulso e queda controlada, agarrão, quebra de guarda,
melhorias e progressão. O salvamento e os menus foram testados clicando na interface.
