import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// A guarda que impede uma RPC de valor de nascer aberta de novo
// ============================================================================
// As 38 RPCs do futebol nasceram `security definer`, sem checar quem chama, com
// grant para `anon`. O bloqueio da tela era borrão, e borrão é enfeite: o dado
// chegava inteiro no navegador de quem nunca pagou, e bastava abrir a aba de
// rede para ler a aposta, a odd, a vantagem e o Score.
//
// O conserto foi um portão único, `futebol_acesso_do_chamador()`, chamado por
// cada função que devolve conteúdo de valor. O modo de falha que sobra é o
// PRÓXIMO: alguém escreve a RPC de valor de amanhã e ela nasce aberta, como
// estas nasceram, e ninguém vê — porque responder 200 é o comportamento normal.
//
// Este teste é a lista explícita dos dois lados, em arquivo contra arquivo, sem
// banco. Ele quebra nos dois sentidos de propósito:
//
//   · função de valor SEM o portão  -> vazamento novo
//   · função pública COM o portão   -> fechamos o calendário sem querer, e a
//     página de aquisição fica vazia para o visitante
//
// Mexer na classificação é mexer nesta lista, que é onde a decisão está
// escrita. É o mesmo formato da paridade da copy (#272) e do shape file (#250).
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const SHAPE = resolve(RAIZ, 'docs/futebol-prod-deploy.sql');
const PORTAO = 'futebol_acesso_do_chamador';

/**
 * Conteúdo do MODELO: a aposta, o preço, a nota e o raciocínio.
 *
 * A régua: é valor tudo que sai do nosso cálculo. Se veio do calendário, não é.
 */
const DE_VALOR = [
  'get_futebol_value_board',
  'get_futebol_fixture_value',
  'get_futebol_fixture_premissas',
  'get_futebol_fixture_reason_contract',
  'get_futebol_fixture_disponivel_desde',
  'get_futebol_alerted_picks',
  'get_futebol_fixture_odds',
  'get_futebol_odds_board',
  'get_futebol_fixture_prediction',
  // Odd comparada entre casas. Hoje responde 500 em toda chamada; entrou na
  // lista porque no dia em que consertarem o 500 ela voltaria aberta.
  'get_futebol_fixture_quotes',
  // O VALOR medido de cada premissa (mercado, saída, linha, número). É o
  // raciocínio do modelo, e nasceu ABERTA porque veio depois desta guarda —
  // o caso exato que a asserção de completude abaixo existe para pegar.
  // Na lista de grants está agrupada entre `_premissas` e `_reason_contract`,
  // as duas irmãs diretas dela, e as duas passam pelo portão.
  'get_futebol_fixture_insumos',
];

/**
 * Fato público de futebol: quem joga, quando, como terminou.
 *
 * Qualquer site entrega de graça, e é o que sustenta a página existir para quem
 * ainda não assinou. Fechar isto não protege nada e esvazia a aquisição.
 *
 * `get_futebol_value_history` está aqui e não é esquecimento: os dois CTEs dela
 * exigem `kickoff_utc < now()`, então ela é PASSADO por construção. Jogo
 * encerrado não é aposta que alguém possa fazer, e é a única prova de método que
 * sobra dentro do app para quem não assinou.
 */
const PUBLICAS = [
  'get_futebol_access',
  'get_futebol_fixtures',
  'get_futebol_fixtures_by_day',
  'get_futebol_fixture_days',
  'get_futebol_competitions',
  'get_futebol_fixture_detail',
  'get_futebol_fixture_extras',
  'get_futebol_fixture_injuries',
  'get_futebol_fixture_numeros',
  'get_futebol_fixture_historico',
  'get_futebol_h2h',
  'get_futebol_leaders',
  'get_futebol_standings_official',
  'get_futebol_team_profile',
  'get_futebol_team_season',
  'get_futebol_value_history',
  // Regra de EXIBIÇÃO, não saída do modelo. O glossário diz que mercado oculto
  // "não é porta de publicação: nada muda no gate, no mart nem nas RPCs".
  // Fechadas, elas voltavam vazias — e vazio não é erro, então o filtro deixava
  // de filtrar e a lista de quem não assina mostrava linhas que o assinante não
  // vê. Esconder a régua não protege valor; só desalinha as duas listas.
  'get_futebol_vitrine',
  'get_futebol_mercados_ocultos',
  'get_futebol_limiar_valor',
  // Só agrega jogos encerrados: média de gols, over 2,5, ambos marcam. Fato
  // público de futebol, e passado liquidado.
  'get_futebol_matchup_markets',
  'get_futebol_standings',
  'get_futebol_teams',
  // Placar ao vivo lido direto do coletor: fixture, status e gols. Os MESMOS
  // números que `get_futebol_fixtures` já devolve aberta — quem ganhou e como
  // está o jogo é fato público de futebol, e fechar aqui não protegeria nada
  // que a agenda não entregue ao lado.
  'get_futebol_placar_fresco',
];

