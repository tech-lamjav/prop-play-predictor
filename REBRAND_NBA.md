# Rebrand NBA — Resumo Detalhado

Documento de revisão das mudanças do rebrand do módulo NBA (branch `feature/nba-dashboard-rebrand`).
Use isso pra audit pré-merge e pra orientar QA.

---

## 1. Telas rebrandadas (de dark → light)

| Rota | Arquivo | Status | Notas |
|---|---|---|---|
| `/home-nba` | `src/pages/HomeNBA.tsx` | ✅ Light | Landing principal do módulo NBA |
| `/oportunidades` | `src/pages/Picks.tsx` | ✅ Light | Lista de picks/oportunidades |
| `/nba-dashboard/:playerName` | `src/pages/NBADashboard.tsx` | ✅ Light | Dashboard do jogador |
| `/analise-360` | `src/pages/Analise360List.tsx` | ✅ Light | Lista de gatilhos (lesionados + impacto) |
| `/analise-360/:triggerPlayerId` | `src/pages/Analise360Detail.tsx` | ✅ Light | Detalhe com cadeia de impacto |
| `/home-games` | `src/pages/Games.tsx` | ✅ Light | Lista de jogos NBA |
| `/game/:gameId` | `src/pages/GameDetail.tsx` | ✅ Light | Detalhe do jogo (passado/futuro/B2B) |
| `/report` | `src/pages/Report.tsx` | ✅ Light | Relatório PDF |

### Telas removidas (rotas deletadas do `App.tsx`)
- `/home-players` (Home.tsx) — não estava em uso
- `/nba-players` (PlayerSelection.tsx) — não estava em uso

> **Arquivos físicos** (`Home.tsx`, `PlayerSelection.tsx`, `NBAHeader.tsx`) **ainda existem** no repo mas estão **dead code**. Sugestão: deletar em PR separado de limpeza.

---

## 2. Componentes novos (criados durante o rebrand)

### `src/components/nba-home/` (header e widgets light)
- `NBAHomeHeader.tsx` — nav light global (substitui o `AnalyticsNav` dark). Tem dropdowns Análises / Betinho, badge Premium, mobile menu
- `NBAUserNav.tsx` — avatar + dropdown user (light)
- `NBABriefingStrip.tsx` — strip de briefing no topo da home
- `NBATopPickHero.tsx` — card hero do pick do dia
- `NBAHotOppCard.tsx` — card de oportunidades quentes
- `NBAKeyInjuriesRail.tsx` — rail horizontal de lesões-chave
- `NBAGamesRich.tsx` — lista rica de jogos do dia

### `src/components/nba/MatchupZonesCard.tsx`
Novo card de zonas de arremesso vs adversário (usado no dashboard do jogador).

---

## 3. Hooks / Services

### `src/hooks/use-analise360.ts`
- Adicionado **filtro de stats** (`ALLOWED_STATS`): só Pontos, Assistências, Rebotes, PRA chegam ao front. Tocos/Roubos/3PT/combos são descartados.
- Adicionado **fallback dev-only** pra mock quando RPC retorna vazio (`import.meta.env.DEV`). Em **produção**, vazio renderiza empty state real (sem mock).
- Suporta `?mock=1` na URL pra forçar mock em qualquer ambiente.

### `src/hooks/use-home-nba.ts`
Ajuste pequeno (não revisei a fundo — só uma linha mudou).

### `src/services/nba-data.service.ts`
- Adicionado campo `previous_game_datetime_brasilia` em `B2BBoxScorePlayer` (acompanha update do RPC).

---

## 4. Migrations no banco (Supabase staging)

⚠️ **Importante**: 3 RPCs foram atualizadas via migration. Precisa aplicar mesma migration em **produção** (project `lavclmlvvfzkblrstojd`) antes do deploy.

### Migration 1: `expand_get_game_box_score_columns`
Adiciona ao `get_game_box_score(p_game_id)`:
- `player_position` (de `dim_players.position`)
- `offensive_rebounds`, `defensive_rebounds` (de `player_offensive_rebounds` / `player_defensive_rebounds`)
- `fg_pct` (de `player_field_goal_percentage`)
- `ft_pct` (de `player_free_throw_percentage`)
- `plus_minus` (de `player_plus_minus`)

