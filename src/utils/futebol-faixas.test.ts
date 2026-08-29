import { describe, expect, it } from 'vitest';
import {
  FAIXA_ALTA_MIN,
  FAIXA_MEDIA_MIN,
  FAIXA_FILTRO_PADRAO,
  edgeToneCls,
  ehDestaque,
  ehFaixaAlta,
  faixaTone,
  rotuloDaFaixa,
  fronteirasDoScore,
  opcoesDeFaixa,
  passaNoFiltroDeFaixa,
  versaoPredominante,
} from './futebol-score';

// ============================================================================
// Faixas do Score de contexto (issue #305, spec #301)
// ============================================================================
// Quem classifica é o backend: a faixa chega pronta na resposta e o front só
// lê. O que mora aqui é o filtro da tela e a legenda — e as fronteiras, que
// existem em UM lugar só para a legenda não voltar a mentir o número.
// ============================================================================

describe('fronteiras da faixa', () => {
  it('pertencem à faixa de cima', () => {
    // Uma nota exatamente 25 é Média; exatamente 55 é Alta.
    expect(FAIXA_MEDIA_MIN).toBe(25);
    expect(FAIXA_ALTA_MIN).toBe(55);
  });

  it('a legenda descreve as três faixas sem furo nem sobreposição', () => {
    const [alta, media, baixa] = opcoesDeFaixa('contexto_v1');
    expect(alta).toEqual({ tone: 'alta', rotulo: 'Alta', selo: '55+' });
    expect(media).toEqual({ tone: 'media', rotulo: 'Média', selo: '25+' });
    expect(baixa).toEqual({ tone: 'baixa', rotulo: 'Baixa', selo: '<25' });
  });

  it('na escala antiga a legenda mostra os números antigos', () => {
    // Entre esta entrega e a troca do mart o board ainda vem em legacy. Anunciar
    // 55+ ali classificaria errado: uma nota legacy de 57 é Média.
    expect(fronteirasDoScore('legacy')).toEqual({ media: 40, alta: 60 });
    expect(fronteirasDoScore('contexto_v1')).toEqual({ media: 25, alta: 55 });
    expect(opcoesDeFaixa('legacy').map((o) => o.selo)).toEqual(['60+', '40+', '<40']);
  });

  it('basta uma linha no contrato novo para a leitura ser a nova', () => {
    // O histórico traz linhas legacy para sempre; elas não podem prender a
    // legenda na escala antiga depois da virada.
    expect(versaoPredominante([])).toBe('legacy');
    expect(versaoPredominante([{ score_versao: 'legacy' }])).toBe('legacy');
    expect(versaoPredominante([{ score_versao: 'legacy' }, { score_versao: 'contexto_v1' }]))
      .toBe('contexto_v1');
  });
});

describe('faixaTone lê a classificação do backend', () => {
  it.each([
    ['Alta', 'alta'],
    ['alta', 'alta'],
    ['Média', 'media'],
    ['Media', 'media'],
    ['Baixa', 'baixa'],
  ])('%s vira %s', (recebido, esperado) => {
    expect(faixaTone(recebido)).toBe(esperado);
  });
});

describe('filtro de faixa do painel', () => {
  it('abre em Alta e Média', () => {
    expect(FAIXA_FILTRO_PADRAO).toBe('destaque');
  });

  it('o padrão mostra Alta e Média e esconde Baixa', () => {
    expect(passaNoFiltroDeFaixa('destaque', 'Alta')).toBe(true);
    expect(passaNoFiltroDeFaixa('destaque', 'Média')).toBe(true);
    expect(passaNoFiltroDeFaixa('destaque', 'Baixa')).toBe(false);
  });

  it('Baixa continua acessível por escolha explícita', () => {
    expect(passaNoFiltroDeFaixa('baixa', 'Baixa')).toBe(true);
    expect(passaNoFiltroDeFaixa('baixa', 'Alta')).toBe(false);
    expect(passaNoFiltroDeFaixa('baixa', 'Média')).toBe(false);
  });

  it('Todas não esconde nenhuma faixa', () => {
    for (const faixa of ['Alta', 'Média', 'Baixa']) {
      expect(passaNoFiltroDeFaixa('all', faixa), faixa).toBe(true);
    }
  });

  it('Alta e Média isoladas mostram só a sua', () => {
    expect(passaNoFiltroDeFaixa('alta', 'Alta')).toBe(true);
    expect(passaNoFiltroDeFaixa('alta', 'Média')).toBe(false);
    expect(passaNoFiltroDeFaixa('media', 'Média')).toBe(true);
    expect(passaNoFiltroDeFaixa('media', 'Alta')).toBe(false);
  });

  it('oportunidade registrada sem faixa continua no padrão', () => {
    // Enviada no daily antes da migration 091: estava acima do corte naquele
    // dia, mas o número não foi guardado. Some do padrão e a lista apaga uma
    // oportunidade que existiu — inclusive em dia cujo seletor a contou.
    expect(passaNoFiltroDeFaixa('destaque', null)).toBe(true);
    expect(passaNoFiltroDeFaixa('all', null)).toBe(true);
  });

  it('mas ela não entra nos filtros específicos, que afirmariam uma faixa', () => {
    expect(passaNoFiltroDeFaixa('alta', null)).toBe(false);
    expect(passaNoFiltroDeFaixa('media', null)).toBe(false);
    expect(passaNoFiltroDeFaixa('baixa', null)).toBe(false);
  });
});

describe('rótulo e testes de faixa saem da classificação do backend', () => {
  it('traduz a faixa em palavras sem olhar o número do Score', () => {
    expect(rotuloDaFaixa('Alta')).toBe('faixa alta');
    expect(rotuloDaFaixa('Média')).toBe('faixa média');
    expect(rotuloDaFaixa('Baixa')).toBe('faixa baixa');
    expect(rotuloDaFaixa(null)).toBe('sem faixa');
  });

  it('destaque é Alta ou Média; faixa alta é só Alta', () => {
    expect(ehDestaque('Alta')).toBe(true);
    expect(ehDestaque('Média')).toBe(true);
    expect(ehDestaque('Baixa')).toBe(false);
    expect(ehDestaque(null)).toBe(false);

    expect(ehFaixaAlta('Alta')).toBe(true);
    expect(ehFaixaAlta('Média')).toBe(false);
    expect(ehFaixaAlta(null)).toBe(false);
  });
});

describe('cor da diferença para o preço justo', () => {
  it('positivo usa verde da marca', () => {
    expect(edgeToneCls(0.12)).toBe('text-forest');
  });

  it('zero e negativo usam cor neutra, nunca vermelho de erro', () => {
    // A diferença é informativa. Pintar de vermelho leria como defeito da
    // leitura, e um preço abaixo do justo não invalida o contexto.
    expect(edgeToneCls(0)).toBe('text-ink-2');
    expect(edgeToneCls(-0.03)).toBe('text-ink-2');
  });

  it('ausência de preço cai no neutro em vez de inventar sinal', () => {
    expect(edgeToneCls(null)).toBe('text-ink-2');
    expect(edgeToneCls(undefined)).toBe('text-ink-2');
  });
});
