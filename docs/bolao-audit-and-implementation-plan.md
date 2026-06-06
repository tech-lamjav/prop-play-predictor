# Bolão Copa 2026 — Auditoria UX/CRO e Plano de Implementação

**Data:** 2026-04-23
**Autor:** Claude (auditoria via skill `ui-ux-pro-max` + exploração ponta-a-ponta do código)
**Escopo:** fluxo completo — chegada → criar bolão → pagar → compartilhar → palpitar → ranking

---

## 1. Sumário executivo — top 5 problemas críticos

1. **Touch targets violam WCAG em todo o sistema.** `h-8` (32px) é o padrão herdado do dashboard NBA; o mínimo acessível é 44px. ~30 dos ~40 botões auditados estão abaixo do limite. Inclui botões que o próprio Claude criou recentemente (`NumberStepper ±` com 24–28px).

2. **Sem tela de boas-vindas pós-pagamento.** Usuário paga R$19,90 e cai direto no `BolaoAdminPanel` auto-aberto, com toast de 5s e nada mais. Queima o momento emocional mais importante da conversão — não tem celebração visual, lista do que desbloqueou, nem CTA próximo passo.

3. **Share tratado como acessório.** `BolaoShareButton` em `variant="compact"` no header — ícone 32×32 `opacity-60`. Crítico pois sem amigos, o bolão não existe. Deveria ser CTA primário enquanto `ranking.length <= 1`.

4. **Duas portas para a mesma sala.** `BolaoPalpites` page e `PredictionsModal` fazem a mesma coisa com lógica duplicada. Sidebar abre modal, deep-link abre página — sem critério claro de qual usar.

5. **Deadline invisível até abrir o card.** Ninguém avisa "palpites fecham em 2h" na home, na lista de bolões ou no header do bolão. Só aparece dentro do `MatchPredictionCard` individual.

---

## 2. Análise por etapa

### Etapa 1 — Chegada (`BolaoHome.tsx`) — nota 5/10

**Bom:**
- Countdown da Copa cria urgência natural.
- Hero com dados concretos (104 jogos, 12 grupos), sem blabla.

**Ruim:**
- Botão "Criar" esconde texto em mobile (`hidden sm:inline`) — vira ícone Plus 14×14 dentro de botão 38px. Discoverability zero pro novo usuário.
- Input "Código de convite" sem aria-label, sem helper text sobre formato. Validação "≥4 chars" sem feedback.
- Empty state "Nenhum bolão ainda" **sem CTA próximo** — o botão Criar está no header, longe do empty.
- Free vs Premium só visíveis **depois** de clicar Criar. Poderia ter strip comparativo no empty.

### Etapa 2 — CreateBolaoModal — nota 7/10

**Bom (após mudanças recentes):** form enxuto, plans lado-a-lado com Recommended badge.

**Ruim:**
- Descrição aparece visualmente obrigatória — Label sem indicação "opcional" em PT-BR (só no schema Zod).
- Checks dos radios de plan pequenos (2.5×2.5) — affordance fraca; user seleciona pelo card inteiro mas o sinal visual é sutil.
- Premium payment flow: toast "Redirecionando..." aparece **antes** do redirect, sem blocking overlay — user pode clicar de novo e duplicar checkout.

### Etapa 3 — Pagamento → Retorno — nota 3/10 (PIOR PONTO)

**Fluxo atual:**
1. User paga na Stripe → redirect `/bolao/{id}?success=true`
2. Toast "Bolão Premium ativado!" (5s, some)
3. `BolaoAdminPanel` auto-abre

**Falta:**
- Celebração visual (confetti, hero "Bem-vindo ao Premium", checkmarks animados)
- Lista do que desbloqueou ("✓ Participantes ilimitados ✓ Pontuação custom ✓ Logo...")
- CTA próximo passo ("Convide seus amigos →")
- Loading state enquanto webhook não confirma (se webhook atrasar, `is_premium=false` sem explicação)
- Email de confirmação mencionado na UI