### Migration 2: `expand_get_team_by_id_with_opp_ranks`
Adiciona ao `get_team_by_id(p_team_id)`:
- `next_opponent_opp_pts_rank`
- `next_opponent_opp_reb_rank`
- `next_opponent_opp_ast_rank`
- `next_opponent_opp_fg3_pct_rank`
- `next_opponent_def_rating_rank`
- `next_opponent_opp_pts_paint_rank`

Necessário pra renderizar o bloco "Ângulo do confronto" no GameDetail.

### Migration 3: `expand_b2b_previous_with_score` + `fix_b2b_previous_game_time_column`
Adiciona ao `get_b2b_previous_game_box_score`:
- `previous_team_score`, `previous_opponent_score` (placar do jogo de ontem)
- `previous_home_away` ("Casa" / "Fora")
- `previous_game_datetime_brasilia` (horário com timezone)

Sem isso o alerta B2B fica sem placar.

---

## 5. Mocks adicionados

Pra dev quando o backend retorna vazio (offseason, etc.). **Não aparecem em prod sob nenhuma condição.**

### `src/mocks/analise360.ts`
Fixture com ~15 jogadores lesionados (Luka, Pascal, Giddey, Reaves, OG Anunoby, Powell, Brown, etc.) + cadeias de impacto com até 4 backups e todas as stats. Ativa via:
- `?mock=1` na URL — **só funciona quando `import.meta.env.DEV` é `true`** (i.e. `vite dev`). Em build de prod/staging a query é ignorada.
- Auto-fallback quando `opportunities.length === 0` — **só em DEV**. Em prod, vazio = empty state real (sem dados fictícios).

### `src/mocks/game-detail.ts`
**Deletado** durante a auditoria pré-PR. Era dead code (nenhum import).

---

## 6. Tokens de design (Tailwind)

