# Bolão Copa 2026 — Palpites Especiais de Jogador (pesquisa + plano)

> Status: **proposta / pesquisa**. Nada implementado.
> Autor: levantamento a pedido do Diody (sugestão dos usuários).
> Data: 2026-06-01.

## 1. O problema

Hoje os palpites especiais são todos **de seleção** (campeão, finalistas, semis, quartas,
mata-mata). A sugestão dos usuários é incluir palpites **de jogador**:

- **Artilheiro** (Chuteira de Ouro / Golden Boot)
- **Melhor goleiro** (Luva de Ouro / Golden Glove)
- **Revelação / jovem** (Prêmio de Melhor Jovem / Young Player)
- **Craque da Copa** (Bola de Ouro / Golden Ball)

A dúvida do Diody é a **metrificação**: artilheiro é objetivo (conta gol), mas os outros
três são subjetivos. O insight dele está correto e é o eixo de todo o plano abaixo.

## 2. Pesquisa — como cada prêmio é decidido

| Prêmio | Quem decide | Critério | Anúncio | Metrificável por stat? |
|---|---|---|---|---|
| **Chuteira de Ouro** (artilheiro) | Regra fixa FIFA | Mais gols. Empate → mais assistências → menos minutos jogados | Fim do torneio | ✅ **Sim, 100% objetivo** |
| **Luva de Ouro** (goleiro) | FIFA Technical Study Group (júri) | Desempenho geral do goleiro | Cerimônia de encerramento | ⚠️ Não — é júri (proxy possível: jogos sem sofrer gol, defesas, etc., mas **não** é a regra oficial) |
| **Melhor Jovem** (revelação) | FIFA TSG (júri) | Melhor jogador com ≤21 anos no início do ano (nascidos a partir de ~01/01/2005 p/ 2026) | Cerimônia de encerramento | ❌ Não — júri |
| **Bola de Ouro** (craque) | Votação da mídia (shortlist do TSG) | Melhor jogador do torneio | Cerimônia de encerramento | ❌ Não — votação |

**Conclusão-chave:** só a **Chuteira de Ouro** tem regra determinística. Os outros três são
decisões de júri/mídia anunciadas **na cerimônia de encerramento, depois da final**. Não
existe fórmula oficial — qualquer "metrificação" nossa seria um proxy que **não bate** com o
vencedor real. Logo, dependem do **anúncio oficial da FIFA** pra serem resolvidos. É
exatamente o ponto do Diody: sem o resultado oficial, vira inviável (ou injusto).

