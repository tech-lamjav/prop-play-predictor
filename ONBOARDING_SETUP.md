# Setup do Processo de Onboarding WhatsApp

## 📋 O que foi implementado

### 1. **Migrations do Banco de Dados**
- `005_create_users_table.sql` - Tabela de usuários com campos para WhatsApp
- `006_create_betting_tables.sql` - Tabelas para apostas e sistema de filas

### 2. **Componentes React**
- `WhatsAppOnboarding.tsx` - Componente principal de onboarding
- `WhatsAppSyncButton.tsx` - Botão reutilizável para sincronização
- `use-whatsapp-sync.ts` - Hook para gerenciar estado do WhatsApp

### 3. **Página de Onboarding**
- `Onboarding.tsx` - Página completa com 3 passos
- Integração com Supabase Auth
- Validação de dados
- Interface responsiva

## 🚀 Como aplicar as migrations

### 1. Aplicar as migrations no Supabase
```bash
# Aplicar migration da tabela de usuários
supabase db push

# Ou aplicar migrations específicas
supabase migration up
```

### 2. Verificar se as tabelas foram criadas
```sql
-- Verificar tabelas criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'bets', 'bet_legs', 'message_queue');
```

## 🔧 Configuração do Ambiente

### 1. Variáveis de Ambiente
Certifique-se de que as seguintes variáveis estão configuradas no `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Dependências
As seguintes dependências são necessárias (já devem estar instaladas):
- `@radix-ui/react-progress` - Para o componente Progress
- `lucide-react` - Para os ícones

## 📱 Fluxo do Onboarding

### Passo 1: Informações Pessoais
- Nome completo
- E-mail
- Validação de dados

### Passo 2: Configuração WhatsApp
- Número do WhatsApp
- Validação do formato
- Salvamento no banco

### Passo 3: Sincronização
- Botão para abrir WhatsApp
- Mensagem pré-definida
- Confirmação de sincronização

## 🎯 Próximos Passos

1. **Aplicar as migrations** no Supabase
2. **Testar o fluxo** de onboarding
3. **Implementar a Edge Function** para capturar conversation_id
4. **Configurar o Chatroot** com webhook
5. **Criar o dashboard** para visualizar apostas

## 🧪 Testes

### Teste Manual do Onboarding
1. Acesse `/onboarding`
2. Preencha as informações pessoais
3. Configure o número do WhatsApp
4. Teste o botão de sincronização
5. Verifique se os dados foram salvos no banco

### Verificação no Banco
```sql
-- Verificar usuários criados
SELECT id, name, email, whatsapp_number, whatsapp_synced 
FROM users 
ORDER BY created_at DESC;

-- Verificar se as funções foram criadas
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%whatsapp%';
```

## 🔒 Segurança

### RLS Policies Implementadas
- Usuários só veem seus próprios dados
- Proteção contra acesso não autorizado
- Validação de dados no frontend e backend

### Validações
- Formato do número do WhatsApp
- E-mail válido
- Dados obrigatórios
- Sanitização de inputs

## 📊 Estrutura das Tabelas

### Tabela `users`
```sql
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- whatsapp_number (VARCHAR, UNIQUE)
- conversation_id (VARCHAR)
- name (VARCHAR)
- whatsapp_synced (BOOLEAN)
- whatsapp_sync_token (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabela `bets`
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- bet_type (VARCHAR)
- sport (VARCHAR)
- league (VARCHAR)
- match_description (TEXT)
- bet_description (TEXT)
- odds (DECIMAL)
- stake_amount (DECIMAL)
- potential_return (DECIMAL)
- status (VARCHAR)
- bet_date (TIMESTAMP)
- match_date (TIMESTAMP)
- raw_input (TEXT)
- processed_data (JSONB)
```

## 🚨 Troubleshooting

### Erro: "Table doesn't exist"
- Verifique se as migrations foram aplicadas
- Execute `supabase db push`

### Erro: "RLS policy violation"
- Verifique se o usuário está autenticado
- Confirme se as policies estão corretas

### Erro: "WhatsApp sync failed"
- Verifique se o número está no formato correto
- Confirme se a função `sync_whatsapp` foi criada

## 📝 Notas Importantes

- O número do WhatsApp deve incluir código do país
- A sincronização real requer a Edge Function
- O conversation_id será capturado quando o usuário enviar mensagem
- O sistema de filas está preparado para múltiplas mensagens
- Todas as operações são protegidas por RLS

---

**Status**: ✅ Implementado  
**Próximo**: Edge Function para captura de conversation_id  
**Dependências**: Supabase CLI, migrations aplicadas