`tailwind.config.ts` ganhou os tokens light:
- `canvas` (#f6f7f5), `canvas-2` (#eef0eb)
- `ink` (#1a1d1a), `ink-2` (#5a625a), `ink-3` (#eef0ec)
- `line` (#e3e6e0), `line-2` (#d4d8d0)
- `forest` (#0a3d2e), `forest-soft` (#1f5640), `forest-tint` (#e7efe9)
- `status.success/warning/danger/info`

Todas as páginas rebrandadas vivem dentro de `.theme-rebrand` (escopo CSS).

---

## 7. Dados ainda mockados na UI

Em **produção** com dado real, o que mostra mock?

| Item | Onde aparece | Vem de | Status |
|---|---|---|---|
| Stats Agregadas (EFG%, Ritmo, etc.) | GameDetail | — | **Removido** após feedback do user. Não aparece mais. |
| Auditoria de apostas | GameDetail tab | — | **Removido**. Tab não existe mais. |
| Apostas do jogo | GameDetail | Real (filtra `analise360` por `game_id`) | ✅ Real |
| Insight de B2B | B2B alert | Heurística qualitativa baseada em min jogados (sem ML) | ⚠️ Heurística estática |
| Viagem em km (B2B) | B2B alert | Calculado via Haversine entre cidades dos times | ✅ Real (cidades hardcoded por team_abbr) |
| Descanso (B2B) | B2B alert | Calculado da diff entre datas | ✅ Real |
| Oportunidade do dia (sidebar) | Games | Top score do `useAnalise360Data` | ✅ Real |

⚠️ **O "Sinal de carga"** no B2B alert mostra texto qualitativo só ("carga muito alta", "carga alta", "distribuída") — **sem número de queda de rendimento**. O número anterior ("-12% em pontos") foi removido por não ter respaldo estatístico. Quando rolar um modelo histórico real, plugar lá.

---

## 8. Referências atualizadas em outras telas

Pra não quebrar links pra rotas removidas (`/home-players`, `/nba-players`):
- `src/components/MainNav.tsx` — itens "Home NBA" e "Jogadores" agora apontam pra `/home-nba`. Logo button também
- `src/pages/Dashboard.tsx` — redirect agora vai pra `/home-nba`
- `src/pages/PaywallPlatform.tsx` — pós-pagamento redireciona pra `/home-nba`

`src/components/nba/NBAHeader.tsx` ainda contém referência pra `/nba-players` mas o arquivo não é importado em nenhum lugar (dead code).

---

## 9. Checklist pré-merge

### Migrations em prod
- [ ] Aplicar `expand_get_game_box_score_columns` em `lavclmlvvfzkblrstojd`
- [ ] Aplicar `expand_get_team_by_id_with_opp_ranks` em `lavclmlvvfzkblrstojd`
- [ ] Aplicar `expand_b2b_previous_with_score` + `fix_b2b_previous_game_time_column` em `lavclmlvvfzkblrstojd`

### Código
- [ ] Restaurar `<ProtectedRoute>` na rota `/oportunidades` (atualmente removido com comentário "TEMP: RESTAURAR antes do merge" no `App.tsx` linha ~64)
- [ ] Deletar arquivos dead-code: `src/pages/Home.tsx`, `src/pages/PlayerSelection.tsx`, `src/components/nba/NBAHeader.tsx`, `src/mocks/game-detail.ts`
- [ ] Limpar referência morta em `NBAHeader.tsx` (se mantiver o arquivo)
- [ ] Remover PNGs de screenshot dos diretórios raiz (audit-*.png, analise360-*.png, game-*.png) — não devem ir pro commit

### QA visual (rodar em desktop 1440px e mobile 390px)
- [ ] **Home NBA** (`/home-nba`) — briefing + top pick + hot opps + key injuries + games
- [ ] **Oportunidades** (`/oportunidades`) — filtros + cards + drawer mobile
- [ ] **Dashboard do jogador** — header + chart + comparison + zones
- [ ] **Análise 360 lista** — filtros (OUT/Duvidoso/Questionável, estrelas exatas, valorizados ≥2), sections por status
- [ ] **Análise 360 detalhe** — cadeia (mandala) + companheiros valorizados + ranking + KPIs
- [ ] **Jogos** — grid (1 col se ≤5, 2 cols se >5), date picker mobile acima dos jogos, sidebar com oportunidade/injury/relatório
- [ ] **Detalhe do jogo** — hero adapta passado/futuro/B2B, OFF/DEF amber, ângulo do confronto, box score completo (FG%, +/−, OREB, DREB), toggle de time mobile com logo
- [ ] **Relatório** — date picker + iframe PDF + estados loading/erro/sem-acesso

### Funcional
- [ ] Calendar abre no mobile (bug do Popover duplicado já corrigido)
- [ ] Toggle Ambos/Home/Visitor no box score filtra certo (normaliza "Casa"/"Fora")
- [ ] Tabs no mobile cabem sem scroll horizontal
- [ ] Hover nos satélites da mandala mostra popover com todas as stats
- [ ] Clique em card de oportunidade no GameDetail navega pra `/analise-360/<trigger_id>`

---

## 10. Pontos de atenção / dívida técnica

1. **`NBAHeader.tsx` continua referenciado em código que pode estar morto** — confirmar e deletar
2. **`game-detail.ts` mock** — não usado, deletar
3. **Vários `audit-*.png` e `analise360-*.png` na raiz** — são screenshots de teste, não devem ir pro commit. Adicionar ao `.gitignore` ou deletar
4. **`AuthenticatedLayout` + `MainNav`** — ainda em uso por páginas fora do escopo NBA (Dashboard, Analysis). Não rebrandados. Se essas páginas continuam ativas, faz sentido um próximo PR de rebrand pra elas
5. **Tradução "Casa/Fora" vs "home/visitor"** — RPCs em PT, código TS pensa em EN. Fix local com `normalizeHomeAway()` no GameDetail. Padronizar no back numa próxima
6. **"Insight do modelo" B2B** — atualmente é heurística estática. Quando time de dados tiver um modelo de queda de rendimento por carga em B2B, plugar o número real
