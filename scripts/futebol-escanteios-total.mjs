/**
 * Total de escanteios (mercado 45) — a medição completa da metodologia.
 *
 * Reproduz todos os números de docs/futebol-metodologia-escanteios-total.md:
 * o catálogo das 18 premissas, o ganho de cada uma por lado, a tabela de pesos
 * e o ROI por faixa de score dentro e fora da amostra.
 *
 * Uso (o token é o mesmo SUPABASE_ACCESS_TOKEN do .env.local):
 *   SUPABASE_ACCESS_TOKEN=... node scripts/futebol-escanteios-total.mjs
 *
 * Existe porque a medição anterior deste mercado ficou num diretório temporário
 * do sistema. Um número que ninguém consegue refazer não é um número, é uma
 * lembrança.
 *
 * Seis armadilhas que este script evita, e que qualquer reescrita precisa
 * continuar evitando:
 *
 * 1. POINT-IN-TIME. Toda média de time usa os 10 jogos ANTERIORES, nunca a
 *    temporada inteira e nunca o próprio jogo. A auditoria do 1X2 achou 27 de
 *    39 premissas lendo dado de depois da partida; o ROI daquele mercado caiu
 *    de +9,7% para −7,6% quando isso foi corrigido.
 *
 * 2. O PAR DO JOGO. `fact_fixture_stats` tem uma linha por time por jogo. Os
 *    escanteios sofridos por um time são os feitos pelo outro na mesma partida.
 *    Sem o join por fixture_id, `sof` não existe.
 *
 * 3. O UNIVERSO. O mercado 45 é cotado em escada — 16 linhas por jogo. O
 *    produto publica UMA. Medir a escada inteira conta o mesmo jogo dezesseis
 *    vezes e infla todo ganho medido. A linha principal é a de odd mais perto
 *    de 2,00, por jogo e por lado.
 *
 * 4. xG É OPCIONAL. Falta em 15% das linhas. Quando falta, a premissa de xG não
 *    acende — o jogo NÃO é descartado. Descartar tira 750 partidas sem motivo.
 *
 * 5. OS CORTES NÃO SAEM DA AMOSTRA DE APOSTA. Os limiares vêm dos ~6 mil jogos
 *    com histórico, não dos ~400 que têm odd. Senão o corte depende de quais
 *    jogos por acaso foram cotados.
 *
 * 6. O ERRO PADRÃO É AGRUPADO POR JOGO. Duas linhas do mesmo jogo não são duas
 *    observações independentes.
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

// ---------------------------------------------------------------------------
// 1. Leitura
// ---------------------------------------------------------------------------
// O PIT é calculado aqui em JavaScript e não em SQL de propósito: a CTE
// equivalente, com uma window por estatística, estoura o timeout do Management
// API. Puxar as linhas cruas e agregar em memória é mais lento de escrever e
// muito mais rápido de rodar.

async function estatisticas() {
  const linhas = [];
  for (let off = 0; off < 60000; off += 5000) {
    const r = await q(`
      select s.fixture_id, s.date_utc, s.team_id, s.team_side lado,
             s.corner_kicks ck, s.ball_possession po, s.expected_goals xg,
             s.shots_insidebox ib, s.total_shots ts, s.shots_outsidebox ob,
             s.blocked_shots bl, s.goalkeeper_saves gs, s.fouls fl,
             f.round, f.competition
      from futebol.fact_fixture_stats s
      join futebol.fact_fixtures f on f.fixture_id = s.fixture_id
      where s.corner_kicks is not null
      order by s.date_utc, s.fixture_id, s.team_side
      limit 5000 offset ${off}`);
    linhas.push(...r);
    if (r.length < 5000) break;
  }
  return linhas;
}

/**
 * Só meia linha (9,5 e não 9,0 nem 9,25) e só com pelo menos três casas
 * cotando. Linha cheia devolve aposta no empate e sujaria o lucro; linha de
 * uma casa só é preço solto, não é mercado.
 */