### Etapa 4 — Compartilhar / Join — nota 4/10

**Crítico:**
- `BolaoShareButton` no header em compact = icon 32×32 `opacity-60`. Invisível.
- `BolaoJoin.tsx` existe e é boa (loading/success/error bem tratados) mas só alcançável via URL direta.
- Dropdown do share não tem trap-focus nem ESC para dismiss.
- Copy feedback é só ícone mudando (Copy → Check) — pouco discoverable.
- Onboarding card existe em `BolaoDetail` (linhas 505–535) mas **desaparece após 1 palpite**. Quem não fez palpite ainda e já recarregou perde a pista.

### Etapa 5 — Fazer palpites — nota 5/10

**OK:**
- Lock state distinto visualmente (opacity, Lock icon).
- Points display pós-finalização com cor condicional.
- Deadline label amarelo quando modo ≠ `per_match`.

**Problemas:**
- Inputs de score `h-8 w-10` (32×40 px). **Mobile terrível** — dedo grande não acerta.
- Zero empty state quando user abre e não tem o que palpitar.
- Filter bar com scroll horizontal A–H **sem indicador de overflow**. Mobile não descobre metade dos grupos.
- Sem push "Você tem X palpites faltando" — só `X/Y` passivo no header.
- Save silencioso — sem toast. "Salvo" aparece 2s no botão.
- Sem auto-save de rascunho (localStorage).

### Etapa 6 — Admin Panel — nota 6/10

**Bom (após mudanças recentes):**
- Presets de pontuação como cards com preview.
- Radios de deadline com Check ✓.
- Warning amarelo quando tem palpites e muda deadline.
- Upgrade CTA banner principal.

**Problemas (incluindo auto-críticas):**
- `NumberStepper` com botões 24–28px — **abaixo do mínimo de 44 px**.
- Banner de upgrade com 5 benefícios em lista plana — CRO recomenda 3–5 com hierarquia (não peso igual).
- CTA "Desbloquear →" aparece 3× inline (Pontuação, Cor, Logo) + 1 banner = 4 CTAs. Upsell saturation.
- Nested scroll: modal → seção → Participantes → Special predictions collapse. 4 níveis.
- Preview cards de pontuação em mobile (`grid-cols-3`) < 90px cada — apertado.

### Etapa 7 — BolaoDetail — nota 6/10

**Bom:**
- Onboarding card quando `ranking ≤ 1 && myPredictions === 0`.
- Sidebar right com 3 cards (palpites/campeão/especiais).

**Ruim:**
- Sidebar sticky só desktop (`lg:sticky`). Mobile vê cards **abaixo das tabs** — discoverability ruim.
- Tabs (Ranking/Meus Palpites/Estatísticas) sem `aria-selected`. Active via className apenas.
- "Meus Palpites" tab empty = Trophy + texto, **sem CTA**.
- Card "Palpite de Campeão" subtitle "Quem vai ganhar a Copa 2026?" **sem deadline**.
- Info bar com ícone Hash + invite_code é display only — perde oportunidade de copy-on-click que dispararia share.

### Etapa 8 — Champion/Special Modals — nota 5/10

**Problemas:**
- ChampionPickModal com grid `grid-cols-3` com placeholder vazio 8×5 no lugar da bandeira.
- Team buttons sem aria-label além do code+nome — delete de picks é "clicar chip com ×" sem button semântico.
- Search inputs em `text-[11px]` com placeholder `opacity-30`. Legibilidade marginal.
- PickPanel expandido dentro do modal = 3 scrolls simultâneos.
- Max-reached toast sem `aria-live` — screen reader perde.

---

## 3. Problemas sistêmicos (atravessam tudo)

**A. Touch targets quebrados por padrão**
`h-8` = 32px é o padrão herdado do dashboard NBA. Fix: bumpar pra `h-11` (44px) em tudo que é interação primária.

