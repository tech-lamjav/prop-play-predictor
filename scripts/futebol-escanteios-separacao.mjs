/**
 * Escanteios — o catálogo testado contra o ESCANTEIO REAL, sem odd.
 *
 * Reproduz os números entregues ao Mateus em 25/09/2026 (task do ClickUp do
 * Total de escanteios) e o corpo da issue #448: o catálogo refinado, o peso de
 * cada premissa nos dois lados, a prova fora da amostra e a simulação.
 *
 * Uso (o token é o mesmo SUPABASE_ACCESS_TOKEN do .env.local):
 *   SUPABASE_ACCESS_TOKEN=... node scripts/futebol-escanteios-separacao.mjs
 *
 * ── Por que este script existe ──────────────────────────────────────────────
 *
 * Porque os números dele já foram enviados a outra pessoa. Pelo princípio que o
 * `futebol-escanteios-total.mjs` declara no cabeçalho — um número que ninguém
 * consegue refazer não é um número, é uma lembrança —, medição que virou pedido
 * precisa ser reproduzível por quem recebeu o pedido.
 *
 * ── A pergunta que ele responde, e a que ele NÃO responde ───────────────────
 *
 * O `futebol-escanteios-total.mjs` mede ROI: a premissa dá lucro nessa odd? Essa
 * pergunta precisa de preço, e o preço só existe desde 16/06/2026 — conferido no
 * banco, não deduzido de documento. São ~636 jogos.
 *
 * Este script mede outra coisa: a premissa separa jogo de muito escanteio? Isso
 * não precisa de odd nenhuma, e roda sobre 6.088 jogos desde fevereiro de 2024.
 *
 * As duas perguntas dão respostas diferentes, e é esse o achado: o catálogo
 * separa escanteio fora da amostra e mesmo assim não dá lucro. Sinal real que o
 * preço já contém.
 *
 * ── Quatro armadilhas, e elas continuam valendo ─────────────────────────────
 *
 * 1. POINT-IN-TIME. Toda média usa os 10 jogos ANTERIORES, nunca o próprio jogo.
 *    É o `l.kickoff_utc < t.kickoff_utc` implícito no `rows between 10 preceding
 *    and 1 preceding`. Sem isso a medição lê o futuro e infla tudo.
 *
 * 2. O PAR DO JOGO. Escanteio SOFRIDO por um time é o FEITO pelo outro na mesma
 *    partida. Sai do self-join por fixture_id com team_id diferente — nunca de
 *    uma coluna própria. Validado: bate nas 16.474 linhas, sem exceção.
 *
 * 3. CORTES E PESOS SAEM DA PRIMEIRA METADE. Escolher premissa e medir na mesma
 *    amostra é o erro que derrubou a metodologia original. Tudo que este script
 *    reporta como PROVA roda na segunda metade, sobre jogos que não participaram
 *    de nenhuma escolha.
 *
 * 4. xG É OPCIONAL. Falta em 16% das linhas. O `avg()` de janela ignora nulo por
 *    construção, então o insumo que falta some e o jogo fica. Descartar o jogo
 *    tiraria centenas de partidas sem motivo.
 *
 * ── Uma divergência deliberada do script irmão ──────────────────────────────
 *
 * O `futebol-escanteios-total.mjs` calcula o PIT em JavaScript porque a CTE
 * equivalente estourava o tempo da API. Aqui o PIT é SQL mesmo: foi o SQL que
 * produziu os números enviados, e reescrever em JS arriscaria divergir em
 * detalhe (método de percentil, tratamento de nulo) e imprimir número diferente
 * do que já foi entregue. Se voltar a estourar o tempo, o caminho é paginar,
 * não reescrever.
 */

const PROJETO = process.env.SUPABASE_PROJECT_REF || 'kpbjuplcwiyrymafhehz';
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
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
  return JSON.parse(t);
}

