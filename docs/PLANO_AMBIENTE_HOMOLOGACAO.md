# Plano: Ambiente de Homologação (Local → Staging → Produção)

## Contexto

Atualmente o projeto tem apenas dois ambientes: local (Supabase Docker + Vite dev server) e produção (Vercel + Supabase Pro). Código vai direto de PR para `main` e deploy em produção sem ambiente intermediário para QA. O objetivo é adicionar um ambiente de homologação (staging) com isolamento completo.

### Decisões tomadas
- **Supabase**: projetos separados (Free para staging, Pro para produção, Docker para local)
- **Vercel**: branch `develop` com domínio fixo para staging
- **Fluxo de promoção**: PR `develop` → `main`
- **CI/CD**: Nível 1 — GitHub Actions para validação de PR (lint + build)
- **Custo adicional**: ~$0/mês (Supabase Free + GitHub Actions gratuito)

### Fluxo proposto

```
feature/task-XXX → PR para develop → merge → Vercel staging
                                                    ↓ (QA aprova)
                                          PR develop → main → Vercel produção
```

---

## Etapa 1: Criar arquivos de variáveis de ambiente por modo Vite

O Vite suporta nativamente arquivos `.env.[mode]`. Vamos criar arquivos para cada ambiente.

### Arquivos a criar

**`.env.example`** — template para onboarding de devs (commitado no repo):
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_CLOUD_PROJECT_ID=
VITE_GOOGLE_CLOUD_STORAGE_BUCKET=
VITE_GOOGLE_CLOUD_API_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_PRICE_ID_BETINHO=
VITE_STRIPE_PRICE_ID_PLATFORM=
VITE_PUBLIC_POSTHOG_KEY=
VITE_PUBLIC_POSTHOG_HOST=
VITE_TELEGRAM_BOT_USERNAME=
VITE_ENABLE_REAL_TIME_UPDATES=
VITE_ENABLE_DATA_EXPORT=
VITE_ENABLE_ANALYTICS=
```

**`.env.development`** — valores para dev local (commitado, sem secrets):
```env
VITE_APP_NAME=Smartbetting [DEV]
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_ENABLE_ANALYTICS=false
```

**`.env.staging`** — valores para staging (commitado, sem secrets — secrets ficam no Vercel):
```env
VITE_APP_NAME=Smartbetting [STAGING]
VITE_ENABLE_ANALYTICS=false
```

**`.env.production`** — valores para produção (commitado, sem secrets):
```env
VITE_APP_NAME=Smartbetting
VITE_ENABLE_ANALYTICS=true
```

> **Importante:** Secrets (SUPABASE_ANON_KEY, STRIPE keys, etc.) ficam nas variáveis de ambiente do Vercel e no `.env.local` (não commitado).

### Arquivos a modificar

**`.gitignore`** — adicionar:
```
.env.local
.env.*.local
```

**`package.json`** — adicionar script:
```json
"build:staging": "vite build --mode staging"
```

**`src/config/environment.ts`** — adicionar helper:
```typescript
export const isStaging = config.app.environment === 'staging';
```

---

## Etapa 2: Criar projeto Supabase de staging

### Passos manuais (fora do código)
1. Criar novo projeto no [Supabase Dashboard](https://supabase.com/dashboard) com plano **Free**
2. Anotar a URL e anon key do novo projeto
3. Aplicar migrations existentes no projeto staging:
   ```bash
   npx supabase link --project-ref <staging-project-ref>
   npx supabase db push
   ```
4. Configurar Edge Functions secrets no projeto staging (Stripe test keys, OpenAI, etc.)
5. Configurar secrets do Telegram — ver [Etapa 2.1](#etapa-21-configurar-telegram-webhook-para-staging)

### Custos Supabase

| Plano | Custo | Limites | Uso |
|-------|-------|---------|-----|
| Free (staging) | $0/mês | 500MB DB, 50K MAU, pausa após 7 dias de inatividade | Homologação |
| Pro (produção) | $25/mês (já pago) | 8GB DB, 100K MAU, sem pausa | Produção |
| Docker (local) | $0 | Sem limites | Desenvolvimento |

> **Nota:** O projeto Free pausa após 7 dias sem atividade. Para staging isso geralmente não é problema. Se necessário, um GitHub Actions com cron pode fazer ping automático para evitar a pausa.

---

## Etapa 2.1: Configurar Telegram webhook para staging

### Problema

O Telegram permite apenas **1 webhook URL por bot token**. Isso significa que o bot `@betinho_assistente_bot` de produção não pode receber mensagens em dois endpoints ao mesmo tempo. Para ter staging e produção rodando simultaneamente, precisamos de **bots separados**.

### Decisão: bot separado por ambiente

| Ambiente | Bot | Webhook aponta para |
|----------|-----|---------------------|
| Produção | `@betinho_assistente_bot` | Edge Function do Supabase Pro |
| Staging | `@betinho_assistente_dev_bot` | Edge Function do Supabase Free (staging) |
| Local | Sem bot (testar via staging) | — |

> **Nota sobre dev local:** Por enquanto, não configuramos bot para dev local. Se no futuro for necessário testar webhook localmente, as opções são: (a) criar um terceiro bot + ngrok/tunnel para expor o Supabase local, ou (b) usar long polling com script Node separado. Staging cobre o QA na maioria dos casos.

### Alternativas descartadas

**Mesmo bot trocando webhook na promoção:** Staging e produção nunca rodariam ao mesmo tempo. Risco alto de esquecer de voltar o webhook e deixar usuários reais sem serviço. Inviável.

### Passos manuais

1. **Bot já criado:** `@betinho_assistente_dev_bot` (via BotFather)

2. **Configurar secrets no Supabase staging** (após criar o projeto Free):
   ```
   TELEGRAM_BOT_TOKEN=<token do bot de staging>
   TELEGRAM_WEBHOOK_SECRET=<gerar um secret aleatório para staging>
   ```

3. **Registrar webhook com o Telegram** (após deploy das Edge Functions no staging):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN_STAGING>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://<supabase-staging-ref>.supabase.co/functions/v1/telegram-webhook",
       "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
     }'
   ```