Fontes:
- [FIFA World Cup awards — Wikipedia](https://en.wikipedia.org/wiki/FIFA_World_Cup_awards)
- [Goal.com — How the Golden Ball is decided](https://www.goal.com/en-us/news/world-cup-golden-ball-full-winners-list-how-award-decided/bltf1da74d328214aba)
- [Inquirer — FIFA awards explained](https://www.inquirer.com/soccer/world-cup-trophies-golden-boot-golden-ball-golden-glove-young-player-fifa-awards-20221117.html)
- [ESPN — Young Player Award](https://www.espn.com/soccer/story/_/id/48760910/who-won-young-player-award-world-cup)

## 3. Pesquisa — o que a API-Sports (API-Football) entrega

Cobertura da Copa 2026 na API-Sports inclui: fixtures (events, lineups, statistics, players),
standings, **players**, **topscorers**, **topassists**, top cards, injuries, predictions, odds,
e **squads** (elencos por seleção).

- ✅ **topscorers** → ranking de artilheiros (gols). Dá pra resolver a Chuteira de Ouro
  automaticamente, inclusive os critérios de desempate (assists via player stats, minutos
  jogados via player stats).
- ✅ **squads / players** → lista de jogadores por seleção com nome, posição, número,
  **data de nascimento** (necessária pro filtro de elegibilidade do Melhor Jovem).
- ❌ **A API NÃO devolve os vencedores oficiais dos prêmios de júri** (Luva/Bola/Jovem).
  Esses são divulgados pela FIFA num evento, não num endpoint.

Confirma a tese: **artilheiro = automático via API**; **goleiro/craque/revelação = só com o
resultado oficial inserido manualmente** depois do anúncio.

Fontes:
- [API-Football — guia Copa 2026](https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports)
- [API-Football — Top Scorers endpoint](https://www.api-football.com/news/post/top-scorers-endpoint)
- Ver também memória do projeto: estratégia de dados = REST direto na API-Sports.

## 4. Decisão central: modelo de resolução em 2 trilhas

Como os prêmios são **fatos globais** (o artilheiro da Copa é o mesmo pra todos os bolões),
a resolução **NÃO** pode ser por dono de bolão (risco de manipulação/erro). Tem que ser
**centralizada**, igual ao resultado dos jogos (`calculate_bolao_scores` hoje usa a verdade
global de `wc_matches`). Duas trilhas:

- **Trilha A — Automática (artilheiro):** ingestão do `topscorers` da API após a final →
  função resolve o vencedor (com desempate) → pontua todos os palpites de `top_scorer`.
- **Trilha B — Manual central (goleiro/craque/revelação):** quando a FIFA anuncia, **um admin
  da plataforma** (não o dono do bolão) registra o `player_id` oficial vencedor de cada prêmio
  numa tabela global → função pontua os palpites correspondentes em todos os bolões.

Ambas rodam **uma única vez, após a final** (settlement único), diferente dos palpites de
placar que pontuam jogo a jogo.

## 5. Proposta de produto

### 5.1 Faseamento (recomendado)

- **Onda 1 — Artilheiro:** menor risco, 100% objetivo, resolução automática. Entrega o valor
  da feature ("palpite de jogador") já validando elenco + UI de seleção de jogador.
- **Onda 2 — Goleiro / Craque / Revelação:** depende da trilha de resolução manual central +
  do anúncio oficial. Liga depois que a Onda 1 estiver redonda.

Isso responde direto à preocupação do Diody: começa pelo metrificável e só liga os
subjetivos com o resultado oficial da FIFA em mãos.

### 5.2 Free vs Premium

Seguir a regra já vigente do bolão (palpites especiais liberados pra todos; Premium muda só
limite de participantes). Sugestão: **mesma política** — palpites de jogador liberados pra
Free e Premium. (Decisão do Diody.)

### 5.3 Pontuação

Pesos configuráveis pelo dono (como os outros especiais). Sugestão de default:
artilheiro alto (mais difícil/icônico), demais médios. Valores finais = decisão de produto.

## 6. Arquitetura (extensão do que já existe)

> Base atual (read-only confirmado): `bolao_special_predictions` guarda `predicted_team_code`
> (TEXT), sem conceito de jogador. `toggle_special_prediction` valida só os 4 tipos de
> seleção. Não existe tabela de jogadores/elencos. Seed de referência segue o padrão de
> `041_bolao_seed_wc_matches.sql`.

### 6.1 Banco

1. **`wc_players`** (nova, dados de referência globais)
   - `player_id` (PK, id da API-Sports), `player_name`, `team_code` (FK lógica p/ seleção),
     `position` (GK/DF/MF/FW), `shirt_number`, `birth_date` (p/ filtro de jovem), `photo_url`.
   - Seed via ingestão dos **squads** da API-Sports (quando a FIFA confirmar os elencos —
     ~início de junho/2026, Copa abre 11/jun).

2. **Armazenamento dos palpites** — duas opções:
   - **(Recomendado) Reusar `bolao_special_predictions`** adicionando coluna nullable
     `predicted_player_id` e novos valores de `prediction_type`
     (`top_scorer`/`best_goalkeeper`/`best_young_player`/`best_player`). Reaproveita
     `get_my_special_predictions`, `toggle`, summary e o scaffolding de pontuação. Cada tipo
     de jogador é **pick único** (1 jogador), diferente dos picks múltiplos de seleção.
   - (Alternativa) Tabela dedicada `bolao_player_predictions`. Mais limpo conceitualmente, mas
     duplica RPCs e UI. Só vale se a lógica divergir muito.

3. **`wc_player_awards`** (nova, verdade global) — `award_type`, `winner_player_id`,
   `resolved_at`, `resolved_by`. Preenchida pela trilha A (auto) ou B (admin central).

### 6.2 RPCs

- `toggle_player_prediction(bolao_id, prediction_type, player_id)` — ou estender
  `toggle_special_prediction` pra aceitar `player_id` quando o tipo for de jogador
  (validação: pick único; goleiro só aceita `position='GK'`; jovem só aceita `birth_date`
  elegível).
- `get_wc_players(filtro: posição/elegibilidade/busca)` — alimenta o seletor.
- `resolve_player_awards()` — settlement: lê `wc_player_awards` (+ `topscorers` p/ artilheiro)
  e grava `points_earned` nos palpites. SECURITY DEFINER, idempotente.
- Ajustar `get_bolao_special_summary` p/ exibir popularidade dos palpites de jogador.

### 6.3 Frontend

- **Seletor de jogador** (novo componente): busca por nome, filtro por posição (goleiro) e por
  elegibilidade (jovem), foto + seleção + número. Padrão visual do `SpecialPredictionsSection`.
- Estender `TYPE_META` e o `SpecialPrediction` (service) com os tipos de jogador.
- **Admin do bolão** (`BolaoAdminPanel`): toggles + pesos dos novos tipos.
- **Admin de plataforma** (novo, restrito): registrar vencedores oficiais (trilha B) e
  disparar `resolve_player_awards`.

### 6.4 Ingestão de dados

- Edge function / job: (a) puxar **squads** pra popular `wc_players` antes da abertura;
  (b) puxar **topscorers** após a final pra resolver artilheiro.

## 7. Riscos e dependências

- **Confirmação dos elencos:** rosters oficiais saem perto da abertura (Copa 11/jun/2026).
  A seleção de jogador só abre quando `wc_players` estiver populado. Prazo do palpite =
  até a abertura (igual aos outros especiais).
- **Cutoff do Melhor Jovem:** nascidos a partir de ~01/01/2005 (a confirmar pela FIFA p/ 2026).
  Filtro depende de `birth_date` da API.
- **Prêmios de júri:** sem resultado oficial automatizável → dependem do anúncio FIFA +
  inserção manual central. **Timing confirmado:** os prêmios saem na cerimônia no gramado
  **minutos após a final, na mesma noite** (ex: Copa 2022, 18/dez — Messi/Mbappé/Martínez/
  Enzo anunciados logo após o apito). Logo, a "demora" não é externa: é só a nossa operação
  inserir os 3 vencedores naquela noite. Pontuam dentro do hype da final, sem perder o sentido.
- **Trilha de resolução central:** precisa de papel de admin de plataforma (não existe hoje
  pro bolão) — definir quem opera.

## 8. Plano de execução solo (você + eu)

> **Premissas (confirmar/corrigir):** (a) feature completa, mas sequenciada; (b) resolução
> manual **central** (admin de plataforma) + automação pro artilheiro; (c) liberado pra Free e
> Premium (política atual). 48 seleções / 104 jogos / **Copa abre 11/jun/2026, final ~19/jul**.

> ⚠️ **Regra de ouro (lição do drift staging×prod):** toda função/tabela nova nasce como
> **migration commitada**. Nada de SQL direto no banco. Sempre staging → validar → prod via
> migration. Ver memória `project_bolao_staging_prod_drift`.

Como é só eu + você, isto **não é paralelo** — é uma fila de movimentos ordenada por
**prazo e risco**. Dois prazos mandam:
- 🔴 **11/jun (abertura):** tudo que envolve *colocar palpite* e *pontuar placar* tem que estar de pé.
- 🟢 **~19/jul (final):** o *settlement dos prêmios de jogador* só acontece aqui — tem 5-6 semanas de folga.

### Movimento 0 — Contrato + validação da API (gate, antes de tudo)
O único acoplamento entre "integração" e "feature" é o schema. Fechar primeiro destrava os dois.
- Validar na API-Sports (Copa 2026): `fixtures` (placar/eventos), `squads` (com `birth_date`+
  `position`), `topscorers`. **Se a API não entregar, o plano muda — por isso é o passo 1.**
- Fechar o schema das tabelas novas (`wc_players`, `wc_player_awards`, extensão de
  `bolao_special_predictions`). Confirmar cutoff do Melhor Jovem 2026 (~nascidos ≥ 01/01/2005).

### Movimento 1 — A ponte API-Sports → Supabase + ingestão de PLACAR 🔴 (critical path)
**Por que primeiro:** sem isso o bolão **não pontua nada** na Copa, com ou sem feature de jogador.
É a peça mais urgente do produto inteiro, não só dos prêmios.
- Edge function base (`ingest-wc`) que fala REST com a API-Sports (1 cliente, vários jobs).
- Job de **fixtures/placar** → upsert em `wc_matches` (score + `is_finished`) → dispara
  `calculate_bolao_scores`. Agendado via **cron do Supabase** (frequente nos dias de jogo).
- **Fallback manual** de placar (admin seta um jogo) como rede de segurança pro 1º dia.

### Movimento 2 — Elencos: ingestão de squads → `wc_players` 🔴
Reusa a ponte do M1. Gate pra UI de palpite de jogador.
- Migration `046_wc_players` (player_id PK, nome, team_code, position, birth_date, photo).
  RLS leitura pública; escrita service_role.
- Job de **squads** → upsert em `wc_players`. Rodar quando a FIFA confirmar os elencos.

### Movimento 3 — Palpite de jogador: SELEÇÃO 🔴 (precisa abrir antes de 11/jun)
Foco só em *deixar o usuário palpitar* — pontuação fica pro M4.
- Migration `047_player_predictions_schema`: estende `bolao_special_predictions`
  (`predicted_player_id` nullable, `team_code` nullable, `CHECK` por tipo,
  `UNIQUE(bolao_id,user_id,prediction_type)` p/ pick único); novos tipos
  `top_scorer`/`best_goalkeeper`/`best_young_player`/`best_player`; config de pesos no `boloes`;
  tabela global `wc_player_awards`.
- Migration `048_player_predictions_rpcs`: **recriar `get_my_special_predictions`** com
  `predicted_player_id` (muda OUT columns → `DROP`+`CREATE`, **sincronizar staging E prod** — é
  a função do incidente recente); `set_player_prediction(...)` com validações
  (goleiro→`position='Goalkeeper'`; jovem→`birth_date` elegível; prazo).
- Frontend: componente `PlayerPicker` (busca + filtro posição/elegibilidade + foto/bandeira),
  4 cards de prêmio no modal, toggles + pesos no `BolaoAdminPanel`.

### Movimento 4 — Settlement dos prêmios 🟢 (com folga, após picks fecharem)
- `resolve_player_awards()` — idempotente; lê `wc_player_awards` e pontua todos os bolões
  respeitando os pesos de cada um.
- Job de **topscorers** (reusa a ponte) → resolve **artilheiro automático** com desempate.
- **Mini-tela de admin de plataforma** — registrar os 3 vencedores de júri + botão "puxar
  artilheiro" → liquida na noite da final em ~30s. É a "automação rápida" que você citou.

### Movimento 5 — Polimento 🟢
Visualização de resultado (vencedor × seu palpite × pontos), popularidade por prêmio,
achievement ("acertou o artilheiro").

### A decisão de escopo que o calendário força
Em modo solo, **M1 (placar) é inegociável pra 11/jun**. M2+M3 (palpite de jogador no ar) é o
*stretch* pra mesma data. Se o tempo apertar, a ordem de sacrifício é clara: garante M1, e os
prêmios de jogador viram fast-follow — **mas** a seleção do palpite (M3) tem que entrar antes da
abertura pra valer nesta Copa (prazo = abertura). M4/M5 têm semanas de folga de qualquer jeito.

→ **Próximo movimento concreto: M0** — validar os 3 endpoints na API-Sports e fechar o schema.
Posso começar por aí quando você der o ok.

## 9. M0 — Resultado da validação (concluído 2026-06-01)

Validado direto na API-Sports (`v3.football.api-sports.io`, league id **1** = World Cup,
season **2026**, `current=true`, abre 11/jun).

### O que a API entrega
- ✅ **Capacidade confirmada:** a Copa **2022** tem cobertura toda `true` (players, top_scorers,
  statistics_players, events, lineups). Na **2026** essas flags estão `false` agora porque o
  torneio não começou — vão virar `true` conforme a Copa se aproxima/começa (igual 2022).
- ✅ **Fixtures/placar (2026):** 72 de 104 jogos já carregados (knockout com TBD ainda não),
  com **team ids** (ex: México=16). Pipeline de placar viável.
- ✅ **Topscorers:** forma da resposta traz `goals.total`, `goals.assists`, `games.minutes` →
  dá pra resolver o **artilheiro automático** com o desempate oficial (validado na 2022:
  Mbappé 8 gols × Messi 7). Em 2026 está vazio agora (sem jogos).
- ✅ **Posição do jogador:** vem no `players/squads` (Goalkeeper/Defender/Midfielder/Attacker).
- ⚠️ **`birth_date` NÃO vem no `squads`** (só `age`). Está no **`players/profiles`** (1 chamada
  por jogador / paginado). A ingestão precisa **combinar squads + profiles** pra ter a data exata
  (necessária pra elegibilidade do Melhor Jovem).
- ⚠️ **Elenco = pool nacional amplo, não os 26 da Copa:** `squads?team=16` retornou 49 jogadores.
  Pré-torneio listamos demais. Mitigação: re-ingerir perto/depois da convocação oficial (o
  squads tende a enxugar) e/ou aceitar o pool amplo (quem palpita em jogador fora dos 26 só perde).

### Conta / plano (operacional)
- Plano **Pro — 7.500 req/dia** (folga pra enriquecer ~1248 jogadores via profiles + pollar placar).
- 🔴 **A assinatura vence em 11/jun/2026 — o dia da abertura.** Renovar antes, senão a ingestão
  morre no 1º jogo. **Bloqueador operacional nº 1.**
- Mapeamento necessário: API usa **team id numérico**; nosso `wc_matches` usa código de 3 letras.
  A ingestão precisa de um de↔para (team id → team_code), construível a partir dos próprios fixtures.

### Schema fechado (contrato pras duas frentes)
- **`wc_players`** (ref global): `player_id bigint PK`, `player_name`, `team_code`, `api_team_id`,
  `position`, `shirt_number`, `birth_date` (nullable até enriquecer), `photo_url`, `updated_at`.
  RLS leitura pública; escrita service_role. Índices `(team_code)`, `(position)`.
- **`bolao_special_predictions`** (extensão): `+ predicted_player_id bigint NULL` (FK wc_players);
  `predicted_team_code` vira nullable; `CHECK` (tipo de time → team_code; tipo de jogador →
  player_id); `UNIQUE(bolao_id,user_id,prediction_type)` parcial p/ tipos de jogador (pick único).
  Novos tipos: `top_scorer`,`best_goalkeeper`,`best_young_player`,`best_player`.
- **`wc_player_awards`** (verdade global): `award_type text PK`, `winner_player_id bigint FK`,
  `resolved_at`, `resolved_by`.
- **`boloes`** (config): `player_awards_enabled jsonb` + `player_award_points jsonb` (padrão do
  `scoring_weights`).
- **Elegibilidade Melhor Jovem 2026:** filtro `birth_date >= '2005-01-01'` (a confirmar oficialmente).

### Veredito do gate
API entrega tudo que o plano precisa. Sinais verdes pra seguir. **Pendências não-código:**
(1) renovar a assinatura API-Sports antes de 11/jun; (2) decidir timing da ingestão de elencos
(pool amplo agora vs lista enxuta perto da Copa).

## 10. Progresso M1 — ponte API→Supabase + placar

Decisão: usar a chave atual (`VITE_API_SPORTS_KEY`) por enquanto; migrar pra secret/chave
backend depois.

- ✅ **046_wc_team_map** — de↔para `api_team_id`→`team_code` (48/48, validado staging). Commit f8d10c3.
- ✅ **047_wc_matches_api_fixture_id** — coluna + seed dos 72 jogos de grupo (validado staging;
  mata-mata null até resolver). Casamento por par de times, NÃO por data (API=UTC, nosso=BRT). Commit 9669aa5.
- ✅ **edge function `ingest-wc-scores`** (código, sem deploy) — puxa fixtures, atualiza placar+
  is_finished por `api_fixture_id`, dispara `calculate_bolao_scores`; idempotente; guard
  `x-cron-secret`; `verify_jwt=false`. Commit a10a28a.

**Falta pra ativar o placar automático (precisa de você / infra):**
1. Setar secrets no Supabase: `API_SPORTS_KEY` (valor da chave atual por ora), `CRON_SECRET`.
2. Deploy da função `ingest-wc-scores`.
3. Agendar via pg_cron (chamar a função de X em X min nos dias de jogo).
4. Smoke test com 1 jogo (forçar um placar via API mock / jogo passado) antes de 11/jun.

**TODO técnico:** auto-link do mata-mata (32 jogos) quando a API carregar os fixtures com times reais.
