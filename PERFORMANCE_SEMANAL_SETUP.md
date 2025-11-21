# Sistema de Performance Semanal com Mensagem WhatsApp

Este sistema calcula e armazena automaticamente métricas de performance semanal dos usuários, gerando mensagens formatadas prontas para envio via WhatsApp. Executa todo domingo às 22h (10 PM).

## 📊 Estrutura

### Tabela `performance_semanal`

Armazena as métricas calculadas para cada usuário por semana, incluindo mensagem formatada:

- **user_id**: ID do usuário
- **user_name**: Nome do usuário (snapshot)
- **user_email**: Email do usuário (snapshot)
- **user_whatsapp_number**: Número do WhatsApp (snapshot)
- **semana_inicio**: Data de início da semana (domingo)
- **semana_fim**: Data de fim da semana (sábado)
- **total_apostas**: Total de apostas na semana
- **valor_apostado**: Valor total apostado
- **ganhos**: Total ganho (soma dos `potential_return` das apostas com status 'won')
- **perdas**: Total perdido (soma dos `stake_amount` das apostas com status 'lost')
- **apostas_pendentes**: Total pendente (soma dos `stake_amount` das apostas com status 'pending')
- **cashout**: Total de cashout (soma dos `cashout_amount` das apostas com status 'cashout')
- **lucro_liquido**: Lucro líquido = (ganhos + cashout) - perdas
- **breakdown_por_esporte**: JSONB com breakdown por esporte
- **mensagem_whatsapp**: Mensagem formatada pronta para envio

### Função `calcular_performance_semanal()`

Função SQL que:
1. Calcula a semana anterior (domingo a sábado)
2. Para cada usuário que teve apostas na semana:
   - Busca informações do usuário (nome, email, WhatsApp)
   - Calcula métricas gerais
   - Calcula breakdown por esporte
   - Gera mensagem WhatsApp formatada
   - Insere ou atualiza o registro na tabela

**Parâmetros:**
- `p_semana_inicio` (opcional): Data de início da semana a calcular. Se NULL, calcula a semana anterior.

**Uso:**
```sql
-- Calcular semana anterior automaticamente
SELECT public.calcular_performance_semanal();

-- Calcular semana específica
SELECT public.calcular_performance_semanal('2025-11-02'::DATE);
```

### Função `generate_whatsapp_message()`

Gera a mensagem formatada no padrão especificado:

```
🎯 *Relatório Semanal de Apostas*

📅 Período: 02/11/2025 - 08/11/2025

👤 *Nome do Usuário*

📊 *Resumo da Semana:*

• Total de Apostas: *14*
• Valor Apostado: *R$ 1.300,00*
• Ganhos: *R$ 0,00*
• Perdas: *R$ 0,00*
• Apostas Pendentes: *R$ 1.300,00*
• Cashout: *R$ 0,00* (se houver)

💰 *Lucro Líquido: R$ 0,00*
```

## ⏰ Cron Job

O cron job está configurado para executar automaticamente todo domingo às 22h (10 PM).

### Configuração do Cron

- **Nome do job**: `calcular-performance-semanal`
- **Schedule**: `0 22 * * 0` (todo domingo às 22:00)
- **Comando**: `SELECT public.calcular_performance_semanal();`

### Verificar Status do Cron

```sql
-- Ver todos os jobs agendados
SELECT * FROM cron.job WHERE jobname = 'calcular-performance-semanal';

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'calcular-performance-semanal')
ORDER BY start_time DESC;
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

3. **Testar manualmente:**
   ```sql
   SELECT public.calcular_performance_semanal();
   ```

4. **Verificar resultados:**
   ```sql
   SELECT * FROM public.performance_semanal ORDER BY semana_inicio DESC;
   ```

## 📈 Queries Úteis

### Ver todas as mensagens da última semana
```sql
SELECT 
  user_name,
  user_email,
  user_whatsapp_number,
  mensagem_whatsapp
FROM public.performance_semanal
WHERE semana_inicio = (
  SELECT MAX(semana_inicio) FROM public.performance_semanal
)
ORDER BY user_name;
```

### Ver mensagem de um usuário específico
```sql
SELECT mensagem_whatsapp
FROM public.performance_semanal
WHERE user_email = 'email@exemplo.com'
ORDER BY semana_inicio DESC
LIMIT 1;
```

### Ver resumo da última semana
```sql
SELECT 
  user_name,
  total_apostas,
  valor_apostado,
  ganhos,
  perdas,
  lucro_liquido
FROM public.performance_semanal
WHERE semana_inicio = (
  SELECT MAX(semana_inicio) FROM public.performance_semanal
)
ORDER BY lucro_liquido DESC;
```

## 🔍 Como Funciona

1. **Todo domingo às 22h**, o cron job executa automaticamente
2. A função `calcular_performance_semanal()` é chamada
3. A função identifica a semana anterior (domingo a sábado)
4. Para cada usuário que teve apostas na semana:
   - Busca informações do usuário
   - Calcula métricas gerais
   - Calcula breakdown por esporte
   - Gera mensagem WhatsApp formatada
   - Insere ou atualiza o registro na tabela
5. Os dados ficam disponíveis para consulta e envio via WhatsApp

## 📝 Formato da Mensagem

A mensagem segue exatamente o formato especificado:
- Emojis para destacar seções
- Formatação em negrito (*texto*)
- Valores formatados em Real brasileiro (R$)
- Datas no formato DD/MM/YYYY
- Inclui cashout apenas se houver valor > 0

## 🐛 Troubleshooting

### Cron não está executando
1. Verifique se pg_cron está habilitado
2. Verifique se o job está agendado: `SELECT * FROM cron.job;`
3. Verifique logs: `SELECT * FROM cron.job_run_details;`
4. Teste manualmente: `SELECT public.calcular_performance_semanal();`

### Mensagem não está formatada corretamente
1. Verifique se as funções `format_currency()` e `format_date_br()` foram criadas
2. Teste a função de mensagem diretamente:
```sql
SELECT generate_whatsapp_message(
  'Nome Teste',
  '2025-11-02'::DATE,
  '2025-11-08'::DATE,
  14, 1300.00, 0.00, 0.00, 1300.00, 0.00, 0.00
);
```

### Dados não estão sendo calculados
1. Verifique se há apostas no período da semana
2. Verifique se as apostas têm `user_id` não nulo
3. Execute manualmente para ver erros: `SELECT public.calcular_performance_semanal();`



