# Sessão 28/03/2026 — Prop Insights: o que foi feito e o que ainda depende do pipeline

## Contexto

Investigamos por que o `PropInsightsCard` nunca aparecia para jogadores backup (ex: Daniss Jenkins com Cade Cunningham fora, Julius Randle com Anthony Edwards fora). Descobrimos um bug arquitetural e fizemos correções. Porém, durante a investigação também descobrimos que **os dados do pipeline estão errados**, o que limita o que podemos validar agora.

---

## 1. Bug arquitetural corrigido (sólido — não muda quando pipeline corrigir)

### O problema
O dado de trigger (`is_leader_with_injury`, `next_available_player_name`, `next_player_stats_when_leader_out`) fica na **linha do líder** em `dim_stat_player`, não na linha do backup.

O frontend estava chamando `getPlayerProps(player_id)` — que busca pelas linhas do próprio jogador. Quando você abre a tela do Daniss Jenkins, essa chamada traz as stats do Daniss. O Daniss nunca tem `is_leader_with_injury = true`, então o card nunca aparecia.

### A solução
Nova RPC que inverte a lógica: em vez de buscar pelas linhas do backup, busca nas linhas dos **líderes** que apontam esse jogador como substituto.

**Arquivo novo:** `supabase/migrations/034_get_player_trigger_insights.sql`
```sql
-- Dado o nome do backup (ex: "Daniss Jenkins"),
-- retorna as linhas dos líderes (ex: Cade) onde next_available_player_name = "Daniss Jenkins"
WHERE dsp.is_leader_with_injury = true
  AND dsp.next_available_player_name = p_player_name
```

**Serviço** (`src/services/nba-data.service.ts`):
- Novo método `getPlayerTriggerInsights(playerName: string)` que chama a nova RPC
- O antigo `getPlayerProps(playerId)` continua existindo (não foi removido)

**Dashboard** (`src/pages/NBADashboard.tsx`, linha 172):
```ts
// Antes:
loadedProps = await nbaDataService.getPlayerProps(playerData.player_id);

// Depois:
loadedProps = await nbaDataService.getPlayerTriggerInsights(playerData.player_name);
```

> ✅ **Esta mudança é correta independente dos dados do pipeline.** A arquitetura estava errada. Quando o pipeline corrigir os valores, esta RPC vai retornar os dados certos automaticamente — não precisa mexer nisso.

---

## 2. Filtro de direção positiva no PropInsightsCard (sólido)

**Arquivo:** `src/components/nba/PropInsightsCard.tsx`

### O problema
O card mostrava qualquer oportunidade com `next_player_stats_when_leader_out > 0`, incluindo casos onde o backup **piora** sem o líder (dado incorreto do pipeline mostrando queda).

### A solução
Adicionado filtro de direção:
```ts
const backupProps = propPlayers.filter(
  p => p.is_available_backup &&
    p.next_available_player_name?.trim() &&
    p.next_player_stats_when_leader_out > 0 &&
    p.next_player_stats_when_leader_out > p.next_player_stats_normal  // <- só se MELHORA
);
```

> ✅ **Esta lógica é correta e permanente.** Só faz sentido mostrar oportunidade quando o backup performa melhor. Quando o pipeline corrigir os valores, o filtro vai continuar válido — os casos ruins simplesmente vão desaparecer do pipeline, os bons vão aparecer.

---

## 3. UI: StatTypeSelector com nome completo inline (sólido)

**Arquivo:** `src/components/nba/StatTypeSelector.tsx`

Quando um botão de stat está selecionado, aparece o nome completo embaixo da abreviação (8px, opacidade reduzida). Ex: botão `PTS` selecionado mostra `PTS` + `Pontos` embaixo.

> ✅ **Melhoria visual pura, não depende de nenhum dado do pipeline.**

---

## 4. O que está ERRADO nos dados do pipeline (não mexemos no frontend para "consertar" isso)

### Problema identificado
`next_player_stats_when_leader_out` está com valores incorretos:

| Caso | Normal (pipeline) | Sem líder (pipeline) | Sem líder (real) |
|---|---|---|---|
| Daniss Jenkins AST (Cade fora) | 3.5 | 2.41 ↓ | ~8.2 ↑ |
| Julius Randle PTS (Edwards fora) | 20.5 | 20.17 ↓ | ~23.5 ↑ |

O pipeline diz que o backup **piora** sem o líder, mas a realidade é que **melhora bastante**. Hipótese: o pipeline está incluindo jogos onde o líder estava presente no cálculo de "sem o líder".

### O que fizemos
- Apenas o filtro de direção positiva no item 2 acima (mitiga no front)
- Criado ClickUp task **86aggrwja** para o pipeline corrigir o cálculo

> ⚠️ **Quando o pipeline corrigir isso, o card vai passar a aparecer com os números certos automaticamente.** Nenhuma mudança adicional de frontend é necessária para esse caso.

---

## 5. O que ainda NÃO foi implementado (bloqueado pelo pipeline)

### Alerta ⚠️ para jogadores questionável/duvidoso
Atualmente o card só aparece quando `is_leader_with_injury = true` (líder confirmado fora).

Falta no pipeline:
- Campo `next_leader_status` (out | questionable | doubtful | null) na `dim_stat_player`
- Preencher `next_available_player_name` e stats para casos questionable/doubtful

Quando isso chegar, o frontend precisará:
1. A nova RPC `get_player_trigger_insights` já vai retornar esses casos automaticamente (só precisa ajustar o filtro `is_leader_with_injury` para incluir duvidosos)
2. `PropInsightsCard` precisa de uma variante visual ⚠️ diferente da ⚡ atual

> Task pipeline: **86aggrd87** | Task frontend completa: **86aggrzmy**

---

## Resumo: o que está comprometido vs. o que está sólido

| Mudança | Status | Risco de quebrar depois? |
|---|---|---|
| Nova RPC `get_player_trigger_insights` | ✅ Implementado | Nenhum — é a arquitetura correta |
| `getPlayerTriggerInsights` no serviço | ✅ Implementado | Nenhum |
| Dashboard usa nova RPC | ✅ Implementado | Nenhum |
| Filtro direção positiva no card | ✅ Implementado | Nenhum — lógica correta e permanente |
| StatTypeSelector label inline | ✅ Implementado | Nenhum — visual puro |
| Valores numéricos corretos no card | ❌ Bloqueado | Pipeline task 86aggrwja |
| Variante ⚠️ questionável/duvidoso | ❌ Bloqueado | Pipeline task 86aggrd87 |

**Conclusão:** As mudanças de hoje são todas arquiteturalmente corretas. Nada foi feito como "gambiarra temporária" que precisaria ser desfeita. O que está faltando (números errados, variante ⚠️) está explicitamente bloqueado pelo pipeline — não foi implementado de forma provisória.
