// ============================================================
// crm-comportamento — o que o PostHog sabe sobre uma pessoa
// ============================================================
// A ficha do CRM mostra o que o BANCO sabe: plano, acessos, apostas, etapa. O
// comportamento — quantas vezes a pessoa entrou, quanto tempo ficou, que
// páginas viu — só existe no PostHog, e a chave que consulta o PostHog não pode
// viver no navegador: quem tiver ela lê o comportamento de toda a base.
//
// Por isso esta função existe. Ela é a única ponte, e faz duas coisas:
//
//   1. confere que quem chamou é sócio, usando o token de quem chamou
//   2. pergunta ao PostHog e devolve só o agregado
//
// ⚠️ O PORTÃO USA O TOKEN DO CHAMADOR, E NÃO A CHAVE DE SERVIÇO
// A tentação é criar o cliente com a service role e conferir a coluna. Isso
// funciona, mas transforma a função num caminho paralelo ao portão do painel: o
// dia em que a regra de quem é sócio mudar, ela continua com a cópia antiga.
// Chamando `eh_socio()` COMO O USUÁRIO, a resposta vem da mesma função que a
// tela usa, e a regra continua morando num lugar só.
//
// Conferência depois de publicar, logado como sócio:
//   supabase functions invoke crm-comportamento --body '{"user_id":"<uuid>"}'
// ============================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const POSTHOG_QUERY_KEY = Deno.env.get('POSTHOG_QUERY_KEY') || '';
const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') || 'https://us.posthog.com';
const POSTHOG_PROJECT = Deno.env.get('POSTHOG_PROJECT_ID') || '242542';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/**
 * Uma consulta ao PostHog, em HogQL.
 *
 * Os valores vão por parâmetro, e não interpolados na string: o identificador
 * vem da rota e não deve poder virar SQL.
 */
async function perguntar(sql: string, valores: Record<string, unknown>) {
  const resposta = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POSTHOG_QUERY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: { kind: 'HogQLQuery', query: sql, values: valores },
    }),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`posthog ${resposta.status}: ${texto.slice(0, 300)}`);
  }

  const corpo = await resposta.json();
  return (corpo.results ?? []) as unknown[][];
}

/**
 * Quem é a pessoa, para o PostHog.
 *
 * Por identificador E por e-mail, porque os dois falham em casos diferentes. O
 * `distinct_id` só acha evento POSTERIOR ao login; o e-mail acha tudo que o
 * PostHog costurou naquela pessoa, inclusive a visita anônima que veio antes.
 *
 * A primeira versão filtrava só por identificador, e devolveu ZERO para o
 * próprio sócio que estava usando o produto naquele instante.
 */
const QUEM = `(distinct_id = {distinct_id} OR person.properties.email = {email})`;

/**
 * O resumo de uma pessoa.
 *
 * `primeiroEvento` não é enfeite: ele diz até onde o PostHog ainda tem
 * história. Se o plano descarta evento antigo, essa data vem recente mesmo para
 * quem se cadastrou há meses — e a tela precisa poder dizer isso em vez de
 * mostrar "2 sessões" como se fosse o total de sempre.
 */
const RESUMO = `
  SELECT
    min(timestamp),
    max(timestamp),
    count(),
    count(DISTINCT $session_id)
  FROM events
  WHERE ${QUEM}
`;

const TEMPO_POR_SESSAO = `
  SELECT sum(duracao) FROM (
    SELECT dateDiff('second', min(timestamp), max(timestamp)) AS duracao
    FROM events
    WHERE ${QUEM} AND $session_id IS NOT NULL
    GROUP BY $session_id
  )
`;

/**
 * Quantos eventos o projeto inteiro recebeu na semana.
 *
 * Só é consultado quando a pessoa some do resultado, e serve para separar duas
 * causas que se parecem na tela: filtro errado, ou projeto/endereço errados.
 * Zero aqui significa que a função está perguntando no lugar errado.
 */
const PULSO = `SELECT count() FROM events WHERE timestamp > now() - INTERVAL 7 DAY`;

const PAGINAS = `
  SELECT properties.path, count() AS vezes
  FROM events
  WHERE ${QUEM} AND event = '$pageview'
  GROUP BY properties.path
  ORDER BY vezes DESC
  LIMIT 8
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!POSTHOG_QUERY_KEY) {
    // Dito com todas as letras: sem a chave, a função não tem o que fazer, e o
    // silêncio aqui viraria "essa pessoa não tem comportamento" na tela.
    return json({ erro: 'sem_chave', detalhe: 'POSTHOG_QUERY_KEY não está configurada' }, 503);
  }

  const autorizacao = req.headers.get('Authorization') ?? '';
  if (!autorizacao) return json({ erro: 'sem_token' }, 401);

  // O portão, com o token de quem chamou. Ver o aviso do cabeçalho.
  const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: autorizacao } },
  });

  const { data: ehSocio, error: erroDoPortao } = await comoUsuario.rpc('eh_socio');
  if (erroDoPortao) return json({ erro: 'portao_falhou', detalhe: erroDoPortao.message }, 500);
  if (ehSocio !== true) return json({ erro: 'apenas_socios' }, 403);

  let userId = '';
  let email = '';
  try {
    const corpo = (await req.json()) as { user_id?: string; email?: string };
    userId = String(corpo?.user_id ?? '');
    email = String(corpo?.email ?? '');
  } catch {
    return json({ erro: 'corpo_invalido' }, 400);
  }
  if (!userId) return json({ erro: 'sem_user_id' }, 400);

  try {
    const valores = { distinct_id: userId, email };
    const [resumo, tempo, paginas] = await Promise.all([
      perguntar(RESUMO, valores),
      perguntar(TEMPO_POR_SESSAO, valores),
      perguntar(PAGINAS, valores),
    ]);

    const [primeiro, ultimo, eventos, sessoes] = resumo[0] ?? [null, null, 0, 0];

    // Sem nenhum evento para a pessoa, o pulso do projeto diz se o problema é
    // o filtro ou o endereço.
    const pulso = Number(eventos ?? 0) === 0 ? Number((await perguntar(PULSO, {}))[0]?.[0] ?? 0) : null;

    return json({
      primeiroEvento: primeiro,
      ultimoEvento: ultimo,
      eventos: Number(eventos ?? 0),
      sessoes: Number(sessoes ?? 0),
      segundosDeTela: Number(tempo[0]?.[0] ?? 0),
      eventosNoProjetoNaSemana: pulso,
      paginas: paginas.map(([caminho, vezes]) => ({
        caminho: String(caminho ?? ''),
        vezes: Number(vezes ?? 0),
      })),
    });
  } catch (erro) {
    // O erro do PostHog volta inteiro de propósito: esta função vai nascer com
    // a consulta errada pelo menos uma vez, e sem a mensagem original a
    // depuração vira adivinhação.
    return json({ erro: 'posthog_falhou', detalhe: String(erro) }, 502);
  }
});
