# Direção de Produto — Futebol (Smart Betting)

Documento de discovery, ainda sem implementação. Serve como base de retomada quando o backend, o banco de dados e a metodologia do modelo estiverem prontos.

Discussão conduzida em 2026-05-27, partindo da análise da API-Football e do mercado de value betting (ver `docs/analise api football e value betting.docx`).

---

## 1. Conclusão do experimento com widgets API-Sports

Os widgets nativos **não atendem**. Vão ser substituídos por componentes React próprios consumindo a REST API direto.

Motivos:
- Widget só entrega o que a API-Sports pré-fabricou (escalações, h2h cru, stats genéricas de jogo).
- Layout e fontes engessadas, distantes do rebrand.
- Faltam endpoints e visualizações que importam pra value bet: predictions, injuries, forma ponderada, devigged probability, CLV.
- Cache e UX próprias dão muito mais controle (já validado no sandbox).

Sandbox preservado em `/widgets-test` e `/widgets-bolao-preview` como referência pra testar endpoints novos rapidamente.

---

## 2. Tese central do produto

O produto **não é** "prever vencedor".

É **flagar oportunidades onde o risco-retorno compensa**, com base em modelo proprietário que detecta discrepância entre **probabilidade modelada** e **probabilidade implícita na odd de mercado** (= value bet).

- **Métrica-rei interna** (não exposta ao usuário): **CLV (Closing Line Value)** — diferença entre a odd capturada pela nossa sinalização e a odd de fechamento da casa sharp (Pinnacle como proxy). CLV positivo consistente = edge real, mesmo em séries curtas perdedoras.
- **Métrica-rei externa** (exposta ao usuário): **Score de Confiabilidade** — paralelo com o que já existe na NBA.

---

## 3. Diferença filosófica: NBA vs Futebol

| Dimensão | NBA | Futebol |
|---|---|---|
| Caráter do dado | Estatística é preditiva | Resultado é caótico |
| Proposta de valor | Previsão | Gestão de risco |
| Unidade central | Jogador (props) | Jogo (múltiplos mercados) |
| Discurso | "Vai bater a linha" | "O risco/retorno aqui compensa" |

Implicações diretas:
- Análise mastigada é **leitura do risco** do jogo, **não predição**.
- Score é medida de **convicção/calibração**, não "chance de acerto".
- Copy deve refletir gestão de risco. Cuidado pra não soar como tipster.

---

## 4. ICP

Apostador frequente / profissional. Iniciantes existem, mas **não são alvo**.

Consequências de UX:
- Podemos assumir letramento de mercado (odd, EV, devigged, linha sharp).
- Densidade de número é OK.
- Sem tutoriais ou explicações básicas no fluxo principal.

---

## 5. Arquitetura de telas (paralela ao módulo NBA)

| Tela | Função | Análogo na NBA |
|---|---|---|
| **Home** | Resumo do dia: KPIs, jogos do dia, oportunidades em destaque | Home/dashboard |
| **Oportunidades** | Lista curada do dia, ranqueada por score | Picks/Oportunidades |
| **Jogo** | Deep dive de uma partida: análise + estatística + oportunidades dela | Player dashboard |

A tela de Oportunidades é apenas um **agregador filtrado**: os cards que aparecem nela são os **mesmos** que aparecem dentro da tela de cada jogo. Sem duplicação de dado, só de visualização.

---

## 6. Anatomia da tela de jogo

Quatro blocos lógicos (ordem e container ainda a fechar):

### 6.1. Header
- Times, hora, status, importância (rodada, fase de mata-mata)
- Eventual placar projetado pelo modelo (a decidir)

### 6.2. Oportunidades do jogo *(só aparece se houver mercado com score relevante)*
Um card por mercado (1x2, O/U gols, BTTS, cartões, escanteios, props):
- Tipo de aposta — ex: "Mais de 2.5 gols"
- **Odd de referência** (sem casa visível) — linha sharp, Pinnacle como proxy
- **Score de Confiabilidade**
- 1 linha curta de justificativa

### 6.3. Análise mastigada
- Texto curado: leitura do risco do jogo, contexto, ponto-chave, ressalvas
- **Aqui mora a credibilidade do produto**, dado que não vamos mostrar track record histórico
- Tom = gestão de risco, não predição
- Custo operacional importante: alguém (ou IA assistida) precisa produzir esse conteúdo por jogo

### 6.4. Estatística descritiva
- Dados crus, sem opinião
- Conteúdo provável: forma recente (WDL casa/fora), médias ofensivas/defensivas, H2H filtrado, lesões/escalação confirmada, tabela, eventualmente xG quando entrar no pipeline

### 6.5. Quando NÃO há oportunidade mapeada (~70% dos jogos)
- A tela do jogo **ainda aparece** com estatística + análise mastigada
- **Não** existe "tela vazia" ou "Sem oportunidades" como página standalone
- Sinalização clara no topo: *"Sem oportunidade mapeada nos mercados monitorados — dados abaixo pra você tirar suas próprias conclusões"*
- A ausência de oportunidade é uma **decisão consciente comunicada**, não um esquecimento

