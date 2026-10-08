import { afterEach, describe, expect, it } from 'vitest';
import { definirMoedaAtiva, moedaAtiva, moedaEscolhida, localeDaMoedaAtiva } from './moeda-ativa';
import { MOEDA_PADRAO, MOEDAS, moedaDoPais } from '@/config/moedas';
import { fmtDinheiro, fmtDinheiroDaPessoa } from './formato';

// ============================================================================
// A moeda é preferência de EXIBIÇÃO
// ============================================================================
// ⚠️ O CRITÉRIO QUE MANDA AQUI É "O NÚMERO NÃO MUDA". Trocar a moeda troca o
// símbolo e a pontuação, nunca o valor — 1.500 continua 1.500. É decisão de
// produto: o registro de apostas não afirma em que moeda cada aposta foi feita,
// e por isso não existe coluna de moeda no banco.
//
// O teste mais importante deste arquivo é o último.
// ============================================================================

describe('a moeda que a tela escreve', () => {
  afterEach(() => definirMoedaAtiva(MOEDA_PADRAO));

  it('vem do país do cadastro', () => {
    expect(moedaDoPais('BR')).toBe('BRL');
    expect(moedaDoPais('PE')).toBe('PEN');
    expect(moedaDoPais('AR')).toBe('ARS');
    expect(moedaDoPais('MX')).toBe('MXN');
    expect(moedaDoPais('CL')).toBe('CLP');
  });

  it('cai no real quando o país é desconhecido ou falta', () => {
    expect(moedaDoPais('XX')).toBe(MOEDA_PADRAO);
    expect(moedaDoPais(null)).toBe(MOEDA_PADRAO);
    expect(moedaDoPais(undefined)).toBe(MOEDA_PADRAO);
  });

  it('o país do cadastro manda quando não houve escolha explícita', () => {
    expect(moedaEscolhida('PE')).toBe('PEN');
    expect(moedaEscolhida('BR')).toBe('BRL');
  });

  it('recusa moeda que não conhece, em vez de escrever lixo na tela', () => {
    definirMoedaAtiva('XYZ');
    expect(moedaAtiva()).toBe(MOEDA_PADRAO);
  });

  it('escreve a moeda no idioma DELA, e não no da interface', () => {
    // Sem isto, sol peruano numa tela em português sairia "PEN 1.500,00":
    // símbolo certo, pontuação do país errado.
    definirMoedaAtiva('PEN');
    expect(localeDaMoedaAtiva()).toBe('es-PE');
    definirMoedaAtiva('BRL');
    expect(localeDaMoedaAtiva()).toBe('pt-BR');
  });

  it('o seletor não repete moeda', () => {
    // O euro aparece em cinco países da lista e o dólar em dois.
    const codigos = MOEDAS.map((m) => m.codigo);
    expect(codigos.length).toBe(new Set(codigos).size);
    expect(codigos[0]).toBe('BRL');
    expect(codigos).toContain('PEN');
  });

  it('⚠️ trocar a moeda NÃO muda o número', () => {
    // O critério da decisão de produto inteira. Se este teste cair, alguém
    // transformou preferência de exibição em conversão — e aí o histórico de
    // ROI e de lucro passou a afirmar outra coisa.
    const soNumeros = (s: string) => s.replace(/[^\d]/g, '');

    definirMoedaAtiva('BRL');
    const emReal = fmtDinheiroDaPessoa(1500.5);
    definirMoedaAtiva('PEN');
    const emSol = fmtDinheiroDaPessoa(1500.5);

    expect(soNumeros(emSol), `"${emReal}" virou "${emSol}"`).toBe(soNumeros(emReal));
    expect(emSol).not.toBe(emReal); // o símbolo mudou, senão nada aconteceu
  });

  it('o português de hoje não muda', () => {
    // Quem está em real continua vendo exatamente o que vê hoje.
    definirMoedaAtiva(MOEDA_PADRAO);
    // O `Intl` separa símbolo e número com espaço NÃO SEPARÁVEL, que é
    // invisível na comparação e faz duas strings idênticas na tela reprovarem.
    expect(fmtDinheiroDaPessoa(1500.5).replace(/\u00a0/g, ' ')).toBe('R$ 1.500,50');
  });

  it('⚠️ dinheiro de moeda FIXA continua em real, seja qual for a escolha', () => {
    // O defeito que este teste segura: o padrão do formatador chegou a seguir
    // a moeda escolhida, e a receita do Stripe no CRM — real de verdade —
    // saía com "S/" para quem tivesse escolhido sol. Rotular real como outra
    // moeda é pior que não traduzir.
    definirMoedaAtiva('PEN');
    expect(fmtDinheiro(1500.5).replace(/\u00a0/g, ' ')).toBe('R$ 1.500,50');
    expect(fmtDinheiroDaPessoa(1500.5)).toContain('S/');
  });
});
