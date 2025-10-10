# Plano de Implementação - Feature Betting (Smart In Bet)

## 📋 Visão Geral
Implementação de um bot WhatsApp para gestão de banca de apostas, permitindo que usuários registrem apostas via texto, áudio ou imagem, com processamento via LLM e visualização no dashboard.

## 🎯 Objetivos
- Criar sistema de gestão de apostas via WhatsApp
- Permitir entrada de dados por texto, áudio ou imagem
- Processar dados com LLM (OpenAI) para estruturação JSON
- Dashboard para visualização das apostas
- Sistema de fila/buffer para múltiplas mensagens

## 🏗️ Arquitetura do Sistema

### Componentes Principais
1. **Banco de Dados** (Supabase)
2. **Edge Function** (Supabase Functions)
3. **Dashboard** (React/TypeScript)
4. **Integração WhatsApp** (Chatroot)
5. **Processamento LLM** (OpenAI)
6. **Sistema de Filas** (Supabase Realtime)

## 📊 Schema do Banco de Dados

### 1. Tabela `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  conversation_id VARCHAR(255), -- ID da conversa no Chatroot
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Tabela `bets`
```sql
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bet_type VARCHAR(50) NOT NULL, -- 'single', 'multiple', 'system', etc.
  sport VARCHAR(50) NOT NULL, -- 'football', 'basketball', 'tennis', etc.
  league VARCHAR(100), -- 'Premier League', 'NBA', etc.
  match_description TEXT, -- 'Manchester United vs Liverpool'
  bet_description TEXT NOT NULL, -- 'Over 2.5 goals'
  odds DECIMAL(10,2) NOT NULL,
  stake_amount DECIMAL(10,2) NOT NULL,
  potential_return DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'won', 'lost', 'void'
  bet_date TIMESTAMP WITH TIME ZONE NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  raw_input TEXT, -- Input original do usuário
  processed_data JSONB -- Dados estruturados pela LLM
);
```

### 3. Tabela `bet_legs` (para apostas múltiplas)
```sql
CREATE TABLE bet_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  leg_number INTEGER NOT NULL,
  sport VARCHAR(50) NOT NULL,
  match_description TEXT NOT NULL,
  bet_description TEXT NOT NULL,
  odds DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Tabela `message_queue` (Sistema de Filas)
```sql
CREATE TABLE message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message_type VARCHAR(20) NOT NULL, -- 'text', 'audio', 'image'
  content TEXT, -- Para texto
  media_url TEXT, -- Para áudio/imagem
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);
```

## 🔧 Implementação por Etapas

### Fase 1: Infraestrutura Base (Semana 1)

#### 1.1 Configuração do Banco de Dados
- [ ] Criar migrations para todas as tabelas
- [ ] Configurar RLS (Row Level Security)
- [ ] Criar índices para performance
- [ ] Configurar triggers para updated_at

#### 1.2 Schema JSON para Processamento LLM
```json
{
  "bet_type": "single|multiple|system",
  "sport": "string",
  "league": "string",
  "matches": [
    {
      "description": "string",
      "bet_description": "string",
      "odds": "number",
      "match_date": "ISO string"
    }
  ],
  "stake_amount": "number",
  "bet_date": "ISO string"
}
```

### Fase 2: Edge Function (Semana 2)

#### 2.1 Estrutura da Edge Function
```typescript
// supabase/functions/whatsapp-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WhatsAppMessage {
  conversation_id: string
  message_type: 'text' | 'audio' | 'image'
  content?: string
  media_url?: string
  timestamp: string
}

serve(async (req) => {
  const message: WhatsAppMessage = await req.json()
  
  // 1. Identificar usuário pelo conversation_id
  // 2. Adicionar à fila de processamento
  // 3. Retornar confirmação
})
```

#### 2.2 Funcionalidades da Edge Function
- [ ] Receber webhook do Chatroot
- [ ] Identificar usuário pelo conversation_id
- [ ] Adicionar mensagem à fila
- [ ] Processar fila em background
- [ ] Integração com OpenAI para processamento
- [ ] Salvar apostas processadas
- [ ] Enviar confirmação via WhatsApp

### Fase 3: Processamento LLM (Semana 3)

#### 3.1 Integração OpenAI
```typescript
// Processamento de texto
const processTextMessage = async (text: string) => {
  const prompt = `
    Analise a seguinte mensagem de aposta e extraia as informações:
    "${text}"
    
    Retorne um JSON com a estrutura definida.
  `
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  })
}

// Processamento de áudio
const processAudioMessage = async (audioUrl: string) => {
  const transcription = await openai.audio.transcriptions.create({
    file: audioUrl,
    model: "whisper-1"
  })
  
  return processTextMessage(transcription.text)
}