const odds = () => q(`
  select fixture_id, outcome_side lado, line_value h, max(odd_decimal) odd
  from futebol.fact_odds_snapshot
  where market_id = 45 and collection_window = 't24h'
    and (line_value * 2) = floor(line_value * 2)
    and abs((line_value * 2)::int) % 2 = 1
  group by 1, 2, 3
  having count(distinct bookmaker_id) >= 3`);

// ---------------------------------------------------------------------------
// 2. Insumos point-in-time
// ---------------------------------------------------------------------------
const num = (x) => (x == null ? null : Number(x));

function construir(stats) {
  // [2] o par do jogo: escanteio sofrido é o feito pelo adversário
  const fx = new Map();
  for (const r of stats) {
    if (!fx.has(r.fixture_id)) fx.set(r.fixture_id, {});
    fx.get(r.fixture_id)[r.lado] = r;
  }
  for (const [, f] of fx) {
    if (f.home && f.away) { f.home.sof = num(f.away.ck); f.away.sof = num(f.home.ck); }
  }

  // fase do campeonato
  const maxRodada = new Map();
  const numRodada = (s) => { const m = /-\s*(\d+)\s*$/.exec(String(s || '')); return m ? Number(m[1]) : null; };
  for (const r of stats) {
    const k = numRodada(r.round);
    if (k != null) maxRodada.set(r.competition, Math.max(maxRodada.get(r.competition) || 0, k));
  }
  const MATA = /final|semi|quarter|round of|play-?off|3rd place/i;

  // [1] point-in-time: média dos 10 jogos anteriores do time
  const porTime = new Map();
  for (const r of stats) {
    if (!porTime.has(r.team_id)) porTime.set(r.team_id, []);
    porTime.get(r.team_id).push(r);
  }
  const pit = new Map();
  for (const [, js] of porTime) {
    js.sort((a, b) => String(a.date_utc).localeCompare(String(b.date_utc)));
    for (let i = 0; i < js.length; i++) {
      const jan = js.slice(Math.max(0, i - 10), i).filter((j) => j.sof != null);
      if (jan.length < 10) continue;
      const mesmoLado = js.slice(0, i).filter((j) => j.lado === js[i].lado && j.sof != null).slice(-5);
      // [4] tolera buraco: só devolve média se 60% da janela tem o campo
      const md = (arr, g) => {
        const v = arr.map(g).filter((x) => x != null && !Number.isNaN(x));
        return v.length >= Math.ceil(arr.length * 0.6) ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      pit.set(`${js[i].fixture_id}|${js[i].lado}`, {
        ck: md(jan, (j) => num(j.ck)), sof: md(jan, (j) => j.sof), po: md(jan, (j) => num(j.po)),
        ts: md(jan, (j) => num(j.ts)), ib: md(jan, (j) => num(j.ib)), ob: md(jan, (j) => num(j.ob)),
        bl: md(jan, (j) => num(j.bl)), gs: md(jan, (j) => num(j.gs)), fl: md(jan, (j) => num(j.fl)),
        xg: md(jan, (j) => num(j.xg)), // [4] pode ser null, e tudo bem
        ck_lado: mesmoLado.length >= 5 ? md(mesmoLado, (j) => num(j.ck)) : null,
        sof_lado: mesmoLado.length >= 5 ? md(mesmoLado, (j) => j.sof) : null,
      });
    }
  }

  // traço do campeonato, também point-in-time
  const porComp = new Map();
  for (const [, f] of fx) {
    if (!f.home || !f.away) continue;
    const c = f.home.competition;
    if (!porComp.has(c)) porComp.set(c, []);
    porComp.get(c).push({ d: f.home.date_utc, t: num(f.home.ck) + num(f.away.ck) });
  }
  for (const [, v] of porComp) v.sort((a, b) => String(a.d).localeCompare(String(b.d)));
  const compPit = (c, data) => {
    const v = porComp.get(c); if (!v) return null;
    const ant = v.filter((x) => String(x.d) < String(data));
    return ant.length < 30 ? null : ant.reduce((a, b) => a + b.t, 0) / ant.length;
  };

  const J = new Map();
  for (const [fid, f] of fx) {
    if (!f.home || !f.away) continue;
    const h = pit.get(`${fid}|home`), a = pit.get(`${fid}|away`);
    if (!h || !a) continue;
    const obrig = [h.ck, a.ck, h.sof, a.sof, h.po, a.po, h.ts, a.ts, h.ib, a.ib,
      h.ob, a.ob, h.bl, a.bl, h.gs, a.gs, h.fl, a.fl];
    if (obrig.some((x) => x == null)) continue;
    const rod = numRodada(f.home.round), max = maxRodada.get(f.home.competition);
    J.set(fid, {
      fid, data: f.home.date_utc, comp: f.home.competition,
      total: num(f.home.ck) + num(f.away.ck), h, a,
      mata: MATA.test(String(f.home.round || '')),
      reta: rod != null && max != null && max >= 20 ? rod >= max - 6 : false,
      comp_media: compPit(f.home.competition, f.home.date_utc),
    });
  }
  return J;
}

// ---------------------------------------------------------------------------
// 3. O catálogo
// ---------------------------------------------------------------------------
const soma = (h, a, c) => (h[c] == null || a[c] == null ? null : h[c] + a[c]);

const FAMILIAS = [
  ['ataque_de_escanteio', (j) => soma(j.h, j.a, 'ck')],
  ['defesa_que_cede', (j) => soma(j.h, j.a, 'sof')],
  ['volume_de_finalizacao', (j) => soma(j.h, j.a, 'ts')],
  ['finalizacao_de_fora', (j) => soma(j.h, j.a, 'ob')],
  ['finalizacao_na_area', (j) => soma(j.h, j.a, 'ib')],
  ['bloqueios', (j) => soma(j.h, j.a, 'bl')],
  ['defesas_do_goleiro', (j) => soma(j.h, j.a, 'gs')],
  ['jogo_faltoso', (j) => soma(j.h, j.a, 'fl')],
  ['chute_de_longe', (j) => j.h.ob / (j.h.ts || 1) + j.a.ob / (j.a.ts || 1)],
  ['desequilibrio_de_posse', (j) => Math.abs(j.h.po - j.a.po)],
  ['pressao_do_mandante', (j) => j.h.ck_lado],
  ['visitante_que_cede', (j) => j.a.sof_lado],
  ['campeonato_de_escanteio', (j) => j.comp_media],
  ['escanteio_previsto', (j) => (j.h.ck + j.a.sof + j.a.ck + j.h.sof) / 2],
  ['chance_de_gol', (j) => soma(j.h, j.a, 'xg')],
  ['previsao_x_linha', (j, l) => (j.h.ck + j.a.sof + j.a.ck + j.h.sof) / 2 - l.h],
];
const BOOLEANAS = [
  ['mata_mata', (j) => j.mata],
  ['reta_final', (j) => j.reta],
];
const TODAS = [...FAMILIAS.map((x) => x[0]), ...BOOLEANAS.map((x) => x[0])];

/** As nove premissas que sobreviveram em cada lado. Ver seção 3 do documento. */
const CATALOGO = {
  Mais: ['ataque_de_escanteio', 'jogo_faltoso', 'volume_de_finalizacao', 'defesa_que_cede',
    'finalizacao_na_area', 'campeonato_de_escanteio', 'pressao_do_mandante',
    'finalizacao_de_fora', 'defesas_do_goleiro'],
  Menos: ['volume_de_finalizacao', 'finalizacao_de_fora', 'jogo_faltoso', 'bloqueios',
    'finalizacao_na_area', 'campeonato_de_escanteio', 'previsao_x_linha',
    'chute_de_longe', 'desequilibrio_de_posse'],
};

// ---------------------------------------------------------------------------
// 4. Universo e ferramentas
// ---------------------------------------------------------------------------
const roi = (ls) => (ls.length ? (100 * ls.reduce((a, b) => a + b.lucro, 0)) / ls.length : null);

/** [6] erro padrão agrupado por jogo: duas linhas do mesmo jogo não são duas observações. */
const ep = (ls) => {
  const m = new Map();
  for (const l of ls) { if (!m.has(l.fid)) m.set(l.fid, []); m.get(l.fid).push(l.lucro); }
  const v = [...m.values()].map((x) => x.reduce((a, b) => a + b, 0) / x.length);
  if (v.length < 2) return null;
  const mu = v.reduce((a, b) => a + b, 0) / v.length;
  return (100 * Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1))) / Math.sqrt(v.length);
};
const f = (x) => (x == null ? '      —' : x.toFixed(2).padStart(7));
const jg = (ls) => new Set(ls.map((l) => l.fid)).size;

