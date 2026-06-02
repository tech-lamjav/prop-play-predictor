# Bolão — Runbook de Deploy (staging → produção)

> Registro vivo de tudo que precisa ser feito **fora do código** (secrets, deploy de edge
> functions, cron) pra ligar a ingestão de dados do bolão. Objetivo: produção vira só "seguir
> a lista". Atualizar a cada passo.
>
> ⚠️ **Nunca commitar valores de secret aqui.** Só os *nomes* e de onde tirar o valor.
>
> Ambientes (ver memória `feedback_supabase_environments`):
> - **staging** = `kpbjuplcwiyrymafhehz`
> - **produção** = `lavclmlvvfzkblrstojd`

## Componente: ingestão de placar (`ingest-wc-scores`)

Robô que lê o placar da API-Sports e atualiza o bolão. Migrations já aplicadas: `046_wc_team_map`,
`047_wc_matches_api_fixture_id`. Código: `supabase/functions/ingest-wc-scores/`.

### Secrets necessários (Edge Functions)
| Nome | Valor (de onde tirar) |
|---|---|
| `API_SPORTS_KEY` | chave da API-Sports. Por ora = o mesmo valor de `VITE_API_SPORTS_KEY` no `.env.local`. **Migrar pra chave backend dedicada depois da renovação.** |
| `CRON_SECRET` | string aleatória (hex 48). Gerada por nós; guardada só no painel + aqui no chat. Serve pra só o nosso agendador conseguir acordar o robô. |

### Checklist por ambiente

**Staging** (`kpbjuplcwiyrymafhehz`)
- [ ] Secrets `API_SPORTS_KEY` e `CRON_SECRET` setados no painel — **Diody** (Dashboard → Project Settings → Edge Functions → Manage secrets / Add new secret).
- [ ] Deploy da função `ingest-wc-scores` — **Claude (via MCP)**.
- [ ] Habilitar extensões `pg_cron` + `pg_net` e agendar o job (migration) — **Claude (via MCP)**.
- [ ] Smoke test: forçar/checar 1 jogo e confirmar placar + pontos — **Claude + Diody**.

**Produção** (`lavclmlvvfzkblrstojd`) — só depois do staging validado
- [ ] Renovar assinatura API-Sports (vence **11/jun/2026**) — **Diody**.
- [ ] Secrets `API_SPORTS_KEY` (idealmente chave backend nova) + `CRON_SECRET` (pode ser outro valor) — **Diody**.
- [ ] Aplicar migrations 046 + 047 em prod — **Diody** (via migration, conforme regra anti-drift).
- [ ] Deploy da função em prod.
- [ ] Agendar cron em prod.
- [ ] Smoke test em prod.

### Como setar os secrets no painel (passo a passo)
1. Acessar https://supabase.com/dashboard/project/kpbjuplcwiyrymafhehz/settings/functions
   (ou: Dashboard → escolher projeto → ⚙️ Project Settings → **Edge Functions** → seção **Secrets**).
2. **Add new secret** → Name: `API_SPORTS_KEY` → Value: (valor passado no chat) → salvar.
3. **Add new secret** → Name: `CRON_SECRET` → Value: (valor passado no chat) → salvar.
4. Avisar o Claude que está feito → ele faz o deploy + cron.

## Log de execução
_(preencher conforme avança)_
- 2026-06-01 — migrations 046/047 aplicadas no **staging** (validadas). Função `ingest-wc-scores`
  escrita (sem deploy). Aguardando secrets no staging pra deploy + cron.
