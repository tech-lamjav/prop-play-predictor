# Guia de Teste - Integração WhatsApp

## Status da Implementação ✅

- ✅ Edge Function deployada
- ✅ Integração com Chatroot configurada
- ✅ Lógica de conversation_id implementada
- ✅ Processamento de mensagens (texto, áudio, imagem)
- ✅ Extração de dados de apostas com OpenAI
- ✅ Dashboard funcionando

## Como Testar o Fluxo Completo

### 1. Preparação
```bash
# Certifique-se de que o Supabase está rodando
supabase start

# Inicie o servidor de desenvolvimento
npm run dev
```

### 2. Teste do Fluxo de Usuário

#### Passo 1: Criar Conta
1. Acesse `http://localhost:5173`
2. Clique em "Começar Grátis"
3. Preencha os dados:
   - Nome: João Teste
   - Email: joao@teste.com
   - Senha: 123456
   - WhatsApp: +5511952132563

#### Passo 2: Onboarding WhatsApp
1. Após o cadastro, você será redirecionado para `/onboarding`
2. Clique em "Sincronizar WhatsApp"
3. Isso abrirá o WhatsApp com uma mensagem pré-formatada
4. Envie a mensagem para o número +55 11 95213-2563

#### Passo 3: Testar Mensagens de Aposta
Envie uma das seguintes mensagens para o WhatsApp:

**Texto simples:**
```
Aposta: Manchester United vs Liverpool - Over 2.5 gols - Odds: 1.85 - Valor: R$ 50,00
```

**Aposta múltipla:**
```
Apostas:
1. Barcelona vs Real Madrid - Barcelona ganha - Odds: 2.10
2. Lakers vs Warriors - Lakers ganha - Odds: 1.95
Valor total: R$ 100,00
```

**Aposta com data:**
```
Aposta para 15/01/2024:
Chelsea vs Arsenal - Under 2.5 gols - Odds: 1.70 - Valor: R$ 75,00
```

### 3. Verificar Resultados

#### No Dashboard
1. Acesse `http://localhost:5173/betting`
2. Verifique se as apostas aparecem na lista
3. Confirme os dados extraídos (esporte, odds, valor, etc.)

#### No Supabase Studio
1. Acesse `http://127.0.0.1:54323`
2. Verifique as tabelas:
   - `users` - usuário com conversation_id
   - `bets` - apostas processadas
   - `message_queue` - mensagens processadas

### 4. Teste de Diferentes Tipos de Mídia

#### Áudio
Envie um áudio descrevendo uma aposta:
"Oi, fiz uma aposta no Manchester United contra o Liverpool, over 2.5 gols, odds 1.85, valor 50 reais"

#### Imagem
Envie uma foto de um bilhete de aposta ou print de uma casa de apostas.

### 5. Verificar Logs

Para debugar problemas, verifique os logs:
```bash
# Logs da Edge Function
supabase functions logs whatsapp-webhook

# Logs do Supabase
supabase logs
```

## Estrutura de Dados Esperada

### Tabela `users`
- `id`: UUID do usuário
- `whatsapp_number`: +5511952132563
- `conversation_id`: ID da conversa no Chatroot
- `whatsapp_synced`: true

### Tabela `bets`
- `user_id`: Referência ao usuário
- `bet_type`: single/multiple/system
- `sport`: futebol, basquete, etc.
- `odds`: 1.85
- `stake_amount`: 50.00
- `raw_input`: Mensagem original
- `processed_data`: JSON com dados extraídos

### Tabela `message_queue`
- `user_id`: Referência ao usuário
- `message_type`: text/audio/image
- `content`: Conteúdo processado
- `status`: pending/processing/completed/failed

## Troubleshooting

### Problema: Mensagem não é processada
- Verifique se o conversation_id está correto
- Confirme se o usuário existe na tabela users
- Verifique os logs da Edge Function

### Problema: Dados extraídos incorretamente
- A mensagem deve conter informações claras de aposta
- Use palavras-chave como "aposta", "odds", "valor"
- Inclua o nome dos times e tipo de aposta

### Problema: WhatsApp não sincroniza
- Verifique se o número está no formato correto (+5511952132563)
- Confirme se a mensagem de sincronização foi enviada
- Verifique se o conversation_id foi capturado

## Próximos Passos

1. ✅ Testar fluxo completo
2. 🔄 Implementar confirmações automáticas
3. 🔄 Adicionar validações de dados
4. 🔄 Melhorar extração de informações
5. 🔄 Implementar relatórios e estatísticas