---

## 7. Decisões fechadas

| Decisão | Resposta |
|---|---|
| Qual odd mostrar? | **Linha sharp** (Pinnacle como proxy), com label explícito do que é. Não mostrar "odd justa" porque parece recomendação implícita. |
| Mostrar casa de aposta? | **Não.** Só o número. User escolhe onde apostar. |
| Recomendar aposta explicitamente? | **Não.** Apresentamos oportunidades com valor, não dizemos "aposte aqui". |
| Mostrar track record (CLV, ROI, hit rate)? | **Não.** Começo da operação, sem dado suficiente. Se for transparência, falamos que está no começo. |
| Linguagem central de oportunidade? | **Score** (paralelo NBA), não EV% nem CLV%. |
| Estatística e insight no mesmo lugar? | **Sim**, mesma tela e mesma sessão de leitura. Separados visualmente, mas juntos. |

---

## 8. Próximos passos sugeridos

Ordem recomendada, baseada em discovery (não exige DB pronto):

### Discovery (sem DB necessário)
1. **Vocabulário do produto** — fechar nomes:
   - Escala e rótulo do score ("Score de Confiabilidade"? "Convicção"? "Sinal"? 0-100? estrelas?)
   - Rótulo da odd ("Linha sharp"? "Linha de referência"? "Odd Pinnacle"?)
   - Copy exato do badge de "sem oportunidade"
   - Nomes dos mercados e das categorias de estatística
2. **Anatomia detalhada da tela de jogo** — sumário textual: quais blocos, ordem, dados por bloco, regras de quando aparecem/somem.
3. **Wireframe ASCII das 3 telas** (Home / Oportunidades / Jogo) — concretizar visualmente o que está discutido.
4. **Mapa de mercados monitorados** — listar quais mercados o modelo vai cobrir primeiro (1x2, O/U gols, BTTS, escanteios, cartões, props). Define escopo do modelo e o que o DB precisa armazenar.

### Experimento técnico (sugerido pelo doc da consultoria, 4 semanas)
- **Semana 1** — Cadastro free na API-Football. Validar coverage do Brasileirão 2026. Puxar 1 rodada completa (fixture, statistics, lineups, injuries, odds, predictions). Conferir cobertura de casas brasileiras (Betano, Bet365, Pinnacle, Sportingbet, KTO).
- **Semana 2** — Implementar Poisson básico com `teams/statistics`. Comparar nossas probabilidades com as do endpoint predictions da API e com odds devigged (Shin). Identificar divergências > 5pp.
- **Semana 3** — Backtest exploratório nas 10 últimas rodadas do Brasileirão 2025. Calcular CLV médio e ROI hipotético com Kelly stake.
- **Semana 4** — Decisão:
  - CLV > 0% → modelo tem sinal, vale aprofundar (ratings dinâmicos, xG calculado, ajuste por lesão)
  - CLV < 0% → modelo fraco mas pipeline aprendido. Decidir entre melhorar modelo (Ângulo B) ou pivotar pra curadoria/scanner (Ângulos A ou C)

---

## 9. Pontos de atenção pra retomada

- **xG e métricas avançadas** (xGA, xGoT, xT, xPoints) não existem na API-Football. Em 6-12 meses provavelmente vão ser necessárias pra competir em narrativa moderna. Caminhos: calcular xG próprio via dados de chute (trabalhoso, impreciso), pagar add-on Sportmonks, ou raspar Understat (só ligas europeias). Decisão fica pra quando o modelo base estiver provado.
- **API key da API-Sports** ainda está exposta no frontend (`VITE_API_SPORTS_KEY`). Pra produção, mover pra Supabase edge function como proxy.
- **CLV positivo é o critério de verdade**, internamente. Pipeline precisa armazenar todo sinal gerado com timestamp + odd da casa de referência (Pinnacle) próximo ao kickoff. 100-200 sinais até virar estatisticamente significante.
- **Brasileirão = mercado pouco eficiente** (menos liquidez, menos dinheiro inteligente, mais variação entre casas). É estrategicamente onde valor é mais fácil de encontrar.
- **Regulamentação BR** (2024-2025) joga a favor de quem oferece ferramenta séria. Cuidado redobrado pra não prometer ROI ou parecer "palpite garantido" — credibilidade vai por água abaixo rápido.

---

## 10. Referências

- `docs/analise api football e value betting.docx` — doc-mãe, análise da API-Football + mercado de value betting
- `src/pages/WidgetsTest.tsx` — sandbox geral de teste com widgets API-Sports
- `src/pages/WidgetsBolaoPreview.tsx` — sandbox de UX de palpite com expand inline
- Memória do projeto: `project_bolao_data_strategy.md` (decisão widget → REST)
- Memória do projeto: `project_bolao_copa_plan.md` (plano Bolão Copa)
- Memória do projeto: `feedback_nba_ui_clarity.md` (diretriz de UI da NBA — paridade visual)
