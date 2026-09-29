import { describe, expect, it } from 'vitest';
import { fmtOdd, fmtDinheiro, fmtPct, fmtDecimal, fmtExato, fmtDecimalAte, fmtLinhaDeAposta, LOCALE_PADRAO, MOEDA_PADRAO } from './formato';

// ============================================================================
// Três réguas, e elas NÃO são a mesma (#529)
// ============================================================================
// O produto misturava três coisas num `toFixed` escrito à mão:
//
//   1. A odd, que segue a convenção do setor e é SEMPRE ponto
//   2. O dinheiro, que segue o país
//   3. Porcentagem e decimal, que seguem o país
//
// A prova da primeira está em página de operador: a Betsson escreve "cuota de
// 2.10" e "10.000 CLP" na MESMA página, para o mesmo chileno. A casa não aplica
// o separador do país à cotação.
//
// Hoje o produto já se contradizia: 41 lugares desenhavam a odd com ponto e 2
// com vírgula, e o dinheiro tinha cinco definições independentes — com o "R$"
// escrito à mão no JSX em três delas, que é o que não sobrevive a um segundo
// país.
//
// A LINHA da aposta é a quarta régua, e é a única ainda indecisa: ver
// `fmtLinhaDeAposta`.
// ============================================================================

describe('fmtOdd · a odd não tem pátria', () => {
  it('desenha com PONTO e duas casas', () => {
    expect(fmtOdd(2.5)).toBe('2.50');
    expect(fmtOdd(1.9)).toBe('1.90');
    expect(fmtOdd(10)).toBe('10.00');
  });

  it('não aceita locale, nem por engano', () => {
    // A assinatura é de um argumento só. Se um dia alguém tentar passar um
    // idioma aqui, o typecheck recusa — que é o ponto: a regra é a ausência
    // da escolha, não uma escolha bem feita.
    expect(fmtOdd.length).toBe(1);
  });

  it('vazio vira travessão, e não "NaN" nem zero', () => {
    // Zero seria uma odd, e odd zero não existe. Travessão é ausência.
    expect(fmtOdd(null)).toBe('—');
    expect(fmtOdd(undefined)).toBe('—');
    expect(fmtOdd(Number.NaN)).toBe('—');
  });
});

describe('fmtDinheiro · o dinheiro segue o país', () => {
  it('no padrão da casa, mostra o símbolo', () => {
    // O símbolo vem da moeda configurada, e não de um "R$" digitado na tela —
    // que era o caso em três lugares, e é o que não vira "S/" nem "$" sozinho.
    //
    // O espaço depois do R$ é NÃO-SEPARÁVEL (U+00A0), e está escapado aqui de
    // propósito: é o que o Intl devolve, é o que as quatro cópias que usavam
    // `style: 'currency'` já produziam, e um espaço comum no lugar faria este
    // teste falhar por um caractere que ninguém enxerga na diff.
    expect(fmtDinheiro(1234.5)).toBe('R$ 1.234,50');
  });

  it('acompanha o país quando o país muda', () => {
    expect(fmtDinheiro(1234.5, { locale: 'es-PE', moeda: 'PEN' })).toContain('1,234.50');
    expect(fmtDinheiro(1234.5, { locale: 'es-AR', moeda: 'ARS' })).toContain('1.234,50');
  });

  it('vazio vira travessão', () => {
    expect(fmtDinheiro(null)).toBe('—');
  });
});

describe('fmtPct e fmtDecimal · também seguem o país', () => {
  it('a porcentagem arredonda e leva o símbolo', () => {
    expect(fmtPct(0.4)).toBe('40%');
    expect(fmtPct(0.406, 1)).toBe('40,6%');
  });

  it('o decimal usa a vírgula da casa', () => {
    expect(fmtDecimal(2.45, 1)).toBe('2,5');
    expect(fmtDecimal(2.45, 2)).toBe('2,45');
  });

  it('vazio vira travessão nos dois', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtDecimal(null)).toBe('—');
  });
});

// Estes três casos são a razão de `fmtExato` existir separado, e cada um deles
// é uma saída que mudaria se a migração tivesse usado `fmtDecimal` ou o `Intl`
// de opções padrão no lugar do `String(v).replace('.', ',')` de hoje.
describe('fmtExato · o número como ele é', () => {
  it('não arredonda para três casas, que é onde o Intl padrão cortaria', () => {
    expect(fmtExato(0.12345)).toBe('0,12345');
  });

  it('não agrupa milhar, que é o que o String nunca fez', () => {
    expect(fmtExato(1234.5678)).toBe('1234,5678');
  });

  it('não completa casas: 0,05 não vira 0,1 nem 0,050', () => {
    // É o caso que o comentário de `exato` no futebol-criterio defende: a
    // diferença entre mostrar "faltou 0,05" e "faltou 0,1" é o dobro.
    expect(fmtExato(0.05)).toBe('0,05');
    expect(fmtDecimal(0.05, 1)).toBe('0,1');
  });

  it('o decimal de casas fixas também não agrupa', () => {
    expect(fmtDecimal(1234.5678, 1)).toBe('1234,6');
  });

  it('vazio vira travessão', () => {
    expect(fmtExato(null)).toBe('—');
  });

  it('até N casas não completa com zero', () => {
    expect(fmtDecimalAte(0.5, 2)).toBe('0,5');
    expect(fmtDecimalAte(0.05, 2)).toBe('0,05');
    expect(fmtDecimalAte(2, 2)).toBe('2');
    expect(fmtDecimalAte(0.456, 2)).toBe('0,46');
  });
});

describe('fmtLinhaDeAposta · a régua que ainda não foi decidida', () => {
  it('hoje segue o país, que é o que o produto já fazia', () => {
    expect(fmtLinhaDeAposta(2.5)).toBe('2,5');
    expect(fmtLinhaDeAposta(1.75)).toBe('1,75');
  });

  it('existe separada da odd, e é isso que a mantém trocável', () => {
    // Se as duas chamassem a mesma função, decidir que a linha segue o setor
    // (como a odd) ou o país seria impossível sem caçar os sete lugares de
    // novo. Este teste falha no dia em que alguém as fundir — de propósito.
    expect(fmtLinhaDeAposta(2.5)).not.toBe(fmtOdd(2.5));
  });

  it('vazio vira travessão', () => {
    expect(fmtLinhaDeAposta(null)).toBe('—');
  });
});

describe('o padrão da casa está num lugar só', () => {
  it('declara idioma e moeda como constante, não espalhado', () => {
    // É a linha que muda quando o produto falar espanhol. Uma linha, e não 46.
    expect(LOCALE_PADRAO).toBe('pt-BR');
    expect(MOEDA_PADRAO).toBe('BRL');
  });
});
