/**
 * Retrato do mercado de escanteios — a fase 1 do método de premissas.
 *
 * Reproduz as medições da seção 5 de docs/futebol-metodologia-de-premissas.md.
 * Existe porque a lição da seção 0 daquele documento é exatamente esta: a
 * rodada de medição anterior ficou num diretório temporário do sistema e só é
 * retomável hoje por sorte.
 *
 * Uso (o token é o mesmo SUPABASE_ACCESS_TOKEN do .env.local):
 *   SUPABASE_ACCESS_TOKEN=... node scripts/futebol-escanteios-retrato.mjs
 *
 * Quatro armadilhas que este script evita, e que qualquer reescrita precisa
 * continuar evitando:
 *
 * 1. POINT-IN-TIME. As médias de time usam `rows between 10 preceding and 1
 *    preceding`. O `1 preceding` é o que exclui a própria partida. Sem ele o
 *    número sobe e a medição vira a task [0] de novo.
 *
 * 2. O PAR DO JOGO. `fact_fixture_stats` tem uma linha por time por jogo. Os
 *    escanteios sofridos por um time são os escanteios feitos pelo outro na
 *    mesma partida — daí o self-join por fixture_id com team_id diferente.
 *    Somar a coluna errada mede a mesma coisa duas vezes.
 *
 * 3. AMOSTRA MÍNIMA. Times com menos de 10 jogos de histórico saem da conta de
 *    separação, e com menos de 30 saem da conta de persistência. Amostra curta
 *    fabrica sinal, e esse é o achado mais caro da base.
 *
 * 4. A RÉGUA. Todo número de escanteio vem ao lado do mesmo número em gols. Sem
 *    a régua, 10,3 pontos de separação parecem muito. Ao lado dos 19,4 de gols,
 *    parecem o que são.
 */

const PROJETO = process.env.SUPABASE_PROJECT_REF || 'lavclmlvvfzkblrstojd';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('falta SUPABASE_ACCESS_TOKEN no ambiente (está no .env.local)');
  process.exit(1);
}

/** Leitura pelo Management API. `read_only` é a garantia de que isto não escreve. */
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJETO}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

/** O par do jogo: cada linha vira (feitos, sofridos) para um time. */
const PARES_ESCANTEIO = `
  select a.fixture_id, a.date_utc, a.team_id, a.team_side lado,
         a.corner_kicks feitos, b.corner_kicks sofridos,
         a.corner_kicks - b.corner_kicks saldo,
         a.total_shots chutes, a.ball_possession posse
  from futebol.fact_fixture_stats a
  join futebol.fact_fixture_stats b
    on b.fixture_id = a.fixture_id and b.team_id <> a.team_id
  where a.corner_kicks is not null and b.corner_kicks is not null`;

const PARES_GOL = `
  select fixture_id, date_utc, home_team_id team_id, 'home' lado,
         goals_home feitos, goals_away sofridos
  from futebol.fact_fixtures where status_short = 'FT' and goals_home is not null
  union all
  select fixture_id, date_utc, away_team_id, 'away', goals_away, goals_home
  from futebol.fact_fixtures where status_short = 'FT' and goals_home is not null`;

/** Média dos 10 jogos ANTERIORES — o `1 preceding` é o point-in-time. */
const pit = (pares) => `
  with pares as (${pares}), pit as (
    select *,
      avg(feitos)   over (partition by team_id order by date_utc rows between 10 preceding and 1 preceding) mf,
      avg(sofridos) over (partition by team_id order by date_utc rows between 10 preceding and 1 preceding) ms,
      count(*)      over (partition by team_id order by date_utc rows between 10 preceding and 1 preceding) n
    from pares
  ), jogo as (
    select h.fixture_id, h.feitos + h.sofridos total,
           (h.mf + a.ms + a.mf + h.ms) / 2.0 prev
    from pit h join pit a on a.fixture_id = h.fixture_id and a.lado = 'away'
    where h.lado = 'home' and h.n >= 10 and a.n >= 10
  )`;

async function cobertura() {
  const r = await q(`
    select f.competition,
      count(distinct f.fixture_id) jogos_ft,
      round(100.0 * count(distinct s.fixture_id) / count(distinct f.fixture_id), 1) cobertura
    from futebol.fact_fixtures f
    left join futebol.fact_fixture_stats s
      on s.fixture_id = f.fixture_id and s.corner_kicks is not null
    where f.status_short = 'FT' and f.date_utc >= '2026-01-01'
    group by 1 order by 2 desc`);
  console.log('\nCOBERTURA DE ESCANTEIO POR COMPETIÇÃO (encerrados em 2026)');
  console.table(r);
}