**B. Type scale caótico**
Tamanhos usados: `[8px]`, `[9px]`, `[10px]`, `[11px]`, `xs`, `sm`, `base`, `lg`, `xl`... zero tokens semânticos (display/headline/body/label).

**C. Cores hex vs tokens misturadas**
`text-terminal-yellow/90` convive com `text-yellow-300` e `text-yellow-400`. São iguais ou diferentes? Impossível saber sem compilar.

**D. Aria-labels ausentes em botões-ícone**
Settings, ShareButton compact, close buttons, steppers ±, toggles Left/Right — nenhum tem aria-label.

**E. Mobile descoberta ruim**
Features escondidas em scroll horizontal (grupos), scroll vertical abaixo do fold (sidebar mobile), dropdowns (share), modais-dentro-de-modais (special predictions).

**F. Sem confirmações destrutivas corretas**
Remover membro: 2-click confirm sem undo toast. Sair do bolão? Não tem UI. Zerar palpite? Não existe.

**G. Sem loading skeleton em lugares pesados**
Ranking, Stats, Champion predictions, Special picks — todos vazios antes da query resolver.

---

## 4. Sumário quantitativo de fricção

| Elemento | Tamanho | Mín. WCAG | Status |
|---|---|---|---|
| Botão "Criar" (home) | 38px | 44px | **Abaixo** |
| Botão "Entrar" (home) | 38px | 44px | **Abaixo** |
| Botão voltar BolaoPalpites | 32px | 44px | **Abaixo** |
| Botão Settings (BolaoDetail) | 32px | 44px | **Abaixo** |
| NumberStepper ± | 24–28px | 44px | **Abaixo** |
| ShareButton compact | 32px | 44px | **Abaixo** |
| ChampionPickModal confirm | h-auto | 44px | **Provável abaixo** |
| MatchPredictionCard inputs | 32×40px | 44×44px | **Abaixo** |
| Input "Código de convite" | aria-label | obrigatório | **Ausente** |

---

## 5. Plano de implementação completo

> Todas as ondas agora cobrem os 40+ itens da auditoria. Ordem por impacto × esforço.

### **Onda 1 — P0: Sangrando (1 semana)**

Problemas que travam acessibilidade básica ou queimam conversão em momento crítico.

**Design system & acessibilidade (base):**
- [ ] 1.1 — Bump touch targets do sistema: `h-8` → `h-11` (44px) em todos os botões primários
- [ ] 1.2 — `NumberStepper`: botões `±` pra 44×44 com hit-area expandida
- [ ] 1.3 — `aria-label` em todos os botões-ícone (Settings, ShareButton compact, close, toggle Left/Right, stepper ±, dropdown triggers)
- [ ] 1.4 — `aria-selected` nos tabs de BolaoDetail
- [ ] 1.5 — Labels nos inputs de score do MatchPredictionCard + "Código de convite"

**Conversão crítica:**
- [ ] 1.6 — **Tela "Bem-vindo ao Premium" pós-pagamento** (substitui `admin auto-open`):
  - Hero com checkmark animado + "Você desbloqueou o Premium!"
  - Lista das 5 features desbloqueadas com ícones
  - Dois CTAs: "Convidar amigos →" (primário) e "Configurar bolão →" (secundário)
  - Loading state explícito enquanto `is_premium = false` e webhook pendente
- [ ] 1.7 — **Share em destaque quando `ranking ≤ 1`**: card sticky no topo do BolaoDetail "Ninguém entrou ainda. Compartilhe o link 👉" com botão grande copy-to-clipboard
- [ ] 1.8 — **Deadline visível fora do card**: badge no header do bolão + na lista de bolões da home ("Palpites fecham em 2h")

**Pagamento & join:**
- [ ] 1.9 — Bloquear botão "Criar Premium" durante redirect (loading overlay)
- [ ] 1.10 — Loading state explícito em BolaoDetail quando `is_premium=false` mas `success=true` na URL (webhook pendente)

---

### **Onda 2 — P1: Fricção óbvia (2 semanas)**

