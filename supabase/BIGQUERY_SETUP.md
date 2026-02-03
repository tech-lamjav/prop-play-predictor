# Setup BigQuery FDW Local

## Resumo

O BigQuery FDW (Foreign Data Wrapper) permite acessar dados do BigQuery diretamente do PostgreSQL.

**Por que setup manual?** As credenciais do BigQuery (service account key) são armazenadas no Vault do Supabase, que gera um UUID dinâmico. Por isso, o servidor e as foreign tables precisam ser configurados manualmente após cada `supabase start` limpo.

## Estrutura de Arquivos

```
supabase/
├── migrations/
│   ├── 002_setup_bigquery_wrapper.sql    # Cria extensão e FDW (automático)
│   ├── 003_cleanup_and_recreate_bigquery.sql  # Desativado
│   └── 20250121_create_bigquery_rpc_functions.sql  # Placeholder (automático)
└── setup_bigquery_local.sql              # Setup manual (RODAR APÓS SUPABASE START)
```

## Fluxo de Trabalho

### 1. Iniciar Supabase
```bash
supabase start
```

### 2. Rodar Setup Manual
Abra o SQL Editor em http://127.0.0.1:54323 e execute os passos do arquivo `setup_bigquery_local.sql`:

1. **PASSO 1** - Cria extensão e FDW (pode dar erro se já existir, ignore)
2. **PASSO 2** - Cria secret no Vault → **COPIE O UUID RETORNADO**
3. **PASSO 3** - Cole o UUID e execute (cria server + foreign tables)
4. **PASSO 4** - Testa conexão
5. **PASSO 5** - Cria RPC functions

### 3. Testar
```sql
SELECT COUNT(*) FROM bigquery.dim_players;
SELECT * FROM public.get_all_players() LIMIT 3;
```

## Tabelas do BigQuery

| Foreign Table | BigQuery Table | Descrição |
|--------------|----------------|-----------|
| `dim_players` | `nba.dim_players` | Jogadores |
| `dim_stat_player` | `nba.dim_stat_player` | Stats/Props dos jogadores |
| `dim_teams` | `nba.dim_teams` | Times |
| `ft_game_player_stats` | `nba.ft_game_player_stats` | Estatísticas por jogo |
| `ft_games` | `nba.ft_games` | Jogos |
| `dim_player_shooting_by_zones` | `nba.dim_player_shooting_by_zones` | Zonas de arremesso |

## Mapeamento de Colunas (BigQuery → PostgreSQL)

- `status` → `current_status` (nas RPC functions)
- `line_value` → `line` (nas RPC functions)

## Troubleshooting

### "foreign-data wrapper bigquery_wrapper does not exist"
Rode o PASSO 1 do setup_bigquery_local.sql

### "duplicate key value violates unique constraint secrets_name_idx"
```sql
DELETE FROM vault.secrets WHERE name = 'bigquery_sa_key';
```

### "Invalid service account authenticator"
O JSON da service account está errado. Verifique se copiou corretamente.

### Limpar tudo e recomeçar
```sql
DROP SERVER IF EXISTS bigquery_server CASCADE;
DROP FOREIGN DATA WRAPPER IF EXISTS bigquery_wrapper CASCADE;
DELETE FROM vault.secrets WHERE name = 'bigquery_sa_key';
```

## Configurações

- **Project ID:** smartbetting-dados
- **Dataset:** nba
- **Location:** us-east1
- **Service Account:** baccarin-local@smartbetting-dados.iam.gserviceaccount.com