4. **Verificar que o webhook está ativo:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN_STAGING>/getWebhookInfo"
   ```

5. **Atualizar link do bot no frontend para staging:**
   - O onboarding (`src/pages/Onboarding.tsx`) e o botão de sync (`src/components/WhatsAppSyncButton.tsx`) têm o link `https://t.me/betinho_assistente_bot` hardcoded
   - Criar variável `VITE_TELEGRAM_BOT_USERNAME` para que staging aponte para `betinho_assistente_dev_bot` e produção para `betinho_assistente_bot`

### Arquivos a modificar (código)

**`.env.staging`** — adicionar:
```env
VITE_TELEGRAM_BOT_USERNAME=betinho_assistente_dev_bot
```

**`.env.production`** — adicionar:
```env
VITE_TELEGRAM_BOT_USERNAME=betinho_assistente_bot
```

**`.env.development`** — adicionar:
```env
VITE_TELEGRAM_BOT_USERNAME=betinho_assistente_dev_bot
```

**`src/pages/Onboarding.tsx`** e **`src/components/WhatsAppSyncButton.tsx`** — substituir link hardcoded:
```typescript
// Antes:
const botUrl = "https://t.me/betinho_assistente_bot";

// Depois:
const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "betinho_assistente_bot";
const botUrl = `https://t.me/${botUsername}`;
```

### Dados de teste em staging

- Usuários de QA precisarão se vincular ao bot de staging separadamente (enviar `/start` + contato no `@betinho_assistente_dev_bot`)
- Os dados de vinculação (`telegram_user_id`, `telegram_chat_id`) serão diferentes dos de produção — isso é esperado pois são bots distintos
- Bets de teste ficarão no Supabase staging, completamente isoladas de produção

### Checklist de verificação

- [ ] Secret `TELEGRAM_BOT_TOKEN` configurado no Supabase staging
- [ ] Secret `TELEGRAM_WEBHOOK_SECRET` configurado no Supabase staging
- [ ] Webhook registrado via `setWebhook` apontando para Edge Function de staging
- [ ] `getWebhookInfo` retorna URL correta e sem erros
- [ ] Variável `VITE_TELEGRAM_BOT_USERNAME` nos arquivos `.env.*`
- [ ] Links do frontend apontam para o bot correto por ambiente
- [ ] Testar fluxo completo: `/start` → enviar contato → enviar aposta → confirmação

---

## Etapa 3: Configurar Vercel para staging

### Passos manuais no Vercel Dashboard
1. **Settings → Git → Production Branch**: confirmar que é `main`
2. **Settings → Domains**: adicionar subdomínio (ex: `staging.smartbetting.com` ou `staging-smartbetting.vercel.app`) e associar ao branch `develop`
3. **Settings → Environment Variables**:
   - Escopo **Preview** (inclui `develop`): variáveis do Supabase staging (URL, anon key, Stripe test keys)
   - Escopo **Production**: manter variáveis atuais do Supabase Pro

### Build commands
- **Production**: `npm run build` (usa mode `production`) — padrão, sem mudança
- **Preview (develop)**: Override no dashboard para `npm run build:staging` (usa mode `staging`)

---

## Etapa 4: Criar branch `develop`

```bash
git checkout main
git checkout -b develop
git push -u origin develop
```

---

## Etapa 5: GitHub Actions — CI de validação de PR

### Arquivo a criar: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

### Passo manual recomendado
No GitHub → **Settings → Branches → Branch protection rules**:
- Para `develop` e `main`: exigir que o check `validate` passe antes de permitir merge

---

## Etapa 6: Indicador visual de ambiente (opcional mas recomendado)

Criar componente `src/components/EnvironmentBanner.tsx` que mostra uma barra colorida no topo com o nome do ambiente. Só aparece em dev/staging, nunca em produção.

Adicionar o componente no `src/App.tsx`.

---

## Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `.env.example` |
| Criar | `.env.development` |
| Criar | `.env.staging` |
| Criar | `.env.production` |
| Criar | `.github/workflows/ci.yml` |
| Criar | `src/components/EnvironmentBanner.tsx` |
| Modificar | `.gitignore` (adicionar `.env.local`, `.env.*.local`) |
| Modificar | `src/pages/Onboarding.tsx` (usar `VITE_TELEGRAM_BOT_USERNAME` no link do bot) |
| Modificar | `src/components/WhatsAppSyncButton.tsx` (usar `VITE_TELEGRAM_BOT_USERNAME` no link do bot) |
| Modificar | `package.json` (adicionar `build:staging`) |
| Modificar | `src/config/environment.ts` (adicionar `isStaging`) |
| Modificar | `src/App.tsx` (adicionar `EnvironmentBanner`) |

---

## Custos totais

| Item | Custo mensal |
|------|-------------|
| Supabase staging (Free) | $0 |
| Supabase produção (Pro, já pago) | $25 |
| Supabase local (Docker) | $0 |
| Vercel (plano atual, sem mudança) | $0 ou $20 |
| GitHub Actions (2.000 min/mês grátis) | $0 |
| **Total adicional** | **$0** |

---

## Verificação

1. **Local**: `npm run dev` → app roda com `[DEV]` no título, conectado ao Supabase Docker local
2. **Staging**: push em `develop` → Vercel builda com `build:staging` → app acessível em URL de staging com `[STAGING]` no título, conectado ao Supabase staging (Free)
3. **Produção**: merge `develop` → `main` → Vercel builda com `build` → app em domínio principal, conectado ao Supabase Pro
4. **CI**: abrir PR para `develop` ou `main` → GitHub Actions roda lint + build → check ✅/❌ aparece no PR
5. **Telegram staging**: enviar `/start` no `@betinho_assistente_dev_bot` → compartilhar contato → enviar aposta → bot confirma com detalhes → aposta aparece no dashboard de staging
