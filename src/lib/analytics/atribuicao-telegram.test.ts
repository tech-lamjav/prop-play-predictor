import { beforeEach, describe, expect, it } from 'vitest';
import {
  VALIDADE_MS,
  atribuicaoGuardada,
  chegadaAReportar,
  guardarAtribuicao,
  lerAtribuicaoDaUrl,
  limparAtribuicao,
  marcarChegadaDisparada,
  tempoDesdeOEnvioMs,
} from './atribuicao-telegram';

// ============================================================================
// A atribuição do Telegram atravessa o login — ou não vale nada
// ============================================================================
// O link do bot chega com `delivery_id` na query. Se a pessoa está deslogada, a
// rota protegida a manda para /auth, o Google a leva para fora do site e ela
// volta em /auth/callback — e a query original não sobrevive a essa viagem.
//
// Sem guardar, TODA chegada de quem estava deslogado seria contada como
// "direto", e a campanha pareceria não converter justamente no público que
// mais precisa de login. É o mesmo problema que o `lib/oauth-state.ts` já
// resolve para o código de indicação.
// ============================================================================

const URL_COMPLETA =
  '?delivery_id=d1&batch_id=b1&link_id=l1&campaign_id=c1' +
  '&campaign_type=published_opportunities&opportunity_id=123%7Cmatch_winner%7CHome%7C' +
  '&segment=A&sent_at=2026-09-19T10%3A00%3A00Z' +
  '&utm_source=telegram&utm_medium=bot&utm_campaign=publicadas&utm_content=pick1';

beforeEach(() => {
  limparAtribuicao();
});

describe('lerAtribuicaoDaUrl', () => {
  it('lê os parâmetros todos', () => {
    const a = lerAtribuicaoDaUrl(URL_COMPLETA);

    expect(a).not.toBeNull();
    expect(a!.delivery_id).toBe('d1');
    expect(a!.batch_id).toBe('b1');
    expect(a!.link_id).toBe('l1');
    expect(a!.campaign_id).toBe('c1');
    expect(a!.campaign_type).toBe('published_opportunities');
    expect(a!.segment).toBe('A');
    expect(a!.utm_source).toBe('telegram');
    expect(a!.utm_medium).toBe('bot');
  });

  it('o `opportunity_id` chega com a chave composta inteira', () => {
    // A identidade de uma oportunidade é `fixture|mercado|saída|linha`, e as
    // barras vão percent-encoded na URL. Se o decode falhar, a chave chega
    // partida e não casa com nenhum evento da tela.
    const a = lerAtribuicaoDaUrl(URL_COMPLETA);
    expect(a!.opportunity_id).toBe('123|match_winner|Home|');
  });

  it('sem `delivery_id` não há atribuição, mesmo com utm_source=telegram', () => {
    // Um `utm_source=telegram` solto pode ter sido copiado e colado por
    // qualquer um. Creditar uma ENTREGA específica a partir disso seria
    // inventar a entrega.
    expect(lerAtribuicaoDaUrl('?utm_source=telegram&utm_medium=bot')).toBeNull();
  });

  it('query vazia não vira atribuição', () => {
    expect(lerAtribuicaoDaUrl('')).toBeNull();
  });
});

describe('tempoDesdeOEnvioMs', () => {
  it('mede do envio até agora', () => {
    const enviado = '2026-09-19T10:00:00Z';
    const agora = Date.parse('2026-09-19T10:05:00Z');
    expect(tempoDesdeOEnvioMs(enviado, agora)).toBe(5 * 60 * 1000);
  });

  it('sem envio, não inventa zero', () => {
    // Zero diria "chegou no mesmo instante do envio", que é uma afirmação.
    // Nulo diz "não sei", que é a verdade.
    expect(tempoDesdeOEnvioMs(null)).toBeNull();
  });

  it('data podre é nulo, não NaN', () => {
    expect(tempoDesdeOEnvioMs('ontem de manhã')).toBeNull();
  });

  it('negativo vira nulo: relógio adiantado não cria viagem no tempo', () => {
    const enviado = '2026-09-19T10:00:00Z';
    const agora = Date.parse('2026-09-19T09:55:00Z');
    expect(tempoDesdeOEnvioMs(enviado, agora)).toBeNull();
  });
});

