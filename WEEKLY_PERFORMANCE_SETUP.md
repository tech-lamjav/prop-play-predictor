# Sistema de Performance Semanal

Este sistema calcula e armazena automaticamente métricas de performance semanal dos usuários, executando todo domingo às 22h (10 PM).

## 📊 Estrutura

### Tabela `weekly_performance`

Armazena as métricas calculadas para cada usuário por semana:

- **user_id**: ID do usuário
- **week_start_date**: Data de início da semana (domingo)
- **week_end_date**: Data de fim da semana (sábado)
- **total_bets**: Total de apostas na semana
- **total_staked**: Valor total apostado
- **total_won**: Total ganho (soma dos `potential_return` das apostas com status 'won')
- **total_lost**: Total perdido (soma dos `stake_amount` das apostas com status 'lost')
- **total_cashout**: Total de cashout (soma dos `cashout_amount` das apostas com status 'cashout')
- **total_pending**: Total pendente (soma dos `stake_amount` das apostas com status 'pending')
- **net_profit**: Lucro líquido = (total_won + total_cashout) - total_lost
- **sport_breakdown**: JSONB com breakdown por esporte contendo as mesmas métricas

### Função `calculate_weekly_performance`

Função SQL que:
1. Calcula a semana anterior (domingo a sábado)
2. Para cada usuário que teve apostas na semana:
   - Calcula métricas gerais
   - Calcula breakdown por esporte
   - Insere ou atualiza o registro na tabela `weekly_performance`

**Parâmetros:**
- `p_week_start_date` (opcional): Data de início da semana a calcular. Se NULL, calcula a semana anterior.

**Uso:**
```sql
-- Calcular semana anterior automaticamente
SELECT public.calculate_weekly_performance();

-- Calcular semana específica
SELECT public.calculate_weekly_performance('2024-01-07'::DATE);
```

## ⏰ Cron Job

O cron job está configurado para executar automaticamente todo domingo às 22h (10 PM).

### Configuração do Cron

- **Nome do job**: `calculate-weekly-performance`
- **Schedule**: `0 22 * * 0` (todo domingo às 22:00)
- **Comando**: `SELECT public.calculate_weekly_performance();`

### Verificar Status do Cron

```sql
-- Ver todos os jobs agendados
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'calculate-weekly-performance')
ORDER BY start_time DESC;
```

### Gerenciar o Cron Job

```sql
-- Remover o job
SELECT cron.unschedule('calculate-weekly-performance');

-- Recriar o job (se necessário)
SELECT cron.schedule(
  'calculate-weekly-performance',
  '0 22 * * 0',
  $$SELECT public.calculate_weekly_performance();$$
);
```

## 🚀 Setup

1. **Aplicar as migrations:**
   ```bash
   supabase db push
   ```

2. **Verificar se pg_cron está habilitado:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

3. **Se pg_cron não estiver habilitado:**
   - No Supabase Dashboard, vá em Database > Extensions
   - Habilite a extensão `pg_cron`
   - Ou execute: `CREATE EXTENSION IF NOT EXISTS pg_cron;`

4. **Testar manualmente:**
   ```sql
   SELECT public.calculate_weekly_performance();
   ```

## 📈 Queries Úteis

Ver arquivo `query_weekly_performance.sql` para exemplos de queries para visualizar os dados.

### Exemplos Rápidos

```sql
-- Ver performance de todos os usuários na última semana
SELECT 
  u.name,
  u.email,
  wp.total_bets,
  wp.net_profit,
  wp.sport_breakdown
FROM weekly_performance wp
JOIN users u ON wp.user_id = u.id
WHERE wp.week_start_date = (
  SELECT MAX(week_start_date) FROM weekly_performance
)
ORDER BY wp.net_profit DESC;

-- Ver breakdown por esporte de um usuário
SELECT 
  week_start_date,
  jsonb_pretty(sport_breakdown) as esportes
FROM weekly_performance
WHERE user_id = 'USER_ID_AQUI'
ORDER BY week_start_date DESC;
```

## 🔍 Como Funciona

1. **Todo domingo às 22h**, o cron job executa automaticamente
2. A função `calculate_weekly_performance()` é chamada
3. A função identifica a semana anterior (domingo a sábado)
4. Para cada usuário que teve apostas na semana:
   - Calcula métricas gerais (total apostas, ganhos, perdas, etc.)
   - Calcula breakdown por esporte
   - Insere ou atualiza o registro na tabela
5. Os dados ficam disponíveis para consulta e visualização

## 📝 Notas

- A semana é calculada de domingo a sábado
- Apostas pendentes não entram no cálculo do lucro líquido
- O breakdown por esporte é armazenado em formato JSONB para flexibilidade
- Se um registro já existe para a semana, ele é atualizado (não duplicado)
- RLS (Row Level Security) está habilitado - usuários só veem seus próprios dados

## 🐛 Troubleshooting

### Cron não está executando

1. Verifique se pg_cron está habilitado
2. Verifique se o job está agendado: `SELECT * FROM cron.job;`
3. Verifique logs de execução: `SELECT * FROM cron.job_run_details;`
4. Teste manualmente: `SELECT public.calculate_weekly_performance();`

### Dados não estão sendo calculados

1. Verifique se há apostas no período da semana
2. Verifique se as apostas têm `user_id` não nulo
3. Execute manualmente para ver erros: `SELECT public.calculate_weekly_performance();`

### Alternativa: Edge Function + Cron Externo

Se pg_cron não estiver disponível, você pode:
1. Criar uma Edge Function que chama a função SQL
2. Usar um serviço externo de cron (como cron-job.org) para chamar a Edge Function via HTTP
3. Ou usar Supabase Scheduled Functions (se disponível)





