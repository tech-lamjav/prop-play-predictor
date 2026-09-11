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
         a.corner_kicks feitos, b.corner_kicks sofridos
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

await cobertura();
await persistencia();
await separacao();