/** A pergunta que decide o mercado: isso é traço do time ou é ruído? */
async function persistencia() {
  const conta = (pares) => `
    with pares as (${pares}), ord as (
      select *, row_number() over (partition by team_id order by date_utc) rn,
             count(*) over (partition by team_id) tot from pares
    ), met as (
      select team_id,
        avg(case when rn <= tot/2 then feitos   end) f1, avg(case when rn > tot/2 then feitos   end) f2,
        avg(case when rn <= tot/2 then sofridos end) s1, avg(case when rn > tot/2 then sofridos end) s2,
        max(tot) tot from ord group by 1
    )
    select round(corr(f1,f2)::numeric,3) a_favor,
           round(corr(s1,s2)::numeric,3) sofridos,
           count(*) times
    from met where tot >= 30`;

  const linhas = [];
  const colunas = ['ball_possession', 'expected_goals', 'total_shots', 'fouls', 'yellow_cards', 'corner_kicks'];
  for (const col of colunas) {
    const pares = PARES_ESCANTEIO.replaceAll('corner_kicks', col);
    const [r] = await q(conta(pares));
    linhas.push({ estatistica: col, ...r });
  }
  const [g] = await q(conta(PARES_GOL));
  linhas.push({ estatistica: 'gols (régua)', ...g });

  console.log('\nPERSISTÊNCIA — metade 1 x metade 2 dos jogos do time (>= 30 jogos)');
  console.log('Abaixo de 0,4 não existe premissa estrutural possível.');
  console.table(linhas.sort((a, b) => Number(b.a_favor) - Number(a.a_favor)));
}

/** Quanto dá para ordenar jogo — sempre ao lado da régua de gols. */
async function separacao() {
  const quintis = (pares, linha) => `${pit(pares)},
    q5 as (select *, ntile(5) over (order by prev) quintil from jogo)
    select quintil, count(*) jogos,
      round(avg(prev)::numeric,2) previsto, round(avg(total)::numeric,2) real,
      round(100.0 * sum(case when total > ${linha} then 1 else 0 end) / count(*), 1) pct_acima
    from q5 group by 1 order by 1`;

  const esc = await q(quintis(PARES_ESCANTEIO, 9.5));
  console.log('\nESCANTEIOS — quintis da previsão point-in-time (linha 9,5)');
  console.table(esc);

  const gol = await q(quintis(PARES_GOL, 2.5));
  console.log('\nGOLS — a mesma conta, como régua (linha 2,5)');
  console.table(gol);

  const spread = (t) => Number(t.at(-1).pct_acima) - Number(t[0].pct_acima);
  console.log(`\nSeparação entre o 1º e o 5º quintil: escanteio ${spread(esc).toFixed(1)}pp · gol ${spread(gol).toFixed(1)}pp`);
}

/**
 * Escanteio não é um mercado, são cinco. Cada um pede um insumo diferente, e o
 * saldo — que é o do handicap — persiste MAIS que as duas pontas que o formam.
 */
async function porMercado() {
  const [saldo] = await q(`
    with pares as (${PARES_ESCANTEIO}), ord as (
      select *, row_number() over (partition by team_id order by date_utc) rn,
             count(*) over (partition by team_id) tot from pares
    ), met as (
      select team_id, avg(case when rn <= tot/2 then saldo end) a1,
             avg(case when rn > tot/2 then saldo end) a2, max(tot) tot
      from ord group by 1)
    select round(corr(a1,a2)::numeric,3) persistencia from met where tot >= 30`);

  const mando = await q(`
    with pares as (${PARES_ESCANTEIO}), ord as (
      select *, row_number() over (partition by team_id, lado order by date_utc) rn,
             count(*) over (partition by team_id, lado) tot from pares
    ), met as (
      select team_id, lado, avg(case when rn <= tot/2 then feitos end) f1,
             avg(case when rn > tot/2 then feitos end) f2, max(tot) tot
      from ord group by 1,2)
    select lado, round(corr(f1,f2)::numeric,3) persistencia from met where tot >= 20 group by 1`);

  const [tempo] = await q(`
    select count(*) colunas_de_escanteio from information_schema.columns
    where table_schema = 'futebol' and column_name ilike '%corner%'`);

  console.log('\nOS CINCO MERCADOS DE ESCANTEIO — persistência do insumo de cada um');
  console.table([
    { id: 56, mercado: 'Handicap de escanteios', insumo: 'saldo', persistencia: saldo.persistencia },
    { id: 45, mercado: 'Total do jogo', insumo: 'a favor + sofridos', persistencia: 'ver acima' },
    { id: 57, mercado: 'Escanteios do mandante', insumo: 'a favor em casa', persistencia: mando.find((r) => r.lado === 'home')?.persistencia },
    { id: 58, mercado: 'Escanteios do visitante', insumo: 'a favor fora', persistencia: mando.find((r) => r.lado === 'away')?.persistencia },
    { id: 77, mercado: 'Total do 1º tempo', insumo: 'escanteio por tempo', persistencia: 'SEM INSUMO' },
  ]);
  console.log(`A base inteira tem ${tempo.colunas_de_escanteio} coluna de escanteio, e ela é do jogo completo.`);
}

