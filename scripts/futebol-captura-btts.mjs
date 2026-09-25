// ============================================================================
// Captura os casos do Ambos marcam em produção (#361, #362)
// ============================================================================
// Uso:
//   node scripts/futebol-captura-btts.mjs
//   node scripts/futebol-captura-btts.mjs --casos=30
//   node scripts/futebol-captura-btts.mjs --fixture=1492140 --fixture=1492211
//   node scripts/futebol-captura-btts.mjs --so-diagnostico
//
// Credencial: `SUPABASE_ACCESS_TOKEN` do ambiente, ou de `.env.local`. Só faz
// SELECT, com `read_only` no endpoint. Nunca imprime segredo.
//
// ── Para que ele existe ─────────────────────────────────────────────────────
//
// Os critérios do Ambos marcam não estão transcritos no repositório. A #361 os
// leu do dbt e escreveu num texto; transcrever a partir de um texto é uma
// SEGUNDA implementação da regra, ao lado da do modelo, e ela pode nascer errada
// sem ninguém notar — foi o que aconteceu com o recorte de mando da
// `defesa_forte`, que ninguém tinha conferido contra nada.
//
// O mercado de Gols resolveu isso com 22 casos capturados de produção: cada um
// traz o jogo a jogo E o veredito que o mart publicou, e o teste exige que a
// nossa conta reproduza o booleano dele. Se divergir, a derivação está errada.
// Este script produz o mesmo arquivo para o Ambos marcam.
//
// ── Três decisões de desenho ────────────────────────────────────────────────
//
// 1. O JOGO A JOGO SAI DA PRÓPRIA RPC, e não de um SELECT reescrito aqui.
//    `select * from public.get_futebol_fixture_historico(id, 40)`. Reescrever a
//    consulta criaria uma terceira cópia do recorte para divergir sozinha, e o
//    arquivo capturado tem de ser byte a byte o que a tela recebe — senão o
//    teste prova a derivação contra um dado que a tela nunca vê.
//
// 2. OS DOIS LADOS DE CADA JOGO. O mart grava uma linha por `outcome`, e as sete
//    premissas se dividem entre "Sim" e "Não". Capturar um lado só deixaria
//    metade do catálogo sem caso nenhum.
//
// 3. AMOSTRA CURTA NÃO É DESCARTADA, É PROCURADA. O defeito que abriu isto
//    apareceu num Turquia × França em que a França tinha 8 jogos e a tela
//    mostrava 2. Jogo de seleção, jogo de time recém-promovido e jogo de começo
//    de temporada são exatamente onde o recorte errado aparece, então o sorteio
//    reserva vagas para janela curta em vez de cair sempre no caso confortável.
//
// ── O diagnóstico que vem junto ─────────────────────────────────────────────
//
// Antes de capturar, o script pergunta se `fact_insumos_medidos` já publica
// linha de Ambos marcam, e com que nomes de insumo. A resposta decide de onde
// o número deve sair na tela: publicando, ele vem do mart e a nossa conta fica
// de reserva; não publicando, a reserva é quem fala. É a pergunta que a rota do
// valor medido (#464) depende para o Ambos marcam.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJETO_PRD = 'lavclmlvvfzkblrstojd';
const DESTINO = resolve(RAIZ, 'src/utils/__fixtures__/futebol-criterios-btts.json');

/** As sete do Ambos marcam, na ordem do catálogo. */
const PREMISSAS = [
  'ambos_marcam',
  'ataque_dos_dois',
  'defesas_vazaveis',
  'historico_btts',
  'defesa_forte',
  'ataque_trava',
  'historico_seco',
];

// ── credencial ──────────────────────────────────────────────────────────────

let tokenEmCache = null;

/**
 * O `.env.local` da raiz, ou do primeiro diretório acima que o tenha.
 *
 * Subir importa: este repositório é trabalhado em worktrees sob
 * `.claude/worktrees/`, e `.env.local` é ignorado pelo git — então ele existe no
 * checkout principal e NUNCA numa worktree.
 */
