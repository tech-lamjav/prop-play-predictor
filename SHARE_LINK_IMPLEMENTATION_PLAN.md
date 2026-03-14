# Plano de Implementação — Compartilhamento por Link

> **Status: IMPLEMENTADO** — Este documento reflete o que foi construído.

---

## Visão Geral

Funcionalidade que permite ao usuário gerar um link público com uma visão filtrada das suas apostas, acessível por qualquer pessoa sem necessidade de login.

**Branch:** `feat/compartilhar_apostas_link`

---

## Decisões Técnicas

| Decisão | Escolha |
|---------|---------|
| "Histórico de operações" | Lista de apostas da tabela `bets` (sem entidade separada) |
| Meta tags na página pública | Estáticas/genéricas (SPA não suporta meta tags dinâmicas sem SSR) |
| Componentes de KPI/gráficos | Novos, específicos para a página pública |
| Cálculo de KPIs | Frontend, reaproveitando `src/utils/bettingStats.ts` |
| Token | UUID v4 via `gen_random_uuid()` — o próprio `id` da linha é o token |
| Expiração de links | `expires_at` nullable — sem expiração por padrão em V1 |
| Paginação | Paginação simples (não scroll infinito) |
| URL do link | Montada no backend via `APP_BASE_URL` (secret do Supabase) |
| Endpoint share-resolve | POST (não GET) — passa token no body para evitar logs de URL |

---

## Arquivos Implementados

### Backend

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/030_create_share_links.sql` | Tabela `share_links` com RLS e índice |
| `supabase/functions/share-create/index.ts` | Edge function autenticada — cria o link |
| `supabase/functions/share-resolve/index.ts` | Edge function pública — resolve o token e retorna apostas |

### Frontend — Hooks

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/use-share-link.ts` | Mutation para criar links (`useShareLink`) |
| `src/hooks/use-share-resolve.ts` | Query para resolver tokens (`useShareResolve`) |

### Frontend — Modal de geração

| Arquivo | Descrição |
|---------|-----------|
| `src/components/bets/ShareLinkModal.tsx` | Modal com chips de filtros, botão gerar e copiar URL |

> Botão "Compartilhar" adicionado em `src/pages/Bets.tsx` na toolbar.

### Frontend — Página pública

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/SharePage.tsx` | Orquestra todos os estados da página |
| `src/components/share/ShareLayout.tsx` | Header com nome do dono e chips de filtros |
| `src/components/share/ShareKpiCards.tsx` | Cards: lucro, ROI, win rate, total de apostas |
| `src/components/share/ShareBankrollChart.tsx` | Gráfico de P&L acumulado ao longo do tempo |
| `src/components/share/ShareBreakdownCharts.tsx` | Breakdown por esporte, liga e mercado |
| `src/components/share/ShareBetsTable.tsx` | Tabela paginada com legs expandíveis para múltiplas |
| `src/components/share/ShareLoadingSkeleton.tsx` | Skeleton loader |
| `src/components/share/ShareErrorState.tsx` | Estados de erro: 404, 410 e genérico |
| `src/components/share/ShareEmptyState.tsx` | Empty state quando nenhuma aposta bate o filtro |

> Rota `/share/:token` adicionada em `src/App.tsx` **sem** `ProtectedRoute`.

---

## Detalhes Técnicos Relevantes

### Migration (`030_create_share_links.sql`)

```sql
CREATE TABLE share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- o id É o token
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  filters_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ  -- nullable, sem expiração por padrão
);

CREATE INDEX idx_share_links_user_id ON share_links(user_id);
```

RLS: `owner_select` e `owner_insert` por `auth.uid() = user_id`.

### Mapeamento de filtros (frontend → API)

O frontend usa nomes internos que são mapeados em `use-share-link.ts`:

| Frontend | API (filters_snapshot) |
|----------|------------------------|
| `sport` | `sports` |
| `league` | `leagues` |
| `betting_market` | `markets` |
| `selectedTags` | `tags` |
| `dateFrom` | `date_from` |
| `dateTo` | `date_to` |
| `searchQuery` | `search` |

### Edge Function: `share-create`

- JWT obrigatório (verificado manualmente via `supabase.auth.getUser`)
- URL montada como: `APP_BASE_URL/share/<token>`
- Fallback: `APP_BASE_URL` → `SITE_URL` → `https://smartbetting.app`
- Retorna: `{ token, url }`

### Edge Function: `share-resolve`

- **Sem JWT** (`--no-verify-jwt` no deploy)
- Aceita GET (`?token=`) e POST (token no body)
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypassar RLS
- Retorna apenas campos seguros — nunca email, whatsapp, dados de pagamento
- Resolve tags via join em `bet_tags`
- Inclui `bet_legs` para apostas do tipo `multipla` ou `multiple`
- Limite de 500 apostas
- Erros: `404` (não encontrado), `410` (expirado), `500` (genérico)

### Hook `use-share-resolve`

Usa `fetch` direto (não `supabase.functions.invoke`) para capturar corretamente os status HTTP 404 e 410 — o cliente Supabase normaliza erros de forma que dificulta distinguir os códigos.

Retry desabilitado para 404 e 410 (não adianta tentar novamente).

---

## CI/CD — Pendência

As duas novas edge functions precisam ser adicionadas aos workflows de deploy:

**`deploy-staging.yml` e `deploy-production.yml`** — adicionar no bloco "Deploy Edge Functions":

```yaml
supabase functions deploy share-create
supabase functions deploy share-resolve --no-verify-jwt
```

---

## Checklist de Deploy

- [ ] Migration aplicada: `supabase db push` (automático via CI ao mergear)
- [ ] Edge functions adicionadas nos workflows de CI/CD (ver seção acima)
- [ ] Secret `APP_BASE_URL` configurado no Supabase Dashboard:
  - Staging: URL do ambiente de staging
  - Produção: `https://smartbetting.app`
- [ ] Types TypeScript regenerados após migration: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
- [ ] Verificar que a rota `/share/:token` está sem `ProtectedRoute` no `App.tsx`