function universo(J, od) {
  // [5] os cortes saem de TODOS os jogos com histórico, não dos que têm odd
  const todos = [...J.values()];
  const pct = (arr, x) => {
    const s = arr.filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
    return s.length ? s[Math.floor(x * (s.length - 1))] : null;
  };
  const CORTE = {};
  for (const [nome, fn] of FAMILIAS) {
    if (nome === 'previsao_x_linha') { CORTE[nome] = { alto: 0.5, baixo: -0.5 }; continue; }
    const v = todos.map((j) => fn(j));
    CORTE[nome] = { alto: pct(v, 2 / 3), baixo: pct(v, 1 / 3) };
  }

  const escada = [];
  for (const o of od) {
    const j = J.get(o.fixture_id); if (!j) continue;
    const over = o.lado === 'Over', h = Number(o.h), odd = Number(o.odd);
    escada.push({
      fid: o.fixture_id, j, lado: over ? 'Mais' : 'Menos', over, h, odd,
      comp: j.comp, data: j.data,
      lucro: (over ? j.total > h : j.total < h) ? odd - 1 : -1,
    });
  }

  // [3] a linha principal: a de odd mais perto de 2,00, por jogo e por lado
  const escolha = new Map();
  for (const l of escada) {
    const k = `${l.fid}|${l.lado}`, at = escolha.get(k);
    if (!at || Math.abs(l.odd - 2) < Math.abs(at.odd - 2)) escolha.set(k, l);
  }
  const linhas = [...escolha.values()].sort((a, b) => String(a.data).localeCompare(String(b.data)));

  for (const l of linhas) {
    l.pr = {};
    for (const [nome, fn] of FAMILIAS) {
      const v = fn(l.j, l);
      l.pr[nome] = v == null || Number.isNaN(v) ? false
        : (l.over ? v >= CORTE[nome].alto : v <= CORTE[nome].baixo);
    }
    for (const [nome, fn] of BOOLEANAS) l.pr[nome] = !!fn(l.j);
  }
  return { linhas, escada, CORTE };
}

