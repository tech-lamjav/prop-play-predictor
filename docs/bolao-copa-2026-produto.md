# Bolao Copa do Mundo 2026 — Documentacao do Produto

## Visao Geral

O **Bolao Copa do Mundo 2026** e um produto de topo de funil (ToFu) integrado ao Smart Betting, projetado para viralidade e aquisicao de usuarios. Permite que qualquer pessoa crie um bolao entre amigos, familia ou colegas de trabalho para a Copa do Mundo 2026 (EUA, Mexico e Canada — 48 selecoes, 12 grupos, 104 jogos).

O racional e simples: bolao e o produto mais viral do futebol. Cada bolao criado gera convites para 10-100+ pessoas que entram na plataforma Smart Betting. O bolao serve como porta de entrada para o ecossistema de analytics.

---

## Como Funciona

### Fluxo do Usuario

1. **Criar bolao** — Usuario logado acessa `/bolao`, clica em "+ Criar", escolhe Free ou Premium
2. **Configurar** — Apos criar, abre automaticamente o modal de configuracoes (pontuacao, modalidades, tema)
3. **Convidar** — Compartilha o codigo de convite (ex: `ABC123`) ou link direto via WhatsApp/Telegram
4. **Palpitar** — Cada participante faz palpites nos 104 jogos (bloqueio automatico antes de cada partida)
5. **Acompanhar** — Ranking atualizado em tempo real apos cada jogo, com pontos calculados automaticamente

### Tipos de Palpites

| Tipo | Descricao | Pontuacao Padrao |
|------|-----------|-----------------|
| **Palpite de Jogo** | Placar de cada partida (ex: BRA 2x1 ARG) | 1pt resultado / 3pts placar exato |
| **Palpite de Campeao** | Qual selecao ganha a Copa | 10pts (configuravel) |
| **Finalistas** | 2 selecoes que vao a final | 10pts cada (configuravel) |
| **Semifinalistas** | 4 selecoes que chegam a semi | 5pts cada (configuravel) |
| **Quartas de Final** | 8 selecoes que chegam as quartas | 3pts cada (configuravel) |
| **Mata-mata (32)** | 32 selecoes que passam da fase de grupos | 1pt cada (configuravel) |

---

## Monetizacao

### Free (volume e viralidade)

- Ate **10 participantes**
- Pontuacao fixa: 1pt resultado / 3pts placar exato
- Palpite de campeao
- Ranking geral
- Compartilhamento via link/WhatsApp

### Premium por Bolao — R$ 19,90 (pagamento unico)

- **Participantes ilimitados**
- Pontuacao customizavel (presets + personalizado)
- Multiplicador por fase (mata-mata vale ate 5x mais)
- Palpites especiais (finalistas, semis, quartas, mata-mata 32)
- Pontos configuraveis por categoria
- Toggle on/off por modalidade (campeao, cada tipo de especial)
- Ranking por fase + estatisticas detalhadas
- Customizacao visual (cor tema + logo do bolao)
- Badge PREMIUM

### Opcao PIX

Como o Stripe nao suporta PIX nativamente, oferecemos pagamento via WhatsApp:
- Link direto para contato: `wa.me/5511952136845`
- Equipe envia PIX, confirma pagamento e executa upgrade manual via:
  ```sql
  SELECT upgrade_bolao_to_premium('CODIGO_CONVITE');
  ```

### Fluxo de Pagamento (Cartao)

1. Usuario seleciona Premium no modal de criacao
2. Frontend gera UUID pre-criado para o bolao
3. Chama Edge Function `stripe-create-checkout` com metadata (bolaoId, nome, descricao)
4. Stripe redireciona para checkout (mode: `payment`, one-time)
5. Apos pagamento, webhook `checkout.session.completed` cria o bolao no banco
6. Redirect de volta para `/bolao/{id}?success=true` → abre configuracoes automaticamente

---

## Arquitetura Tecnica

### Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + RLS + Edge Functions + Storage)
- **Pagamento:** Stripe (checkout session + webhook)
- **Deploy:** Vercel (frontend) + Supabase Cloud (backend)

### Estrutura de Arquivos

```
src/
  pages/
    BolaoHome.tsx         — Lista de boloes + criacao
    BolaoDetail.tsx       — Tela principal (ranking + sidebar com palpites)
    BolaoPalpites.tsx     — Tela de palpites (rota standalone)
    BolaoJoin.tsx         — Entrar via codigo de convite
  components/bolao/
    CreateBolaoModal.tsx  — Modal de criacao (Free vs Premium)
    BolaoAdminPanel.tsx   — Modal de configuracoes (pontuacao, modalidades, tema, membros)
    BolaoRankingTable.tsx — Tabela de ranking
    MatchPredictionCard.tsx — Card de palpite por jogo
    ChampionPickModal.tsx — Modal de escolha de campeao
    PredictionsModal.tsx  — Modal de palpites dos jogos
    SpecialPredictionsSection.tsx — Palpites especiais (finalistas, semis, etc)
    BolaoShareButton.tsx  — Botao compartilhar (WhatsApp/Telegram/copiar)
    BolaoStatsPanel.tsx   — Painel de estatisticas
    TeamFlag.tsx          — Bandeira da selecao
    CopaGruposModal.tsx   — Modal com tabela de grupos
    CopaBracketModal.tsx  — Modal com chave mata-mata
  services/
    bolao.service.ts      — Camada de dados (Supabase client)
  hooks/
    use-bolao.ts          — 20+ React Query hooks
```

### Banco de Dados (Supabase/PostgreSQL)

```
boloes                    — Boloes criados (config, premium, tema)
bolao_members             — Participantes (role: owner/member)
bolao_predictions         — Palpites por jogo (placar)
bolao_special_predictions — Palpites especiais (campeao, finalistas, etc)
bolao_subscriptions       — Registro de compras premium
wc_matches                — 104 jogos da Copa (seed oficial)
```

**Colunas de configuracao do bolao (`boloes`):**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| scoring_result | int | Pontos por acertar resultado (default 1) |
| scoring_exact | int | Pontos por placar exato (default 3) |
| scoring_preset | text | 'standard' / 'classic' / 'weighted_stages' / 'custom' |
| champion_enabled | bool | Habilitar palpite de campeao |
| champion_points | int | Pontos por acertar campeao (default 10) |
| special_predictions_enabled | bool | Algum palpite especial habilitado |
| special_predictions_config | jsonb | Toggle por tipo: `{finalist: true, semifinalist: false, ...}` |
| special_predictions_points | jsonb | Pontos por tipo: `{finalist: 10, semifinalist: 5, ...}` |
| custom_color | text | Cor tema (blue/green/gold/purple/red/cyan/orange) |
| custom_banner_url | text | URL do logo (Supabase Storage) |
| is_closed | bool | Inscricoes abertas/fechadas |
| max_participants | int | 10 (free) ou 9999 (premium) |

**RPC Functions principais:**
- `calculate_bolao_scores(p_match_id)` — Calcula pontos apos resultado
- `get_bolao_ranking(p_bolao_id)` — Ranking com RANK() window function
- `get_user_boloes()` — Lista boloes do usuario com stats (CTE otimizado)
- `join_bolao_by_code(p_invite_code)` — Entrar via codigo
- `toggle_special_prediction()` — Adicionar/remover palpite especial
- `update_bolao_scoring()` — Atualizar preset de pontuacao
- `upgrade_bolao_to_premium(p_invite_code)` — Upgrade manual (PIX)

### Edge Functions (Supabase)

| Funcao | Descricao |
|--------|-----------|
| `stripe-create-checkout` | Cria sessao Stripe (mode: payment para bolao, subscription para outros) |
| `stripe-webhook` | Recebe `checkout.session.completed` e cria o bolao premium no banco |

### Layout da Pagina Principal (BolaoDetail)

Desktop usa layout de 2 colunas:

