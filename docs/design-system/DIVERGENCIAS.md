# Divergências entre o design system e o código

Levantado na Fase 0 da padronização de cabeçalho/rodapé (2026-07-24), comparando
`tokens/*.css` deste bundle com `src/index.css` e `tailwind.config.ts`.

O bundle foi gerado lendo a branch `develop`; o levantamento rodou sobre
`feat/landing-futebol`.

## Resolvidas nesta branch

- **Logo do cabeçalho.** O app aplicava `invert hue-rotate-180` sobre a logo
  branca (`/logo.png`) para usá-la em fundo claro. O filtro entrega wordmark
  **preto** em vez do navy `#223244` e apaga o teal `#46c1ac` das barras.
  Agora usa `/logo-nav.png` — o `logo-full.png` do bundle (byte-idêntico ao
  `public/logo-azul.png`, que estava órfão no repo), recortado do padding
  transparente e reescalado para 297×104 (37 KB, contra 144 KB do original).

## Dívida de responsividade abaixo de 375px

Levantado em 2026-07-24, ao investigar "o cabeçalho e o rodapé somem no
celular". **Não era o cabeçalho.** Várias telas estouram a largura da viewport
em aparelhos estreitos (muitos Androids são 360px; iPhone SE é 375px). Como
elemento `sticky`/`fixed` se posiciona pela viewport e não pelo documento, ao
rolar pro lado o header e a tab bar ficam parados enquanto o conteúdo anda —
e o fundo deles acaba na largura da tela. Daí a impressão de que "somem".

Causa dominante: **filho de grid/flex tem `min-width: auto`** e se recusa a
encolher abaixo do próprio conteúdo, empurrando a página inteira. O remédio é
`min-w-0` no filho — e, quando o conteúdo é uma tabela que realmente não cabe,
um `overflow-x-auto` com `min-w-[Npx]` interno pra ela rolar dentro do card.

Medido a 320px de viewport (305px úteis), excesso horizontal em px:

| Rota | Antes | Depois | O que era |
| --- | --- | --- | --- |
| `/futebol/jogos` | 199 | **0** | tabela de classificação (486px de colunas fixas) → rola dentro do card + `min-w-0` nas colunas |
| `/bets` | 95 | **0** | fileira de páginas da paginação sem `flex-wrap` |
| `/futebol` | 70 | **0** | `min-w-0` nos filhos do grid de 12 colunas |
| `/futebol/oportunidades` | 18 | **0** | filtros "Faixa" + "Competição" (294px) em linha `nowrap shrink-0` |
| `/betting-dashboard` | 14 | **0** | rótulo de mês do heatmap posicionado em px, sem clip (o grid abaixo já tinha) |
| `/bankroll` | 0 | 2 | resíduo de 2px, dentro da margem de arredondamento |
| demais 9 rotas | 0 | 0 | — |

Todas eram anteriores a esta branch. O cabeçalho `sticky` e a tab bar `fixed`
só tornaram o sintoma visível.

**Vale virar teste:** medir `documentElement.scrollWidth > clientWidth` a 320px
em cada rota é barato e pega essa classe de regressão de uma vez.

## Em aberto — fora do escopo de cabeçalho/rodapé

### `ink-2` e `ink-3` valem coisas diferentes dentro e fora de `.theme-bolao`

| token | `tailwind.config.ts` | `.theme-bolao` (index.css) | design system |
|---|---|---|---|
| `ink-2` | `#5a625a` | `#4a4f48` | `#5a625a` |
| `ink-3` | `#eef0ec` | `#8a8f86` | `#eef0ec` |

A mesma classe `text-ink-2` renderiza uma cor diferente conforme o elemento
esteja ou não dentro de um wrapper `.theme-bolao`. Em `ink-3` o problema é
maior que um tom: são **papéis diferentes** — o design system define `ink-3`
como *superfície* clara (fundo de avatar/chip, `#eef0ec`), enquanto o
`.theme-bolao` usa como *texto* cinza (`#8a8f86`).

O papel "texto mais apagado" existe no design system com outro nome:
`--ink-dim: #9aa097`, que hoje só está no `tailwind.config.ts`.

**Por que não foi corrigido aqui:** `ink-3` aparece 1211 vezes em 107 arquivos,
majoritariamente como cor de texto (Betinho, Auth, Bankroll, Bets). Alinhar ao
design system significa reclassificar cada uso entre `ink-dim` (texto) e
`ink-3` (superfície) — é uma varredura própria, não um efeito colateral da
padronização de cabeçalho/rodapé.

### Tokens do design system ausentes no `.theme-bolao`

`--radius-2xl` (24px, hero), `--forest-soft`, `--forest-tint`, `--ink-dim`,
`--amber-bright`, `--amber-light` e os gradientes `--gradient-hero*`. Parte
existe só no `tailwind.config.ts`, parte não existe em lugar nenhum e está
escrita à mão nos componentes.

### `favicon.svg`

O do bundle difere do que está em `public/`. Não mexido — é decisão de marca,
não de cabeçalho.