// ---------------------------------------------------------------------------
// 5. A regra de peso
// ---------------------------------------------------------------------------
/**
 * Três níveis pelo tamanho do ganho, multiplicados por três se a premissa ganha
 * nas DUAS metades do período.
 *
 * O peso NÃO é proporcional ao ganho de propósito. Ganho medido dentro da
 * amostra é o número mais contaminado que existe — a ADR 0001 mediu 14,5 pontos
 * de viés num caso análogo. Peso proporcional a ele é peso proporcional ao
 * ruído. Testado contra outras oito regras: esta é a única que faz o score
 * ordenar nos dois lados.
 */
function pesar(treino, lista) {
  const meio = treino[Math.floor(treino.length / 2)].data;
  const A = treino.filter((l) => String(l.data) <= meio);
  const B = treino.filter((l) => String(l.data) > meio);
  const ganhoEm = (ls, n) => {
    const on = ls.filter((l) => l.pr[n]), off = ls.filter((l) => !l.pr[n]);
    return on.length >= 10 && off.length >= 10 ? roi(on) - roi(off) : null;
  };
  const perfil = {};
  for (const n of lista) {
    const on = treino.filter((l) => l.pr[n]), off = treino.filter((l) => !l.pr[n]);
    if (on.length < 15 || off.length < 15) { perfil[n] = { g: 0, n: on.length, estavel: false }; continue; }
    const a = ganhoEm(A, n), b = ganhoEm(B, n);
    perfil[n] = { g: roi(on) - roi(off), n: on.length, estavel: a != null && b != null && a > 0 && b > 0 };
  }
  const positivas = lista.filter((n) => perfil[n].g > 0).sort((a, b) => perfil[b].g - perfil[a].g);
  const peso = {}, nivel = {};
  for (const n of lista) { peso[n] = 0; nivel[n] = '—'; }
  positivas.forEach((n, i) => {
    const t = i < positivas.length / 3 ? 3 : i < (2 * positivas.length) / 3 ? 2 : 1;
    peso[n] = perfil[n].estavel ? t * 3 : t;
    nivel[n] = `${t === 3 ? 'forte' : t === 2 ? 'media' : 'fraca'}${perfil[n].estavel ? ' + estavel' : ''}`;
  });
  return { peso, nivel, perfil, teto: Object.values(peso).reduce((a, b) => a + b, 0) };
}

