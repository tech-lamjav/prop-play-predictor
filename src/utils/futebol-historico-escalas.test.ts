import { describe, expect, it } from 'vitest';
import {
  compararOportunidades,
  opcoesDeFaixa,
  ordemDaFaixa,
  versaoDaJanela,
} from './futebol-score';

// ============================================================================
// Histórico point-in-time convivendo com o Score de contexto (issue #307)
// ============================================================================
// O histórico guarda a nota como ela foi publicada, e continua devolvendo
// linhas da escala antiga para sempre. A tela precisa conviver com isso sem
// recalcular nada e sem colocar as duas escalas lado a lado como se fossem a
// mesma régua.
// ============================================================================

const linha = (faixa: string | null, score: number | null, score_versao?: 'legacy' | 'contexto_v1') => ({
  faixa,
  score,
  score_versao,
});

describe('a escala da janela', () => {
  it('é a antiga enquanto só houver registro antigo', () => {
    expect(versaoDaJanela([linha('Alta', 62, 'legacy')])).toBe('legacy');
  });

  it('é a nova quando a janela inteira já virou', () => {
    expect(versaoDaJanela([linha('Alta', 62, 'contexto_v1')])).toBe('contexto_v1');
  });

  it('é indefinida no dia da virada, quando as duas convivem', () => {
    // A lista do dia corrente une a foto do apito com o board.
    expect(
      versaoDaJanela([linha('Alta', 62, 'legacy'), linha('Alta', 58, 'contexto_v1')]),
    ).toBe('indefinida');
  });

  it('é indefinida sem nenhuma linha que declare escala', () => {
    // Dia futuro que ainda não tem board, e a oportunidade registrada, que vem
    // de uma tabela sem coluna de versão. Nos dois casos o número seria chute.
    expect(versaoDaJanela([])).toBe('indefinida');
    expect(versaoDaJanela([linha(null, null)])).toBe('indefinida');
  });

  it('a registrada não arrasta a janela para indefinida sozinha', () => {
    // Era o defeito: carimbada de legacy, ela aparecia em quase todo dia e a
    // legenda ficava sem números para sempre, não só na virada.
    expect(
      versaoDaJanela([linha('Alta', 58, 'contexto_v1'), linha(null, null)]),
    ).toBe('contexto_v1');
  });
});

describe('a legenda não afirma número quando as escalas convivem', () => {
  it('some com os cortes na janela indefinida, e mantém as três faixas', () => {
    const opcoes = opcoesDeFaixa('indefinida');

    expect(opcoes.map((o) => o.tone)).toEqual(['alta', 'media', 'baixa']);
    expect(opcoes.map((o) => o.selo)).toEqual([null, null, null]);
  });

  it('nas janelas de uma escala só, o número aparece', () => {
    expect(opcoesDeFaixa('contexto_v1').map((o) => o.selo)).toEqual(['55+', '25+', '<25']);
    expect(opcoesDeFaixa('legacy').map((o) => o.selo)).toEqual(['60+', '40+', '<40']);
  });
});

describe('a lista ranqueia por faixa antes do Score', () => {
  it('não põe um Score de uma escala à frente da faixa da outra', () => {
    // 46 na escala antiga é Média; 46 na escala nova é Alta. Ordenar só pelo
    // número colocaria as duas empatadas, afirmando uma comparação que não
    // existe. A faixa é o que as duas escalas têm em comum.
    const legacyMedia = linha('Média', 46, 'legacy');
    const contextoAlta = linha('Alta', 46, 'contexto_v1');

    expect([legacyMedia, contextoAlta].sort(compararOportunidades)).toEqual([
      contextoAlta,
      legacyMedia,
    ]);
  });

  it('dentro da mesma faixa, o Score continua desempatando', () => {
    const maior = linha('Alta', 71, 'contexto_v1');
    const menor = linha('Alta', 58, 'contexto_v1');

    expect([menor, maior].sort(compararOportunidades)).toEqual([maior, menor]);
  });

  it('registrada sem Score continua vindo primeiro', () => {
    // Ela foi enviada no daily, ou seja, estava entre as melhores do dia. O que
    // falta é o número, não a qualidade da leitura.
    const registrada = linha(null, null);
    const alta = linha('Alta', 71, 'contexto_v1');

    expect([alta, registrada].sort(compararOportunidades)).toEqual([registrada, alta]);
  });

  it('mas linha COM nota e sem banda não é promovida ao topo', () => {
    // A promoção olha o Score, não a faixa. Chaveando pela faixa, uma linha com
    // nota e sem banda declarada passava na frente de toda oportunidade Alta.
    const semBanda = linha(null, 44, 'contexto_v1');
    const alta = linha('Alta', 71, 'contexto_v1');

    expect([semBanda, alta].sort(compararOportunidades)).toEqual([alta, semBanda]);
    expect(ordemDaFaixa(null)).toBeGreaterThan(ordemDaFaixa('Baixa'));
  });

  it('a ordem das faixas é alta, média, baixa', () => {
    expect(ordemDaFaixa('Alta')).toBeLessThan(ordemDaFaixa('Média'));
    expect(ordemDaFaixa('Média')).toBeLessThan(ordemDaFaixa('Baixa'));
  });
});
