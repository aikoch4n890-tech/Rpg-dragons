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