/** A separação do handicap, que é a que inverte a ordem óbvia. */
async function separacaoHandicap() {
  const quintis = (pares, coberto) => `
    with pares as (${pares}), pit as (
      select *, avg(saldo) over (partition by team_id order by date_utc rows between 10 preceding and 1 preceding) m,
             count(*) over (partition by team_id order by date_utc rows between 10 preceding and 1 preceding) n
      from pares
    ), jogo as (
      select h.saldo real, (h.m - a.m) / 2.0 prev
      from pit h join pit a on a.fixture_id = h.fixture_id and a.lado = 'away'
      where h.lado = 'home' and h.n >= 10 and a.n >= 10
    ), q5 as (select *, ntile(5) over (order by prev) quintil from jogo)
    select quintil, count(*) jogos, round(avg(prev)::numeric,2) previsto,
      round(avg(real)::numeric,2) saldo_real,
      round(100.0 * sum(case when real > ${coberto} then 1 else 0 end) / count(*), 1) pct_acima
    from q5 group by 1 order by 1`;

  const esc = await q(quintis(PARES_ESCANTEIO, 0.5));
  console.log('\nHANDICAP DE ESCANTEIO — quintis da supremacia prevista (mandante cobre o −0,5)');
  console.table(esc);

  const paresGol = `
    select fixture_id, date_utc, home_team_id team_id, 'home' lado, goals_home - goals_away saldo
    from futebol.fact_fixtures where status_short = 'FT' and goals_home is not null
    union all
    select fixture_id, date_utc, away_team_id, 'away', goals_away - goals_home
    from futebol.fact_fixtures where status_short = 'FT' and goals_home is not null`;
  const gol = await q(quintis(paresGol, 0.5));
  console.log('\nHANDICAP DE GOLS — a mesma conta, como régua');
  console.table(gol);

  const spread = (t) => Number(t.at(-1).pct_acima) - Number(t[0].pct_acima);
  console.log(`\nSeparação: handicap de escanteio ${spread(esc).toFixed(1)}pp · handicap de gol ${spread(gol).toFixed(1)}pp`);
}

/**
 * Os cortes do catálogo. Saem da distribuição da nossa base — p75, mediana,
 * quartil —, o que decide quantas vezes a premissa acende, não se ela vale.
 * O que ela vale é a fase 5, e ela precisa de odds.
 */
async function limiares() {
  const t = await q(`
    with pares as (${PARES_ESCANTEIO}), m as (
      select team_id, lado, avg(feitos) mf, avg(sofridos) ms, avg(saldo) msa
      from pares group by 1,2 having count(*) >= 15)
    select lado,
      round(percentile_cont(0.50) within group (order by mf)::numeric,2)  a_favor_mediana,
      round(percentile_cont(0.75) within group (order by ms)::numeric,2)  sofridos_p75,
      round(percentile_cont(0.25) within group (order by msa)::numeric,2) saldo_p25,
      round(percentile_cont(0.75) within group (order by msa)::numeric,2) saldo_p75
    from m group by 1`);
  console.log('\nLIMIARES MEDIDOS, por mando (times com >= 15 jogos no lado)');
  console.table(t);

  const [j] = await q(`
    with pares as (${PARES_ESCANTEIO}), jogo as (
      select h.chutes + a.chutes chutes_total, abs(h.posse - a.posse) gap_posse
      from pares h join pares a on a.fixture_id = h.fixture_id and a.lado = 'away'
      where h.lado = 'home')
    select round(percentile_cont(0.50) within group (order by chutes_total)::numeric,1) chutes_mediana,
           round(percentile_cont(0.75) within group (order by chutes_total)::numeric,1) chutes_p75,
           round(percentile_cont(0.50) within group (order by gap_posse)::numeric,1) gap_posse_mediana,
           round(percentile_cont(0.75) within group (order by gap_posse)::numeric,1) gap_posse_p75
    from jogo`);
  console.log('\nPOR JOGO — finalizações somadas e diferença de posse');
  console.table([j]);

  // A premissa de estilo que morreu na fase 3: a razão quase não varia entre times.
  const [r] = await q(`
    with pares as (
      select a.team_id, a.corner_kicks feitos, a.total_shots chutes
      from futebol.fact_fixture_stats a
      join futebol.fact_fixture_stats b on b.fixture_id = a.fixture_id and b.team_id <> a.team_id
      where a.corner_kicks is not null and a.total_shots > 0
    ), m as (select team_id, sum(feitos)::numeric / sum(chutes) r from pares group by 1 having count(*) >= 30)
    select round(percentile_cont(0.10) within group (order by r)::numeric,3) p10,
           round(percentile_cont(0.50) within group (order by r)::numeric,3) mediana,
           round(percentile_cont(0.90) within group (order by r)::numeric,3) p90,
           round(stddev(r)::numeric,3) desvio
    from m`);
  console.log('\nESCANTEIOS POR FINALIZAÇÃO — a premissa de estilo, cortada na fase 3');
  console.log('Quase não varia entre times: é constante do futebol, não traço de time.');
  console.table([r]);
}

await cobertura();
await persistencia();
await porMercado();
await separacao();
await separacaoHandicap();
await limiares();