// ---------------------------------------------------------------------------
// A base: insumos point-in-time e o catálogo por jogo
// ---------------------------------------------------------------------------
// Emite `elegiveis`: uma linha por jogo encerrado, com o valor de cada premissa
// e o total de escanteios que de fato aconteceu. Já filtrada pelo piso de dez
// jogos anteriores para os DOIS times — o mesmo piso que o mart aplica.

const BASE = `
with log as (
  select s.fixture_id, s.team_id, s.team_side, f.kickoff_utc, f.competition_id, f.round,
         s.corner_kicks as ck, b.corner_kicks as sof, s.ball_possession as po,
         s.expected_goals as xg, s.shots_insidebox as ib, s.total_shots as ts,
         s.shots_outsidebox as ob, s.blocked_shots as bl,
         s.goalkeeper_saves as gs, s.fouls as fl
  from futebol.fact_fixture_stats s
  join futebol.fact_fixture_stats b on b.fixture_id=s.fixture_id and b.team_id<>s.team_id
  join futebol.fact_fixtures f on f.fixture_id=s.fixture_id
  where f.status_short='FT'
),
pit as (
  select fixture_id, team_id, team_side,
    avg(ck) over w10 as ck10, avg(sof) over w10 as sof10, avg(po) over w10 as po10,
    avg(xg) over w10 as xg10, avg(ib) over w10 as ib10, avg(ts) over w10 as ts10,
    avg(ob) over w10 as ob10, avg(bl) over w10 as bl10, avg(gs) over w10 as gs10,
    avg(fl) over w10 as fl10, count(*) over w10 as jogados,
    avg(ck) over w5 as ck5, avg(sof) over w5 as sof5
  from log
  window w10 as (partition by team_id order by kickoff_utc, fixture_id rows between 10 preceding and 1 preceding),
         w5  as (partition by team_id, team_side order by kickoff_utc, fixture_id rows between 5 preceding and 1 preceding)
),
tot as (
  select l.fixture_id, l.kickoff_utc, l.competition_id, l.round, sum(l.ck) as total_ck
  from log l group by 1,2,3,4
),
compmedia as (
  select fixture_id,
         avg(total_ck) over (partition by competition_id order by kickoff_utc, fixture_id
                             rows between unbounded preceding and 1 preceding) as comp_media,
         count(*) over (partition by competition_id order by kickoff_utc, fixture_id
                        rows between unbounded preceding and 1 preceding) as comp_n
  from tot
),
rodadas as (
  select competition_id, season, max(cast(substring(round from '(\\d+)$') as int)) as total_rodadas
  from futebol.fact_fixtures where round like 'Regular Season%' group by 1,2
),
jogo as (
  select t.fixture_id, t.total_ck, least(h.jogados, a.jogados) as min_jogos,
    (h.ck10 + a.ck10)                                   as ataque_de_escanteio,
    (h.sof10 + a.sof10)                                 as defesa_que_cede,
    (h.ts10 + a.ts10)                                   as volume_de_finalizacao,
    (h.ob10 + a.ob10)                                   as finalizacao_de_fora,
    (h.ib10 + a.ib10)                                   as finalizacao_na_area,
    (h.bl10 + a.bl10)                                   as bloqueios,
    (h.gs10 + a.gs10)                                   as defesas_do_goleiro,
    (h.fl10 + a.fl10)                                   as jogo_faltoso,
    (h.ob10/nullif(h.ts10,0) + a.ob10/nullif(a.ts10,0)) as chute_de_longe,
    abs(h.po10 - a.po10)                                as desequilibrio_de_posse,
    h.ck5                                               as pressao_do_mandante,
    a.sof5                                              as visitante_que_cede,
    case when cm.comp_n >= 30 then cm.comp_media end    as campeonato_de_escanteio,
    (h.ck10 + a.sof10 + a.ck10 + h.sof10)/2.0           as escanteio_previsto,
    (h.xg10 + a.xg10)                                   as chance_de_gol,
    (lower(t.round) ~ 'final|semi|quarter|round of|play-?off|3rd place') as mata_mata,
    (r.total_rodadas >= 20
      and cast(substring(t.round from '(\\d+)$') as int) >= r.total_rodadas - 6
      and t.round like 'Regular Season%')               as reta_final
  from tot t
  join pit h on h.fixture_id=t.fixture_id and h.team_side='home'
  join pit a on a.fixture_id=t.fixture_id and a.team_side='away'
  join compmedia cm on cm.fixture_id=t.fixture_id
  left join futebol.fact_fixtures f on f.fixture_id=t.fixture_id
  left join rodadas r on r.competition_id=f.competition_id and r.season=f.season
),
elegiveis as (select * from jogo where min_jogos >= 10)
`;