// Processamento de imagem
const processImageMessage = async (imageUrl: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Analise esta imagem de aposta e extraia as informações" },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }]
  })
}
```

### Fase 4: Dashboard (Semana 4)

#### 4.1 Estrutura do Dashboard
```typescript
// Páginas principais
- /dashboard/bets - Lista de apostas
- /dashboard/bets/new - Nova aposta (manual)
- /dashboard/stats - Estatísticas
- /dashboard/settings - Configurações
```

#### 4.2 Componentes Principais
- [ ] BetList - Lista de apostas com filtros
- [ ] BetCard - Card individual da aposta
- [ ] BetForm - Formulário para aposta manual
- [ ] StatsChart - Gráficos de performance
- [ ] WhatsAppSync - Botão de sincronização

### Fase 5: Integração WhatsApp (Semana 5)

#### 5.1 Configuração Chatroot
- [ ] Criar webhook URL da Edge Function
- [ ] Configurar mensagens automáticas
- [ ] Testar fluxo de sincronização
- [ ] Implementar respostas automáticas

#### 5.2 Fluxo de Sincronização
1. Usuário clica em "Sincronizar WhatsApp"
2. Redirecionamento para WhatsApp com mensagem pré-definida
3. Usuário envia mensagem
4. Sistema captura conversation_id
5. Confirmação de sincronização

## 🔄 Sistema de Filas e Buffer

### Implementação com Supabase Realtime
```typescript
// Processamento em background
const processMessageQueue = async () => {
  const { data: messages } = await supabase
    .from('message_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5)

  for (const message of messages) {
    await processMessage(message)
  }
}

// Executar a cada 30 segundos
setInterval(processMessageQueue, 30000)
```

## 🎨 Interface do Dashboard

### Layout Principal
```
┌─────────────────────────────────────────┐
│ Header: Logo + User Menu + WhatsApp Sync│
├─────────────────────────────────────────┤
│ Sidebar: Navigation                     │
├─────────────────────────────────────────┤
│ Main Content:                           │
│ ┌─────────────────┬─────────────────────┐│
│ │ Stats Cards     │ Recent Bets         ││
│ ├─────────────────┼─────────────────────┤│
│ │ Performance     │ Betting History       ││
│ │ Chart          │ (Table/List)         ││
│ └─────────────────┴─────────────────────┘│
└─────────────────────────────────────────┘
```

### Componentes de Visualização
- **Cards de Estatísticas**: Total apostado, lucro/prejuízo, ROI
- **Gráfico de Performance**: Evolução da banca ao longo do tempo
- **Lista de Apostas**: Filtros por data, status, esporte
- **Detalhes da Aposta**: Modal com informações completas

## 🚀 Deploy e Testes

### Comandos de Deploy
```bash
# Deploy da Edge Function
supabase functions deploy whatsapp-webhook

# Deploy das migrations
supabase db push

# Teste local
supabase functions serve whatsapp-webhook
```

### Testes
- [ ] Teste de recebimento de webhook
- [ ] Teste de processamento de texto
- [ ] Teste de processamento de áudio
- [ ] Teste de processamento de imagem
- [ ] Teste de sistema de filas
- [ ] Teste de sincronização WhatsApp

## 📱 Fluxo do Usuário

### 1. Onboarding
1. Usuário se cadastra com email e WhatsApp
2. Clica em "Sincronizar WhatsApp"
3. Envia mensagem pré-definida
4. Sistema confirma sincronização

### 2. Uso Diário
1. Usuário envia aposta via WhatsApp (texto/áudio/imagem)
2. Sistema processa e estrutura dados
3. Aparece no dashboard automaticamente
4. Usuário pode visualizar e editar

### 3. Gestão
1. Visualizar histórico no dashboard
2. Filtrar por período, esporte, status
3. Ver estatísticas de performance
4. Editar apostas se necessário

## 🔒 Segurança e Privacidade

### RLS Policies
```sql
-- Users só veem suas próprias apostas
CREATE POLICY "Users can only see their own bets" ON bets
  FOR ALL USING (auth.uid() = user_id);

-- Message queue protegida
CREATE POLICY "Users can only see their own messages" ON message_queue
  FOR ALL USING (auth.uid() = user_id);
```

### Dados Sensíveis
- Criptografia de dados financeiros
- Logs de auditoria
- Backup automático
- Conformidade LGPD

## 📈 Métricas e Monitoramento

### KPIs Principais
- Taxa de processamento de mensagens
- Tempo médio de resposta
- Precisão da LLM
- Satisfação do usuário

### Logs e Alertas
- Erros de processamento
- Falhas na integração WhatsApp
- Performance da LLM
- Uso de recursos

## 🎯 Próximos Passos

1. **Semana 1**: Criar schema do banco e migrations
2. **Semana 2**: Implementar Edge Function básica
3. **Semana 3**: Integrar OpenAI e processamento
4. **Semana 4**: Desenvolver dashboard
5. **Semana 5**: Configurar Chatroot e testes finais

## 📝 Notas Importantes

- Usar Supabase Storage para mídias temporárias
- Implementar retry automático para falhas
- Considerar rate limiting para OpenAI
- Backup regular dos dados
- Monitoramento de custos da OpenAI
- Testes extensivos antes do deploy em produção

---

**Status**: 🚧 Em Desenvolvimento  
**Prioridade**: 🔥 Alta  
**Estimativa**: 5 semanas  
**Responsável**: Equipe de Desenvolvimento
