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

**Staging** (`kpbjuplcwiyrymafhehz`) — ✅ CONCLUÍDO 2026-06-01
- [x] Secrets `API_SPORTS_KEY` e `CRON_SECRET` setados no painel — Diody.
- [x] Vault: `ingest_wc_cron_secret` + `ingest_wc_url` (via SQL, não versionado).
- [x] Deploy da função `ingest-wc-scores` (version 1, verify_jwt=false) — Claude (MCP).
- [x] Extensões `pg_cron` + `pg_net` + job agendado `*/5 * * * *` (migration 048).
- [x] Smoke test: função retornou 200 `{ok, fixtures_recebidos:72, sem_link:0}`; cron via pg_net também 200.
- [ ] Pendente: validar ramo "placar→pontos" com 1 jogo real (só com jogo finalizado).

**Produção** (`lavclmlvvfzkblrstojd`) — só depois do staging validado
- [ ] Renovar assinatura API-Sports (vence **11/jun/2026**) — **Diody**.
- [ ] Secrets `API_SPORTS_KEY` (idealmente chave backend nova) + `CRON_SECRET` (pode ser outro valor) — **Diody**.
- [ ] Vault: `ingest_wc_cron_secret` + `ingest_wc_url` (URL com o ref de prod) — via SQL.
- [ ] Aplicar migrations 046, 047, 048, 049 em prod — **Diody/Claude** (via migration, regra anti-drift).
- [ ] Deploy das funções `ingest-wc-scores`, `ingest-wc-squads` **e** `enrich-wc-players` em prod.
- [ ] Rodar `ingest-wc-squads` 1x → depois `enrich-wc-players` em loop (birth_date) + smoke test do `ingest-wc-scores`.
- [ ] Cron já vem da migration 048 (lê Vault) — conferir `cron.job`.

## Componente: ingestão de elencos (`ingest-wc-squads` + `enrich-wc-players`)
Popula `wc_players` (migration 049). Disparadas **sob demanda** (sem cron). Reusam os secrets do
`ingest-wc-scores`. Ordem:
1. `POST /functions/v1/ingest-wc-squads` (header `x-cron-secret`) — nome/posição/número/foto.
   ⚠️ Squads = pool nacional amplo (~1381 no staging), não os 26 finais. Re-rodar perto da convocação.
2. `POST /functions/v1/enrich-wc-players` (body `{after, batch}`, em loop até `done`) — preenche
   `birth_date` via `players/profiles`. Necessário pro filtro de Revelação. Staging: 1323/1381
   preenchidos, 77 elegíveis (≥2005). **Fotos já vêm no squads** (URL do CDN da API, sem download).

### Como setar os secrets no painel (passo a passo)
1. Acessar https://supabase.com/dashboard/project/kpbjuplcwiyrymafhehz/settings/functions
   (ou: Dashboard → escolher projeto → ⚙️ Project Settings → **Edge Functions** → seção **Secrets**).
2. **Add new secret** → Name: `API_SPORTS_KEY` → Value: (valor passado no chat) → salvar.
3. **Add new secret** → Name: `CRON_SECRET` → Value: (valor passado no chat) → salvar.
4. Avisar o Claude que está feito → ele faz o deploy + cron.

### Pré-requisito Vault por ambiente (rodar 1x via SQL — NÃO versionar valores)
```sql
-- staging já feito. Pra prod, trocar URL pro ref de prod e (idealmente) outro secret:
SELECT vault.create_secret('<x-cron-secret>', 'ingest_wc_cron_secret', 'x-cron-secret do ingest-wc-scores');
SELECT vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/ingest-wc-scores', 'ingest_wc_url', 'URL da função');
```

## Log de execução
- 2026-06-01 — migrations 046/047 aplicadas no **staging** (validadas). Função `ingest-wc-scores`
  escrita.
- 2026-06-01 — **staging ligado ponta a ponta:** secrets (painel + Vault), deploy da função,
  migration 048 (pg_cron `*/5` + pg_net lendo Vault). Smoke test 200 OK (72 fixtures, 0 sem-link).
  Cron via pg_net também 200. Falta só validar com jogo finalizado real.
- 2026-06-01 — **M2 elencos no staging:** migration 049 (wc_players) + deploy `ingest-wc-squads`.
  Run = 48 times, 1381 jogadores, 167 goleiros, 0 erros. birth_date pendente (profiles).