describe('a guarda e a validade', () => {
  it('guarda e devolve dentro do prazo', () => {
    const a = lerAtribuicaoDaUrl(URL_COMPLETA)!;
    const t0 = 1_000_000;
    guardarAtribuicao(a, t0);

    expect(atribuicaoGuardada(t0 + 60_000)?.delivery_id).toBe('d1');
  });

  it('vence depois de duas horas', () => {
    // Atribuição velha é pior que nenhuma: ela credita ao Telegram uma visita
    // que o Telegram não causou.
    const a = lerAtribuicaoDaUrl(URL_COMPLETA)!;
    const t0 = 1_000_000;
    guardarAtribuicao(a, t0);

    expect(atribuicaoGuardada(t0 + VALIDADE_MS + 1)).toBeNull();
  });

  it('vencida é apagada, não só ignorada', () => {
    const a = lerAtribuicaoDaUrl(URL_COMPLETA)!;
    guardarAtribuicao(a, 0);
    atribuicaoGuardada(VALIDADE_MS + 1);

    // Mesmo perguntando de novo num instante "válido", não volta: a leitura
    // vencida já limpou. Deixá-la ali só adiaria o engano.
    expect(atribuicaoGuardada(VALIDADE_MS + 2)).toBeNull();
  });
});

describe('chegadaAReportar — uma vez por abertura do link', () => {
  it('a primeira visita com o parâmetro reporta', () => {
    const c = chegadaAReportar(URL_COMPLETA, 1000);
    expect(c?.delivery_id).toBe('d1');
    expect(c?.chegada_disparada).toBe(false);
  });

  it('a mesma URL remontando não reporta de novo', () => {
    chegadaAReportar(URL_COMPLETA, 1000);
    marcarChegadaDisparada();

    // Voltar pelo histórico, trocar de aba, StrictMode montando o efeito duas
    // vezes — tudo isso reencontra a MESMA entrega.
    expect(chegadaAReportar(URL_COMPLETA, 2000)).toBeNull();
  });

  it('sobrevive ao login: sem parâmetro na volta, ainda reporta', () => {
    // Chega deslogado em /futebol/jogo/123?delivery_id=... → vai para /auth →
    // Google → volta em /auth/callback, SEM query nenhuma.
    chegadaAReportar(URL_COMPLETA, 1000);

    const naVolta = chegadaAReportar('', 5000);
    expect(naVolta?.delivery_id).toBe('d1');
  });

  it('depois de reportada, a volta do login não reporta segunda vez', () => {
    chegadaAReportar(URL_COMPLETA, 1000);
    marcarChegadaDisparada();

    expect(chegadaAReportar('', 5000)).toBeNull();
  });

  it('entrega NOVA reporta de novo, mesmo com uma anterior guardada', () => {
    chegadaAReportar(URL_COMPLETA, 1000);
    marcarChegadaDisparada();

    const outra = chegadaAReportar('?delivery_id=d2&batch_id=b2', 2000);
    expect(outra?.delivery_id).toBe('d2');
    expect(outra?.chegada_disparada).toBe(false);
  });

  it('sem nada guardado e sem parâmetro, não reporta', () => {
    expect(chegadaAReportar('?foo=bar', 1000)).toBeNull();
  });

  it('a atribuição CONTINUA guardada depois de reportada', () => {
    // De propósito: ela ainda precisa etiquetar a oportunidade que a pessoa
    // abrir em seguida. O que a marca impede é o segundo evento de CHEGADA.
    chegadaAReportar(URL_COMPLETA, 1000);
    marcarChegadaDisparada();

    expect(atribuicaoGuardada(2000)?.delivery_id).toBe('d1');
  });
});
