# Plano: fundir o PR #259 do Matheus com o que já está na develop

**Contexto (18/08/2026).** O A0 foi implementado duas vezes, sem ninguém saber do outro: a gente entregou nos PRs #254 e #256 (mergeados em 17/08 à noite), o Matheus entregou no #259 (aberto em 18/08 de manhã, hoje em conflito com a develop). Decisão do Victor: não descartar nenhum dos dois, absorver o melhor de cada um.

## O que cada lado tem que o outro não tem

**Já na develop (nosso):**
- Migration 101: RPC `get_futebol_value_history` + `get_futebol_fixture_value` caindo na foto do apito quando o kickoff passou (o escopo do ticket #260 dele, que ele NÃO implementou)
- Coluna `premissas_sem_dado` no retorno do histórico (espelha o board pós-099)
- FaixaPartida com o estado "Em andamento" (antes jogo rolando dizia "Não começou")
- Decisão do Victor: dia pré-27/07 fora do stepper
- Remoção do código morto "sem valor claro"

**Só no #259 (dele):**
1. **Guarda `kickoff < now()`** na RPC de histórico. A nossa não tem, e o furo é real: 7 versões abertas de jogos futuros passam no predicado PIT hoje. Uma chave que saiu do board voltaria à tela como oportunidade viva.
2. **`DISTINCT ON (opportunity_key)`** blindando o grão. A gente decidiu confiar no dado ("zero sobreposição hoje"); ele blindou contra o dia em que o SCD produzir janela sobreposta. A blindagem é barata e o desempate é explícito (`dbt_valid_from desc`), então não é o desempate arbitrário que a 098 corrigiu.
3. **Janela BRT sargável**: ele converte os limites do dia UMA vez (`p_from at time zone 'America/Sao_Paulo'`), a nossa chama `futebol_dia_brt(kickoff)` linha a linha, o que impede índice.
4. **Índice `fact_fixtures_kickoff_utc_idx`**: medido por ele, a seleção PIT cai de 85ms para 6,3ms.
5. **Módulo puro `futebol-history.ts` com 130 linhas de teste**, incluindo a regra de fusão do dia corrente.
6. **Regra do dia corrente MELHOR que a nossa**: no dia de hoje, kickoff já passou → vence a linha do hist (foto do apito); kickoff futuro → vence o board. A nossa dava o board pra tudo de hoje, o que descasa da tela de detalhe (que já mostra a foto do apito assim que o jogo começa). Com a dele, lista e detalhe contam a mesma história.
7. **Shape file atualizado** (a dívida da #250, na parte do histórico).

## Divergência a resolver: a coluna `premissas_sem_dado`

A RPC dele NÃO devolve `premissas_sem_dado`, espelhando o board de PRODUÇÃO. Só que produção está atrasada: a 099 (já na develop, aguardando deploy) põe a coluna no board. E o próprio shape file, desde o PR #248, declara o board COM a coluna, então o espelho dele contradiz a regra dele ("espelhar o RETURNS do board").

**Decisão: a coluna FICA.** O deploy é das 097-101 juntas, então o board de produção vai ter a coluna no mesmo instante em que o histórico nascer lá.

## O que NÃO absorver do #259

- O `RETURNS TABLE` sem `premissas_sem_dado` (acima).
- As funções de calendário do módulo dele (`kickoffMs`, `brtDay`, `addDaysBrt`): duplicam `futebol-datas.ts`, que já existe e já tem teste. O módulo absorvido importa de lá.
- A parte do front dele que refaz o que o nosso já faz (união inline): a base é a nossa página, que já carrega as decisões do Victor.

## Execução (ordem)

**1. Migration 102 — endurecer a RPC de histórico.** Corpo novo com: guarda `kickoff < now()`, `DISTINCT ON (opportunity_key)` com desempate explícito, janela BRT sargável, e o índice `fact_fixtures_kickoff_utc_idx`. Mantém as colunas nossas (com `premissas_sem_dado`). Crédito ao #259 no cabeçalho.

**2. Migration 103 — fase da escalação por TEMPO, não por existência.** A 098 escolhe `confirmed` se existir qualquer linha `confirmed`. Medido: nos 154 jogos com as duas fases, `confirmed` tem 2 jogadores/jogo contra 46,5 da `real` — a regra atual desenharia um campinho com 2 jogadores depois que a C1 do Matheus deployar. Regra nova, por tabela: kickoff passou E existe `real` → `real`; senão `confirmed` se existir; senão `real`. **É o que destrava a C1 dele (PR #88 em draft no analytics-engineering).**

**3. Front — adotar o módulo testado dele.** `futebol-history.ts` (só `mergeBoardAndHistory`, `opportunityKey`, `historyWindow`; calendário importado de `futebol-datas`) + os testes adaptados. `FutebolOportunidades` passa a usar `mergeBoardAndHistory` no lugar da união inline, ganhando a regra do dia corrente. As decisões do Victor (pré-27/07, código morto) não mudam.

**4. Shape file — catch-up completo, fecha a #250.** O `docs/futebol-prod-deploy.sql` ganha: as correções 097/098 nos corpos das RPCs de odds e valor, a fase por tempo (103), a RPC de histórico versão 102 (base no bloco dele, ajustado), e o índice. Depois disso o arquivo volta a ser espelho fiel.

**5. Comunicação.**
- **PR #259**: comentário com o que foi absorvido e onde, crédito explícito, e o apontamento da divergência do `premissas_sem_dado`. Ele fecha o #259.
- **Tickets #257 e #260**: fecham quando o PR de fusão mergear (o escopo dos dois está coberto).
- **ClickUp C1**: a RPC passa a filtrar por tempo na 103; o gate dele (não buildar antes do deploy) continua até 097-103 chegarem em produção; aí ele tira o #88 de draft.
- **Causa raiz da colisão**: propor a convenção de reivindicar o ticket com um comentário "em execução" antes de começar. Um comentário de uma linha teria evitado um dia de trabalho dobrado.

**6. Deploy em produção: janela única com 097-103.** Depois dela: Matheus liga o expurgo (passo 3 do A0) E builda a C1.

## Aceite

- `get_futebol_value_history` não devolve nenhuma linha de kickoff futuro (hoje devolveria 7 versões).
- Grão de 1 linha por `opportunity_key` garantido por construção, não por sorte.
- Detalhe de jogo com as duas fases de escalação mostra a `real` depois do apito (46,5 jogadores, não 2).
- Testes do módulo de fusão passando; suíte sem regressão além das 2 falhas pré-existentes.
- Shape file espelha exatamente as funções vivas do dev (conferido por `pg_get_functiondef`).
- #250, #257, #260 fechadas; #259 fechado pelo autor; C1 destravada.