/** As quinze premissas numéricas, na ordem em que o catálogo as declara. */
const NUMERICAS = [
  'escanteio_previsto', 'finalizacao_de_fora', 'campeonato_de_escanteio',
  'defesa_que_cede', 'chute_de_longe', 'ataque_de_escanteio', 'visitante_que_cede',
  'bloqueios', 'pressao_do_mandante', 'defesas_do_goleiro', 'volume_de_finalizacao',
  'finalizacao_na_area', 'desequilibrio_de_posse', 'chance_de_gol', 'jogo_faltoso',
];

/** Empilha as premissas numa coluna só, para medir todas na mesma varredura. */
const empilhar = (origem) =>
  NUMERICAS.map((p) => `select total_ck, '${p}' p, ${p} v from ${origem}`).join(' union all ');

const f2 = (x) => (x == null ? '    —' : Number(x).toFixed(2).padStart(6));
const f1 = (x) => (x == null ? '   —' : Number(x).toFixed(1).padStart(5));
const i = (x) => String(x ?? '—').padStart(6);
const risco = (n = 84) => '─'.repeat(n);

async function main() {
  console.log(`\n${risco()}\nESCANTEIOS — O CATÁLOGO CONTRA O ESCANTEIO REAL\n${risco()}`);
  console.log(`projeto ${PROJETO}`);

  // -------------------------------------------------------------------------
  // 1. Universo e validações
  // -------------------------------------------------------------------------
  const [u] = await q(`${BASE}
    select count(*) as jogos, count(*) filter (where min_jogos >= 10) as elegiveis,
           round(avg(total_ck) filter (where min_jogos >= 10)::numeric,2) as media,
           round(stddev_samp(total_ck) filter (where min_jogos >= 10)::numeric,2) as desvio
    from jogo`);

  const [v] = await q(`
    with log as (
      select s.fixture_id, s.team_id, s.corner_kicks as cf, b.corner_kicks as ca
      from futebol.fact_fixture_stats s
      join futebol.fact_fixture_stats b on b.fixture_id=s.fixture_id and b.team_id<>s.team_id
      join futebol.fact_fixtures f on f.fixture_id=s.fixture_id
      where f.status_short='FT'
    )
    select count(*) as linhas,
           count(*) filter (where ca is distinct from (
             select cf from log l2 where l2.fixture_id=l.fixture_id and l2.team_id<>l.team_id
           )) as divergentes
    from log l`);

  console.log(`\n1. UNIVERSO`);
  console.log(`   jogos com estatística ....... ${i(u.jogos)}`);
  console.log(`   elegíveis (piso de 10) ...... ${i(u.elegiveis)}`);
  console.log(`   escanteios por jogo ......... ${f2(u.media)}  (desvio ${f2(u.desvio)})`);
  console.log(`\n   validação do par do jogo: ${v.divergentes} divergências em ${v.linhas} linhas`
    + `${Number(v.divergentes) === 0 ? '  ✓' : '  ⚠️  O SELF-JOIN ESTÁ ERRADO'}`);

  // -------------------------------------------------------------------------
  // 2. Separação de cada premissa, nos dois lados
  // -------------------------------------------------------------------------
  const sep = await q(`${BASE}
    , longo as (${empilhar('elegiveis')})
    , cortes as (
      select p, percentile_cont(2.0/3) within group (order by v) as alto,
                percentile_cont(1.0/3) within group (order by v) as baixo
      from longo where v is not null group by 1
    )
    select l.p as premissa,
      round((avg(l.total_ck) filter (where l.v >= c.alto)
           - avg(l.total_ck) filter (where l.v <  c.alto))::numeric,2) as dif_mais,
      round(((avg(l.total_ck) filter (where l.v >= c.alto) - avg(l.total_ck) filter (where l.v < c.alto))
        / sqrt(var_samp(l.total_ck) filter (where l.v >= c.alto)/count(*) filter (where l.v >= c.alto)
             + var_samp(l.total_ck) filter (where l.v <  c.alto)/count(*) filter (where l.v <  c.alto)))::numeric,1) as t_mais,
      round((avg(l.total_ck) filter (where l.v <= c.baixo)
           - avg(l.total_ck) filter (where l.v >  c.baixo))::numeric,2) as dif_menos,
      round(((avg(l.total_ck) filter (where l.v <= c.baixo) - avg(l.total_ck) filter (where l.v > c.baixo))
        / sqrt(var_samp(l.total_ck) filter (where l.v <= c.baixo)/count(*) filter (where l.v <= c.baixo)
             + var_samp(l.total_ck) filter (where l.v >  c.baixo)/count(*) filter (where l.v >  c.baixo)))::numeric,1) as t_menos
    from longo l join cortes c on c.p=l.p where l.v is not null
    group by 1 order by 2 desc`);

  console.log(`\n${risco()}\n2. SEPARAÇÃO POR PREMISSA  (escanteios a mais no jogo quando acende)\n${risco()}`);
  console.log(`   |t| acima de 2 é sinal; abaixo é ruído. No lado Menos o certo é NEGATIVO.\n`);
  console.log(`   ${'premissa'.padEnd(26)}${'Mais'.padStart(8)}${'t'.padStart(7)}${'Menos'.padStart(9)}${'t'.padStart(7)}`);
  for (const r of sep) {
    const marca = Math.abs(Number(r.t_mais)) < 2 && Math.abs(Number(r.t_menos)) < 2 ? '  ← sai' : '';
    console.log(`   ${r.premissa.padEnd(26)}${f2(r.dif_mais)}${f1(r.t_mais)}${f2(r.dif_menos).padStart(9)}${f1(r.t_menos)}${marca}`);
  }

  const bool = await q(`${BASE}
    select 'mata_mata' as premissa, count(*) filter (where mata_mata) as n,
      round((avg(total_ck) filter (where mata_mata) - avg(total_ck) filter (where not mata_mata))::numeric,2) as dif
    from elegiveis
    union all
    select 'reta_final', count(*) filter (where reta_final),
      round((avg(total_ck) filter (where reta_final) - avg(total_ck) filter (where not reta_final))::numeric,2)
    from elegiveis`);

  console.log(`\n   as duas booleanas:`);
  for (const r of bool) console.log(`   ${r.premissa.padEnd(26)}${f2(r.dif)}   em ${r.n} jogos`);
  console.log(`\n   ⚠️  reta_final acende ZERO vezes na janela de preço e ${bool.find((x) => x.premissa === 'reta_final')?.n} vezes aqui.`);
  console.log(`      Ela é invisível na janela de odd, não inexistente.`);

  // -------------------------------------------------------------------------
  // 3. Pesos, derivados SÓ na primeira metade
  // -------------------------------------------------------------------------
  const META = `${BASE}
    , comdata as (
      select e.*, ntile(2) over (order by f.kickoff_utc, e.fixture_id) as metade
      from elegiveis e join futebol.fact_fixtures f on f.fixture_id=e.fixture_id
    )`;

  const pesos = await q(`${META}
    , h1 as (select * from comdata where metade=1)
    , longo as (${empilhar('h1')})
    , c as (
      select p, percentile_cont(2.0/3) within group (order by v) as alto,
                percentile_cont(1.0/3) within group (order by v) as baixo
      from longo where v is not null group by 1
    )
    select l.p as premissa,
      greatest(round((avg(l.total_ck) filter (where l.v >= c.alto)
             - avg(l.total_ck) filter (where l.v <  c.alto))::numeric * 10, 0)::int, 0) as peso_mais,
      greatest(round(-(avg(l.total_ck) filter (where l.v <= c.baixo)
             - avg(l.total_ck) filter (where l.v >  c.baixo))::numeric * 10, 0)::int, 0) as peso_menos
    from longo l join c on c.p=l.p where l.v is not null
    group by 1 order by 2 desc, 3 desc`);

  const tetoMais = pesos.reduce((a, b) => a + Number(b.peso_mais), 0);
  const tetoMenos = pesos.reduce((a, b) => a + Number(b.peso_menos), 0);

  console.log(`\n${risco()}\n3. O CATÁLOGO REFINADO  —  peso = décimos de escanteio que a premissa move\n${risco()}`);
  console.log(`   Derivado SÓ na primeira metade do histórico. Peso 0 = fora do catálogo.\n`);
  console.log(`   ${'premissa'.padEnd(26)}${'Mais'.padStart(6)}${'Menos'.padStart(8)}`);
  for (const r of pesos) {
    const fora = Number(r.peso_mais) === 0 && Number(r.peso_menos) === 0;
    console.log(`   ${r.premissa.padEnd(26)}${i(r.peso_mais).slice(-6)}${i(r.peso_menos).slice(-8)}${fora ? '   ← sai' : ''}`);
  }
  console.log(`   ${'TETO'.padEnd(26)}${i(tetoMais).slice(-6)}${i(tetoMenos).slice(-8)}`);

  // -------------------------------------------------------------------------
  // 4. A prova: fora da amostra
  // -------------------------------------------------------------------------
  // Cortes da primeira metade aplicados à segunda. O score usa os pesos acima;
  // o `case` por premissa é montado aqui para o SQL não depender de ordem.
  const corteSql = NUMERICAS.map((p) => `
      percentile_cont(2.0/3) within group (order by ${p}) as ${p}_a,
      percentile_cont(1.0/3) within group (order by ${p}) as ${p}_b`).join(',');

  const pesoDe = Object.fromEntries(pesos.map((r) => [r.premissa, r]));
  const somaMais = NUMERICAS.filter((p) => Number(pesoDe[p].peso_mais) > 0)
    .map((p) => `case when e.${p} >= c.${p}_a then ${pesoDe[p].peso_mais} else 0 end`).join(' + ');
  const somaMenos = NUMERICAS.filter((p) => Number(pesoDe[p].peso_menos) > 0)
    .map((p) => `case when e.${p} <= c.${p}_b then ${pesoDe[p].peso_menos} else 0 end`).join(' + ');

  const FORA = `${META}
    , c as (select ${corteSql} from comdata where metade=1)
    , fora as (
      select e.total_ck,
             (${somaMais}) * 100.0/${tetoMais}  as nota_mais,
             (${somaMenos}) * 100.0/${tetoMenos} as nota_menos
      from comdata e cross join c where e.metade=2
    )`;

  const faixas = await q(`${FORA}
    select 'Mais' as lado,
      case when nota_mais>=60 then '3_Alta' when nota_mais>=30 then '2_Media' else '1_Baixa' end as faixa,
      count(*) as jogos, round(avg(total_ck)::numeric,2) as escanteios,
      round(100.0*count(*) filter (where total_ck>9.5)/count(*),1) as acerto
    from fora group by 1,2
    union all
    select 'Menos',
      case when nota_menos>=60 then '3_Alta' when nota_menos>=30 then '2_Media' else '1_Baixa' end,
      count(*), round(avg(total_ck)::numeric,2),
      round(100.0*count(*) filter (where total_ck<9.5)/count(*),1)
    from fora group by 1,2
    order by 1,2`);

  console.log(`\n${risco()}\n4. FORA DA AMOSTRA  —  cortes e pesos da 1ª metade, medido na 2ª\n${risco()}`);
  console.log(`   acerto = contra linha fixa de 9,5 · equilíbrio 52,6% na odd 1,90 · base 49,2%\n`);
  console.log(`   ${'lado'.padEnd(8)}${'faixa'.padEnd(10)}${'jogos'.padStart(7)}${'escanteios'.padStart(12)}${'acerto'.padStart(9)}`);
  for (const r of faixas) {
    console.log(`   ${r.lado.padEnd(8)}${r.faixa.slice(2).padEnd(10)}${i(r.jogos).slice(-7)}${f2(r.escanteios).padStart(12)}${(r.acerto + '%').padStart(9)}`);
  }

  // -------------------------------------------------------------------------
  // 5. Por que o acerto acima NÃO é ROI
  // -------------------------------------------------------------------------
  const linha = await q(`${META}
    , c as (select ${corteSql} from comdata where metade=1)
    , todas as (
      select e.fixture_id, e.total_ck, e.escanteio_previsto,
             (${somaMais}) * 100.0/${tetoMais} as nota_mais
      from comdata e cross join c
    )
    , mercado as (
      select fixture_id, (array_agg(line_value order by abs(odd_decimal-2.00)))[1] as principal
      from futebol.fact_odds_snapshot
      where market_id = 45 and odd_decimal is not null
      group by 1
    )
    select case when t.nota_mais>=60 then '3_Alta' when t.nota_mais>=30 then '2_Media' else '1_Baixa' end as faixa,
           count(*) as jogos,
           round(avg(m.principal)::numeric,2) as linha_da_casa,
           round(avg(t.escanteio_previsto)::numeric,2) as nossa_previsao,
           round(avg(t.total_ck)::numeric,2) as escanteio_real
    from todas t join mercado m on m.fixture_id=t.fixture_id
    group by 1 order by 1`);

  console.log(`\n${risco()}\n5. ⚠️  O ACERTO ACIMA NÃO É ROI  —  a linha da casa acompanha o nosso score\n${risco()}`);
  console.log(`   ${'faixa'.padEnd(10)}${'jogos'.padStart(7)}${'linha da casa'.padStart(15)}${'nossa previsão'.padStart(16)}${'real'.padStart(8)}`);
  for (const r of linha) {
    console.log(`   ${r.faixa.slice(2).padEnd(10)}${i(r.jogos).slice(-7)}${f2(r.linha_da_casa).padStart(15)}${f2(r.nossa_previsao).padStart(16)}${f2(r.escanteio_real).padStart(8)}`);
  }
  console.log(`\n   Onde o catálogo diz "poucos escanteios", a casa abre a linha lá embaixo — não em 9,5.`);
  console.log(`   A simulação da seção 4 aposta contra uma linha que não existe naquele preço.`);
  console.log(`\n   ⚠️  Amostra pequena: no espelho de desenvolvimento a odd é podada em 14 dias`);
  console.log(`      (data-engineering#75/#76). Produção tem o histórico desde 16/06/2026.`);

  // -------------------------------------------------------------------------
  // 6. A pergunta que sobra
  // -------------------------------------------------------------------------
  const residuo = await q(`${META}
    , c as (select ${corteSql} from comdata where metade=1)
    , fora as (
      select e.total_ck, e.escanteio_previsto,
             (${somaMais}) * 100.0/${tetoMais} as nota_mais,
             ntile(3) over (order by e.escanteio_previsto) as faixa_prev
      from comdata e cross join c where e.metade=2
    )
    select faixa_prev,
           round(avg(total_ck) filter (where nota_mais>=30)::numeric,2) as resto_alto,
           round(avg(total_ck) filter (where nota_mais< 30)::numeric,2) as resto_baixo,
           round((avg(total_ck) filter (where nota_mais>=30)
                - avg(total_ck) filter (where nota_mais<30))::numeric,2) as ganho
    from fora group by 1 order by 1`);

  // O mesmo teste pelo recorte que foi entregue em 25/09: as SEIS premissas de
  // maior separação, sem peso, em três faixas de contagem. O recorte muda a
  // magnitude e não muda a conclusão — e está aqui para que quem receba os
  // números de 25/09 consiga refazê-los exatamente.
  const seis = ['escanteio_previsto', 'campeonato_de_escanteio', 'ataque_de_escanteio',
    'visitante_que_cede', 'defesa_que_cede', 'finalizacao_de_fora'];
  const contaSeis = seis.map((p) => `case when e.${p} >= c.${p}_a then 1 else 0 end`).join(' + ');

  const residuo6 = await q(`${META}
    , c as (select ${corteSql} from comdata where metade=1)
    , fora as (
      select e.total_ck, (${contaSeis}) as ref,
             ntile(3) over (order by e.escanteio_previsto) as faixa_prev
      from comdata e cross join c where e.metade=2
    )
    select faixa_prev,
           round(avg(total_ck) filter (where ref<=1)::numeric,2)            as baixo,
           round(avg(total_ck) filter (where ref between 2 and 3)::numeric,2) as medio,
           round(avg(total_ck) filter (where ref>=4)::numeric,2)            as alto
    from fora group by 1 order by 1`);

  console.log(`\n${risco()}\n6. A PERGUNTA QUE SOBRA  —  o catálogo separa ALÉM do escanteio previsto?\n${risco()}`);
  const nome = { 1: 'baixo', 2: 'médio', 3: 'alto' };

  console.log(`\n   a) catálogo de 11 premissas COM peso, corte em 30 pontos\n`);
  console.log(`   ${'faixa do previsto'.padEnd(20)}${'resto alto'.padStart(12)}${'resto baixo'.padStart(13)}${'ganho'.padStart(8)}`);
  for (const r of residuo) {
    console.log(`   ${('previsto ' + nome[r.faixa_prev]).padEnd(20)}${f2(r.resto_alto).padStart(12)}${f2(r.resto_baixo).padStart(13)}${f2(r.ganho).padStart(8)}`);
  }

  console.log(`\n   b) as 6 de maior separação, SEM peso — o recorte entregue em 25/09\n`);
  console.log(`   ${'faixa do previsto'.padEnd(20)}${'0-1'.padStart(8)}${'2-3'.padStart(8)}${'4-6'.padStart(8)}`);
  for (const r of residuo6) {
    console.log(`   ${('previsto ' + nome[r.faixa_prev]).padEnd(20)}${f2(r.baixo).padStart(8)}${f2(r.medio).padStart(8)}${f2(r.alto).padStart(8)}`);
  }
  console.log(`\n   Os dois recortes dão a mesma conclusão com magnitudes diferentes — o que`);
  console.log(`   mostra que ela não depende de onde se corta.`);
  console.log(`\n   O catálogo separa dentro de toda faixa do previsto. Se essa sobra NÃO estiver`);
  console.log(`   na linha da casa, existe borda. Se estiver, o mercado ganhou.`);
  console.log(`\n   Isso é o teste do resíduo, e ele precisa da odd de PRODUÇÃO:`);
  console.log(`      escanteio_real − linha_principal, e o score prevê esse resíduo?`);
  console.log(`\n   Pedido em aberto: issue #448 · task do ClickUp do Total de escanteios.\n`);
}

main().catch((e) => {
  console.error(`\nfalhou: ${e.message}`);
  process.exit(1);
});