const pontuar = (l, lista, m) =>
  (m.teto ? Math.round((100 * lista.reduce((a, k) => a + (l.pr[k] ? m.peso[k] : 0), 0)) / m.teto) : 0);
const faixaDe = (s) => (s >= 60 ? 'Alta' : s >= 30 ? 'Media' : 'Baixa');

// ---------------------------------------------------------------------------
// 6. Relatório
// ---------------------------------------------------------------------------
async function main() {
  console.log('lendo estatísticas e odds...');
  const [stats, od] = await Promise.all([estatisticas(), odds()]);
  const J = construir(stats);
  const { linhas, escada, CORTE } = universo(J, od);
  const lado = (k) => linhas.filter((l) => l.lado === k);

  console.log(`\n${'='.repeat(88)}\n1. O UNIVERSO\n${'='.repeat(88)}`);
  console.log(`  jogos com histórico completo : ${J.size}`);
  console.log(`  escada inteira               : ${escada.length} linhas em ${jg(escada)} jogos (${(escada.length / jg(escada)).toFixed(1)} por jogo)`);
  console.log(`  linha principal              : ${linhas.length} linhas em ${jg(linhas)} jogos`);
  console.log(`  odd média ${(linhas.reduce((a, b) => a + b.odd, 0) / linhas.length).toFixed(2)}  ·  linha média ${(linhas.reduce((a, b) => a + b.h, 0) / linhas.length).toFixed(2)}`);
  console.log(`  período ${linhas[0].data} a ${linhas[linhas.length - 1].data}`);
  console.log(`  ROI de apostar em tudo: ${f(roi(linhas))} (ep ${f(ep(linhas))})`);
  console.log(`    só Mais ${f(roi(lado('Mais')))}   ·   só Menos ${f(roi(lado('Menos')))}`);

  console.log(`\n${'='.repeat(88)}\n2. OS CORTES  (terço alto define o Mais, terço baixo define o Menos)\n${'='.repeat(88)}`);
  for (const [nome] of FAMILIAS) {
    const c = CORTE[nome];
    console.log(`  ${nome.padEnd(25)} Mais >= ${c.alto == null ? '   —' : c.alto.toFixed(2).padStart(6)}   Menos <= ${c.baixo == null ? '   —' : c.baixo.toFixed(2).padStart(6)}`);
  }

  console.log(`\n${'='.repeat(88)}\n3. O CATÁLOGO EXAUSTIVO  —  ganho de cada premissa, por lado\n${'='.repeat(88)}`);
  console.log('  premissa                  lado    jogos     ROI   apagada   ganho   met.1   met.2  veredito');
  for (const k of ['Mais', 'Menos']) {
    const b = lado(k), meio = b[Math.floor(b.length / 2)].data;
    const A = b.filter((l) => String(l.data) <= meio), B = b.filter((l) => String(l.data) > meio);
    const g = (ls, n) => {
      const on = ls.filter((l) => l.pr[n]), off = ls.filter((l) => !l.pr[n]);
      return on.length >= 10 && off.length >= 10 ? roi(on) - roi(off) : null;
    };
    for (const n of TODAS) {
      const on = b.filter((l) => l.pr[n]), off = b.filter((l) => !l.pr[n]);
      if (on.length < 20 || off.length < 20) { console.log(`  ${n.padEnd(25)} ${k.padEnd(6)}  amostra insuficiente`); continue; }
      const t = roi(on) - roi(off), a = g(A, n), b2 = g(B, n);
      const v = a == null || b2 == null ? 'sem amostra' : a > 0 && b2 > 0 ? 'RESISTE' : t > 0 ? 'so numa metade' : 'nao ajuda';
      console.log(`  ${n.padEnd(25)} ${k.padEnd(6)} ${String(on.length).padStart(5)} ${f(roi(on))} ${f(roi(off))} ${f(t)} ${f(a)} ${f(b2)}  ${v}`);
    }
    console.log('');
  }

  console.log(`${'='.repeat(88)}\n4. A TABELA DE PESOS  (ajustada na amostra inteira — é a que vai para produção)\n${'='.repeat(88)}`);
  const MOD = {};
  for (const k of ['Mais', 'Menos']) {
    const lista = CATALOGO[k], b = lado(k);
    MOD[k] = pesar(b, lista);
    console.log(`\n  LADO ${k.toUpperCase()}  ·  teto ${MOD[k].teto}  ·  score 30 = ${Math.ceil(0.3 * MOD[k].teto)} pontos, score 60 = ${Math.ceil(0.6 * MOD[k].teto)}`);
    console.log('  peso  premissa                  nivel                ganho   % do teto');
    for (const n of [...lista].sort((x, y) => MOD[k].peso[y] - MOD[k].peso[x])) {
      console.log(`  ${String(MOD[k].peso[n]).padStart(4)}  ${n.padEnd(25)} ${MOD[k].nivel[n].padEnd(18)} ${f(MOD[k].perfil[n].g)} ${`${Math.round((100 * MOD[k].peso[n]) / MOD[k].teto)}%`.padStart(10)}`);
    }
  }

  console.log(`\n${'='.repeat(88)}\n5. ROI POR FAIXA, DENTRO DA AMOSTRA\n${'='.repeat(88)}`);
  for (const k of ['Mais', 'Menos']) {
    const b = lado(k), lista = CATALOGO[k];
    for (const l of b) l.sc = pontuar(l, lista, MOD[k]);
    console.log(`  ${k} (apostar tudo ${f(roi(b))}):`);
    for (const fx of ['Alta', 'Media', 'Baixa']) {
      const ls = b.filter((l) => faixaDe(l.sc) === fx); if (!ls.length) continue;
      const acesas = ls.reduce((a, l) => a + lista.filter((n) => l.pr[n]).length, 0) / ls.length;
      console.log(`    ${fx.padEnd(6)} ${String(ls.length).padStart(4)} jogos  ROI ${f(roi(ls))} (ep ${f(ep(ls))})  ${acesas.toFixed(1)} premissas acesas`);
    }
  }

  console.log(`\n${'='.repeat(88)}`);
  console.log('6. ROI POR FAIXA, FORA DA AMOSTRA');
  console.log('   Peso e nível refeitos com metade do período, score medido na outra metade,');
  console.log('   nas duas direções. É o número que vale — ADR 0001.');
  console.log('='.repeat(88));
  const fora = [];
  for (const k of ['Mais', 'Menos']) {
    const lista = CATALOGO[k], b = lado(k), meio = b[Math.floor(b.length / 2)].data;
    const A = b.filter((l) => String(l.data) <= meio), B = b.filter((l) => String(l.data) > meio);
    const F = [];
    for (const [tr, te] of [[A, B], [B, A]]) {
      const m = pesar(tr, lista);
      for (const l of te) F.push({ ...l, sc: pontuar(l, lista, m) });
    }
    fora.push(...F);
    console.log(`  ${k} (apostar tudo ${f(roi(b))}):`);
    for (const fx of ['Alta', 'Media', 'Baixa']) {
      const ls = F.filter((l) => faixaDe(l.sc) === fx); if (!ls.length) continue;
      const ac = (100 * ls.filter((l) => l.lucro > 0).length) / ls.length;
      console.log(`    ${fx.padEnd(6)} ${String(ls.length).padStart(4)} jogos  ROI ${f(roi(ls))} (ep ${f(ep(ls))})  acerto ${ac.toFixed(1)}%`);
    }
  }
  console.log('  os dois lados juntos:');
  for (const fx of ['Alta', 'Media', 'Baixa']) {
    const ls = fora.filter((l) => faixaDe(l.sc) === fx); if (!ls.length) continue;
    console.log(`    ${fx.padEnd(6)} ${String(ls.length).padStart(4)} jogos  ROI ${f(roi(ls))} (ep ${f(ep(ls))})`);
  }

  console.log(`\n${'='.repeat(88)}\n7. AS PORTAS DE PUBLICAÇÃO  (fora da amostra)\n${'='.repeat(88)}`);
  const porta = (rot, g) => {
    const ls = fora.filter(g);
    console.log(`  ${rot.padEnd(42)} ${String(ls.length).padStart(4)} jogos  ROI ${f(roi(ls))} (ep ${f(ep(ls))})`);
  };
  porta('apostar em tudo', () => true);
  porta('score >= 30', (l) => l.sc >= 30);
  porta('score >= 30 e odd ate 2,20', (l) => l.sc >= 30 && l.odd <= 2.2);
  porta('so a faixa Alta', (l) => l.sc >= 60);
  console.log('\n  por faixa de odd, sem filtro de score:');
  for (const [a, b] of [[1, 1.8], [1.8, 1.95], [1.95, 2.05], [2.05, 2.2], [2.2, 99]]) {
    const ls = linhas.filter((l) => l.odd >= a && l.odd < b); if (!ls.length) continue;
    console.log(`    odd ${a.toFixed(2)} a ${b === 99 ? '+   ' : b.toFixed(2)}  ${String(ls.length).padStart(4)} linhas  ROI ${f(roi(ls))} (ep ${f(ep(ls))})`);
  }

  console.log(`\n${'='.repeat(88)}`);
  console.log('8. POR QUE O LADO MAIS RENDE MENOS');
  console.log('   A linha que o mercado pede sobe junto com o nosso score. Onde ela ainda não');
  console.log('   subiu o bastante, sobra escanteio para a gente. No topo ela já passou.');
  console.log('='.repeat(88));
  for (const k of ['Mais', 'Menos']) {
    console.log(`  ${k}:`);
    const b = lado(k);
    for (let s = 0; s < 100; s += 20) {
      const ls = b.filter((l) => l.sc >= s && l.sc < s + 20); if (ls.length < 15) continue;
      const md = (g) => ls.reduce((a, x) => a + g(x), 0) / ls.length;
      console.log(`    score ${String(s).padStart(2)}-${String(s + 19).padStart(2)} ${String(ls.length).padStart(4)} jogos · linha pedida ${md((l) => l.h).toFixed(2)} · escanteio real ${md((l) => l.j.total).toFixed(2)} · sobra ${(md((l) => l.j.total) - md((l) => l.h)).toFixed(2).padStart(5)} · ROI ${f(roi(ls))}`);
    }
  }
  console.log('');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
