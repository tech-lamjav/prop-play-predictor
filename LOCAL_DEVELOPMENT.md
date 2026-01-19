# Guia de Desenvolvimento Local - Smart Betting

Este documento fornece um guia completo para configurar e executar o ambiente de desenvolvimento local do Smart Betting, incluindo setup do Supabase com Docker, frontend, e explicações detalhadas sobre os componentes principais do produto.

## 📋 Índice

1. [Introdução](#introdução)
2. [Pré-requisitos](#pré-requisitos)
3. [Setup do Ambiente Local](#setup-do-ambiente-local)
4. [Rodando o Ambiente Completo](#rodando-o-ambiente-completo)
5. [Ambiente Isolado para Testes](#ambiente-isolado-para-testes)
6. [Arquitetura do Produto](#arquitetura-do-produto)
7. [Troubleshooting](#troubleshooting)
8. [Próximos Passos](#próximos-passos)

---

## Introdução

O Smart Betting é uma plataforma completa de análise de apostas esportivas focada em:
- **Betinho**: Bot de gestão de apostas via Telegram/WhatsApp com processamento por IA
- **Plataforma de Análises**: Dashboard avançado para análise de player props da NBA com dados do BigQuery

Este guia cobre todo o processo de configuração de um ambiente local isolado para desenvolvimento e testes antes de fazer Pull Requests.

---

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

### Software Necessário

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Supabase CLI** ([Instalação](https://supabase.com/docs/guides/cli))
- **Git** ([Download](https://git-scm.com/))
- **Yarn** ou **npm** (gerenciador de pacotes)

### Verificação Rápida

```bash
# Verificar versões instaladas
node --version    # Deve ser >= 18.0.0
npm --version     # Ou yarn --version
docker --version
supabase --version
git --version
```

### Contas e Acesso

- Conta no **Google Cloud Platform** (para BigQuery - opcional para desenvolvimento local)
- Conta no **Supabase** (para produção - opcional para desenvolvimento local)
- **OpenAI API Key** (para processamento de mensagens do Betinho)

---

## Setup do Ambiente Local

### 1. Instalação de Dependências

#### 1.1 Docker Desktop

1. Baixe e instale o Docker Desktop
2. Inicie o Docker Desktop e aguarde até que esteja rodando
3. Verifique se está funcionando:

```bash
docker ps
# Deve retornar uma lista (mesmo que vazia) sem erros
```

#### 1.2 Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux
npm install -g supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Verifique a instalação:

```bash
supabase --version
```

#### 1.3 Node.js e Dependências do Projeto

```bash
# Clone o repositório (se ainda não tiver)
git clone <repository-url>
cd prop-play-predictor

# Instale as dependências
npm install
# ou
yarn install
```

### 2. Configuração do Supabase Local

#### 2.1 Inicializar o Projeto Supabase

Antes de iniciar o Supabase, você precisa inicializar o projeto localmente:

```bash
# Certifique-se de que o Docker está rodando
docker ps

# Inicialize o projeto Supabase (primeira vez apenas)
supabase init
```

Este comando cria a estrutura de pastas necessária (`supabase/`) se ainda não existir.

#### 2.2 Iniciar Supabase com Docker

Após inicializar, inicie o Supabase local:

```bash
# Inicie o Supabase local
supabase start
```

Este comando irá:
- Baixar as imagens Docker necessárias (na primeira vez)
- Criar containers para todos os serviços
- Aplicar todas as migrations automaticamente
- Configurar o banco de dados local

**Tempo estimado**: 2-5 minutos na primeira execução

#### 2.3 Verificar Status e Obter Credenciais

Após iniciar, você verá informações importantes no terminal:

```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANTE**: Copie o **API URL** e o **anon key** completos! Você precisará deles para configurar o `.env` do frontend.

Você também pode ver essas informações a qualquer momento com:

```bash
supabase status
```

#### 2.4 Aplicar Migrations

As migrations são aplicadas automaticamente quando você executa `supabase start`. Se precisar aplicar manualmente:

```bash
# Ver migrations aplicadas
supabase migration list

# Aplicar migrations pendentes
supabase db reset
```

#### 2.5 Configurar Variáveis de Ambiente do Frontend

Agora você precisa configurar as variáveis de ambiente do frontend para conectar ao Supabase local rodando no Docker.

**Passo 1**: Crie um arquivo `.env` na raiz do projeto:

```bash
# Copie o exemplo (se existir)
cp .env.example .env

# Ou crie manualmente
touch .env
```

**Passo 2**: Abra o arquivo `.env` e adicione as variáveis do Supabase local. **Use os valores exatos** que apareceram no output do `supabase start`:

```env
# App Configuration
VITE_APP_NAME=Smart Betting
VITE_APP_VERSION=1.0.0

# Supabase Local Configuration
# ⚠️ IMPORTANTE: Use os valores do output do 'supabase start'
# Copie o "API URL" completo para VITE_SUPABASE_URL
VITE_SUPABASE_URL=http://127.0.0.1:54321

# Copie o "anon key" completo para VITE_SUPABASE_ANON_KEY
# Exemplo (substitua pelo seu valor real):
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# PostHog Analytics (opcional para desenvolvimento)
VITE_PUBLIC_POSTHOG_KEY=your-posthog-key-here
VITE_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Google Cloud Storage (opcional para desenvolvimento local)
VITE_GOOGLE_CLOUD_PROJECT_ID=your-project-id
VITE_GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
VITE_GOOGLE_CLOUD_API_KEY=your-api-key

# OpenAI (necessário para Betinho)
OPENAI_API_KEY=your-openai-api-key-here

# Telegram Bot (opcional para desenvolvimento local)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret
```

**⚠️ Dica**: Para copiar facilmente as credenciais:

1. Execute `supabase status` no terminal
2. Copie o **API URL** completo (geralmente `http://127.0.0.1:54321`)
3. Copie o **anon key** completo (é um JWT longo)
4. Cole no arquivo `.env` nas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

**Nota**: Essas são as **únicas duas variáveis obrigatórias** do Supabase para o frontend funcionar localmente. As outras são opcionais dependendo das features que você quer testar.

#### 2.6 Edge Functions Locais

As Edge Functions podem ser testadas localmente:

```bash
# Servir todas as functions localmente
supabase functions serve

# Servir uma function específica
supabase functions serve telegram-webhook
supabase functions serve whatsapp-webhook
```

As functions estarão disponíveis em:
- `http://127.0.0.1:54321/functions/v1/telegram-webhook`
- `http://127.0.0.1:54321/functions/v1/whatsapp-webhook`

### 3. Configuração do Frontend

#### 3.1 Instalação de Dependências

```bash
# Se ainda não instalou
npm install
# ou
yarn install
```

#### 3.2 Arquivo .env para Desenvolvimento

O arquivo `.env` já foi configurado na seção anterior. Certifique-se de que todas as variáveis necessárias estão presentes.

#### 3.3 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento na porta 8080
yarn dev             # Alternativa com yarn

# Build
npm run build        # Build para produção
npm run build:dev    # Build em modo desenvolvimento

# Preview
npm run preview      # Preview do build de produção

# Linting
npm run lint         # Executa ESLint
```

#### 3.4 Iniciar o Frontend

```bash
npm run dev
# ou
yarn dev
```

O servidor estará disponível em: `http://localhost:8080`

---

## Rodando o Ambiente Completo

### Passo a Passo Completo

1. **Iniciar Docker Desktop**
   ```bash
   # macOS
   open -a Docker
   
   # Aguarde até que o Docker esteja rodando (ícone na barra de tarefas)
   ```

2. **Inicializar Supabase (primeira vez apenas)**
   ```bash
   cd prop-play-predictor
   supabase init
   ```

3. **Iniciar Supabase Local**
   ```bash
   supabase start
   ```

4. **Copiar Credenciais do Supabase**
   - Anote o **API URL** e **anon key** do output do `supabase start`
   - Ou execute `supabase status` para ver novamente

5. **Configurar .env do Frontend**
   - Crie/edite o arquivo `.env` na raiz do projeto
   - Adicione `VITE_SUPABASE_URL` com o API URL copiado
   - Adicione `VITE_SUPABASE_ANON_KEY` com o anon key copiado
   - Configure outras variáveis opcionais conforme necessário

6. **Iniciar Frontend**
   ```bash
   npm run dev
   # ou
   yarn dev
   ```

7. **Verificar Saúde dos Serviços**

   - **Frontend**: http://localhost:8080
   - **Supabase Studio**: http://127.0.0.1:54323 (interface visual do banco)
   - **Supabase API**: http://127.0.0.1:54321
   - **Inbucket** (emails locais): http://127.0.0.1:54324

### URLs e Portas Importantes

| Serviço | URL | Porta | Descrição |
|---------|-----|-------|-----------|
| Frontend | http://localhost:8080 | 8080 | Aplicação React |
| Supabase API | http://127.0.0.1:54321 | 54321 | API REST do Supabase |
| Supabase Studio | http://127.0.0.1:54323 | 54323 | Interface visual do banco |
| PostgreSQL | postgresql://postgres:postgres@127.0.0.1:54322/postgres | 54322 | Banco de dados |
| Inbucket | http://127.0.0.1:54324 | 54324 | Servidor de email local |
| Edge Functions | http://127.0.0.1:54321/functions/v1/ | 54321 | Functions serverless |

### Comandos Úteis

```bash
# Ver status do Supabase
supabase status

# Parar Supabase
supabase stop

# Resetar banco de dados (aplica migrations novamente)
supabase db reset

# Ver logs do Supabase
supabase logs

# Ver logs de uma function específica
supabase functions logs telegram-webhook
```

---

## Ambiente Isolado para Testes

### Estratégia de Testes End-to-End

Para garantir que suas mudanças funcionam corretamente antes de fazer um PR:

#### 1. Dados de Teste

O Supabase local começa com um banco vazio. Você pode criar dados de teste de várias formas:

**Opção A: Via Supabase Studio**
1. Acesse http://127.0.0.1:54323
2. Navegue até a tabela desejada
3. Use o editor SQL ou interface visual para inserir dados

**Opção B: Via SQL Script**

Crie um arquivo `supabase/seed.sql`:

```sql
-- Exemplo: Criar usuário de teste
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Criar perfil do usuário
INSERT INTO public.users (id, email, name, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  'Test User',
  NOW()
);

-- Criar apostas de teste
INSERT INTO public.bets (user_id, bet_type, sport, bet_description, odds, stake_amount, potential_return, status, bet_date)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'single', 'basquete', 'LeBron 25+ pontos', 1.85, 100.00, 185.00, 'pending', NOW()),
  ('00000000-0000-0000-0000-000000000001', 'multiple', 'futebol', 'Over 2.5 gols', 2.10, 150.00, 315.00, 'won', NOW() - INTERVAL '1 day');
```

Execute o seed:

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql
```

#### 2. Testar Fluxo Completo do Betinho

1. **Criar usuário de teste** via interface web
2. **Configurar Telegram/WhatsApp** (usar números de teste)
3. **Enviar mensagem de teste** para a edge function
4. **Verificar no dashboard** se a aposta foi processada corretamente

**Script de teste para Telegram:**

```bash
# test-telegram-webhook.sh
curl -X POST http://127.0.0.1:54321/functions/v1/telegram-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "update_id": 123456,
    "message": {
      "message_id": 1,
      "date": 1234567890,
      "chat": {"id": 123456789, "type": "private"},
      "from": {"id": 123456789, "is_bot": false, "first_name": "Test"},
      "text": "Aposta: LeBron 25+ pontos, odds 1.85, valor R$ 100"
    }
  }'
```

#### 3. Testar Plataforma de Análises

Para testar a plataforma de análises, você precisa de dados do BigQuery. Opções:

**Opção A: Mock de Dados**
- Criar dados mock no Supabase que simulam a estrutura do BigQuery
- Usar RPC functions locais que retornam dados de teste

**Opção B: Conectar ao BigQuery de Desenvolvimento**
- Usar um projeto GCP separado para desenvolvimento
- Configurar credenciais no Supabase Vault

### Checklist de Validação Antes do PR

Antes de fazer um Pull Request, certifique-se de:

- [ ] **Supabase local está rodando** (`supabase status`)
- [ ] **Frontend inicia sem erros** (`npm run dev`)
- [ ] **Migrations aplicadas corretamente** (verificar no Studio)
- [ ] **Autenticação funciona** (criar conta, login, logout)
- [ ] **Betinho funciona** (se modificou):
  - [ ] Edge function responde corretamente
  - [ ] Mensagens são processadas
  - [ ] Apostas aparecem no dashboard
- [ ] **Plataforma de análises funciona** (se modificou):
  - [ ] Dados são carregados corretamente
  - [ ] Gráficos renderizam
  - [ ] Filtros funcionam
- [ ] **Sem erros no console** do navegador
- [ ] **Lint passa** (`npm run lint`)
- [ ] **Build funciona** (`npm run build`)
- [ ] **Testado em diferentes navegadores** (Chrome, Firefox, Safari)
- [ ] **Responsivo** (mobile e desktop)

### Comandos de Teste Rápido

```bash
# Testar build
npm run build && npm run preview

# Testar lint
npm run lint

# Verificar tipos TypeScript
npx tsc --noEmit

# Resetar ambiente limpo
supabase stop
supabase start
npm run dev
```

---

## Arquitetura do Produto

### O Betinho

#### O que é o Betinho?

O **Betinho** é um assistente inteligente de gestão de apostas que permite aos usuários registrar apostas através de mensagens no Telegram ou WhatsApp. O sistema usa IA (OpenAI) para processar mensagens de texto, áudio ou imagens e extrair automaticamente informações sobre as apostas.

#### Fluxo de Funcionamento

```
┌─────────────┐
│   Usuário   │
│ (Telegram/  │
│  WhatsApp)  │
└──────┬──────┘
       │
       │ Envia mensagem (texto/áudio/imagem)
       │
       ▼
┌─────────────────────┐
│  Edge Function      │
│  (telegram-webhook  │
│  /whatsapp-webhook) │
└──────┬──────────────┘
       │
       │ Processa mídia (Whisper/Vision)
       │
       ▼
┌─────────────────────┐
│   OpenAI API        │
│  (GPT-4 + Whisper)  │
└──────┬──────────────┘
       │
       │ Extrai dados estruturados
       │
       ▼
┌─────────────────────┐
│   Supabase DB       │
│  (bets, bet_legs)   │
└──────┬──────────────┘
       │
       │ Dados salvos
       │
       ▼
┌─────────────────────┐
│   Dashboard Web     │
│   (/bets)           │
└─────────────────────┘
```

#### Componentes Principais

##### 1. Edge Functions

**Localização**: `supabase/functions/telegram-webhook/` e `supabase/functions/whatsapp-webhook/`

**Responsabilidades**:
- Receber webhooks do Telegram/WhatsApp
- Processar diferentes tipos de mídia (texto, áudio, imagem)
- Integrar com OpenAI para extração de dados
- Salvar apostas no banco de dados
- Enviar confirmações de volta ao usuário

**Principais funções**:
- `extractBettingInfo()`: Extrai informações de apostas usando GPT-4
- `processImage()`: Processa imagens com GPT-4 Vision
- `processAudio()`: Transcreve áudio com Whisper
- `saveBet()`: Salva aposta no banco de dados

##### 2. Processamento com OpenAI

O sistema usa três modelos da OpenAI:

- **GPT-4**: Extração de dados de apostas de texto e imagens
- **Whisper**: Transcrição de áudio para texto
- **GPT-4 Vision**: Análise de imagens (prints de apostas)

**Schema de Extração**:
```typescript
interface ProcessedBet {
  bet_type: 'single' | 'multiple' | 'system';
  sport: string;
  league?: string;
  matches: Array<{
    description: string;      // "Lakers vs Warriors"
    bet_description: string;  // "LeBron 25+ pontos"
    odds: number;             // 1.85
    match_date?: string;
    is_combined_odd?: boolean;
  }>;
  stake_amount: number;
  bet_date: string;
  odds_are_individual: boolean;
}
```

##### 3. Dashboard de Apostas

**Localização**: `src/pages/Bets.tsx`

**Features**:
- Visualização de todas as apostas do usuário
- Estatísticas (total apostado, ROI, taxa de acerto)
- Filtros avançados (data, esporte, status, tags)
- Gráfico de evolução da banca
- Edição e exclusão de apostas
- Sistema de tags para organização
- Suporte a cashout

**Componentes Relacionados**:
- `src/components/bets/BetsHeader.tsx`: Cabeçalho com estatísticas
- `src/components/bets/BetStatsCard.tsx`: Cards de estatísticas
- `src/components/bets/TagSelector.tsx`: Seletor de tags
- `src/components/bets/BankrollEvolutionChart.tsx`: Gráfico de evolução
- `src/hooks/use-bets.ts`: Hook para gerenciar apostas

##### 4. Estrutura de Dados

**Tabelas Principais**:

```sql
-- Tabela de apostas
bets (
  id, user_id, bet_type, sport, league,
  match_description, bet_description,
  odds, stake_amount, potential_return,
  status, bet_date, match_date,
  raw_input, processed_data
)

-- Pernas de apostas múltiplas
bet_legs (
  id, bet_id, leg_number, sport,
  match_description, bet_description,
  odds, status
)

-- Fila de mensagens (para processamento assíncrono)
message_queue (
  id, user_id, message_type,
  content, media_url, status,
  processing_attempts, error_message
)
```

**Relacionamentos**:
- `bets.user_id` → `users.id`
- `bet_legs.bet_id` → `bets.id`
- `message_queue.user_id` → `users.id`

#### Como Testar Localmente

1. **Inicializar e Iniciar Supabase local**
   ```bash
   # Primeira vez apenas
   supabase init
   
   # Iniciar Supabase
   supabase start
   ```

2. **Servir Edge Function localmente**
   ```bash
   supabase functions serve telegram-webhook
   ```

3. **Criar usuário de teste**
   - Acesse http://localhost:8080
   - Crie uma conta
   - Anote o `user_id` no Supabase Studio

4. **Configurar Telegram (opcional)**
   - Use um bot de teste
   - Configure webhook para: `http://127.0.0.1:54321/functions/v1/telegram-webhook`

5. **Testar com curl**
   ```bash
   curl -X POST http://127.0.0.1:54321/functions/v1/telegram-webhook \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -d @test-message.json
   ```

6. **Verificar no Dashboard**
   - Acesse http://localhost:8080/bets
   - A aposta deve aparecer na lista

### Plataforma de Análises NBA

#### O que é a Plataforma de Análises?

A **Plataforma de Análises** é um dashboard avançado para análise de player props da NBA. Ela integra dados do BigQuery (Google Cloud) para fornecer análises estatísticas detalhadas, previsões de performance, e insights sobre lesões que podem impactar as apostas.

#### Fluxo de Dados

```
┌──────────────┐
│  BigQuery    │
│  (GCP)       │
└──────┬───────┘
       │
       │ Dados agregados (player stats, props, injuries)
       │
       ▼
┌─────────────────────┐
│  Supabase RPC       │
│  Functions          │
│  (Foreign Data      │
│   Wrapper)          │
└──────┬──────────────┘
       │
       │ Queries via PostgREST
       │
       ▼
┌─────────────────────┐
│  Frontend Services  │
│  (nba-data.service, │
│   bigquery.service) │
└──────┬──────────────┘
       │
       │ Dados processados
       │
       ▼
┌─────────────────────┐
│  React Components   │
│  (Charts, Cards,    │
│   Tables)           │
└─────────────────────┘
```

#### Componentes Principais

##### 1. Serviços de Dados

**nba-data.service.ts** (`src/services/nba-data.service.ts`)
- Interface principal para dados NBA
- Funções RPC do Supabase
- Cache e otimizações

**Principais métodos**:
```typescript
getPlayerByName(name: string): Promise<Player>
getPlayerProps(playerId: number): Promise<PropPlayer[]>
getPlayerGameStats(playerId: number, limit: number): Promise<GamePlayerStats[]>
getTeamPlayers(teamId: number): Promise<TeamPlayer[]>
```

**bigquery.service.ts** (`src/services/bigquery.service.ts`)
- Integração direta com BigQuery
- Queries complexas e agregações
- Análises estatísticas

**Principais métodos**:
```typescript
getPlayerPropData(playerId: string): Promise<ApiResponse<DimPropPlayer[]>>
getPlayerLinePerformance(playerId: string): Promise<ApiResponse<DimPlayerStatLinePerf[]>>
getPlayerRecentGames(playerId: string): Promise<ApiResponse<FtPlayerStatOverLine[]>>
```

**prop-betting.service.ts** (`src/services/prop-betting.service.ts`)
- Análise de prop bets
- Recomendações (over/under)
- Cálculo de edge e confiança

##### 2. Páginas Principais

**NBADashboard** (`src/pages/NBADashboard.tsx`)
- Dashboard individual de jogador
- Estatísticas da temporada
- Gráficos de performance
- Análise de props
- Próximos jogos
- Zonas de arremesso

**Analysis** (`src/pages/Analysis.tsx`)
- Insights gerais
- Análise de lesões
- Tendências e padrões
- Performance do modelo

**Games** (`src/pages/Games.tsx`)
- Lista de jogos
- Filtros por data/equipe
- Estatísticas de jogos

##### 3. Componentes de Visualização

**Localização**: `src/components/nba/`

**Componentes principais**:
- `NBAHeader.tsx`: Cabeçalho com informações do jogador
- `PlayerHeader.tsx`: Header detalhado do jogador
- `GameChart.tsx`: Gráfico de performance por jogo
- `PropInsightsCard.tsx`: Insights sobre props
- `ComparisonTable.tsx`: Tabela comparativa
- `ShootingZonesCard.tsx`: Visualização de zonas de arremesso
- `TeammatesCard.tsx`: Informações sobre companheiros de equipe
- `NextGamesCard.tsx`: Próximos jogos

##### 4. Estrutura de Dados

**BigQuery Schemas**:

```sql
-- Dimensão de jogadores
dim_player (
  id, name, position, team_id, team_name,
  age, games_played, minutes,
  current_status, conference_rank,
  next_opponent_id, next_opponent_name
)

-- Dados de props
dim_prop_player (
  player_id, team_id, stat_type, stat_value,
  line, delta, stat_rank, team_avg_stat,
  zscore, rating_stars, is_leader_with_injury
)

-- Performance vs linha
dim_player_stat_line_perf (
  player_id, stat_type, over_lines, totals,
  perc_over_line, game_numbers
)

-- Estatísticas de jogos
ft_player_stat_over_line (
  player_id, game_date, game_id, stat_type,
  stat_value, line, stat_vs_line,
  played_against, is_b2b_game, home_away
)
```

**RPC Functions no Supabase**:

```sql
-- Buscar props de um jogador
get_player_props(p_player_id INTEGER)

-- Buscar estatísticas de jogos
get_player_game_stats(p_player_id INTEGER, p_limit INTEGER)

-- Buscar jogadores do time
get_team_players(p_team_id INTEGER)
```

#### Features Principais

##### 1. Análise de Player Props

- **Estatísticas em tempo real**: Média da temporada, últimas 5/10/15 jogos
- **Comparação com linha**: Delta, z-score, rating stars
- **Performance histórica**: Taxa de acerto vs linha
- **Recomendações**: Over/Under com nível de confiança

##### 2. Estatísticas de Jogadores

- **Temporada completa**: Médias, totais, rankings
- **Tendências recentes**: Últimos jogos, home/away splits
- **Contexto da equipe**: Ranking da conferência, rating ofensivo/defensivo
- **Próximo oponente**: Estatísticas vs próximo adversário

##### 3. Insights de Lesões

- **Status atual**: Lesões ativas, game-time decisions
- **Impacto em props**: Como lesões afetam as linhas
- **Backups disponíveis**: Jogadores que podem se beneficiar
- **Análise histórica**: Performance quando líder está fora

##### 4. Comparações e Tendências

- **Vs Média da Equipe**: Como o jogador se compara ao time
- **Vs Oponente**: Performance histórica vs próximo adversário
- **Home/Away**: Splits de performance
- **Back-to-Back**: Impacto de jogos consecutivos

#### Como Testar Localmente

1. **Configurar BigQuery (Opcional)**
   - Se não tiver acesso ao BigQuery, use dados mock
   - Crie RPC functions locais que retornam dados de teste

2. **Acessar Dashboard**
   ```bash
   # Inicie o frontend
   npm run dev
   
   # Acesse
   http://localhost:8080/nba-players
   ```

3. **Selecionar Jogador**
   - Use a busca para encontrar um jogador
   - Clique para ver o dashboard completo

4. **Verificar Componentes**
   - Estatísticas carregam corretamente
   - Gráficos renderizam
   - Filtros funcionam
   - Navegação entre páginas

---

## Troubleshooting

### Problemas Comuns

#### 1. Projeto Supabase não inicializado

**Sintoma**: `supabase start` falha com erro sobre projeto não encontrado

**Solução**:
```bash
# Inicializar o projeto primeiro
supabase init

# Depois iniciar
supabase start
```

#### 2. Docker não está rodando

**Sintoma**: `supabase start` falha com erro de conexão ao Docker

**Solução**:
```bash
# Iniciar Docker Desktop
open -a Docker  # macOS
# Aguarde 10-15 segundos até o Docker estar totalmente rodando

# Verificar se está rodando
docker ps

# Iniciar Supabase
supabase start
```

#### 3. Porta já em uso

**Sintoma**: `Bind for 0.0.0.0:54322 failed: port is already allocated`

**Solução**:
```bash
# Verificar processos na porta
lsof -ti:54322

# Matar processo (substitua PID pelo número retornado)
kill -9 PID

# Ou parar Supabase corretamente
supabase stop
```

#### 4. Migrations não aplicadas

**Sintoma**: Tabelas não existem no banco

**Solução**:
```bash
# Resetar banco e aplicar migrations
supabase db reset

# Ou aplicar manualmente
supabase migration up
```

#### 5. Variáveis de ambiente não carregam

**Sintoma**: `VITE_SUPABASE_URL is undefined` ou valores não aparecem

**Solução**:
1. Certifique-se de que o arquivo `.env` está na **raiz do projeto** (mesmo nível do `package.json`)
2. Verifique se copiou os valores corretos do `supabase start`:
   - `VITE_SUPABASE_URL` deve ser o **API URL** completo (ex: `http://127.0.0.1:54321`)
   - `VITE_SUPABASE_ANON_KEY` deve ser o **anon key** completo (JWT longo)
3. **Reinicie o servidor de desenvolvimento** após mudar `.env`:
   ```bash
   # Pare o servidor (Ctrl+C)
   # Inicie novamente
   npm run dev
   ```
4. Variáveis devem começar com `VITE_` para serem expostas no frontend
5. Verifique se não há espaços ou aspas extras nos valores do `.env`

#### 6. Edge Functions não funcionam localmente

**Sintoma**: 404 ou erro ao chamar functions

**Solução**:
```bash
# Servir functions localmente
supabase functions serve

# Verificar logs
supabase functions logs telegram-webhook
```

#### 7. Erro de autenticação no Supabase

**Sintoma**: `Invalid API key` ou `JWT expired`

**Solução**:
1. Verifique se copiou o `anon key` **completo** do output do `supabase start`:
   ```bash
   # Ver novamente as credenciais
   supabase status
   ```
2. Certifique-se de que o `.env` tem os valores corretos:
   - `VITE_SUPABASE_URL` deve ser exatamente o API URL (sem barra no final)
   - `VITE_SUPABASE_ANON_KEY` deve ser o anon key completo (é um JWT muito longo)
3. Reinicie o servidor de desenvolvimento após atualizar o `.env`
4. Limpe o cache do navegador e localStorage:
   ```javascript
   // No console do navegador
   localStorage.clear()
   ```
5. Se ainda não funcionar, verifique se o Supabase está rodando:
   ```bash
   supabase status
   ```

#### 8. BigQuery não conecta

**Sintoma**: Erro ao buscar dados NBA

**Solução**:
- Para desenvolvimento local, use dados mock
- Se precisar do BigQuery real, configure credenciais no Supabase Vault
- Verifique se o projeto GCP está ativo

### Comandos Úteis de Debug

```bash
# Ver status completo do Supabase
supabase status

# Ver logs em tempo real
supabase logs --follow

# Ver logs de uma function específica
supabase functions logs telegram-webhook --follow

# Conectar ao banco diretamente
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Ver containers Docker
docker ps

# Ver logs de um container
docker logs supabase_db_<project-id>

# Limpar tudo e começar do zero
supabase stop
docker system prune -f
# Se necessário, reinicializar (isso não apaga migrations, apenas recria estrutura)
supabase init
supabase start
```

### Logs e Debugging

#### Frontend

```bash
# Modo verbose do Vite
npm run dev -- --debug

# Verificar variáveis de ambiente carregadas
# Adicione no código:
console.log(import.meta.env)
```

#### Supabase

```bash
# Ver todos os logs
supabase logs

# Filtrar por serviço
supabase logs --service db
supabase logs --service api
supabase logs --service auth
```

#### Edge Functions

```bash
# Logs em tempo real
supabase functions logs telegram-webhook --follow

# Testar function localmente
curl -X POST http://127.0.0.1:54321/functions/v1/telegram-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"test": "data"}'
```

---

## Próximos Passos

### Como Contribuir

1. **Fork o repositório**
2. **Crie uma branch** para sua feature
   ```bash
   git checkout -b feature/minha-feature
   ```
3. **Desenvolva localmente** seguindo este guia
4. **Teste completamente** antes de fazer PR
5. **Faça commit e push**
   ```bash
   git commit -m "feat: adiciona nova feature"
   git push origin feature/minha-feature
   ```
6. **Abra um Pull Request**

### Links Úteis

- **Documentação do Supabase**: https://supabase.com/docs
- **Documentação do Vite**: https://vitejs.dev
- **Documentação do React**: https://react.dev
- **BigQuery Setup**: Ver `BIGQUERY_SETUP.md`
- **Betting Implementation**: Ver `BETTING_IMPLEMENTATION_SUMMARY.md`

### Documentação Adicional

- `SETUP.md` - Setup básico do projeto
- `BIGQUERY_SETUP.md` - Configuração do BigQuery
- `BETTING_IMPLEMENTATION_SUMMARY.md` - Resumo da implementação do Betinho
- `SUPABASE_TROUBLESHOOTING.md` - Troubleshooting específico do Supabase
- `WHATSAPP_WEBHOOK_SETUP.md` - Setup do webhook WhatsApp
- `ONBOARDING_SETUP.md` - Setup do fluxo de onboarding

### Recursos de Aprendizado

- **Supabase Local Development**: https://supabase.com/docs/guides/cli/local-development
- **Docker Documentation**: https://docs.docker.com
- **React Query**: https://tanstack.com/query/latest
- **TypeScript**: https://www.typescriptlang.org/docs

---

## Conclusão

Este guia fornece tudo que você precisa para configurar e trabalhar com o ambiente de desenvolvimento local do Smart Betting. Se encontrar problemas não cobertos aqui, consulte a documentação adicional ou abra uma issue no repositório.

**Boa sorte com o desenvolvimento! 🚀**