Problemas que o usuário resolve ignorando mas custam engajamento.

**Consolidação & fluxo:**
- [ ] 2.1 — **Consolidar BolaoPalpites + PredictionsModal** numa única tela. Escolher: modal (se é feature secundária) OU página (se é primária). Decisão: usar página + redirect do card "Fazer palpites →".
- [ ] 2.2 — **Empty states com CTA**:
  - BolaoHome "Nenhum bolão" → "Criar meu primeiro bolão →"
  - Meus Palpites vazio → "Fazer meu primeiro palpite →"
  - Ranking vazio → share CTA
- [ ] 2.3 — **Auto-save draft palpites** em localStorage. Chave `bolao_{id}_draft_{match_id}`. Restaurar ao abrir.

**Mobile & descoberta:**
- [ ] 2.4 — **Bottom sheet mobile** pra sidebar do BolaoDetail (cards Campeão/Especiais viram bottom-sheet arrastável, não scroll abaixo)
- [ ] 2.5 — **Filter bar com indicador de overflow**: fade-gradient nas bordas + scroll arrows (mesma solução do NBADashboard)
- [ ] 2.6 — **Onboarding persistente**: não some após 1 palpite. Adicionar checklist de steps ("Compartilhar ✓", "Fazer 3 palpites", "Escolher campeão") que dismissa só quando tudo feito OU via botão X.

**Upsell refinement:**
- [ ] 2.7 — **Reduzir CTAs de upgrade**: manter só 1 banner top + 1 CTA sutil inline (não 3× "Desbloquear →"). A/B test sugerido.
- [ ] 2.8 — **Banner Premium: 3 benefícios forte + 2 finos** (hierarquia visual), não 5 uniformes.
- [ ] 2.9 — **"Grupos 1× → Final 5×"** vira texto mais concreto: "Palpite certo na Final vale 5× mais que em jogo de grupo"

**Deadline UX:**
- [ ] 2.10 — **Warning específico de deadline mode change**: "23 pessoas já fizeram 147 palpites. Mudar o prazo agora afeta todos eles. Confirmar?" (não genérico "pode confundir")

**Push engajamento:**
- [ ] 2.11 — **"Você tem X palpites faltando"** sticky no BolaoPalpites (ou toast se > 10).
- [ ] 2.12 — **Save feedback aumentado** no palpite: toast breve de "Palpite salvo" por 2s (complementa o check inline).
- [ ] 2.13 — **Deadline proximity alert**: se `deadline - now < 1h`, badge vermelho pulsante.

---

### **Onda 3 — P2: Qualidade (3+ semanas)**

Polimento que separa produto "ok" de produto "gostoso de usar".

**Design system explícito:**
- [ ] 3.1 — **Token system** `tailwind.config`:
  - Spacing scale (4, 8, 12, 16, 24, 32, 48, 64)
  - Type scale (`text-label-sm`, `text-label-md`, `text-body`, `text-title`, `text-display`) — matar `text-[9px]` & co.
  - Color semantic tokens (`bg-surface-primary`, `text-fg-muted`, `border-border-subtle`)
  - Migrar componentes para usar tokens (começar pelo bolão, expandir)

**Estados de carga:**
- [ ] 3.2 — **Loading skeletons** em:
  - Ranking table
  - BolaoStats tab
  - Champion predictions (sidebar card)
  - Special picks panel

**Confirmações & undo:**
- [ ] 3.3 — **Undo toast** para remover membro (e qualquer ação destrutiva)
- [ ] 3.4 — **Sair do bolão** — UI no admin panel quando não-owner
- [ ] 3.5 — **Zerar palpite** — menu de 3 pontos no MatchPredictionCard

**Milestones & gamificação:**
- [ ] 3.6 — **Celebração primeira vez**:
  - Primeiro palpite → confetti + toast
  - Primeiro acerto → badge + som sutil
  - Subiu pro pódio → banner
