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
  escalaDeExibicao,
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
    // Uma nota exatamente 30 é Média; exatamente 60 é Alta.
    expect(FAIXA_MEDIA_MIN).toBe(30);
    expect(FAIXA_ALTA_MIN).toBe(60);
  });

  it('a legenda descreve as três faixas sem furo nem sobreposição', () => {
    const [alta, media, baixa] = opcoesDeFaixa('contexto_v1');
    expect(alta).toEqual({ tone: 'alta', rotulo: 'Alta', selo: '60+' });
    expect(media).toEqual({ tone: 'media', rotulo: 'Média', selo: '30+' });
    expect(baixa).toEqual({ tone: 'baixa', rotulo: 'Baixa', selo: '<30' });
  });

  it('na escala antiga a legenda mostra os números antigos', () => {
    // O histórico é point-in-time e continua devolvendo linhas legacy. Anunciar
    // 60+ ali classificaria errado: uma nota legacy de 57 é Média.
    expect(fronteirasDoScore('legacy')).toEqual({ media: 40, alta: 60 });
    expect(fronteirasDoScore('contexto_v1')).toEqual({ media: 30, alta: 60 });
    expect(opcoesDeFaixa('legacy').map((o) => o.selo)).toEqual(['60+', '40+', '<40']);
  });

  // ==========================================================================
  // A tradução do histórico não pode ser apagada junto com o contrato antigo
  // ==========================================================================
  // A contração do #310 removeu o contrato legacy do board — a inferência por
  // forma, os componentes de preço, os defaults zerados. O que NÃO pode sair é
  // isto aqui: `legacy` continua sendo a escala de 19.229 oportunidades
  // anteriores ao cutover de 03/09/2026, e ela tem régua própria.
  //
  // O teste acima fixa os NÚMEROS. Este fixa a CONSEQUÊNCIA, que é o que a
  // pessoa da próxima faxina precisa ver antes de apagar o ramo de 40/60.
  // ==========================================================================
  it('a mesma nota cai em faixas diferentes nas duas escalas', () => {
    // Classifica pela régua da escala, que é o que o backend faz. Escrito aqui
    // porque o front não classifica de propósito — ele lê a faixa pronta. Sem
    // isto o teste compararia números com os mesmos números, e passaria a
    // dizer bem menos do que parece.
    const faixaDe = (score: number, escala: 'legacy' | 'contexto_v1') => {
      const { media, alta } = fronteirasDoScore(escala);
      return score >= alta ? 'Alta' : score >= media ? 'Média' : 'Baixa';
    };

    // Apagar o ramo de legacy é promover esta oportunidade de Baixa para Média
    // anos depois — a tela reescrevendo o passado de quem apostou.
    expect(faixaDe(35, 'legacy')).toBe('Baixa');
    expect(faixaDe(35, 'contexto_v1')).toBe('Média');
  });
});

// ============================================================================
// A escala que a tela usa quando a janela não declara nenhuma (#310)
// ============================================================================
// `versaoDaJanela` devolve `indefinida` para janela vazia ou mista, e cada tela
// resolvia isso por conta própria — as duas caindo em `legacy`. A justificativa
// escrita era a inferência por forma do contrato antigo, que a contração matou.
//
// Com ela morta, o padrão virou defeito: dia sem oportunidade publicada é
// janela vazia, e a tela real passava a explicar o Score pela fórmula
// aposentada, dizendo que ele "junta o cenário com o quanto a odd paga acima do
// risco". O preço saiu do Score em 03/09.
// ============================================================================

describe('escala de exibição da janela', () => {
  const linha = (score_versao?: 'legacy' | 'contexto_v1') => ({ score_versao });

  it('janela vazia usa a escala que o produto publica hoje', () => {
    expect(escalaDeExibicao([])).toBe('contexto_v1');
  });

  it('janela que mistura as duas escalas também', () => {
    expect(escalaDeExibicao([linha('legacy'), linha('contexto_v1')])).toBe('contexto_v1');
  });

  it('janela sem nenhuma linha que declare versão também', () => {
    // É o caso da oportunidade registrada, que vem de uma tabela sem versão.
    expect(escalaDeExibicao([linha(), linha()])).toBe('contexto_v1');
  });

  it('mas janela realmente antiga continua sendo lida na régua antiga', () => {
    // O histórico point-in-time devolve linhas legacy, e ali acompanhar é o
    // certo: a legenda tem de anunciar 40+, não 30+.
    expect(escalaDeExibicao([linha('legacy')])).toBe('legacy');
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
