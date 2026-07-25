# Handoff: header de duas faixas, rodapé e cor secundária "areia"

Origem: projeto do Claude Design
`https://claude.ai/design/p/ff7f7a0a-ac3e-4f16-bf47-0f3b390409f9`
(arquivos `Futebol Hoje - Header e Footer.dc.html`, `Futebol Hoje - Header claro bege.dc.html`
e `design_handoff_header_footer_sand/README.md`).

Substitui a padronização anterior, que só alinhava a barra branca de uma faixa
aos tokens. Isto aqui é redesenho estrutural da navegação.

## Motivação (do handoff)

O header antigo misturava dois níveis num dropdown só: qual **produto** o
usuário está usando e qual **esporte** está vendo. O novo separa em duas
faixas — e "Configurações" passa a morar num menu **Perfil**.

## Variante escolhida: forest

O README do handoff recomendava a variante **bege** (`#F4EDDC`). O Victor
escolheu a **forest** (`#0a3d2e`) em 2026-07-24, com a estrutura idêntica.

As duas são o mesmo esqueleto com o mapa de cores invertido, então trocar é
mexer nas classes de cor do `AnalyticsNav` e do `Footer` — não na estrutura.

## O que foi implementado

| Faixa | Altura | Conteúdo |
| --- | --- | --- |
| 1 | 60px | logo · Análises / Betinho / [Bolão] · PREMIUM · pill Perfil |
| 2 | 46px | pills de esporte (Futebol / NBA) + sub-seções do produto ativo |

Rodapé: 4 colunas (marca + Análises + Ferramentas + Suporte) sobre `forest`, com
barra legal em `forest-deep` (`#051f12`) contendo copyright, link de termos,
badge `+18` e o aviso de jogo responsável.

Tokens novos em `tailwind.config.ts`: escala `sand` (7 tons) e `forest-deep`.

## Omitido de propósito

Itens do desenho que **não existem no app** — decisão do Victor de deixar fora
em vez de renderizar botão morto:

- Busca `⌘K` (command palette)
- `+4 esportes`
- `Odds em queda` · `Favoritos` · `Agenda`

Também fora:

- **`Perguntas frequentes`** na coluna Suporte — não existe rota de FAQ.
- **`Atualizado HH:MM`** na linha de contexto — a prop existe
  (`context.updatedAt`), mas nenhuma página passa ainda: não há fonte de dado
  ligada, e cravar um horário fixo seria mentira na tela.

## Desvios conscientes do desenho

**1. Sub-seções ficaram na faixa 2 (à direita).**
O desenho tira os dropdowns e diz que as sub-seções viram tabs dentro de cada
tela — tabs que não existem. Implementar ao pé da letra deixaria **7 páginas
órfãs**: `/oportunidades`, `/analise-360`, `/home-games`, `/report`,
`/futebol/oportunidades`, `/futebol/jogos`, `/betting-dashboard`.

A solução foi ocupar o espaço da direita da faixa 2 — que ficou vazio porque
"Odds em queda / Favoritos / Agenda" foram omitidos — com as sub-seções do
produto ativo. Mantém os dois níveis separados e não órfã nada. Quando as tabs
in-page existirem, é só remover esse bloco.

**2. Mobile: tab bar implementada, hambúrguer removido.**
Como as sub-seções foram parar na faixa 2 (item 1), o rail mobile pôde
carregá-las junto com os pills de esporte — rolando na horizontal. Isso
destravou a tab bar do desenho sem depender das tabs in-page.

- Topo compacto 52px: logo 20px · [Voltar] · avatar 30px.
- Rail 42px (`overflow-x` sem scrollbar): pills de esporte · divisor ·
  sub-seções do produto ativo.
- Tab bar fixa 62px: Análises · Betinho · [Bolão] · Perfil. Deslogado, o
  último item vira **Entrar** e aponta pro `/auth` — não há menu de conta
  pra abrir.
- A barra é `position:fixed`, então cobriria os últimos 62px da página. O
  `MobileTabBar` põe a classe `has-tabbar` no `<body>` enquanto está montado,
  e o `index.css` reserva `62px + env(safe-area-inset-bottom)` abaixo de
  768px. Em rotas sem `AnalyticsNav` (landings) a classe sai junto.