- [ ] 3.7 — **Progresso visual** no card "Palpites dos Jogos": barra X/Y com cor azul→verde conforme completude

**Acessibilidade avançada:**
- [ ] 3.8 — **Reduced motion support** — envolver todas animações em `prefers-reduced-motion`
- [ ] 3.9 — **Dynamic Type / Text zoom** — testar até 200% sem quebrar layouts
- [ ] 3.10 — **aria-live regions** pros toasts + max-reached nos pick panels
- [ ] 3.11 — **Focus trap correto** nos dropdowns do ShareButton + ESC dismiss
- [ ] 3.12 — **Focus rings visíveis** (2-4px) em todos interactive — hoje está faltando em vários lugares

**Correções menores:**
- [ ] 3.13 — **Hash invite_code clicável** no info bar (copy-on-click + toast)
- [ ] 3.14 — **Flag real** no ChampionPickModal (não só placeholder 8×5)
- [ ] 3.15 — **Search inputs** nos modals com `text-sm` mínimo (não `text-[11px]`)
- [ ] 3.16 — **Delete chips** com button semântico + aria-label "Remover {team}"
- [ ] 3.17 — **Copy feedback do ShareButton** reforçada (toast + animation, não só ícone mudando)

---

### **Onda 4 — P3: Refinamento final (ongoing)**

- [ ] 4.1 — **A/B testing** do banner Premium (3 vs 5 features, cores diferentes, preço destacado)
- [ ] 4.2 — **Email de confirmação** pós-pagamento com link direto pro bolão + convites
- [ ] 4.3 — **Deep-link WhatsApp** otimizado (mensagem pré-formatada específica por bolão)
- [ ] 4.4 — **Notificações** (push/email) pre-deadline: "Você ainda não palpitou os jogos de hoje"
- [ ] 4.5 — **Compartilhamento de ranking** em imagem (já existe botão, fazer imagem bonita)
- [ ] 4.6 — **Landing page dedicada** do Bolão fora do dashboard NBA (SEO + conversão orgânica)
- [ ] 4.7 — **Multi-usuário**: owner pode transferir bolão, múltiplos admins, convite com role

---

## 6. Métricas de sucesso (pra validar cada onda)

**Onda 1:**
- Accessibility score (Lighthouse) ≥ 90
- Taxa de conclusão do onboarding pós-pagamento ≥ 60% (primeiro compartilhamento)
- % de bolões com ≥ 2 membros em 24h após criação ≥ 40%

**Onda 2:**
- Taxa de abandono em `BolaoPalpites` antes do primeiro save ↓ 30%
- Usuários que fazem 2º palpite na mesma sessão ↑ 25%
- Upgrade rate (free → premium) ↑ (tracking após redução de CTA saturation)

**Onda 3:**
- NPS / CSAT survey pós-primeira semana de uso
- Retention 7-day ≥ 50% (user volta pelo menos 1 vez)
- Time-to-first-prediction < 90s

---

## 7. Dependências e considerações

- **Webhook Stripe** precisa gravar `bolaoDeadlineMode` enviado no body (pendência conhecida) — bloqueia pleno funcionamento da feature de deadline em bolões premium criados via checkout dinâmico.
- **Migration 041 (scoring_weights) + 042 (update_bolao_deadline_mode)** aplicadas em staging; **falta aplicar em prod** (`lavclmlvvfzkblrstojd`).
- **Design system refactor (Onda 3.1)** tem overlap com dashboard NBA — decidir se faz escopo bolão-only ou global.
- **Consolidação Palpites modal ↔ page (Onda 2.1)** precisa review com PM antes de implementar — impacto em analytics/funil existente.

---

## 8. Histórico

- 2026-04-23 — auditoria inicial + plano criado por Claude (session)
- 2026-??-?? — revisão humana + priorização real

---

*Fim do documento. Qualquer item riscado no checklist deve incluir commit SHA e data. Se novo problema aparecer durante implementação, adicionar na seção correspondente e atualizar.*
