# Guia visual do rebrand — módulo Futebol (tema `theme-bolao`)

> DNA visual extraído dos mockups do rebrand (`docs/rebrand-nba-unzipped/mockups/nba/*.jsx`,
> `docs/rebrand-betinho-unzipped/`) + telas já implementadas (`src/pages/BolaoHome.tsx`,
> `src/components/bolao/*`) + tokens em `src/index.css`. **Consultar antes de rebrandar cada tela.**
> Regra de ouro: rebrand ≠ alargar container + header maior. O "aconchego" vem da composição.

## A) Tokens (src/index.css ~403-427)
- **canvas** `#f6f7f5` (fundo) · **canvas-2** `#eef0eb` (fundo secundário)
- **ink** `#1a1d1a` · **ink-2** `#4a4f48` · **ink-3** `#8a8f86` (labels/hints)
- **line** `#e3e6e0` · **line-2** `#d4d8d0`
- **forest** `#0a3d2e` · **forest-2** `#0f5238` (hover)
- **amber** `#d4a017` · **amber-2** `#b8870f`
- **status**: success `#2f7d50` · warning `#c97a1a` · danger `#b8341c` · info `#1a5fb4`
- **raios**: `rounded-rebrand-sm` 6px · `-md` 10px · `-lg` 14px · `-xl` **20px**
- **fonte**: Inter Variable; headline peso 600-700 `tracking-tight`; label uppercase 9-11px `tracking-[0.14em–0.2em]`; números `tabular-nums`.

## B) Padrões de componente
- **Card**: `bg-white border border-line rounded-rebrand-xl` + **`p-5`/`p-6`** + (se clicável) `hover:shadow-sm transition`. Elevação é exceção (`shadow: 0 12px 32px rgba(0,0,0,.12)`), o padrão é borda+cor, não sombra pesada.
- **Hero**: `linear-gradient(135deg,#0a3d2e,#08321f 60%,#051f12)`, texto branco, `rounded-rebrand-xl`, + acento radial âmbar no canto (`radial-gradient(circle, rgba(251,191,36,.16), transparent 70%)`).
- **KPI tile**: card branco bordado, label uppercase 10px ink-3, valor 22-30px bold, hint 11px ink-2.
- **Section header**: label uppercase 11px ink-3 **+** título 18px bold ink (stack, `mt-1`).
- **Badge/chip**: `px-2 h-6 rounded-rebrand-sm text-[11px] font-semibold` + cor de status.
- **Tabela**: header `bg-canvas-2` uppercase 10px ink-3; linhas `border-top border-line` `py-3.5 px-5`; hover `bg-canvas-2`; números tabulares.
- **Botões**: primary `bg-forest text-white hover:bg-forest-2 rounded-rebrand-md h-11`; secondary `bg-white border border-line`; CTA `bg-amber text-ink`.

## C) Composição por tela (mockup de referência)
- **Home/Dashboard** (`00-home-desktop`, `01-dashboard`): briefing (data + KPIs 4-col) → hero → grid 2-col (8/4) → tabela full → tiles de acesso. **(nossa Hoje já segue)**
- **Oportunidades** (`06-opps-table`): tabela full-width com **color spine** (4px à esquerda por tier), coluna Score, agrupar por gatilho, toggle Por Score/Por Gatilho, filtros em chips. (alternativa: cards polidos)
- **Detalhe de jogo** (`09-game-detail`): header card 3-col (time | placar/vs central | time) com forma + **strip de ratings/stats comparados** logo abaixo (canvas-2); seções (box score/escalação/injury) em cards; callout de contexto (fundo âmbar claro) quando houver.
- **Perfil jogador/time** (`10-player-dashboard`, `01-dashboard`): grid 12-col → esquerda(4) header + próximos + opps; direita(8) gráfico de performance (barras) + grid 2-col (tabela recente + zonas). Visual > tabela crua.
- **Lista de jogos** (`08-home-games`): **grid 2-col de game-cards** (faixa de data/hora + times + placar/forma + badges); sidebar com date picker + carrossel de opps.

## D) Os 5 detalhes do "aconchego"
1. **Respiro** — `p-5/6` nos cards, `gap-5/6` entre seções, `mt-2..4` entre título e conteúdo.
2. **Hierarquia tipográfica** — headline 32px / título seção 18px / label uppercase 9-11px tracking alto.
3. **Gradiente forest + acento âmbar** nos heros.
4. **Borda fina + fundo claro** no lugar de drop-shadow.
5. **Status discreto** — verde/vermelho/âmbar quentes mas nunca "coloridos demais".

## E) Referências de código
| Padrão | Arquivo | Linhas |
|---|---|---|
| Tokens (CSS vars + utils) | `src/index.css` | 403-495 |
| Home exemplo | `src/pages/BolaoHome.tsx` | 1-150 |
| KPI tiles / hero | `docs/rebrand-nba-unzipped/mockups/nba/00-home-desktop.jsx` | 144-233 |
| Opps table (color spine) | `…/06-opps-table.jsx` | 57-276 |
| Game detail (header/stats strip) | `…/09-game-detail.jsx` | 98-267 |
| Game cards | `…/08-home-games.jsx` | 58-200 |
| Player dashboard layout | `…/01-dashboard-desktop.jsx` | 405-447 |
| Ranking table | `src/components/bolao/BolaoRankingTable.tsx` | 73-160 |
| Champion hero (âmbar) | `src/components/bolao/ChampionHeroCard.tsx` | 50-100 |

## Status do rebrand das telas Futebol
- **Hoje** ✅ (segue `00-home-desktop`).
- **Detalhe / Time / Oportunidades / Jogos**: 1ª passada foi só largura+header (insuficiente). Refazer **uma por vez, com revisão**, aplicando A–D fielmente. Decisão pendente: Oportunidades = cards polidos **ou** tabela color-spine.