**3. Canvas da página não mudou.**
O protótipo usa `#f8f4ea` (`sand-50`) como fundo da página; o app segue em
`#f6f7f5` (`--canvas`). Trocar afeta todas as telas, não só header/rodapé —
fica como decisão à parte. A diferença entre os dois é sutil e não quebra a
composição.

**4. Ordem dos botões deslogado: `Assinar` antes de `Entrar`.**
A convenção web põe o CTA primário na ponta direita, mas aqui ela brigaria com
o próprio header: logado, a ponta é o pill **Perfil**. Com esta ordem os dois
estados batem — `[PREMIUM][Perfil]` e `[Assinar][Entrar]` — o botão âmbar não
muda de posição quando o usuário loga. Decisão do Victor em 2026-07-24.

**5. Faixa 3 (linha de contexto) cortada.**
O desenho tinha uma faixa bege de 38px descrevendo a tela ("Futebol hoje —
oportunidades de valor…"). Repetia o que o H1 da página já diz, e o
"Atualizado HH:MM" não tinha fonte de dado. Removida a pedido do Victor.

**6. Rodapé lista produtos, não sub-páginas.**
O desenho listava 6 links em Análises e 5 em Produtos — uma cópia do menu.
Virou: **Análises** (Futebol · NBA), **Ferramentas** (Betinho) e **Suporte**
(Planos e preços · Como usar · Configurações · Indique um amigo · Falar com o
time). As sub-seções já vivem na faixa 2 do header.

**7. Termos e privacidade num link só.**
`/termos` e `/privacidade` renderizam a mesma página (`App.tsx`), que traz as
duas seções sob um H1 só. O desenho pedia dois links; dois rótulos pro mesmo
destino confundem. Se um dia virarem páginas separadas, separa-se o link junto.

**8. Variante `terminal` do `AnalyticsNav` removida.**
Os 35 call sites passavam `variant="rebrand"`. A prop segue aceita (marcada
`@deprecated`) pra não churnar 35 arquivos num PR de UI.

## Iconografia do cabeçalho

Regra: **um conceito, um glifo** — em toda a navegação, nos dois esportes.

| Item | Glifo | Por quê |
| --- | --- | --- |
| Análises | `BarChart3` | o produto é análise de dados |
| Betinho | `Bot` | é um assistente; era `MessageSquare`, que serve pra qualquer coisa. Mesmo glifo do hub `/inicio` |
| Bolão | `Trophy` | — |
| Perfil | `CircleUser` | — |
| Futebol | `IconSoccer` (próprio) | o lucide não tem bola; `Goal` desenha bandeira com espiral e lê como "alvo" |
| NBA | `IconBasketball` (próprio) | era `BarChart3`, **o mesmo glifo de "Análises"** no mesmo cabeçalho |
| Hoje | `LayoutGrid` | era `Calendar` no futebol e `BarChart3` na NBA |
| Oportunidades | `Zap` | era `Zap` no futebol e `TrendingUp` na NBA |
| Jogos | `Calendar` | era `Goal` no futebol e `Calendar` na NBA |
| Análise 360 | `Radar` | só NBA |
| Relatório | `FileText` | só NBA |
| Apostas | `Target` | Betinho |
| Banca / Dashboard | `Wallet` | era `BarChart3`; o gráfico já é "Análises". Mesmo glifo do item de banca na `/perfil` |

Os dois SVGs próprios ficam em `src/components/icons/sports.tsx`. Nasceram no
hub `/inicio` e foram extraídos quando o header passou a precisar dos mesmos —
hub e cabeçalho têm que mostrar a mesma marca por produto. A 14px eles usam
`strokeWidth` 2 (2.2 no ativo) pra bater com o peso óptico dos lucide vizinhos.

## Pendências para uma próxima leva

- Levar o header novo pras 4 landings + `/auth`, que seguem no padrão antigo
  (nav próprio com `backdrop-blur` e logo invertida por filtro).
- Busca `⌘K` sobre times/jogadores/ligas.
- Rota de FAQ.
- Tabs in-page por produto — se existirem, as sub-seções saem da faixa 2 e o
  header fica igualzinho ao desenho.
