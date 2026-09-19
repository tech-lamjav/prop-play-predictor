import { describe, expect, it } from 'vitest';
import {
  CHAVES_PESSOAIS,
  ORIGENS_DO_JOGO,
  TIPOS_DE_CAMPANHA,
  chavesPessoaisEm,
  idDaOportunidade,
  propsDaOportunidade,
  valorControlado,
} from './eventos';

// ============================================================================
// O contrato dos eventos, travado por teste
// ============================================================================
// Este arquivo protege TRÊS decisões que são invisíveis no código e caras de
// descobrir depois:
//
//   1. as traduções de nome (`game_id` ← `fixture_id`, `selection` ← `outcome`,
//      `confidence_band` ← `faixa`). Trocar uma delas não quebra nada: o evento
//      continua saindo, e o painel passa a medir outra coisa em silêncio;
//   2. o formato do `opportunity_id`, que é a chave que liga o site ao link do
//      Telegram — as duas pontas casam por STRING, sem ninguém validando;
//   3. a ausência de dado pessoal, que é a regra que não pode depender de
//      alguém lembrar dela na hora de instrumentar a próxima tela.
// ============================================================================

const OPORTUNIDADE = {
  fixture_id: 123,
  market: 'match_winner',
  outcome: 'Home',
  line_value: null,
  competition: 'brasileirao',
  faixa: 'Alta',
  score: 72,
};

describe('propsDaOportunidade — as traduções de nome', () => {
  const p = propsDaOportunidade(OPORTUNIDADE, {
    source: 'opportunities',
    subscription_status: 'subscribed',
    position: 3,
  });

  it('`game_id` recebe o `fixture_id`', () => {
    expect(p.game_id).toBe(123);
  });

  it('não manda um `fixture_id` separado', () => {
    // Não existem DOIS identificadores de jogo no domínio: `fixture_id` é o
    // único. Mandar os dois criaria a ilusão de que há um par para conferir, e
    // alguém acabaria cruzando os dois num relatório.
    expect(p).not.toHaveProperty('fixture_id');
  });

  it('`selection` recebe o `outcome`, que é o nome do domínio', () => {
    expect(p.selection).toBe('Home');
  });

  it('`confidence_band` recebe a faixa', () => {
    expect(p.confidence_band).toBe('Alta');
  });

  it('manda `competition`, e NÃO um `league_id` inventado', () => {
    // Liga no domínio é uma string (`type Competition = string`). Um
    // `league_id` numérico não existe em tabela nenhuma: seria um campo que
    // nenhuma consulta sabe responder.
    expect(p.competition).toBe('brasileirao');
    expect(p).not.toHaveProperty('league_id');
  });

  it('a posição entra quando existe', () => {
    expect(p.position).toBe(3);
  });

  it('sem posição, a chave não vai como indefinida', () => {
    const semPos = propsDaOportunidade(OPORTUNIDADE, {
      source: 'home_games',
      subscription_status: 'anon',
    });
    expect(semPos).not.toHaveProperty('position');
  });

  it('medi-e-não-havia continua sendo nulo, não sumido', () => {
    // Nulo e ausente dizem coisas diferentes. A oportunidade registrada antes
    // da migration 091 não guardou Score nem faixa: ela existe, e os números
    // não. Apagar a chave faria o painel contar essa linha como "não medida".
    const semNumeros = propsDaOportunidade(
      { fixture_id: 9, market: 'goals_over_under', outcome: 'Over', line_value: 2.5 },
      { source: 'opportunities', subscription_status: 'trial' },
    );
    expect(semNumeros.score).toBeNull();
    expect(semNumeros.confidence_band).toBeNull();
    expect(semNumeros.competition).toBeNull();
  });
});

