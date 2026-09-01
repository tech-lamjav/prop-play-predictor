import { describe, expect, it } from 'vitest';
import {
  FAIXA_ALTA_MIN,
  FAIXA_MEDIA_MIN,
  FAIXAS_FILTRO_PADRAO,
  edgeToneCls,
  ehDestaque,
  ehFaixaAlta,
  faixaTone,
  rotuloDaFaixa,
  fronteirasDoScore,
  opcoesDeFaixa,
  passaNoFiltroDeFaixas,
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
    expect(FAIXAS_FILTRO_PADRAO).toEqual(['alta', 'media']);
  });

  it('o padrão mostra Alta e Média e esconde Baixa', () => {
    expect(passaNoFiltroDeFaixas(FAIXAS_FILTRO_PADRAO, 'Alta')).toBe(true);
    expect(passaNoFiltroDeFaixas(FAIXAS_FILTRO_PADRAO, 'Média')).toBe(true);
    expect(passaNoFiltroDeFaixas(FAIXAS_FILTRO_PADRAO, 'Baixa')).toBe(false);
  });

  it('Baixa continua acessível por escolha explícita', () => {
    expect(passaNoFiltroDeFaixas(['baixa'], 'Baixa')).toBe(true);
    expect(passaNoFiltroDeFaixas(['baixa'], 'Alta')).toBe(false);
    expect(passaNoFiltroDeFaixas(['baixa'], 'Média')).toBe(false);
  });

  it('Todas não esconde nenhuma faixa', () => {
    for (const faixa of ['Alta', 'Média', 'Baixa']) {
      expect(passaNoFiltroDeFaixas(['alta', 'media', 'baixa'], faixa), faixa).toBe(true);
    }
  });

  it('Alta e Média isoladas mostram só a sua', () => {
    expect(passaNoFiltroDeFaixas(['alta'], 'Alta')).toBe(true);
    expect(passaNoFiltroDeFaixas(['alta'], 'Média')).toBe(false);
    expect(passaNoFiltroDeFaixas(['media'], 'Média')).toBe(true);
    expect(passaNoFiltroDeFaixas(['media'], 'Alta')).toBe(false);
  });

  it('oportunidade registrada sem faixa continua no padrão', () => {
    // Enviada no daily antes da migration 091: estava acima do corte naquele
    // dia, mas o número não foi guardado. Some do padrão e a lista apaga uma
    // oportunidade que existiu — inclusive em dia cujo seletor a contou.
    expect(passaNoFiltroDeFaixas(FAIXAS_FILTRO_PADRAO, null)).toBe(true);
    expect(passaNoFiltroDeFaixas(['alta', 'media', 'baixa'], null)).toBe(true);
  });

  it('mas ela não entra em nenhuma seleção que afirmaria a faixa dela', () => {
    // Com só Alta marcada, exibi-la é dizer que era Alta — e o número não foi
    // guardado. Vale para toda seleção que não tenha Alta e Média juntas.
    expect(passaNoFiltroDeFaixas(['alta'], null)).toBe(false);
    expect(passaNoFiltroDeFaixas(['media'], null)).toBe(false);
    expect(passaNoFiltroDeFaixas(['baixa'], null)).toBe(false);
    expect(passaNoFiltroDeFaixas(['alta', 'baixa'], null)).toBe(false);
    expect(passaNoFiltroDeFaixas(['media', 'baixa'], null)).toBe(false);
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