function envLocal() {
  let dir = RAIZ;
  for (let i = 0; i < 6; i++) {
    try {
      return readFileSync(resolve(dir, '.env.local'), 'utf8');
    } catch {
      const acima = dirname(dir);
      if (acima === dir) return null;
      dir = acima;
    }
  }
  return null;
}

function tokenDeAcesso() {
  if (tokenEmCache) return tokenEmCache;
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    tokenEmCache = process.env.SUPABASE_ACCESS_TOKEN;
    return tokenEmCache;
  }
  const env = envLocal();
  if (env == null) {
    throw new Error('sem SUPABASE_ACCESS_TOKEN no ambiente e sem .env.local para ler');
  }
  const m = env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m);
  if (!m) throw new Error('.env.local não tem SUPABASE_ACCESS_TOKEN');
  tokenEmCache = m[1].trim();
  return tokenEmCache;
}

/**
 * Uma consulta somente leitura na produção.
 *
 * O status HTTP é checado antes do corpo, como fazem os outros scripts: sem
 * isso, um 401 ou um HTML de gateway viram `SyntaxError: Unexpected token '<'`
 * e o motivo real da falha se perde.
 */
async function consultar(sql) {
  let r;
  try {
    r = await fetch(`https://api.supabase.com/v1/projects/${PROJETO_PRD}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenDeAcesso()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql, read_only: true }),
    });
  } catch (e) {
    throw new Error(`não consegui falar com a API do Supabase: ${e.message}`);
  }
  const corpo = await r.text();
  if (!r.ok) throw new Error(`consulta recusada (HTTP ${r.status}): ${corpo.slice(0, 400)}`);
  try {
    return JSON.parse(corpo);
  } catch {
    throw new Error(`resposta não era JSON: ${corpo.slice(0, 400)}`);
  }
}

// ── 1. diagnóstico: o mart publica insumo de btts? ──────────────────────────

const DIAGNOSTICO = `
  select i.market,
         i.premissa,
         i.insumo,
         count(*)                      as linhas,
         count(i.valor)                as com_valor,
         min(i.valor)                  as menor,
         max(i.valor)                  as maior
  from futebol.fact_insumos_medidos i
  where i.market = 'btts'
  group by 1, 2, 3
  order by 2, 3;
`;

async function diagnosticar() {
  const r = await consultar(DIAGNOSTICO);
  const linhas = Array.isArray(r) ? r : (r.result ?? []);

  console.log('\n── a tabela de insumos medidos, no Ambos marcam ──\n');
  if (!linhas.length) {
    console.log('  NENHUMA linha de btts.');
    console.log('  Consequência: a rota do valor medido não tem o que dizer neste');
    console.log('  mercado, e quem fala é a nossa conta sobre o jogo a jogo. É ela');
    console.log('  que os casos capturados aqui precisam provar.');
    return { publica: false, insumos: [] };
  }
  for (const l of linhas) {
    console.log(
      `  ${String(l.premissa).padEnd(18)} ${String(l.insumo).padEnd(16)} ` +
        `${String(l.linhas).padStart(7)} linhas, ${String(l.com_valor).padStart(7)} com valor` +
        `  [${l.menor} … ${l.maior}]`,
    );
  }
  console.log('\n  Consequência: o número da tela deve sair DAQUI, e a nossa conta');
  console.log('  fica de reserva para linha antiga sem valor gravado.');
  return { publica: true, insumos: linhas };
}

// ── 2. escolha dos jogos ────────────────────────────────────────────────────
//
// O sorteio é estratificado de propósito. Pegar as N linhas mais recentes daria
// uma amostra de campeonato em andamento, com janela cheia — e a janela cheia é
// justamente o caso em que o recorte errado NÃO aparece. As vagas de janela
// curta existem para o arquivo conter o caso do Turquia × França.

function consultaDeEscolha({ quantos, janelaCurta }) {
  return `
  with base as (
    select distinct
           b.fixture_id,
           f.competition,
           f.kickoff_utc,
           f.home_team_id,
           f.away_team_id,
           f.home_team_name || ' x ' || f.away_team_name as confronto
    from futebol.int_futebol_premissas_btts b
    join futebol.fact_fixtures f on f.fixture_id = b.fixture_id
    -- Jogo já ENCERRADO: o histórico de um jogo futuro ainda cresce, e capturar
    -- um deles daria um arquivo que deixa de reproduzir sozinho amanhã.
    where b.outcome is not null
      and f.status_short in ('FT','AET','PEN')
      and f.kickoff_utc >= now() - interval '150 days'
  ),
  -- O sorteio vem ANTES da conta de janela: ela é duas varreduras por jogo, e
  -- rodá-la no mart inteiro custa caro para depois jogar quase tudo fora.
  candidatos as (select * from base order by random() limit 400),
  com_janela as (
    select c.*,
           -- Quantos jogos anteriores cada lado tem. É o eixo da estratificação:
           -- abaixo de 10 o recorte de mando é o que mais corta.
           least(
             (select count(*) from futebol.fact_fixtures h
               where h.status_short in ('FT','AET','PEN')
                 and h.kickoff_utc < c.kickoff_utc
                 and (h.home_team_id = c.home_team_id or h.away_team_id = c.home_team_id)),
             (select count(*) from futebol.fact_fixtures a
               where a.status_short in ('FT','AET','PEN')
                 and a.kickoff_utc < c.kickoff_utc
                 and (a.home_team_id = c.away_team_id or a.away_team_id = c.away_team_id))
           ) as menor_janela
    from candidatos c
  )
  select fixture_id, competition, confronto, kickoff_utc, menor_janela
  from com_janela
  where menor_janela ${janelaCurta ? 'between 1 and 9' : '>= 10'}
  -- Uma competição não domina a amostra: numera dentro de cada uma e pega as
  -- primeiras de cada, alternando. Sem isto o Brasileirão levaria quase tudo.
  order by (row_number() over (partition by competition order by kickoff_utc desc)), random()
  limit ${quantos};
  `;
}

async function escolherJogos({ casos, forcados }) {
  // Os forçados ENTRAM ALÉM do sorteio, e não no lugar dele. Um caso relatado
  // é a razão de a captura existir, mas capturar só ele daria um arquivo que
  // prova a derivação no exemplo em que ela já se sabe errada e em nenhum
  // outro. E o sorteio sozinho pode não pegá-lo nunca.
  const fixos = forcados.length
    ? await consultar(`
        select f.fixture_id, f.competition,
               f.home_team_name || ' x ' || f.away_team_name as confronto,
               f.kickoff_utc
        from futebol.fact_fixtures f
        where f.fixture_id in (${forcados.join(',')})
        order by f.kickoff_utc;
      `).then((r) => (Array.isArray(r) ? r : (r.result ?? [])))
    : [];

  // Um terço das vagas para janela curta. É pouco no campeonato e é tudo em
  // seleção — e é lá que o defeito mora.
  const restantes = Math.max(0, casos - fixos.length);
  const curtos = restantes ? Math.max(2, Math.round(restantes / 3)) : 0;
  const cheios = restantes - curtos;

  const a = cheios > 0 ? await consultar(consultaDeEscolha({ quantos: cheios, janelaCurta: false })) : [];
  const b = curtos > 0 ? await consultar(consultaDeEscolha({ quantos: curtos, janelaCurta: true })) : [];
  const sorteados = [
    ...(Array.isArray(a) ? a : (a.result ?? [])),
    ...(Array.isArray(b) ? b : (b.result ?? [])),
  ];

  const vistos = new Set(fixos.map((j) => j.fixture_id));
  const linhas = [...fixos, ...sorteados.filter((j) => !vistos.has(j.fixture_id))];
  if (!linhas.length) throw new Error('nenhum jogo de btts no mart — nada a capturar');
  return linhas;
}

// ── 3. captura de um jogo ───────────────────────────────────────────────────

/**
 * Quantos jogos por lado o arquivo guarda.
 *
 * A tela pede 40 à consulta, mas a maior janela do Ambos marcam é 10 e a menor
 * é 5 — guardar 40 multiplicaria o arquivo por quatro sem provar nada a mais.
 *
 * E não pode ser 10: com exatamente a janela, uma derivação que ESQUECESSE de
 * recortar passaria no teste, porque recortar dez de dez não muda nada. O dobro
 * da maior janela é o mínimo que deixa o erro aparecer — inclusive o de inverter
 * a ordem, filtrando mando antes de recortar, que aqui daria até 20 jogos de um
 * mando só onde o certo são uns 5.
 */
const JOGOS_POR_LADO = 20;

function consultaDoCaso(fixtureId) {
  return `
  select
    (select coalesce(jsonb_agg(to_jsonb(h) order by h.side, h.ordem), '[]'::jsonb)
       from public.get_futebol_fixture_historico(${fixtureId}, ${JOGOS_POR_LADO}) h) as jogos,
    (select coalesce(jsonb_agg(to_jsonb(b) - 'dbt_loaded_at'), '[]'::jsonb)
       from futebol.int_futebol_premissas_btts b
      where b.fixture_id = ${fixtureId}) as mart;
  `;
}

async function capturar(jogo) {
  const r = await consultar(consultaDoCaso(jogo.fixture_id));
  const linha = (Array.isArray(r) ? r : (r.result ?? []))[0];
  if (!linha) return null;

  const mart = linha.mart ?? [];
  if (!mart.length) return null;

  // UM caso por jogo, com os dois lados dentro — e não um caso por lado.
  //
  // O mart grava uma linha por `outcome` e os vereditos diferem entre elas: as
  // premissas do "Sim" e as do "Não" são conjuntos diferentes. Mas o jogo a jogo
  // é o MESMO para os dois, porque ele é dos times e não da aposta. Repetir o
  // caso por lado duplicaria o histórico inteiro no arquivo — na primeira
  // captura isso sozinho valeu 1,3 MB — e ainda sugeriria que a amostra depende
  // da saída escolhida, que é exatamente o tipo de confusão que este mercado já
  // tem de sobra.
  const porLado = {};
  const semDado = {};
  for (const m of mart) {
    porLado[m.outcome] = Object.fromEntries(
      PREMISSAS.filter((p) => m[p] != null).map((p) => [p, m[p]]),
    );
    semDado[m.outcome] = m.premissas_sem_dado ?? null;
  }

  return {
    origem: 'producao',
    fixture_id: jogo.fixture_id,
    confronto: jogo.confronto,
    competicao: jogo.competition,
    data: String(jogo.kickoff_utc).slice(0, 10),
    // O Ambos marcam não tem linha. Fica explícito para quem escrever o teste
    // não procurar um corte que depende dela — nenhum dos sete critérios usa.
    linha: null,
    /** Os vereditos do mart, por saída: `{ "Yes": {...}, "No": {...} }`. */
    veredito: porLado,
    /** Quantas premissas o mart marcou como sem dado, por saída. Zero é o caso limpo. */
    premissas_sem_dado: semDado,
    jogos: linha.jogos ?? [],
  };
}

// ── principal ───────────────────────────────────────────────────────────────

function argumento(nome, padrao) {
  const m = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return m ? m.split('=')[1] : padrao;
}

/**
 * Acha o `fixture_id` de um confronto pelo nome, para poder forçá-lo na captura.
 *
 * Existe porque o caso que abre uma investigação chega como print de tela, com
 * dois nomes de time e uma data — nunca com o id. Sem isto, reproduzir um caso
 * relatado vira consulta ad hoc fora do script, que é o que faz a captura deixar
 * de ser reproduzível por outra pessoa.
 */
async function buscar(termo) {
  const alvo = termo.replace(/'/g, "''");
  const r = await consultar(`
    select f.fixture_id, f.competition, f.kickoff_utc,
           f.home_team_name || ' x ' || f.away_team_name as confronto,
           exists (select 1 from futebol.int_futebol_premissas_btts b
                    where b.fixture_id = f.fixture_id) as tem_btts
    from futebol.fact_fixtures f
    where f.home_team_name ilike '%${alvo}%' or f.away_team_name ilike '%${alvo}%'
    order by f.kickoff_utc desc
    limit 20;
  `);
  const linhas = Array.isArray(r) ? r : (r.result ?? []);
  console.log(`\n── jogos com "${termo}" ──\n`);
  for (const l of linhas) {
    console.log(
      `  ${String(l.fixture_id).padEnd(9)} ${String(l.kickoff_utc).slice(0, 10)}  ` +
        `${String(l.confronto).padEnd(38)} ${l.competition}` +
        `${l.tem_btts ? '' : '   (sem linha de btts no mart)'}`,
    );
  }
}

async function principal() {
  const termo = argumento('buscar', null);
  if (termo) return buscar(termo);

  const diag = await diagnosticar();
  if (process.argv.includes('--so-diagnostico')) return;

  const casos = Number(argumento('casos', '24'));
  const forcados = process.argv
    .filter((a) => a.startsWith('--fixture='))
    .map((a) => Number(a.split('=')[1]))
    .filter((n) => Number.isFinite(n));

  const jogos = await escolherJogos({ casos, forcados });
  console.log(`\n── capturando ${jogos.length} jogos ──\n`);

  const capturados = [];
  for (const jogo of jogos) {
    const caso = await capturar(jogo);
    if (!caso) {
      console.log(`  pulado  ${jogo.fixture_id}  ${jogo.confronto} — sem linha no mart`);
      continue;
    }
    capturados.push(caso);
    console.log(
      `  ok      ${String(jogo.fixture_id).padEnd(9)} ${String(jogo.confronto).padEnd(38)} ` +
        `${String(caso.jogos.length).padStart(3)} jogos  lados ${Object.keys(caso.veredito).join('/')}`,
    );
  }

  if (!capturados.length) throw new Error('nada capturado — não vou escrever arquivo vazio');

  writeFileSync(DESTINO, `${JSON.stringify(capturados, null, 1)}\n`);

  // O resumo existe para quem for escrever o teste saber o que a amostra cobre.
  // Premissa com zero aceso e zero apagado não prova nada, e é melhor descobrir
  // isso aqui do que num teste verde que não testa.
  console.log(`\n── ${capturados.length} casos em ${DESTINO} ──\n`);
  // Conta por LADO, e não por jogo: a mesma premissa tem veredito próprio no
  // "Sim" e no "Não", e somar os dois esconderia uma saída sem cobertura.
  const lados = capturados.flatMap((c) => Object.values(c.veredito));
  for (const p of PREMISSAS) {
    const com = lados.filter((v) => v[p] != null);
    const acesas = com.filter((v) => v[p]).length;
    const marca = com.length === 0 || acesas === 0 || acesas === com.length ? '  ⚠️' : '';
    console.log(
      `  ${p.padEnd(18)} ${String(acesas).padStart(3)} acesas / ` +
        `${String(com.length - acesas).padStart(3)} apagadas${marca}`,
    );
  }
  console.log('\n  ⚠️ = a amostra não tem os dois vereditos: o teste passaria sem provar nada.');
  console.log(`  Insumo medido no mart: ${diag.publica ? 'PUBLICA' : 'não publica'}.`);
}

principal().catch((e) => {
  console.error(`\nfalhou: ${e.message}`);
  process.exit(1);
});