describe('idDaOportunidade — a chave que o Telegram também usa', () => {
  it('é a composição de quatro partes, separadas por barra', () => {
    expect(idDaOportunidade(OPORTUNIDADE)).toBe('123|match_winner|Home|');
  });

  it('a linha entra quando existe', () => {
    expect(
      idDaOportunidade({ fixture_id: 7, market: 'goals_over_under', outcome: 'Over', line_value: 2.5 }),
    ).toBe('7|goals_over_under|Over|2.5');
  });

  it('linha ZERO é uma linha de verdade, e não um vazio', () => {
    // Handicap 0 existe. Um teste de verdade (`if (line_value)`) a apagaria, e
    // duas oportunidades diferentes passariam a ter a mesma identidade.
    expect(
      idDaOportunidade({ fixture_id: 7, market: 'asian_handicap', outcome: 'Home', line_value: 0 }),
    ).toBe('7|asian_handicap|Home|0');
  });

  it('bate com o formato que o link do bot carrega', () => {
    // O `dest` do Telegram é `jogo-<fixture>|<mercado>|<saída>|<linha>`. Tirado
    // o prefixo do jogo, é a MESMA composição — é isso que deixa envio, clique
    // e tela caírem na mesma oportunidade sem tradutor no meio.
    const destDoBot = 'jogo-123|match_winner|Home|';
    expect(destDoBot.replace(/^jogo-/, '')).toBe(idDaOportunidade(OPORTUNIDADE));
  });
});

describe('valorControlado', () => {
  it('deixa passar o que está na lista', () => {
    expect(valorControlado('home_featured', ORIGENS_DO_JOGO, 'other')).toBe('home_featured');
  });

  it('o que não está vira o padrão, em vez de sujar a lista', () => {
    // Um valor solto cria uma fatia nova em todo gráfico que quebra por origem,
    // e ninguém percebe até o gráfico ficar ilegível.
    expect(valorControlado('home_destaque', ORIGENS_DO_JOGO, 'other')).toBe('other');
  });

  it('nulo e indefinido caem no padrão', () => {
    expect(valorControlado(null, TIPOS_DE_CAMPANHA, 'other')).toBe('other');
    expect(valorControlado(undefined, TIPOS_DE_CAMPANHA, 'other')).toBe('other');
  });

  it('as três campanhas do bot são as que o redirecionador reconhece', () => {
    // Inventar uma quarta aqui sem mexer no `go` faz o clique cair no fallback
    // e a campanha sumir do funil.
    expect(TIPOS_DE_CAMPANHA).toContain('daily_opportunities');
    expect(TIPOS_DE_CAMPANHA).toContain('published_opportunities');
    expect(TIPOS_DE_CAMPANHA).toContain('weekly_summary');
  });
});

describe('a guarda de dado pessoal', () => {
  it('um payload normal de oportunidade não tem nada pessoal', () => {
    const p = propsDaOportunidade(OPORTUNIDADE, {
      source: 'opportunities',
      subscription_status: 'subscribed',
    });
    expect(chavesPessoaisEm(p)).toEqual([]);
  });

  it('acusa e-mail, telefone e nome', () => {
    expect(chavesPessoaisEm({ email: 'a@b.c' })).toEqual(['email']);
    expect(chavesPessoaisEm({ phone: '11999' })).toEqual(['phone']);
    expect(chavesPessoaisEm({ name: 'Fulano' })).toEqual(['name']);
  });

  it('acusa os identificadores do Telegram', () => {
    // O `distinct_id` é o id da aplicação. Mandar `chat_id` junto refaz, em
    // forma legível, o vínculo que o contrato de identidade separou.
    expect(chavesPessoaisEm({ chat_id: '42' })).toEqual(['chat_id']);
    expect(chavesPessoaisEm({ telegram_user_id: '42' })).toEqual(['telegram_user_id']);
  });

  it('não se engana com maiúsculas', () => {
    expect(chavesPessoaisEm({ Email: 'a@b.c' })).toEqual(['Email']);
  });

  it('a lista cobre os campos que a tabela `users` de fato guarda', () => {
    for (const chave of ['email', 'whatsapp_number', 'telegram_chat_id', 'telegram_username']) {
      expect(CHAVES_PESSOAIS).toContain(chave);
    }
  });
});
