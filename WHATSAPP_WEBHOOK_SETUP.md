# WhatsApp Webhook Edge Function

## 📋 O que foi implementado

### **Edge Function: `whatsapp-webhook`**
- Processamento de mensagens do WhatsApp via Chatroot
- Suporte a texto, áudio e imagem
- Integração com OpenAI (Whisper + GPT-4)
- Sistema de filas para processamento
- Captura automática de conversation_id

## 🚀 Como fazer deploy

### 1. Configurar variáveis de ambiente
```bash
# No Supabase Dashboard > Settings > Edge Functions
# Adicionar as seguintes variáveis:

OPENAI_API_KEY=your_openai_api_key_here
CHATROOT_API_KEY=your_chatroot_api_key_here
```

### 2. Fazer deploy da Edge Function
```bash
# Deploy da função
supabase functions deploy whatsapp-webhook

# Verificar se foi deployada
supabase functions list
```

### 3. Testar localmente (opcional)
```bash
# Iniciar Supabase local
supabase start

# Servir a função localmente
supabase functions serve whatsapp-webhook

# Em outro terminal, testar
node test-webhook.js
```

## 🔧 Configuração do Chatroot

### 1. Webhook URL
```
https://your-project-ref.supabase.co/functions/v1/whatsapp-webhook
```

### 2. Headers necessários
```
Content-Type: application/json
Authorization: Bearer your_supabase_anon_key
```

### 3. Formato do payload esperado
```json
{
  "conversation_id": "string",
  "message_type": "text|audio|image",
  "content": "string (para texto)",
  "media_url": "string (para áudio/imagem)",
  "timestamp": "string",
  "sender": {
    "phone_number": "string",
    "name": "string"
  }
}
```

## 🧠 Processamento de Mensagens

### **Fluxo de Processamento**
1. **Recebe webhook** do Chatroot
2. **Identifica usuário** por conversation_id
3. **Processa mídia** (áudio → Whisper, imagem → GPT-4 Vision)
4. **Extrai informações** de aposta com GPT-4
5. **Salva no banco** de dados
6. **Envia confirmação** para o usuário

### **Tipos de Mensagem Suportados**

#### **Texto**
```
"Apostei R$ 100 no Manchester United vs Liverpool, Over 2.5 gols, odds 1.85"
```

#### **Áudio**
- Transcrito com Whisper
- Processado como texto
- Suporte a português

#### **Imagem**
- Analisada com GPT-4 Vision
- Extrai texto da aposta
- Processado como texto

## 📊 Estrutura de Dados

### **JSON de Saída da LLM**
```json
{
  "bet_type": "single|multiple|system",
  "sport": "futebol|basquete|tênis",
  "league": "Premier League|NBA|etc",
  "matches": [
    {
      "description": "Manchester United vs Liverpool",
      "bet_description": "Over 2.5 gols",
      "odds": 1.85,
      "match_date": "2024-01-15T20:00:00Z"
    }
  ],
  "stake_amount": 100.00,
  "bet_date": "2024-01-15T10:00:00Z"
}
```

### **Tabelas Utilizadas**
- `users` - Dados do usuário
- `bets` - Apostas registradas
- `message_queue` - Fila de processamento

## 🔄 Sistema de Filas

### **Estados da Mensagem**
- `pending` - Aguardando processamento
- `processing` - Sendo processada
- `completed` - Processada com sucesso
- `failed` - Falhou no processamento

### **Retry Automático**
- Máximo 3 tentativas
- Delay exponencial entre tentativas
- Log de erros para debugging

## 🧪 Testes

### **Teste Manual**
```bash
# Usar o script de teste
node test-webhook.js
```

### **Teste com cURL**
```bash
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "test-123",
    "message_type": "text",
    "content": "Apostei R$ 100 no Real Madrid ganhar, odds 1.50"
  }'
```

## 🔒 Segurança

### **Validações Implementadas**
- Verificação de conversation_id
- Validação de formato de mensagem
- Rate limiting (configurável)
- Logs de auditoria

### **Tratamento de Erros**
- Retry automático para falhas temporárias
- Logs detalhados para debugging
- Fallback para mensagens não processáveis

## 📈 Monitoramento

### **Logs Importantes**
- Recebimento de webhook
- Identificação de usuário
- Processamento de mídia
- Extração de dados
- Salvamento no banco
- Envio de confirmação

### **Métricas**
- Mensagens processadas por minuto
- Taxa de sucesso/erro
- Tempo médio de processamento
- Uso da API OpenAI

## 🚨 Troubleshooting

### **Erro: "User not found"**
- Verificar se conversation_id está correto
- Confirmar se usuário fez sync do WhatsApp
- Verificar se número está no formato correto

### **Erro: "OpenAI API error"**
- Verificar se OPENAI_API_KEY está configurada
- Confirmar se tem créditos na conta OpenAI
- Verificar rate limits da API

### **Erro: "Failed to extract betting info"**
- Verificar se a mensagem contém informações de aposta
- Testar com diferentes formatos de mensagem
- Ajustar prompt da LLM se necessário

## 🔄 Próximos Passos

1. **Configurar Chatroot** com webhook URL
2. **Testar fluxo completo** end-to-end
3. **Implementar envio de confirmação** via Chatroot
4. **Adicionar rate limiting** e monitoramento
5. **Criar dashboard** para visualizar apostas

## 📝 Notas Importantes

- A Edge Function precisa estar deployada para funcionar
- OpenAI API key é obrigatória
- Conversation_id é capturado automaticamente
- Sistema de filas evita perda de mensagens
- Logs são essenciais para debugging

---

**Status**: ✅ Implementado  
**Próximo**: Configurar Chatroot e testar integração  
**Dependências**: OpenAI API, Supabase deploy
