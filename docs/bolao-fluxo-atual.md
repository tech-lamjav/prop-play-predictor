# Bolão Copa 2026 — Fluxo do usuário

> Mapeamento conceitual do bolão organizado por **fase temporal × papel**. Sem análise — só "o que existe" e "o que se propõe".
>
> **Estrutura:**
> 1. Fluxo atual (estado consolidado em `feature/bolao-onda5-diferencial`, PR #139)
> 2. Fluxo proposto (com ajustes acordados)
> 3. O que muda de um para o outro

---

# 1. Fluxo atual

## Fase 1 — Descoberta & criação

**Criador**
- Vê propaganda / lembra da Copa / é convidado por colega
- Acessa `/bolao` deslogado → cai na landing pública
- Cria conta em `/auth` (ou faz login)
- No dashboard, abre modal "Criar bolão"
- Escolhe nome, descrição, plano (Free ou Premium R$19,90)
- Se Premium: passa por Stripe Checkout one-time
- Cai no bolão recém-criado com painel de configuração já aberto
- Define pontuação, modalidades habilitadas, tema, logo

**Jogador** — ainda não existe

---

## Fase 2 — Distribuição

**Criador**
- Pega o código (ex: `ABCD12`) ou link
- Compartilha no grupo do WhatsApp/Telegram (botão dedicado gera preview com OG image)

**Jogador**
- Recebe o link no grupo
- Clica → abre `/bolao/entrar/CODIGO`

---

## Fase 3 — Inscrição

**Criador**
- Vê a lista de membros crescer (no Admin Panel)
- Pode remover qualquer participante
- Pode encerrar inscrições quando quiser
- Limite: 10 participantes (Free) ou ilimitado (Premium)

**Jogador**
- Entra com 1 clique (precisa estar logado; senão precisa criar conta)
- Cai em `/bolao/:id` (BolaoDetail) — ranking vazio, sidebar mostra palpites disponíveis

---

## Fase 4 — Palpites pré-Copa

**Criador (também é jogador no próprio bolão)**
- Pode ainda ajustar configurações até a 1ª partida
- Palpita igual aos outros

**Jogador**
- Faz palpite de placar dos 104 jogos: manual jogo a jogo, ou via Quick Pick (3 personas — Realista/Patriota/Zebreiro — preenchem tudo de uma vez)
- Se o bolão for Premium: escolhe campeão e faz palpites especiais (finalistas, semis, quartas, mata-mata 32)
- Cada palpite trava automaticamente quando o jogo começa

---

## Fase 5 — Copa rolando

**Criador**
- Após cada jogo, registra o placar manualmente no Dashboard
- Trigger calcula pontos e atualiza ranking
- Continua podendo remover membros

**Jogador**
- A cada jogo: ganha/perde pontos, vê posição mudar, recebe insights pós-jogo (cravou solo, contra a maré, streak)
- Compartilha conquistas (achievements 1080×1080) ou ranking (feed / Stories 1080×1920)
- Vê tab "Você" com personalidade do palpiteiro + evolução em gráfico
- Loop de ~3 jogos/dia × ~30 dias

---

## Fase 6 — Fim do bolão

**Criador**
- O bolão fica em `/bolao/:id` com ranking final congelado
- Não há fluxo formal de "encerrar"

**Jogador**
- Vê ranking final, eventualmente compartilha
- Pode sair do bolão (ação adicionada na Onda 3)
- Continua tendo acesso à página do bolão indefinidamente

---

# 2. Fluxo proposto

## Fase 1 — Descoberta & criação

**Criador**
- Vê propaganda / lembra da Copa / é convidado por colega
- Acessa `/bolao` deslogado → cai na landing pública
- Cria conta em `/auth` (ou faz login)
- No dashboard, abre modal "Criar bolão"
- Escolhe nome e descrição (não há escolha de plano — bolão é único e gratuito)
- Cai no bolão recém-criado com painel de configuração já aberto
- Define pontuação, modalidades habilitadas, tema, logo (todas as opções disponíveis pra todo bolão)

**Jogador** — ainda não existe

---

## Fase 2 — Distribuição

**Criador**
- Pega o código (ex: `ABCD12`) ou link
- Compartilha no grupo do WhatsApp/Telegram (botão dedicado gera preview com OG image)

**Jogador**
- Recebe o link no grupo
- Clica → abre `/bolao/entrar/CODIGO`

---

## Fase 3 — Inscrição

**Criador**
- Vê a lista de membros crescer (no Admin Panel)
- Pode remover qualquer participante
- Pode encerrar inscrições quando quiser
- Limite técnico: 50 participantes por bolão

**Jogador**
- Entra com 1 clique (precisa estar logado; senão precisa criar conta)
- Cai em `/bolao/:id` (BolaoDetail) — ranking vazio, sidebar mostra palpites disponíveis

---

## Fase 4 — Palpites pré-Copa

**Criador (também é jogador no próprio bolão)**
- Pode ainda ajustar configurações até a 1ª partida
- Palpita igual aos outros

**Jogador**
- Faz palpite de placar dos 104 jogos:
  - Manual jogo a jogo
  - Quick Pick por persona (Realista/Patriota/Zebreiro)
  - **Quick Pick por placar fixo** — define um placar (ex: 1x1) e aplica em todos os jogos pendentes
- Escolhe campeão e faz palpites especiais (finalistas, semis, quartas, mata-mata 32) — disponível em todo bolão
- **CTA pré-jogo "Vai apostar nesse jogo? Registra no Betinho"** próximo de cada palpite, leva pra LP do Betinho
- Cada palpite trava automaticamente quando o jogo começa

---

## Fase 5 — Copa rolando

**Criador**
- Após cada jogo, registra o placar manualmente no Dashboard
- Trigger calcula pontos e atualiza ranking
- Continua podendo remover membros

**Jogador**
- A cada jogo: ganha/perde pontos, vê posição mudar, recebe insights pós-jogo (cravou solo, contra a maré, streak)
- **CTA pós-jogo "Apostou nesse jogo? Registra o resultado no Betinho"** aparece junto do resultado, leva pra LP do Betinho
- Compartilha conquistas (achievements 1080×1080) ou ranking (feed / Stories 1080×1920) — sem mudança no formato existente
- Vê tab "Você" com personalidade do palpiteiro + evolução em gráfico
- Loop de ~3 jogos/dia × ~30 dias

---

## Fase 6 — Fim do bolão

**Criador**
- O bolão fica em `/bolao/:id` com ranking final congelado
- Não há fluxo formal de "encerrar"

**Jogador**
- Vê ranking final, eventualmente compartilha
- Pode sair do bolão (ação adicionada na Onda 3)
- Continua tendo acesso à página do bolão indefinidamente

---

# 3. O que muda

**Fase 1 — Criação**
- Removido: escolha entre Free e Premium R$19,90
- Removido: fluxo de Stripe Checkout
- Tudo que era Premium (pontuação custom, multiplicador por fase, palpites especiais, cor tema, logo) vira default pra todo bolão

**Fase 3 — Inscrição**
- Limite passa de "10 (Free) ou ilimitado (Premium)" para teto único de **50 participantes**

**Fase 4 — Palpites pré-Copa**
- Quick Pick ganha 4º modo: **Placar fixo** (escolhe um placar tipo 1x1 e aplica em todos os jogos pendentes)
- Palpites especiais (campeão, finalistas, semis, quartas, mata-mata 32) liberados em todo bolão
- Adicionado: **CTA "Vai apostar nesse jogo? Registra no Betinho"** próximo do palpite, antes do jogo

**Fase 5 — Copa rolando**
- Adicionado: **CTA "Apostou nesse jogo? Registra o resultado no Betinho"** junto do resultado pós-jogo

**Fases 2 e 6** — sem mudanças