```
+------------------------------------------+----------------------------+
| Header: Nome [PREMIUM] [Compartilhar] [Config] |
| Info: participantes · codigo · pontuacao                               |
+------------------------------------------+----------------------------+
| [Ranking] [Palpites] [Estatisticas]      | Palpites dos Jogos         |
|                                          | 0 feitos · 72 disponiveis  |
| Ranking table...                         |----------------------------|
|                                          | Palpite de Campeao         |
|                                          | Quem ganha a Copa 2026?    |
|                                          |----------------------------|
|                                          | Palpites Especiais         |
|                                          | Finalistas, Semis...       |
+------------------------------------------+----------------------------+
```

Mobile empilha: conteudo principal → sidebar abaixo.

---

## Configuracoes do Bolao (Modal)

O modal de configuracoes e aberto automaticamente apos criacao e acessivel via botao no header. Secoes:

1. **Inscricoes** — Abrir/encerrar entradas
2. **Modalidades** — Toggle on/off para campeao (com pontos) e cada tipo de palpite especial (com pontos individuais)
3. **Pontuacao** — Presets rapidos (Padrao, Classico, Fases valem +) + inputs editaveis + toggle multiplicador por fase
4. **Cor do bolao** — 8 opcoes de tema (premium)
5. **Logo do bolao** — Upload JPG/PNG ate 2MB (premium)
6. **Participantes** — Lista com opcao de remover

---

## Multiplicador por Fase (weighted_stages)

Quando habilitado, os pontos dos palpites sao multiplicados conforme a fase:

| Fase | Multiplicador |
|------|--------------|
| Fase de Grupos | 1.0x |
| Round of 32/16 | 1.5x |
| Quartas de Final | 2.0x |
| Semifinal | 3.0x |
| 3o Lugar | 2.0x |
| Final | 5.0x |

Exemplo: se o usuario acerta o placar exato da final (3pts base), ganha 3 × 5 = **15 pontos**.

---

## Status de Deploy

### Staging (kpbjuplcwiyrymafhehz) — COMPLETO
- Todas as migrations aplicadas
- Edge Functions deployadas (v19 checkout, v16 webhook)
- Stripe test mode configurado (Price ID: `price_1TMelW01CLJUO7HdF16XSddA`)
- Webhook signing secret configurado
- Fluxo de pagamento testado e validado

### Producao (lavclmlvvfzkblrstojd) — PENDENTE

Checklist:
- [ ] Rodar migrations do bolao (tabelas + RLS + RPCs + seed 104 jogos)
- [ ] Deploy Edge Functions com suporte a bolao
- [ ] Verificar webhook endpoint Stripe live
- [ ] Configurar `STRIPE_WEBHOOK_SIGNING_SECRET` live nos secrets
- [ ] Adicionar `VITE_STRIPE_PRICE_ID_BOLAO=price_1TMdRI01CLJUO7HdmB5hMMBv` no Vercel
- [ ] Confirmar `SITE_URL=https://smartbetting.app` nos secrets
- [ ] Deploy frontend com rotas `/bolao/*`
- [ ] Testar pagamento real

---

## Metricas de Sucesso

| Metrica | Objetivo |
|---------|----------|
| Boloes criados | Volume de adocao |
| Taxa de convite | Quantos convites por bolao (viralidade) |
| Conversao Free → Premium | % de boloes que fazem upgrade |
| Participantes por bolao | Engajamento medio |
| Palpites por usuario | Retencao e engajamento |
| Receita por bolao premium | R$ 19,90 × conversao |

---

## Proximos Passos (pos-lancamento)

1. **Deploy em producao** — Seguir checklist acima
2. **Notificacoes** — Push/email quando resultado sai e pontuacao muda
3. **Ranking publico** — Link compartilhavel do ranking sem auth
4. **API de resultados** — Automatizar atualizacao de placares (hoje e manual via Dashboard)
5. **Premium por usuario** — R$ 9,90/mes para criar boloes premium ilimitados