/**
 * Fechadas por OUTRA régua, não pela do assinante.
 *
 * Estas não passam pelo portão e não deveriam: são de sócio (revogadas de anon,
 * com `eh_socio()` no corpo) ou de serviço, chamadas só por função de borda com
 * a chave de serviço. Ficam listadas para a asserção de completude abaixo poder
 * cobrar que TODA RPC esteja classificada em algum lugar.
 */
const FORA_DA_REGRA = [
  'get_futebol_oportunidades_publicadas',
  'get_futebol_placar_da_metodologia',
  'get_futebol_oferta_pos_teste_targets',
  'get_futebol_publication_alert_recipients',
];

const sql = readFileSync(SHAPE, 'utf8').replace(/\r\n/g, '\n');

/** O corpo de uma função, entre os dois delimitadores do `create`. */
function corpoDa(nome: string): string | null {
  const baixo = sql.toLowerCase();
  const agulha = `function public.${nome}(`;
  let i = baixo.indexOf(agulha);
  while (i >= 0) {
    // Ignora `grant`, `revoke` e `comment on`: só o `create` tem corpo.
    if (baixo.slice(Math.max(0, i - 60), i).includes('create')) {
      const abre = sql.indexOf('$function$', i);
      if (abre < 0) return null;
      const fecha = sql.indexOf('$function$', abre + '$function$'.length);
      if (fecha < 0) return null;
      return sql.slice(abre + '$function$'.length, fecha);
    }
    i = baixo.indexOf(agulha, i + 1);
  }
  return null;
}

describe('o portão de acesso das RPCs de valor do futebol', () => {
  it('existe, é definer e deixa a chave de serviço passar', () => {
    const corpo = corpoDa(PORTAO);
    expect(corpo, `${PORTAO} não está no shape file`).not.toBeNull();
    // Sem esta porta, fechar as RPCs derruba os alertas do Telegram em silêncio:
    // o bot chama com service_role, e nessa conexão não existe usuário.
    expect(corpo).toContain('service_role');
    expect(corpo).toContain('futebol_acesso_vigente');
    expect(sql).toContain(`grant execute on function public.${PORTAO}()`);
  });

  it.each(DE_VALOR)('%s não devolve valor sem passar pelo portão', (nome) => {
    const corpo = corpoDa(nome);
    expect(corpo, `${nome} não está no shape file`).not.toBeNull();
    expect(
      corpo,
      `${nome} devolve conteúdo de valor e não chama ${PORTAO}: nasceu aberta`,
    ).toContain(PORTAO);
  });

  it.each(PUBLICAS)('%s continua aberta, porque é fato público', (nome) => {
    const corpo = corpoDa(nome);
    expect(corpo, `${nome} não está no shape file`).not.toBeNull();
    expect(
      corpo,
      `${nome} é fato público de futebol e passou a exigir acesso: isso esvazia a tela de quem ainda não assinou`,
    ).not.toContain(PORTAO);
  });

  // Sem esta asserção as duas listas acima não fecham buraco nenhum: a RPC de
  // valor de AMANHÃ nasce fora delas, ninguém a classifica, e o teste passa
  // verde — exatamente o modo de falha que o cabeçalho deste arquivo declara.
  it('toda RPC de futebol está classificada em alguma das listas', () => {
    const declaradas = new Set([...DE_VALOR, ...PUBLICAS, ...FORA_DA_REGRA]);
    const noArquivo = [
      ...new Set(
        [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(get_futebol_\w+)/gi)].map(
          (m) => m[1].toLowerCase(),
        ),
      ),
    ];
    expect(noArquivo.length, 'não achei função nenhuma no shape file').toBeGreaterThan(20);
    const semClasse = noArquivo.filter((n) => !declaradas.has(n));
    expect(
      semClasse,
      `estas RPCs não estão em nenhuma lista — classifique antes de mergear:\n  ${semClasse.join('\n  ')}`,
    ).toEqual([]);
  });
});
