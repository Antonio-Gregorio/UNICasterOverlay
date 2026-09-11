# UNICompSlide

Character showcase de **UNDER NIGHT IN-BIRTH II Sys:Celes** e gerador de material
promocional para torneios: cards de personagem, artes de chaveamento e vídeos
curtos de embate (*Jogador A vs Jogador B*).

Tudo roda no navegador — sem backend, deploy estático. Inclusive o
[overlay do OBS](#overlay-para-o-obs): o tempo real ali vem do WebSocket que o
próprio OBS já tem, não de um servidor deste projeto.

---

## Stack escolhida

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Build / dev | **Vite 6** | HMR instantâneo e build estático; `public/` serve o dataset direto. |
| UI | **React 18 + TypeScript** | A parte de UI é formulário e lista — território de DOM, não de canvas. |
| Composição visual | **PixiJS 8** (WebGL / WebGPU) | Render de GPU para as artes promocionais. |
| Export de imagem | `renderer.extract` do Pixi | Renderiza fora da tela: exporta 4K sem depender do tamanho do monitor. |
| Export de vídeo | **WebCodecs** + **ffmpeg.wasm** | Encode acelerado por hardware, mux em MP4 no cliente. |

### Sobre WebAssembly

Você perguntou se WASM melhoraria a renderização. Direto ao ponto: **para
desenhar, não.** O gargalo de compor artes de 2000px com máscara, gradiente e
glow é a GPU, e quem fala com ela é WebGL/WebGPU — o Pixi já entrega isso. WASM
rodaria na CPU e ficaria mais lento.

Onde WASM ganha de verdade é no **vídeo**:

- `MediaRecorder` (a via puramente nativa) grava em **tempo real** e só produz
  WebM. Um clipe de 10s leva 10s e sai num formato que o Twitter/X e vários
  players não aceitam bem.
- **WebCodecs** (`VideoEncoder`) encoda frame a frame, **mais rápido que o tempo
  real** e com aceleração de hardware — mas cospe pacotes brutos, não um arquivo.
- **ffmpeg.wasm** empacota esses pacotes em **MP4/H.264**, o formato que todo
  mundo consegue postar.

Ou seja: WASM entra como *muxer* e como fallback de encode onde WebCodecs não
existe. É um uso pontual e justificado, não a base do projeto.

### Por que Pixi e não DOM/CSS ou Canvas 2D

- **DOM/CSS** é ótimo para montar a UI, mas não exporta pixel-perfect: virar
  imagem exige `html2canvas` ou serialização SVG, que erram fonte e filtro.
- **Canvas 2D** dá o export, mas filtros animados (glow, deslocamento, transição
  de embate) em 60fps ficam pesados na CPU.
- **Pixi** resolve os três problemas de uma vez: render de GPU, mesma cena
  exportada como PNG em qualquer resolução, e a animação pronta para virar vídeo
  frame a frame de forma determinística.

---

## Dataset

Já montado, com os 28 personagens do roster atual — incluindo a **Zohar**.
Fonte: site oficial da Arc System Works.

```
public/characters/
├── images/
│   ├── <slug>.png          arte oficial, fundo transparente (~1–2 MB)
│   ├── <slug>_sp.png       versão vertical, quando o site tem
│   └── <slug>_catch.svg    tagline oficial
├── data/
│   ├── <slug>.json         fonte da verdade, um arquivo por personagem
│   └── _index.json         lista slug/nome/ordem do roster
├── all.json                agregado que o app consome (1 fetch)
└── palette-preview.html    abre no navegador e confere as paletas no olho
```

### Formato

```jsonc
{
  "slug": "phonon",
  "name": "Phonon",
  "voiceActor": "Saori Onishi",
  "profile": {
    "height": "157cm", "weight": "45kg", "birthday": "8/5",
    "bloodType": "AB", "ability": "Baroque Noise", "weapon": "Meuniel"
  },
  "bio": ["...linha a linha..."],
  "assets": { "art": "...", "artPortrait": "...", "catchphrase": "..." },
  "colors": [
    { "role": "primary",   "hex": "#e66d9f", "rgb": [230,109,159], "oklab": [...], "coverage": 0.14 },
    { "role": "secondary", "hex": "#6d283f", ... },
    { "role": "tertiary",  "hex": "#231e22", ... }
  ],
  "rosterOrder": 15
}
```

### Como as 3 cores são escolhidas

k-means determinístico sobre os pixels opacos da arte, em **OKLab** — espaço
perceptualmente uniforme, então "distância entre cores" bate com o que o olho vê
(em RGB não bate). Os clusters são então ordenados por um score de
*chamatividade*:

```
score = área^0.45 × (0.18 + croma × 1.4) × penalidade_de_extremo
```

- **Expoente < 1 na área**: uma massa grande e sem cor (o preto de uma roupa)
  conta, mas não atropela a cor de identidade.
- **Piso de 0.18**: esse mesmo preto ainda entra na paleta em vez de sumir.
- **Penalidade de extremo**: branco de highlight e preto de contorno levam
  desconto — são desenho, não identidade.

Na hora de escolher as três, duas cores só coexistem se estiverem longe em OKLab
**e** em matiz — senão a Vatista devolvia vermelho claro + vermelho escuro, o que
não serve para compor nada. A exceção é diferença grande de luminosidade, que é
justamente o caso do rosa claro da roupa da Phonon contra o magenta dela.

Resultado para a Phonon: `#a3da9f` (cabelo) → `#e66d9f` (rosa da roupa) →
`#231e22` (preto), na ordem que você descreveu. Esse verde-menta é o único caso
até agora de paleta corrigida à mão: o cabelo dela ocupa 5% dos pixels e o
k-means preferia devolver dois tons do mesmo rosa. Ficou `colorsLocked`.

### Ajuste manual

A extração é um bom default, não um oráculo. Se alguma paleta não te agradar:

1. Abra `public/characters/palette-preview.html` no navegador para comparar.
2. Edite `colors` no `<slug>.json` à mão.
3. Marque `"colorsLocked": true` — o script passa a respeitar aquele arquivo.

---

## Enquadramento do rosto

Cada personagem tem um campo `face` no seu JSON — a região da cabeça, com um
pouco de zoom out para pegar os ombros:

```jsonc
"face":      { "x": 0.365, "y": 0.134, "width": 0.22, "height": 0.173 },
"imageSize": { "width": 1920, "height": 2446 },
"faceLocked": true
```

Coordenadas normalizadas (0–1) sobre a arte, então continuam válidas se você
gerar derivados menores. O recorte é quadrado **em pixels** — por isso `width` e
`height` normalizados diferem: `imageSize` é o que converte entre os dois.

É o que o modo lista usa: a arte inteira num quadrado de 56px deixa o personagem
do tamanho de uma formiga, enquanto o rosto identifica na hora.

### Como foram marcados

`npm run data:faces` tem um detector automático — procura manchas de tom de pele
e pergunta de cada uma "isto tem olhos?", já que um rosto é pele com buracos
dentro e um braço é pele lisa. Ele acerta cerca de dois terços do roster, o que
não é o bastante para uma listagem.

Então **os 28 estão marcados à mão** em
[scripts/face-overrides.json](scripts/face-overrides.json), o que também deixa o
enquadramento uniforme entre artes de formatos bem diferentes. O detector fica
como ponto de partida para personagens novos.

Para ajustar um:

```bash
npm run data:faces -- --grid=phonon --cols=1 --cell=620   # arte + grade + recorte atual
npm run data:scale   # escala do elenco (cabeça na arte, olhos→pés no chibi)
npm run data:scale -- --contact    # folhas da arte e do chibi
# leia as coordenadas na grade, edite scripts/face-overrides.json
npm run data:faces -- --contact                            # confira todos lado a lado
```

`--grid` sobrepõe uma grade percentual na arte e desenha o recorte vigente;
`--contact` gera `.cache/face-contact.png` com os 28 recortes juntos. Os
overrides usam `cx`/`cy` (centro, em % da largura e da altura) e `size` (lado, em
% da largura) — bem mais fácil de acertar no olho do que quatro coordenadas.

---

## Ponto de centralização

Cada personagem tem um ponto logo abaixo dos olhos, gravado no JSON:

```jsonc
"anchor":   { "x": 0.475, "y": 0.220 },   // na arte oficial
"sdAnchor": { "x": 0.489, "y": 0.299 }    // no sprite chibi
```

Ao montar topbar ou gráfico, esse ponto é levado a **50% da largura e 25% da
altura** do bloco. É o que alinha o elenco: cada arte tem o personagem numa pose
e num canto diferentes, e sem um ponto comum uns ficavam altos e outros baixos.

São dois pontos porque o chibi tem enquadramento completamente diferente da arte
oficial — cabeça enorme, corpo pequeno.

### Um terceiro ponto, para corpo inteiro

A mesma mira nem sempre serve para os dois usos. Na topbar o ponto enquadra uma
cabeça; no gráfico ele posiciona a figura toda, e em algumas poses o que centra
bem o rosto deixa o corpo torto no quadro. Quem precisar disso ganha um `body`
em [scripts/anchor-overrides.json](scripts/anchor-overrides.json), usado **só**
no desenho de corpo inteiro — o enquadramento de rosto continua com o ponto
original. A **Yuzuriha** é a primeira: o centro dela sobe um pouco e vai um
tiquinho para a direita, o que desce e desencosta a figura na moldura do
gráfico. Sem `body`, vale o ponto do rosto.

### Como foram marcados

`npm run data:anchors -- --contact` gera `.cache/anchor-full.png` e
`.cache/anchor-sd.png`, com uma cruz sobre o ponto de cada personagem — a folha
da arte recorta em volta do alvo, para conferir a mira de perto.

Os valores da arte oficial partiram dos centros de rosto já marcados em
`face-overrides.json`. Os dos chibis saíram de um detector: a maior mancha de
tom de pele na metade superior, com o ponto a 62% da altura dela. Acertou 23 dos
27 — os quatro que erraram são justamente os que não têm rosto como maior área
de pele: **Enkidu** (torso nu), **Merkava** (monstro, sem pele), **Ogre**
(luva na frente) e **Waldstein** (juba). Esses quatro estão à mão em
[scripts/anchor-overrides.json](scripts/anchor-overrides.json).

---

## Escala do elenco

O ponto de centralização alinha os rostos; a escala resolve a outra metade do
problema, que é o **tamanho**. Encaixando cada imagem na moldura ("contain"), o
tamanho aparente vira sorteio: medido numa moldura igual para todos, o rosto do
maior era **2,2x** o do menor, o Akatsuki — de pose ereta — saía gigante ao lado
de quem posa agachado, e o rosto de 15 dos 28 caía fora da linha dos 25%, a
Yuzuriha 19 pontos abaixo dela.

`npm run data:scale` acerta isso. A régua é diferente em cada imagem, porque o
que é constante em cada uma é diferente:

- **Arte oficial: a caixa de rosto.** Ela é quadrada em pixels nos 28, então
  serve de unidade. A moldura de referência tem tamanho fixo em "cabeças" —
  **5,3 de largura por 8,6 de altura** — e é ela que se encaixa na moldura do
  retrato. Todo mundo sai com a mesma cabeça, e o rosto na mesma linha. Medir o
  corpo não serve aqui: as poses variam demais, de agachado a voando.
- **Chibi: dos olhos até os pés, gravado no arquivo.** Não dá para medir rosto
  num chibi — tentei pele na linha dos olhos e o detector pegava braço e perna,
  com 11x de variação e cinco personagens sem pele nenhuma. Mas a pose do chibi é
  sempre em pé e de frente, então essa distância é estável. Em vez de virar
  número no JSON, ela **redimensiona o próprio sprite**: todo chibi passa a ter
  210px dos olhos até os pés, e o desenho vira regra de três com o tamanho do
  arquivo. Dois chibis lado a lado já saem proporcionais em qualquer tela que os
  use — foi assim que a topbar entrou na conta (lá o chibi era dimensionado por
  "cobrir a caixa", com **2,8x** de diferença entre o maior e o menor).

Uma alternativa considerada era levar todos os sprites a uma tela comum, com a
largura do mais largo. Não compensa: a tela teria que ser 366x399 por causa das
foices do Byakuya e da lança da Orie, e encaixá-la numa moldura encolheria o
chibi típico em **30%**. Cada um continua no seu recorte justo, e o que sobra dos
extremos é cortado pela moldura, não pelo arquivo.

Pela altura do sprite também não dá: ela inclui o que estiver acima da cabeça, e
normalizar por ela encolhe quem levanta a espada, quem usa chapéu (Uzuki, Ogre) e
quem tem auréola (Vatista).

**A escolha do 8,6:** cobre até o percentil 75 de "olhos até os pés" do elenco.
Mais alto encolhe todo mundo para caber os dois ou três de pose mais esticada;
mais baixo corta a canela do Carmine e do Akatsuki, que já perdem o pé. Numa
moldura larga e baixa — as casas do 2º ao 8º no Top 8 — o personagem inteiro é
alto demais para a altura disponível, então sobra margem dos lados; o zoom da
arte, no editor, fecha essa folga quando se prefere cortar a perna.

A régua da cabeça vale onde o elenco aparece lado a lado: retrato de competidor
e chibi na topbar. **O líder tem régua própria** — a altura desenhada, igual
para todos.

O motivo é o que se enxerga em cada caso. Num grid de oito retratos, cabeça igual
é o que lê como "mesma escala", e a diferença de altura que sobra é pose, que é
verdadeira. Na faixa lateral só há duas figuras grandes, uma de cada lado, e ali
o que salta aos olhos é a altura: com cabeça igual, o Akatsuki — de pose ereta —
ficava 44% mais alto que a Hilda, encolhida flutuando.

A medida é a extensão desenhada inteira, do topo ao ponto mais baixo, e não dos
olhos aos pés. Normalizando pelos pés, quem posa em pé fica pequeno ao lado de
quem posa sentado: a distância olhos-pés da Hilda cobre uma fração do que ela
ocupa na tela, enquanto a do Akatsuki é o corpo dele inteiro. É o campo `artBody`
(e `sdBody`), gravado por `npm run data:scale`.

Antes disso o líder encaixava a arte inteira na faixa, e aí quem mandava no
tamanho era a proporção do arquivo: o Akatsuki saía com **710** de altura contra
**312** da Hilda, porque a arte dele tem 4958px de altura e a dela 1692.

Doze personagens têm correção à mão em
[scripts/scale-overrides.json](scripts/scale-overrides.json), como multiplicador
sobre a régua.

Nos chibis o motivo é sempre o mesmo — o que está entre os olhos e o pé nem
sempre é perna: Hilda tem o cabelo passando dos pés (sobe 15%), Waldstein e
Merkava mal têm pernas (descem 28%), Mika viaja dentro de um punho gigante
(30%). Nesses o multiplicador entra na hora de gravar o sprite, não na hora de
desenhar.

Na arte oficial o motivo é outro: cabeças iguais não significam figuras iguais.
Quem posa ereto ocupa muito mais quadro que quem posa agachado — o Akatsuki
enchia a moldura de alto a baixo enquanto a Wagner, de capa aberta e pose
compacta, ocupava 0,56 dela contra 0,84 da mediana.

Corrigir todo mundo até a mediana seria pior: o Waldstein, agachado, precisaria
de 2,5x e viraria uma cabeça gigante andando. Então só as pontas entram, e com
moderação — **Carmine, Akatsuki e Chaos** descem; **Wagner, Waldstein, Linne,
Hilda e Merkava** sobem. É sempre um empate entre cabeça igual e figura igual: o
multiplicador que conserta a altura é o mesmo que desiguala a cabeça.

`npm run data:scale -- --contact` gera as duas folhas —
`.cache/scale-art.png` e `.cache/scale-sd.png` — com os 28 desenhados como o
gráfico os desenha e a linha dos 25% marcada. É o único jeito honesto de
conferir: número em tabela não mostra pose.

---

## Sprites SD

`npm run data:sd` baixa os chibis do in-birth.fandom.com para
`public/characters/sd/<slug>.webp`. **27 dos 28** — a Zohar, mais recente, ainda
não tem sprite na wiki, e quem pedir SD para ela recebe a arte normal em vez de
um buraco.

Tanto o editor de topbar quanto o de gráficos têm a opção **Usar sprite SD
(chibi)** no lugar da arte oficial.

Três detalhes do pipeline:

- **Os nomes de arquivo na wiki não seguem regra.** O elenco clássico usa
  `Sd-<abreviação>` com abreviações inventadas caso a caso (`Sd-wald`,
  `Sd-gord`, `Sd-lnd`), e os personagens novos usam outro padrão,
  `Mini <número> <Nome>`. Daí o mapa explícito no script em vez de montar o nome.
- **Os arquivos chegam com até 2000px e moldura transparente em volta.** O
  script apara a moldura e reduz — mas **todos pelo mesmo fator**, o que faz o
  maior deles ter 512px de altura. Reduzir cada um para a mesma altura, como
  fazia antes, era o que estragava a escala: um chibi agachado virava do tamanho
  de um em pé, e quem ergue arma ficava menor que os dois. Sem a redução seriam
  14 MB de pixels que ninguém vê, contra os 1,4 MB atuais.
- **As imagens da wiki não estão todas na mesma resolução** — a da Kuon vem com
  2193px de altura aparada contra os ~1440px da maioria. Por isso o fator comum
  resolve só metade: o resto é a régua de [Escala do elenco](#escala-do-elenco).

Na topbar o chibi ganha uma caixa mais estreita que a da arte oficial — ele é
alto e magro, e numa caixa larga ficava perdido no meio, longe da ponta.

---

## Bandeiras

Cobrem todas as Américas: **55 países e territórios** e **377 subdivisões**
(estados, províncias, departamentos, regiões) — tudo em **1,5 MB**.

```
public/flags/
├── countries.webp       as 55 bandeiras nacionais
├── regions/<cc>.webp    as subdivisões daquele país (26 arquivos)
└── index.json           manifesto: nome, código ISO e célula de cada bandeira
```

### Por que sprite

São ~430 bandeiras. Servidas soltas, abrir o seletor de país dispara centenas de
requisições e o navegador engasga. Agrupadas em sprite, o seletor de país custa
**1 arquivo** (167 KB) e o de estado custa **mais 1, só do país escolhido** — o
sprite do Brasil tem 88 KB para os 27 estados.

Cada bandeira é exibida por recorte, via `background-position`
([Flag.tsx](src/Flag.tsx)). As células são 4:3 com a bandeira encaixada por
`contain`: as proporções reais variam (2:3, 1:2, 10:19) e esticar bandeira para
caber num quadrado fixo é falta de respeito com o país. Em 128×96 elas
aguentam exibição de 16 px a ~96 px de altura, inclusive em tela retina.

### Fontes e cobertura

Bandeiras nacionais vêm do **flagcdn.com**; as de subdivisão, do **Wikidata**
(`P300` = código ISO 3166-2, `P41` = bandeira) rasterizadas pelo **Wikimedia
Commons**.

A cobertura das subdivisões é a do Wikidata, e ela não é uniforme. Brasil (27),
Argentina (24), Colômbia (33), Venezuela (24), Peru (26), Chile (16) e Canadá
(13) vêm completos. **O México sai com 14 dos 32 estados** — o Wikidata
simplesmente não tem bandeira registrada para o resto. Vários países do Caribe
aparecem com uma subdivisão só, que é o que existe lá.

Se algum estado importante faltar, dá para adicionar a bandeira à mão em
`.cache/flags/region/<CC>/<CODE>.png` e rodar `npm run data:flags` — o script usa
o cache antes de ir à rede.

O SPARQL leva até 30s por país, então o resultado fica em `.cache/`. Um segundo
`npm run data:flags` é praticamente instantâneo.

---

## Interface

Um sistema com **menu lateral** e rotas — não mais abas dentro de uma caixa.
Cada tela tem endereço próprio, então dá para favoritar, voltar pelo navegador e
abrir um editor direto pelo link.

| Rota | Tela |
| --- | --- |
| `/personagens` | roster, filtro e grade/lista |
| `/players` | cadastro de players |
| `/times` | times com sigla e logo |
| `/logos` | logos de evento |
| `/topbar` · `/topbar/:id` | lista e editor de topbar |
| `/winners` · `/winners/:id` | lista e editor de gráficos |
| `/winners/:id/gerar` | montar e exportar a imagem |
| `/animacoes` | animações de apresentação |
| `/chaves` | estilos da tela de chave (lista) |
| `/chaves/novo`, `/chaves/:id` | editor de estilo de chave |
| `/animacoes/novo`, `/animacoes/:id` | editor de apresentação |
| `/overlay/novo`, `/overlay/:id` | painel de um overlay |
| `/overlay` | painel do overlay do OBS |
| `/overlay/live` | a página que o OBS carrega (fora da casca do sistema) |

Os editores deixaram de ser modal: viraram tela, com **controles à esquerda e o
preview grudado no topo à direita**. Eram opções demais para caber numa janela —
e num modal o preview saía de vista assim que se rolava até os últimos ajustes.

Os controles se dividem em colunas **por largura e não por número fixo**: numa
tela de 1920 o painel abre em três e cabe inteiro sem rolagem; numa estreita cai
para uma. Cada seção é indivisível, então nenhuma começa numa coluna e termina na
outra.

Os dados estáticos (roster, bandeiras, fundos, players de exemplo) são carregados
uma vez por [DataProvider](src/data.tsx) e servidos por contexto; antes cada aba
refazia os mesmos fetches a cada navegação.

### Template e conteúdo são coisas separadas

O **template** guarda só o visual — arranjo, cores, molduras, tipografia,
espaçamento. Nome do evento, logo, canais de Twitch e YouTube, narradores, quem
competiu, quem é o líder de cada lado e **tudo sobre cada líder** — imagem,
brilho, tamanho, posição — vivem na tela de geração (`/winners/:id/gerar`),
porque mudam a cada torneio enquanto o visual é reaproveitado. Os líderes
entraram nessa lista depois: parecem visual, mas dependem de qual personagem foi
escalado, e os dois lados raramente pedem o mesmo ajuste. Do template ficou só o
liga-desliga das faixas laterais.

**Preencher a lista é digitar e apertar Enter.** O campo do jogador aceita busca
e também **nome que não está no cadastro** — quem apareceu de última hora entra
como texto, sem passar pela aba Players. O Enter escolhe o primeiro da busca (ou
cria o digitado) e já abre o campo seguinte: num top 8 são oito nomes seguidos,
e voltar ao mouse a cada um custa caro.

Ao lado de cada jogador vem o **personagem**, preenchido do cadastro mas
editável: nem sempre se joga de main num torneio, e trocar ali não mexe no
cadastro dele.

No modelo de times, a geração escolhe **qual lado venceu**. O vencedor ganha uma
coroa antes do nome do time e o outro lado sai dessaturado — dois sinais para a
mesma informação, porque quem vê a peça na timeline não vai comparar saturação.

A terceira opção é **"ainda não"**: sem coroa, os dois lados coloridos e os dois
rótulos na cor de destaque. O mesmo gráfico passa a anunciar um confronto que não
aconteceu, em vez de só comemorar um que acabou.

De lá sai o **PNG em 1920×1080**. A exportação serializa o SVG e o desenha num
canvas — e antes disso converte cada `<image href>` em data URI, porque um SVG
carregado como imagem **não busca sub-recursos**: sem esse passo a peça sairia
sem fundo e sem personagens.

Pelo mesmo motivo, nenhum ícone da peça usa `currentColor`: fora da página não há
CSS herdado para resolver, e o microfone dos narradores saía **preto** no PNG
enquanto aparecia branco no preview. A cor de cada ícone vai por prop.

### Players de exemplo nas miniaturas

As listagens sorteiam os jogadores em vez de fatiar o arquivo em ordem. A semente
nasce diferente a cada visita — abrir a tela duas vezes mostra elencos
diferentes — e o botão **Sortear** pede outra rodada na hora. Dentro de uma peça
ninguém se repete: com 23 nomes no arquivo, um gráfico de 20 sai com 20
distintos.

Os líderes também entram sorteados no preview do editor, num sorteio à parte dos
slots: eles não competem nas caixas, e sem ninguém ali não dava para ver como o
brilho e o alinhamento ficam.

### Trazer os exemplos para o cadastro

A aba **Players** tem **+ Exemplos**, que cadastra de uma vez os 23 do arquivo —
todos brasileiros, cada um com o seu personagem. Serve para não começar de um
cadastro vazio: montar uma chave de teste ou conferir um template exige gente na
lista, e digitar 23 nomes à mão para isso não se sustenta.

O botão só oferece **quem ainda não está lá**, comparando por nome, e desliga
quando não sobra ninguém — clicar duas vezes não duplica a lista. Depois de
importados eles são players como os outros: dá para renomear, trocar de
personagem e apagar. Não fica marca de procedência de propósito, porque um player
"de exemplo" seria uma segunda classe a manter viva no resto do sistema.

A gravação é uma só, e não uma por pessoa: 23 chamadas de `addPlayer` num laço
escreveriam 23 vezes no localStorage e redesenhariam a lista 23 vezes, com a
chance de a fila cair pela metade se a cota estourar no meio.

---

## Gráfico de vencedores

Mesma ideia do editor de topbar, com **arranjos prontos** como atalho de
criação — escolher um modelo já abre o editor com o gráfico montado.

| Modelo | O que faz |
| --- | --- |
| Top 8 | campeão em destaque à esquerda; do 2º em diante à direita, 4 em cima e 3 embaixo |
| Top 8 duplas | mesmo arranjo, dois retratos por posição |
| Pódio (top 3) | campeão maior e mais alto, ao centro |
| Time vencedor | dois times de até 10, o perdedor dessaturado, com líderes opcionais nas laterais |

Customização:

- **Fundo** — 18 cenários do próprio jogo (o padrão), cor, degradê ou upload,
  com véu de opacidade sobre a imagem.
- **Retratos** — formato da borda (reta, redonda, círculo, hexágono), cor única
  ou degradê, largura e altura em porcentagem, chanfro no topo/base com ângulo,
  e zoom + deslocamento da arte dentro da moldura. O zoom vai de 50% a **400%**:
  em 100% o personagem entra inteiro, e daí para cima serve para fechar num
  busto — por isso o deslocamento tem curso de uma moldura e meia para cada
  lado, senão não se chega no que se quer enquadrar. A **sombra** vem em quatro
  níveis prontos (sem, leve, média, forte), todos discretos: o que se quer é
  descolar o card do fundo, e valor livre aqui convida ao borrão escuro em volta
  de cada retrato.
- **Distribuição** — espaço entre colunas e entre fileiras, e no modelo de times
  a largura do bloco de cada um. Ela e a faixa do líder são a mesma medida vista
  dos dois lados: estreitar o bloco alarga o líder na mesma proporção, porque a
  sobra tem que ir para algum lugar. Acima de 100% o bloco avança sobre a faixa
  até um mínimo — os líderes são desenhados antes, então ficam atrás dos
  retratos, e a sobreposição é o ponto.
- **Arte** — sprite SD (chibi) no lugar da arte oficial, e o alinhamento pelos
  olhos como opção: desligado, cada personagem fica simplesmente centrado na
  moldura, na pose em que a arte veio.
- **Insígnia** — bandeira do país, do estado, logo do time, ou nenhuma. Fica à
  frente do nome, e o conjunto é centrado no slot.
- **Líderes** (só no modelo de times) — um jogador à parte por lado, escolhido
  na tela de geração, que aparece em pé na lateral à frente do fundo. O capitão
  nem sempre está entre os que jogaram, então não é o primeiro da lista. **Só o
  boneco**: o nome não é escrito ali, quem está na faixa é o personagem e o nome
  do jogador já aparece na lista do time.

  Do template ficou **só o liga-desliga** das faixas laterais. Todo o resto é de
  cada líder e mora na geração, um lado independente do outro: **imagem** (arte
  oficial ou chibi), **brilho** (ligado ou não, em cor fixa ou na cor do próprio
  personagem, com intensidade que mexe na opacidade e no tamanho ao mesmo tempo —
  só opacidade vira disco chapado e só tamanho vira mancha), **tamanho, largura,
  altura e posição**. Tudo isso depende de quem foi escalado, e cada personagem
  tem uma pose; dá para pôr o chibi de um lado e a arte do outro.

  O ponto de partida é comum a todos — a faixa que sobrou ao lado do bloco, com a
  **mesma altura desenhada** para o elenco todo (ver
  [Escala do elenco](#escala-do-elenco)), o rosto no centro da faixa e não o meio
  da imagem (numa pose de braço estendido o meio do arquivo cai longe do
  personagem), e o da direita **espelhado**, para os dois se olharem — com o
  espelho no eixo do rosto, senão ele escorregava para o lado ao inverter. Quem
  tem pose larga passa da faixa (a arte da Wagner dá 739 contra 354 dela) e
  sangra pela borda: puxar a arte para dentro da tela tirava o rosto do centro em
  18 dos 28, e a ponta de uma capa saindo do quadro custa menos que o líder
  plantado fora do lugar.
- **@ do X** — nos modelos de blocos largos (pódio, top 8) o arroba do jogador
  aparece sob o nome, precedido pelo logo do X. O cadastro fica na aba Players e
  é guardado sem o arroba, para quem desenha decidir como mostrar. Num gráfico de
  20 jogadores o bloco é estreito demais e o arroba é omitido. Tem **fonte, cor e
  contorno próprios** — é outra leitura, menor, e não precisa combinar com a do
  nome — e uma **sombra** em volta do texto e do logo, porque cai sobre a arte do
  personagem e sem ela some no que estiver atrás.
- **Textos** — fonte, cor e contorno do nome. O título do evento tem os mesmos,
  mais degradê, **canto do topo** (esquerda, centro ou direita), **deslocamento**
  nos dois eixos e **tamanho**: o canto resolve o caso comum e o deslocamento
  desvia de uma logo ou de um detalhe do fundo sem precisar trocar de canto. São
  **26 fontes**, do Impact ao Bahnschrift, e ao lado do seletor há duas setas que
  passam de uma para a outra: escolher fonte é comparar, não procurar, e abrir a
  lista a cada tentativa para ver como fica no gráfico é caro. Um "Aa" na fonte
  atual fica ao lado, para não precisar olhar para a peça a cada clique. Todas
  são stacks do sistema, porque a exportação desenha o SVG num canvas e uma
  webfont teria que estar embutida para não sair errada na imagem.
- **Rodapé** — logo do evento vinda da aba Logos, canais de Twitch e YouTube, e
  narradores com microfone.

Cada escolha de forma traz um ícone que desenha o que ela faz, como no editor de
topbar.

### Fundos do jogo

`npm run data:backgrounds` baixa os 18 cenários do wiki (`Screen_bg01` a
`Screen_bg18`) via API do MediaWiki e gera duas resoluções: a de uso (1408px) e
uma miniatura de 280px. Os 18 cabem em **912 KB** no total.

As duas resoluções existem porque o seletor mostra todos de uma vez — puxar os
arquivos grandes só para desenhar quadradinhos de 72px custaria alguns MB à toa.

### Decisões que valem registro

**Dessaturação em vez de legenda** — no layout de confronto o time perdedor sai
em tons de cinza. A diferença já diz quem ganhou, sem precisar escrever.

**Nome que encolhe** — medir texto em SVG exigiria renderizar antes, então a
largura é estimada por número de caracteres e a fonte diminui até caber. Sem
isso, um nome comprido invadia o retrato vizinho.

**Escalas entram no arranjo, não depois** — aumentar a altura das molduras
afasta as fileiras em vez de sobrepô-las. Antes as molduras eram esticadas no
fim, quando as posições já estavam fechadas, e as linhas se atropelavam.

**Células calculadas, não fixas** — no layout de times a célula sai do espaço
disponível, para o bloco ocupar sua metade da tela com 3 ou com 10 jogadores. A
última linha incompleta fica centrada, senão o time parecia torto.

**Nome preso ao passo do arranjo** — ampliar a moldura além de 100% não aumenta
o texto. O nome se mede pelo espaço que o arranjo reservou (`pitch`), não pela
moldura: sem isso, esticar os retratos fazia os nomes colidirem.

**Nome no fim do bloco, não sob a moldura** — todos os nomes de uma fileira são
escritos na mesma linha (`nameY`), medida a partir do fim do espaço reservado.
Antes o texto acompanhava a moldura, então o campeão — moldura maior, fonte
maior — escrevia mais baixo que os vizinhos e a fileira ficava em degraus.

**Altura do time vem da área, não da proporção** — no layout de times a célula
cresce até o limite do espaço disponível (`pitchW * 1.85`). A proporção antiga
travava a altura antes do fim da área e sobrava tela vazia embaixo, com os
personagens pequenos à toa.

**O crescimento desce** — aumentar a altura das molduras empurra o bloco para
baixo, nunca para cima: em cima estão o título, o rótulo do time e as
colocações, enquanto a faixa do rodapé tem os canais num canto, os narradores no
outro e o meio vazio. O bloco avança sobre ela e para antes da sua linha de
texto; se nem assim couber, a alavanca para de responder em vez de desenhar fora
da tela. O pé da moldura fica sempre na linha do nome — encolhendo, o retrato
continua apoiado nela; crescendo, é a linha que desce junto.

**Uma escala para o arranjo inteiro** — o campeão do Top 8 tem mais folga
vertical que as fileiras de trás, e o degrau do meio do pódio tem mais que os
laterais. A escala aplicada é a menor que o arranjo comporta, igual para todos:
deixar cada bloco crescer até o seu próprio limite fazia o destaque virar
desproporção.

Os retratos mostram o personagem **de corpo inteiro**, na mesma escala para todo
o elenco — a régua está em [Escala do elenco](#escala-do-elenco); zoom e
deslocamento ajustam por cima disso. A topbar continua usando o enquadramento de
rosto, que é o que cabe numa barra; as contas vivem em
[src/portrait.ts](src/portrait.ts).


---

## Âncoras do chibi

O ponto de centralização de cada sprite é marcado à mão em
`scripts/anchor-overrides.json` e vai para 50% x 25% do bloco — é ele que alinha
os rostos na topbar. **Seis estavam fora do rosto**: enkidu, hilda, kuon, merkava,
mika e waldstein. A âncora da Hilda caía no vazio do cabelo, a do Waldstein na
capa, a da Mika no escudo.

O sintoma é fácil de confundir com escala: com a âncora errada a topbar mostrava
o pedaço errado do sprite, e cada um desses seis tinha um multiplicador em
`scale-overrides.json` que compensava o enquadramento errado com tamanho. Os dois
são botões diferentes — mexer no de escala não conserta posição.

Corrigidas medindo sobre o próprio sprite e convertendo a posição observada no
recorte da topbar de volta para fração da imagem. A conferência é visual:

```
npm run data:anchors -- --contact   # .cache/anchor-full.png e anchor-sd.png
```

Ao mexer numa âncora, rode `npm run data:anchors` e **depois** `npm run
data:scale`: `sdBody` é medido a partir da âncora, então a ordem importa. E
`data:scale` redimensiona o sprite no lugar — refazer a régua com a âncora errada
reescala o arquivo e a perda de qualidade não volta.

---

## A forma dos editores

Todo módulo com prévia tem a mesma planta: **controles à esquerda**, em colunas
que se reorganizam pela largura da tela, e à direita uma **coluna fixa** com a
prévia em cima e, embaixo dela, o que vale para o trabalho inteiro — nome do
template, nome e logo do evento, salvar.

A prévia é fixa porque é a resposta de cada ajuste: rolando os controles, ela
saía de cena justamente enquanto se mexia nela. E o rodapé existe porque nome e
salvar não são ajustes — são o começo e o fim. No topo eles disputavam espaço com
o que se mexe o tempo todo; no meio dos controles, o campo de nome se perdia
entre trinta sliders.

Cada família tem **lista e editor**, e não uma tela só: `/topbar`, `/winners`,
`/animacoes` e `/chaves` listam, `/…/novo` e `/…/:id` editam. Com meia dúzia de
estilos, achar um vira o trabalho — e um seletor dentro do editor esconde
justamente o que diferencia dois estilos, que é visual. Na lista cada um aparece
desenhado: a chave com gente de exemplo dentro, a topbar com o par de barras.

A miniatura da lista de chaves mede a si mesma: a escala sai da largura medida
da coluna, e não de um número escolhido. Com escala fixa, a caixa era a coluna
inteira e o desenho tinha largura própria — sobrava fundo à direita dele, um 16:9
dentro de outro maior.

A lista de animações é a exceção que confirma a regra: o cartão **não toca**.
Cinco cenas em laço na mesma tela competem por atenção e nenhuma se vê; o cartão
mostra a coreografia, a cor e o tempo, e ver mesmo é no editor, onde ela ocupa a
tela e toca a cada ajuste.

---

## Chaves de torneio

O assunto vive em duas telas, e a divisão é a mesma do resto do projeto: **quem
joga** de um lado, **com que cara** do outro.

| Tela | O que decide |
| --- | --- |
| **Chaves** | o visual: o modo, o fundo, o efeito, as infos, cores, tamanho da vaga, entrada e saída |
| **Overlay** | o torneio: quem entrou, em que ordem, o placar e quem passou |

O template não guarda ninguém. Guardar amarraria a cara da chave ao torneio que
estava aberto quando ela foi desenhada, e o visual é justamente o que se
reaproveita de evento em evento. Do outro lado, quem entrou e por quanto ganhou
muda **durante** a transmissão — que é onde o painel do overlay está.

O torneio aceita até **40 participantes**, vindos do cadastro ou digitados na hora
no próprio painel — num torneio aberto sempre aparece alguém de última hora.

### Os três modos

O template escolhe o que a chave desenha, e os três não são variações de estilo —
são formatos diferentes de disputa:

| Modo | O que é |
| --- | --- |
| **Confronto** | um contra um, a chave de sempre |
| **Duplas** | dois por vaga: os dois bonecos lado a lado, os dois nomes e a bandeira de cada |
| **Times** | duas torres, uma escalação por lado, sem chave nenhuma |

Em **duplas**, a dupla é **um** participante: avança junta, tem um placar só e
ocupa uma vaga só. Por isso o parceiro mora dentro da inscrição
(`Entry.partner`) e não como uma segunda inscrição — que teria de ser mantida ao
lado da primeira em cada sorteio e cada troca de posição. Trocar o parceiro **não**
refaz os confrontos: quem a dupla encara não muda por causa de quem está do lado,
e refazer apagaria placar por uma correção de nome.

O anel da vaga, em duplas, é um **degradê a -45°**: começa na cor do primeiro, à
esquerda, e termina na do segundo, à direita. O selo de quem passou fica na ponta
direita e usa a cor do segundo, fechando a leitura da cor que corre pela vaga.

As pontas entram **na ordem inversa** no CSS: 0° aponta para cima e o ângulo
cresce no sentido horário, então `-45deg` aponta para o topo-**esquerdo** e a
primeira cor da lista é a que fica embaixo à direita. Escrito na ordem natural, o
segundo jogador pintava o lado esquerdo da vaga.

Ele é desenhado como borda em degradê — o fundo recortado em `padding-box` sobre
o degradê em `border-box` —, e não com `mask`, que o navegador do OBS nem sempre
compõe. As pontas já vêm misturadas com a cor da borda na força do realce, em JS:
`color-mix()` só existe a partir do Chrome 111, e cor que aquele navegador não
entende não degrada, some.

A **sigla do time** entra nas duas linhas, como entra na vaga do confronto: a
opção é uma só no template e vale nos três desenhos. Ela ficava de fora só em
duplas, o que fazia a opção parecer quebrada — ligada, e nada aparecendo.

Os dois nomes ficam empilhados, não lado a lado. Numa vaga de 300px com dois
retratos sobram 180, e dois nomes na mesma linha ficariam com 90px cada — o que
não se lê numa transmissão. Meia altura cada um preserva a largura inteira do
nome. Os retratos também estreitam para 72% no modo de duplas: o recorte perde as
laterais, não a cabeça, que é o que a régua de rosto já centraliza.

O nome do time recua o dobro das outras peças: ele começa na borda da coluna,
enquanto as vagas abaixo começam depois do boneco — com o mesmo respiro, ficava
encostado na barra de cor.

A divisão automática vale **só enquanto ninguém tocou nas torres**. Esvaziar a
escalação é um gesto como outro qualquer, e depois dele as torres ficam vazias —
antes, tirar todo mundo fazia o sistema devolver o elenco inteiro no quadro
seguinte, desfazendo o que acabaram de fazer. Quem separa os dois casos é o campo
`touched`, que qualquer gesto liga.

O primeiro gesto numa torre **materializa** essa divisão: apagar ou pontuar
alguém que se está vendo em cena caía num array vazio enquanto a escalação era
só um cálculo — nada mudava no torneio, e nada mudando, nada subia para o OBS.

**Sem escalação, o elenco entra dividido ao meio.** O modo de times com um
torneio cheio e as torres vazias ia ao ar como dois cabeçalhos e mais nada — que
é como "a chave sem os jogadores" aparece no OBS. Um palpite óbvio vale mais que
um quadro vazio no meio da transmissão, e escalar à mão continua sobrescrevendo
o palpite; **Escalar todos**, no painel, materializa a mesma divisão para poder
ajustá-la.

O painel também diz, numa linha, o que está indo ao ar quando a chave está
ligada: quantos participantes e confrontos, ou os dois times e quantos escalados,
ou o que falta — sem torneio, sem estilo, sem gente. Do OBS não dá para saber
qual dos três é.

Em **times** não há confronto nem rodada: são duas colunas com uma escalação cada,
o cabeçalho com o nome do time, e o organizador apagando quem já caiu. **O time
não tem placar**: quem pontua é cada jogador, na sua vaga — um número no
cabeçalho competia com esses e dizia outra coisa.

**Cada lado tem cor própria** — a barra do cabeçalho e o texto do nome —, e as
quatro ficam no **template**, na seção *Cores dos times*: são a cara da tela,
decididas uma vez ao desenhar o modelo e reaproveitadas em toda guerra que usar
esse modelo. Nascem diferentes uma da outra, que é o que separa os dois lados de
relance. Do torneio vêm só o nome de cada time e quem está escalado; a barra das
vagas continua sendo a cor do personagem de cada um.
É como uma guerra 5x5 se acompanha. A estrutura fica em `Tournament.towers`, ao
lado dos confrontos e não no lugar deles — trocar de modo no meio de um evento não
pode apagar a chave que já foi ao ar, e a lista de participantes é a mesma nos
dois. Placar e cinza ficam na **casa** e não na pessoa: quem ocupa o terceiro
lugar da escalação herda o que já foi anotado nele.

### A chave

Eliminatória simples. O tamanho é a próxima potência de dois e as vagas que
sobram viram **bye**: com 40 pessoas a chave tem 64 vagas e 24 byes, o que é o
normal de um torneio e não um caso especial. Byes resolvem em cascata — dois byes
vizinhos deixam o confronto seguinte com um lado só, e sem o laço a chave ficava
com buracos que só sumiam quando alguém clicava.

A ordem de encaixe é a de sempre: 1 encara o último, 2 o penúltimo, de modo que
os dois primeiros só se cruzem na final. `seedOrder` a constrói por espelhamento
sucessivo.

Dá para **trocar duas pessoas de posição** ou **sortear tudo** (Fisher-Yates numa
cópia — sortear "trocando dois ao acaso N vezes" não dá distribuição uniforme, e
num sorteio de torneio isso importa). As duas operações refazem os confrontos:
mexer na ordem muda quem encara quem, e manter placar de um confronto que deixou
de existir seria pior que perdê-lo.

`slots` guarda **índice na lista**, não o objeto — trocar duas pessoas vira trocar
dois números, e o placar fica preso ao confronto, que é o que não muda.

### O template

Só o visual, e reaproveitado de evento em evento: boneco do personagem ao lado,
bandeira, sigla do time, placar, fonte e cores, **realce com a cor primária do
personagem** (o mesmo critério da topbar e da apresentação) e **perdedores em
cinza**, com a força regulável.

A prévia do editor usa os **players de exemplo**, como as miniaturas da topbar, e
a chave vem já jogada pela metade: sem vencedor não dá para conferir o selo, sem
perdedor não dá para conferir o cinza, e sem vaga vazia não dá para ver como a
rodada seguinte fica.

O cinza é `filter` no elemento inteiro, não troca de cor peça por peça: a vaga
tem arte, bandeira, nome e placar, cada um com a sua origem de cor, e apagar de
uma vez trata todos — inclusive os que vierem depois.

Nada de `rgb(from ...)` para misturar alfa: a sintaxe de cor relativa só existe
a partir do Chrome 119 e o navegador do OBS costuma estar atrás. O brilho sai de
um pseudo-elemento com opacidade própria.

O placar tem **faixa fixa**, larga o bastante para dois dígitos, e o número fica
centrado nela. Sem isso a caixa encolhia junto com o número — "2" ocupava menos
que "10" e o que sobrava ia para o nome ao lado —, e a coluna mudava de largura
de linha para linha: os nomes truncando em pontos diferentes e os números tortos
entre si.

Cada peça da vaga carrega o próprio respiro **à esquerda**, e o da direita é da
vaga inteira. Era o contrário — cada uma empurrava a seguinte —, e aí desligar o
boneco no template colava a bandeira na borda: o espaço que a separava dela era o
que o boneco carregava. A medida escala junto com a vaga (`--pad`), porque 6px
fixos numa prévia a 40% ficam proporcionalmente enormes.

O **selo de quem passou** marca o vencedor dentro da própria vaga. Ele ocupa o
lugar mesmo apagado: aparecer e sumir mudaria a largura útil da vaga, e o placar
dançaria de linha em linha conforme os resultados saíssem. Numa chave cortada nas
quartas ele é a única pista de quem avançou — a coluna da frente pode nem estar
em cena.

### A tela

A chave é uma **tela cheia**: o fundo cobre os 1920x1080, o efeito corre pela
borda do quadro, o título fica no topo e a chave, centrada no meio do que sobra.
Era uma caixa do tamanho da chave encostada no topo, e nessa forma o fundo virava
um adesivo com a transmissão aparecendo em volta dele.

O fundo é o mesmo cardápio da apresentação: **cor, degradê, imagem ou cenário
desfocado**, com véu por cima para os nomes continuarem legíveis. O padrão é **sem
fundo**, que é como a chave sempre foi ao ar — direto sobre a transmissão. Sobre
gameplay, porém, uma chave de 64 vagas se perde no cenário do jogo, e é aí que o
fundo deixa de ser enfeite.

O **respiro** é a margem entre a borda da tela e o conteúdo. O **canto** costuma
ser zero: arredondar um retângulo de 1920x1080 só aparece como falha.

Quem se move dentro da tela é a chave, e não a tela: o painel tem **tamanho** e
**ajuste vertical**, este último contado a partir do centro. Medir do topo obrigava
a refazer a conta toda vez que o título mudava de tamanho ou uma rodada saía de
cena.

**A área da chave termina onde o título começa.** Uma chave de 64 vagas é mais
alta que a tela, e subindo ela passava por cima do nome do evento; agora o corpo
recorta o que passa (`overflow: hidden`) e o deslocamento vertical mora na camada
de dentro — se morasse no corpo, levaria o recorte junto e o problema voltaria.
Quem precisa de mais rodada em cena usa o **tamanho** ou o **Mostrar a partir
de**, que corta as rodadas iniciais.

O **ajuste vertical** são dois botões de segurar, e não um slider: no slider, um
pixel de mouse vale dezenas de px de cena e acertar a altura exata vira sorte.
Segurando, o valor anda de oito em oito no mesmo ritmo; uma batidinha move um
passo só; e clicar no número volta ao centro.

O cenário é o único item resolvido **dentro** do desenho, e não no payload como a
logo e as pessoas: ele mora em `public/backgrounds/index.json`, que a fonte do OBS
carrega do mesmo endereço de onde carrega a página. Viajar resolvido só é
necessário para o que existe apenas no localStorage desta máquina.

### O efeito ao redor

Cinco animações em volta do quadro — **pulso**, **luz correndo**, **tracejado**,
**faíscas** e **varredura** —, com cor, intensidade, espessura e velocidade. Em
CSS e SVG, e não em vídeo, pela mesma razão da apresentação: recolorem com a cor
do template, escalam para qualquer resolução de fonte e não trazem arquivo nem
licença de terceiros junto.

As duas que percorrem a borda saem em SVG: em CSS o mesmo exigiria recortar o
miolo com `mask`, que o navegador embutido do OBS nem sempre compõe do jeito
esperado. O `pathLength` reescreve a régua do contorno para 100, e é o que permite
um tracejado em proporção — um dash em px teria que ser recalculado sempre que a
tela mudasse de tamanho.

Esses dois recuam meia espessura para dentro. O traço é centrado na linha do
retângulo e a tela recorta o que passa da borda: sem o recuo, metade da espessura
escolhida caía fora e o contorno saía com metade do peso pedido.

Detalhe que custou um bug: o `<svg>` precisa de `width`/`height` explícitos. É
elemento substituído, e posicionado com `inset: 0` e largura automática ele não
estica — cai no tamanho intrínseco de 300x150 e o contorno sai do tamanho de um
cartão de visita no canto do quadro, em vez de em volta dele.

### Entrada e saída

Um corte seco no meio da transmissão parece falha de fonte, então a tela entra e
sai animada. **Fade** é o discreto. **Barra** é uma faixa que entra pela direita
trazendo a tela atrás de si, e sai do mesmo jeito levando-a embora: o recorte e a
faixa correm com a mesma curva e no mesmo sentido nas duas pontas, e é isso que
gruda uma coisa na outra.

O recorte é `clip-path` na camada de conteúdo; a faixa corre por fora dela, senão
o próprio recorte a esconderia. E ela é **remontada a cada ponta**: a animação da
entrada já tinha terminado quando a saída começava, e o CSS não repete a mesma
animação sem que o elemento renasça — a tela saía sem o feixe, que era o que a
entrada tinha de melhor.

A faixa corre **centrada na linha do corte**, e não começando nela: `left` põe a
borda do elemento na posição, e o que tem de coincidir é o meio do feixe — meia
largura de diferença que, inclinada, aparecia ainda mais, porque a torção é
medida a partir do centro dela.

A barra aceita **inclinação**, de -45° a 45°. O corte é um polígono e não um
`inset` justamente por causa disso: o topo corre em `p + incl` e a base em
`p - incl`, com a faixa recebendo o mesmo desnível por um `skewX`. Com zero os
dois pontos coincidem e a borda sai reta, então um par de keyframes serve aos
dois casos. A `--folga` é o tanto que a passada anda além das bordas: numa
diagonal o canto de cima chega antes do de baixo, e sem ela sobrava um triângulo
do quadro no fim da entrada.

A saída tem um problema que a entrada não tem: quando o painel tira a chave do
ar, desenhar direto disso faria a tela sumir no mesmo quadro — sem saída nenhuma.

A primeira solução foi a fonte deduzir: `bracket` virava nulo, ela segurava o
último quadro e rodava um `setTimeout` próprio. Funcionava enquanto nada se
perdia no caminho. Só que o envio é de mão única e sem confirmação: bastava a
mensagem do desligamento chegar tarde, se perder, ou a fonte recarregar no meio
da transição, para as duas pontas discordarem — uma terminando a saída, a outra
ainda entrando. E não havia como uma corrigir a outra, porque **o estado da
animação não existia em lugar nenhum além delas**.

Agora o relógio é do painel e o payload descreve o estado inteiro:

| Campo | O que diz |
| --- | --- |
| `bracket` | o que desenhar; durante a saída ele **continua indo**, e só some no fim |
| `bracketPhase` | `in` (entrando ou no ar) ou `out` (saindo) |
| `bracketRun` | muda a cada entrada, e só aí |

A fonte virou função pura disso: desenha o que mandarem, na ponta que mandarem. O
`run` é o mesmo truque do `runId` da apresentação — remontar pela chave reinicia
a animação do CSS, e sem trocar de id ela não recomeça a cada reenvio. Junto com
o reenvio de dois segundos, qualquer mensagem sozinha basta para a fonte se
acertar: quem nasce no meio de uma saída faz a saída, não a entrada.

### As infos

**Título, subtítulo e nome da rodada**, com cor, tamanho e alinhamento. O título
vazio puxa o nome do próprio torneio, que é o que muda a cada evento; o campo
existe para quando a tela pede outra coisa ("Chave principal", "Repescagem").

Ficam no template, e não no torneio, porque são decisão de visual: o mesmo
torneio vai ao ar com título numa tela e sem nenhum noutra. Quem joga, o placar e
quem passou vêm do torneio, e é o painel do overlay que mexe neles ao vivo.

### No overlay

O painel é onde o torneio vive durante a transmissão: **criar**, **inscrever**,
**mexer na ordem**, **sortear**, e então operar o confronto — **somar e tirar
ponto** e **passar alguém**. Passar preenche a vaga na rodada seguinte; mudar de
ideia **refaz o caminho a partir dali** em vez de corrigir pela metade — apagar à
mão o que dependia de um resultado dá mais chance de deixar rastro do que
recalcular.

### O payload viaja como texto

Esta é a armadilha mais cara do projeto até agora, e vale entender antes de mexer
no envio.

O caminho até a fonte passa pela libobs: o obs-websocket converte o `event_data`
em `obs_data_t`, e nessa estrutura um array é `obs_data_array_t` — uma lista de
**objetos**, e nada mais. Array de número, de string, de booleano ou de outro
array não tem representação e **some no caminho**: chega vazio do outro lado.

O payload é cheio deles — `slots: [0, 7]`, `score: [2, 1]`, `dim: [true, false]`,
os nomes e a escalação das torres, as paradas do degradê. O que ia ao ar era a
chave desenhada e vazia: vagas sem ninguém, placar em branco, times sem nome. E
nada disso aparecia em teste no navegador, porque só o OBS de verdade faz essa
conversão.

Por isso `ObsLink.send` embrulha tudo num campo só, como **texto**
(`event_data: { json: "..." }`), e `listen` desempacota do outro lado — string
atravessa inteira. O `listen` ainda aceita o objeto cru, para uma fonte que ficou
aberta desde antes da troca continuar funcionando.

**O painel reenvia o estado a cada dois segundos** enquanto está no ar. O envio é
de mão única: o painel fala, a fonte escuta, e ninguém confirma nada. Basta a
fonte não estar ouvindo no instante do evento — recarregada, cena recém-ativada,
OBS reabrindo a página — para ela ficar parada num estado velho até alguém mexer
no painel de novo. Com o reenvio ela se acerta sozinha em no máximo dois
segundos. Só no modo ao vivo: com ele desligado o silêncio é o pedido, e é assim
que se monta o próximo confronto sem que ele vá ao ar antes da hora.

A chave cobre a cena inteira enquanto está no ar, e as barras ficam atrás dela —
com fundo transparente no template, as duas coisas convivem; com fundo pintado, a
chave é o que se vê.

O confronto é referenciado por "rodada-ordem" e não por objeto: o torneio é
reconstruído a cada resultado, e uma referência apontaria para algo que deixou de
existir.

**Mostrar a partir de** corta as rodadas iniciais. Uma chave de 40 mede
2080x4352px e não cabe em 1080p num tamanho legível; transmissão de verdade mostra
das quartas em diante. Cortada, a primeira rodada exibida vira a base e o
espaçamento recomeça nela.

A prévia do painel desenha a chave no mesmo arranjo da fonte do OBS, entrada e
saída incluídas. Quem opera o confronto dali precisa ver o que "passar" fez, e
conferir isso no OBS significa olhar para outra tela no meio do set.

### A tela fica de pé mesmo vazia

Sem confronto nenhum — o torneio ainda não montado, ou o último participante
removido — a tela continua no ar com o quadro, o efeito e o título, e sem vaga
dentro. Ela sumia, e isso é pior do que parece: tirar o último participante
apagava a peça inteira do ar no meio da transmissão, quando o que se queria era
só limpar a chave.

### O nome que vale é o do cadastro

A inscrição guarda um nome porque também aceita quem não está cadastrado; para
quem está, aquilo é só o retrato de quando a inscrição foi feita. A cena sempre
resolveu pelo cadastro (`resolvePerson`), mas as listas do painel liam o retrato
— renomear um player deixava a chave no ar com o nome novo e o painel com o
antigo. Agora as duas pontas leem do mesmo lugar.

### Mexer na chave pela prévia

Passando o mouse numa vaga aparecem os gestos, na própria vaga:

| Gesto | O que faz |
| --- | --- |
| **−** e **+** | placar daquele lado |
| **◐** | deixa em cinza, ou devolve a cor |
| **✕** | tira quem está na casa |
| **arrastar** | leva uma **cópia** para outra casa; quem foi arrastado continua onde estava |

O **✕ não aparece na primeira rodada**. É ali que a lista de participantes está
desenhada, e tirar alguém de lá o perderia da chave inteira — nas rodadas
seguintes a vaga é resultado, e esvaziá-la é justamente a correção que se quer.

O cinza à mão é um campo à parte do cinza do perdedor (`Match.dim`). Aquele é
consequência do resultado; este é decisão de quem opera — marcar quem desistiu,
quem foi desclassificado, ou quem já era numa fase que ainda não fechou.

Pôr alguém numa casa à mão **não** passa pela cascata de byes nem propaga nada: é
uma correção, e a cascata desfaria o que a mão acabou de fazer. Ela some sozinha se
um resultado anterior mudar depois, porque `setWinner` refaz o caminho todo dali
para a frente — e é assim que tem de ser.

Os botões são desenhados em **px fixos**, e não multiplicados pela escala: a prévia
mostra a cena a 40%, e um botão a 40% teria 9px de lado. Como o desenho não usa
`transform: scale`, um filho de tamanho fixo simplesmente não encolhe junto. E as
barras da prévia ganharam `pointer-events: none` — cobrem o quadro inteiro e
ficariam na frente da chave, que é onde se clica.

Sem linha de ligação desenhada: o espaço entre confrontos dobra a cada rodada, e
isso basta para cada par apontar para o meio do confronto seguinte. Linhas
exigiriam medir posições depois do layout, e a chave muda de forma a cada
resultado.

O vão entre confrontos da mesma coluna é o mesmo vão entre as duas vagas de um
confronto, e isso não é escolha de estilo: a altura de um confronto da rodada
seguinte é calculada como "dois da anterior mais o vão entre eles". Com a coluna
sem vão nenhum a conta sobrava um vão por rodada, e as colunas iam descolando —
na terceira rodada o confronto já não apontava para o meio do par que o
alimenta.

---

## Overlay para o OBS

### Um overlay é uma cena inteira

A aba **Overlay** lista cenas montadas: barras, logo, apresentação, chave, o
torneio que ela opera e a **chave do OBS** — endereço, porta e senha. Num evento
existem várias (as oitavas, a grand finals, o showmatch), e trocar num clique é o
que evita remontar a tela entre um set e outro, que é onde o erro acontece.

A chave do OBS fica no overlay porque a máquina muda com o evento: o OBS da
bancada tem uma senha, o do notebook de casa tem outra, o de um evento remoto
está noutro endereço. A senha fica no localStorage em texto, como todo o resto do
projeto — é a senha do OBS local de quem transmite, e o que a protege é a máquina
estar com o dono.

O overlay guarda **a cena inteira**, e isso inclui a chave em cena, o tamanho, o
ajuste vertical, a rodada inicial e o enquadramento das figuras da apresentação.
Ficavam só no estado da tela, e o preço era alto: abrir o overlay salvo — ou
recarregar o painel, ou trocar de um overlay para outro — voltava a chave para
desligada e mandava `bracket: null` para a fonte, tirando a chave do ar sem
ninguém ter pedido. Fora do preset ficaram só os gestos do momento: ocultar as
barras, o disparo da apresentação e qual confronto está selecionado.

**Trocar de overlay não derruba a conexão.** O link do WebSocket é um só na
aplicação e vive **fora do React** (`obsLink`, em `src/overlay/obs.ts`): dentro de
um componente ele morreria a cada navegação, e sair do painel para a lista e
voltar obrigaria a reconectar no meio da transmissão — que é exatamente quando não
dá para reconectar. O painel também é a **mesma rota** para todos os overlays: de
`/overlay/A` para `/overlay/B` muda o id, o componente continua montado e o que
troca é o que ele está editando.

### O painel

À direita, **só a prévia**, fixa. À esquerda, **abas**: Topbar, Apresentação,
Chave e Geral. Uma frente por vez — as peças da cena não se ajustam juntas, e
lado a lado viravam uma parede de campos onde achar o placar custava mais do que
mexer nele.

**Geral** guarda o que não se toca durante o set: nome do overlay, a chave do OBS
com o botão de conectar, a URL da fonte e o "ao vivo". Aqui ele é uma aba e não
um bloco sob a prévia — que é onde os outros editores o põem — porque é alto: com
ele embaixo, rolar até o campo de senha levava a prévia para fora da tela, e a
coluna fixa existe justamente para isso não acontecer.



Uma peça que muda no meio do set não pode ser um PNG. A aba **Overlay** monta a
topbar dos dois jogadores com o placar e entrega isso ao OBS como uma **fonte de
navegador**, atualizando durante a transmissão.

E sem backend: **não há servidor novo neste projeto**. A página do overlay é a
mesma aplicação, então quem já serve o painel serve ela também — `npm run dev`,
`npm run preview` ou o `dist/` publicado em qualquer lugar. No OBS, a fonte
aponta para `/overlay/live`.

### O que uma página pode e o que não pode

Uma página web **não abre porta TCP**: ela conversa com servidores, nunca é um.
Não existe "ligar um servidor pelo navegador" — o que existe é usar um servidor
que já esteja de pé. Aqui são dois, e nenhum é nosso: o que serve o app, e o
**WebSocket que o próprio OBS traz embutido**.

### Os três caminhos até a fonte

O estado chega ao overlay por três vias, e a página escuta as três
([src/overlay/channel.ts](src/overlay/channel.ts)):

1. **Evento do obs-browser** — é o tempo real. O painel fala com o
   obs-websocket (Ferramentas → Configurações do Servidor WebSocket) e dispara um
   evento *dentro* da fonte de navegador, via `CallVendorRequest`. A fonte
   redesenha sem recarregar, o que evita o piscar em cena. A autenticação por
   desafio está em [src/overlay/obs.ts](src/overlay/obs.ts), em umas poucas
   linhas: `base64(sha256(...))` duas vezes e pronto.
2. **BroadcastChannel** — quando o overlay está aberto noutra aba do mesmo
   navegador. Serve para conferir sem abrir o OBS, e para quem prefere capturar a
   janela do navegador a usar fonte de navegador.
3. **Hash da URL** — o botão de copiar leva o estado embutido no endereço, então
   a fonte **já abre preenchida**, antes de qualquer atualização. É o caminho que
   funciona mesmo com o obs-websocket desligado; só que aí atualizar exige
   recarregar a fonte.

As imagens saem do caminho da URL: a logo do time e a logo do meio são data
URL, sozinhas passam de 50 KB e estourariam o endereço. Pelo WebSocket elas vão
inteiras. Com dois jogadores e o template completo, a URL fica em torno de
**1,5 KB**.

O painel manda o **template inteiro** junto com o placar, e não o id: o OBS não
tem o localStorage da sua máquina, e com o id a fonte não saberia desenhar nada.

Duas coisas que só aparecem em uso: a página do overlay não tem fundo — o
navegador do OBS compõe sobre a cena, e qualquer cor ali viraria um retângulo por
cima da transmissão —, e o `+` do placar soma a partir do valor atual, não do que
estava na tela quando o clique começou; numa rajada de cliques, três viravam um
ponto só.

Com "ao vivo" ligado cada mexida sai na hora; desligado, só no botão **Atualizar
overlay** — que é o que serve para montar o próximo confronto enquanto o anterior
ainda está em cena.

### Onde a barra fica

Quatro controles decidem o arranjo, e dois deles são coisas diferentes que é
fácil confundir:

| Controle | O que faz |
| --- | --- |
| **Largura de cada barra** | quanto de cena cada barra ocupa |
| **Vão entre elas** | o espaço do meio, onde a logo entra |
| **Tamanho** | escala o conjunto todo — barras, vão e logo |
| **Posição vertical** | distância do topo da cena até as barras |

Largura é o que se acerta uma vez, montando a cena. Tamanho é o ajuste de
depois, quando o arranjo já está certo mas o conjunto ficou pequeno ou grande
demais para a resolução da transmissão.

As barras se posicionam **dentro do quadro**: centradas na horizontal, a
`offsetY` px do topo. Antes elas caíam no canto superior esquerdo com uma folga
fixa, e acertar o lugar exigia arrastar a fonte dentro do OBS — o que muda a
escala junto e desalinha a apresentação, que continua mirando o quadro inteiro.

Por isso a prévia do painel passou a mostrar **o quadro inteiro**, 16:9, e não as
barras encaixadas numa faixa: enquadrando só as barras, a posição vertical
ficaria sem resposta na tela e o efeito do controle só apareceria no OBS. A
largura dela é limitada para o 16:9 não empurrar os controles para fora da tela.

As duas escalas se multiplicam e não se confundem. `scale` é a lente de quem
está olhando — a prévia encolhida no painel, a fonte do OBS que não tem 1920 de
largura. `zoom` é decisão de visual, viaja no payload e vale igual nos dois.

### Espelhamento e ocultar

A barra da direita é **sempre espelhada** — é o que faz as duas se encararem, e
nunca foi uma escolha de visual: era um bug com botão. O controle saiu.

O botão **Ocultar barras** tira o placar de cena sem mexer na fonte do OBS.
Esconder pelo OBS significa clicar no olho da fonte, que é longe do painel e
fácil de esquecer ligado — e há um momento em que ocultar é obrigatório: a
apresentação usa o quadro inteiro, e o placar por cima dela fica no caminho.

Ocultar e a apresentação são os dois estados que **não** entram no preset:
carregar um preset no meio da transmissão não pode reacender a barra que acabou
de ser escondida, nem redisparar uma animação.

### A logo do meio

O vão entre as duas barras aceita uma imagem: logo do evento, do patrocinador, do
que for. Ela vem das **logos cadastradas** em Logos, e não de um upload próprio —
assim a mesma arte serve o overlay e as peças promocionais, e não há duas cópias
da mesma imagem disputando a cota do localStorage.

Quatro ajustes, porque nenhuma logo cai certa de primeira: **tamanho** (a altura
manda, a largura sai da proporção), **alinhamento** vertical em relação às barras,
**espaçamento** dos dois lados e um **ajuste vertical** fino. O espaçamento é um
extra sobre o vão das barras, não um substituto: mexer num não desfaz o outro.

O alinhamento vai no `align-self` da logo, e não no `align-items` do palco —
senão alinhar a logo mexeria também nas barras.

### Presets

Montar a tela é trabalho de antes da transmissão, não de durante. O **preset**
grava tudo que a aba define — template, largura, vão, logo com os quatro ajustes,
jogadores e placar — sob um nome, e devolve num clique
([src/overlay/presets.ts](src/overlay/presets.ts)).

Um botão só para gravar: com o nome do preset carregado intacto ele grava por
cima; mudou o nome, vira preset novo. É como se tira "Quartas" de "Oitavas" sem
passar por um menu de duplicar.

O preset guarda o **id** da logo, não a imagem — ao contrário do payload, que
viaja resolvido. O localStorage tem poucos MB no total, e meia dúzia de presets
repetindo a mesma logo estouraria a cota para guardar seis vezes o que já está no
cadastro. Pela mesma razão a tela inteira vive num estado só, e não num
`useState` por controle: espalhado, salvar significaria listar todos os campos de
novo em cada ponto — e esquecer um na próxima vez que a tela ganhasse um.

### O formato da tela

A prévia pega a faixa de cima inteira e os controles se abrem numa grade embaixo,
em vez do preview lateral das telas de editor. A cena do overlay tem quase dois
mil pixels de largura por uma faixa de altura: espremida numa coluna de 720px ela
sai ilegível, e os controles ao lado viram uma tira de rolagem — e rolar no meio
de um set é justamente quando não dá para rolar.

A escala da prévia é medida, não fixa: um `ResizeObserver` compara a largura da
faixa com a largura da cena e ajusta. Com escala fixa, mexer na largura das barras
acabava jogando metade da cena para fora do painel.

---

## Animações de apresentação

A aba **Animações** anuncia os dois jogadores antes do set: as figuras entram, os
nomes sobem, um efeito atravessa a tela, e em cinco segundos sai tudo. No painel
do overlay, **Rodar apresentação** dispara com os dois que já estão escolhidos —
não há uma segunda seleção para divergir da barra.

### Doze coreografias, não um editor de linha do tempo

| Efeito | O que faz |
| --- | --- |
| **Abertura** | clarão e onda de choque no ponto onde os dois se encontram |
| **Correntes** | correntes de elo desenhado varrem a tela e balançam no lugar |
| **Chamas** | línguas de fogo sobem do chão levantando brasas |
| **Relâmpago** | raios rasgam o quadro e o clarão pisca junto |
| **Estilhaço** | o vidro trinca e os cacos abrem para os dois |
| **Neon** | grade em fuga e faixa de luz atravessando, ao estilo synthwave |
| **Pétalas** | pétalas caem em três profundidades, com vento |
| **Glitch** | canais deslocados, varredura e cortes de sinal |
| **Vórtice** | anéis de energia girando em torno do centro |
| **Cortina** | lâminas diagonais varrem o quadro, ao estilo esports |
| **Faíscas** | estouro de partículas a partir do encontro |
| **Ondas** | anéis concêntricos de choque abrindo do centro |

São efeitos **desenhados em CSS e SVG, não vídeo**. Um render pronto ficaria preso
à cor e à resolução em que foi exportado, pesaria no repositório e traria licença
de terceiros junto; desenhado, cada efeito recolore com a cor do template e escala
para qualquer tamanho de fonte.

O que muda de torneio para torneio é a cor, a fonte e se o personagem entra em
chibi — a coreografia em si não é decisão de quem transmite. Por isso o store
[nasce cheio](src/anim/store.ts). São **cinco** templates de fábrica e não doze:
doze seriam doze linhas para rolar num seletor antes de chegar no que se quer, e o
estilo é um campo — trocá-lo num destes leva aos outros sem criar nada. Chave
ausente no localStorage significa primeira visita; chave presente com lista vazia
significa que o usuário apagou tudo, e ressemear ali seria desfazer isso.

O que se ajusta em cada uma: **chibi ou arte oficial**, **fonte e cor do nome**,
cor da sigla do time, **cor do efeito**, se cada lado acende com a cor primária do
próprio personagem, o **fundo**, e a **duração**.

**O enquadramento das figuras não está aqui**: tamanho e altura são do painel do
overlay. O ajuste depende de quem foi escalado — duas artes largas pedem espaço no
meio, duas estreitas sobram —, e quem entra só se sabe na hora do set. Os valores
gravados no template continuam valendo como ponto de partida: escolher a animação
no painel carrega os dois nos controles de lá.

Eles viajam no **disparo**, e não no template (`AnimPlay.figureZoom`,
`figureOffsetY`). Como o painel manda o payload inteiro a cada mexida, arrastar o
slider reposiciona a apresentação que já está em cena, em vez de valer só na
próxima vez que ela tocar.

### Fade da cena

Com fundo, o quadro aparece e some de uma vez, e num corte seco isso pisca na
transmissão. **Entrada** e **saída** são reguláveis em ms, e os controles só
aparecem quando há fundo — sem ele a cena já é transparente e cada peça entra e
sai por conta própria.

São **duas camadas aninhadas**, e não uma animação só: entrada e saída têm
durações independentes, e keyframe de CSS não aceita porcentagem vinda de
variável — não dá para escrever "escurece a partir de (dur − fadeOut)".
Aninhando, a opacidade de uma multiplica a da outra sem que as duas disputem a
mesma propriedade.

### O fundo

Cinco origens: **sem fundo** (a transmissão aparece atrás, como o overlay sempre
fez), **cor sólida**, **degradê**, **cenário desfocado** — os mesmos fundos de
`public/backgrounds` que os gráficos usam — e **imagem própria**, reduzida a
1600px no upload como no editor de gráficos.

O desfoque é o que transforma um cenário em fundo: nítido, ele disputa a atenção
com os personagens que deveria emoldurar. Ele mora num elemento separado da
imagem, porque `filter` borra tudo que estiver dentro do elemento — aplicado no
contêiner, levaria os personagens junto. E a imagem escala junto com o desfoque:
borrar deixa a borda transparente, e sem a folga aparece uma moldura clara em
volta do quadro.

O cenário viaja **resolvido em URL**, como a logo do meio viaja resolvida em
imagem: a fonte do OBS não tem o índice de fundos para procurar o id.

### HTML e CSS, ao contrário do resto da arte

A topbar e o gráfico de vencedores são SVG porque existem para virar imagem — um
SVG já é o próprio material de exportação, em qualquer resolução. A apresentação
é o inverso: nunca vira arquivo, toca uma vez na transmissão e acaba. O que
importa aqui é keyframe, e keyframe em CSS é uma linha do que em SMIL seria um
bloco.

Toda a coreografia vive no CSS; [AnimStage](src/anim/AnimStage.tsx) só monta o
palco e passa as variáveis. **Cada elemento roda uma animação só**, com a duração
inteira e as fases escritas como porcentagem — entrada até 18%, sustentação até
82%, saída no resto. A alternativa seria uma animação curta por fase com
`animation-delay` calculado: cada mudança de duração exigiria refazer as contas em
cinco lugares, e bastava uma errar para a coreografia descolar. Do jeito escolhido,
esticar `--dur` estica tudo junto por construção.

A corrente não desenha elo por elo: são dois traços sobre a mesma diagonal, com a
mesma cadência de tracejado e meio elo de diferença, o de baixo mais grosso e
escuro. Parado é um tracejado duplo; em movimento o olho fecha a forma. Um
`<pattern>` de elos de verdade custaria dez vezes mais nós de SVG pelo mesmo
resultado nessa velocidade.

Nada de `color-mix` nem `oklab` nos degradês, por mais que encurtassem o código: o
navegador embutido do OBS costuma estar algumas versões atrás do Chrome de mesa, e
uma cor que ele não entende não degrada — some.

### Tocar sem repetir

O disparo carrega um **`runId`**, e é a mudança dele — não a presença do template —
que a fonte lê como "toca agora". O painel manda o payload inteiro a cada mexida,
então sem isso um ponto no placar reiniciaria a apresentação do zero. A página do
overlay guarda qual disparo já terminou, o que também dispensa o painel de voltar
depois só para limpá-la.

A apresentação sai do caminho do hash junto com as imagens: o hash serve para a
fonte abrir preenchida, e uma animação gravada no endereço tocaria de novo a cada
recarga da fonte — inclusive no meio de um set.

### A prévia parada

Entre um teste e outro a cena fica **congelada na pose de sustentação**, com
atraso negativo e a animação pausada: cada elemento salta para 45% da própria
linha do tempo e fica ali, tudo em cena. Parar no fim deixaria a tela vazia — o
último keyframe é a saída —, e prévia vazia lê como coisa quebrada. O mesmo truque
atende quem configurou o sistema para menos movimento.

Mexer no template redispara a prévia, mas com 400ms de espera: arrastar o slider
da duração dispara uma mudança por quadro, e sem isso a prévia reiniciava trinta
vezes por segundo em vez de mostrar o resultado.

### O enquadramento dos personagens

**A régua é a cabeça, não a altura desenhada.** O gráfico de vencedores normaliza
a extensão desenhada (`leaderFigure`) e ali faz sentido: são duas figuras grandes
nas laterais e o que salta aos olhos é a altura. Na apresentação não servia —
medido sobre os 28, a cabeça variava **2,70x**, com o Waldstein saindo com 214px
de rosto ao lado dos 79px da Vatista. Cabeça igual é o que lê como "mesma escala"
com os dois lado a lado; com a régua nova a variação cai para **1,24x** na arte
oficial e **1,00x** no chibi.

O que **não** dá para fazer é normalizar pela altura do personagem: o dado não
existe. `artBody` mede a extensão desenhada *naquela ilustração*, e o
enquadramento é decisão do artista — a arte do Waldstein é um corte fechado do
tronco de um gigante, a da Vatista mostra o corpo inteiro mais a auréola.
Normalizando a cabeça, ele sairia o **mais baixo** do elenco. Por isso a figura é
ancorada pelo rosto e o corpo cai onde cair.

O chibi tem **a mesma média**, com olhos-pés no lugar da caixa de rosto (ele não
tem uma). Só olhos-pés errava pelo mesmo motivo que a altura erra na arte: mede o
enquadramento. Medida a área desenhada com olhos-pés fixo, ela variava **9,47x**
no elenco — o chibi do Waldstein dava 687k contra 72k do Ogre. Com a média, 3,08x.

A linha de rosto dele é bem mais baixa que a da arte, porque é atarracado e de
cabeça enorme.

`animScale` **não** vale para o chibi: foi calibrada olhando a arte oficial, e o
chibi tem régua própria. Aplicá-la nos dois faria a correção do gigante entrar
duas vezes no sprite dele. Os dois números saíram de varrer a combinação que deixa o menor
desvio de rosto no elenco todo.

**Na horizontal**, o rosto vai para o meio da metade — que é onde o nome fica
centrado —, de modo que a faixa do nome caia exatamente sob ele. Antes o rosto
ficava a 55% (ou 45%) e o nome a 50%, e os dois não se encontravam.

O ponto usado é o do **rosto** (`anchor`), não o do corpo. `bodyAnchor` existe
para o gráfico de vencedores, onde a mira que enquadra bem uma cabeça deixa a
figura torta no quadro; aqui o alvo é o rosto, e usar o outro ponto tirava a
Yuzuriha — a única do elenco que tem `bodyAnchor` — do lugar.

**Na vertical** o rosto mira uma linha comum, mas quem não caberia é **empurrado
para dentro, não encolhido**. Já tentei o contrário: alinha os rostos, mas cobra
em tamanho de quem tem muito desenhado acima do rosto — as luvas da Mika, as asas
da Kuon —, e eram justamente os que tinham acabado de ser ajustados à mão.
Empurrar preserva o tamanho e não corta nada; o preço é que sete dos vinte e oito
ficam fora da linha, até 138px.

A conta do topo é pela **imagem** e não pela figura medida: `artBody.above` para
no topo do corpo com substância, e asa fina, ponta de cabelo e auréola não contam
— foi assim que a Kuon perdia 95px de asa.

### A régua da apresentação

**Média geométrica de cabeça e área desenhada**, com o Carmine como referência. A
fórmula vive em [AnimStage.tsx](src/anim/AnimStage.tsx); `scale-overrides.json`
guarda só exceções.

A altura desenhada — a régua do gráfico de vencedores — não serve aqui: ela mede o
**enquadramento da ilustração**, não o personagem. A arte do Hyde é um plano
afastado onde espada e rastro respondem por metade da figura; a da Linne é um
plano fechado onde quase tudo é ela. Por altura, a Linne saía "gigante" ao lado
dele estando mais baixa.

As duas réguas que sobram erram, e para o mesmo lado em personagens diferentes:

| Régua | Imune a | Erra em |
| --- | --- | --- |
| **Cabeça** (`face.width`) | pose | caixa marcada com critério diferente — a do Hyde inclui o cabelo e o encolhe |
| **Área** sólida (`artSolid`) | pose e enquadramento | capa e vestido contam como corpo e encolhem quem tem manto |

A média divide cada erro pela metade em vez de somá-los. Conferida contra os seis
ajustes já julgados a olho, acerta cinco; cada régua sozinha acerta dois.

`artSolid` é a fração da arte com alfa ≥ 200, medida por
[detect-scale.mjs](scripts/detect-scale.mjs) — brilho e rastro são
semitransparentes e não são corpo. Sem ele, a régua cai na cabeça sozinha, então
personagem novo desenha razoável antes de `npm run data:scale` rodar.

**As exceções** ficam em `anim`, e existem porque a régua não sabe ler pose nem
separar personagem de adereço. São de três tipos:

| Tipo | Quem | Por quê |
| --- | --- | --- |
| Adereço domina a imagem | Gordeau 1.35, Yuzuriha 1.35, Tsurugi 1.2 | foice, capa e katana, braço erguido — a medida vai para o objeto |
| Manto conta como corpo | Wagner 1.15 | a área a encolhe |
| Tamanho é do personagem | Waldstein 1.45, Merkava 1.5, Nanase 0.78, Linne 0.85 | gigantes e crianças; a régua os iguala e não deveria |

O resto se acerta contra a **proporção corporal do Hyde**, que virou a referência
prática: Seth 0.92, Chaos 0.88, Enkidu 0.92, Eltnum 0.82 (de costas, um pouco
abaixo).

O critério é sempre o mesmo: renderizar o personagem ao lado do Hyde e comparar o
corpo, não a extensão. O seletor da prévia serve para isso na aba.

### Uma nota sobre peso

As artes somam ~66 MB em PNG. Ficam assim de propósito: são a fonte de qualidade
para export em alta resolução. Quando a UI começar a carregar muitas de uma vez,
vale gerar derivados WebP só para exibição, mantendo os PNGs para o render final.

---

Imagens e dados pertencem à Arc System Works / French-Bread, usados aqui para
material de divulgação de torneios da comunidade.
