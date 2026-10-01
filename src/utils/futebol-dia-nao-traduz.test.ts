import { afterEach, describe, expect, it } from 'vitest';
import { brtDateStr, brtDayOf, fmtDayHeader } from './futebol-datas';
import { definirLocaleAtivo, LOCALE_PADRAO } from './idioma-ativo';

// ============================================================================
// A chave do dia NÃO é traduzível (#530)
// ============================================================================
// Este módulo tem dois formatadores que parecem iguais e não são:
//
//   · um escreve para PESSOA LER — "qui, 01/10", "1 de outubro"
//   · outro escreve `en-CA` para a MÁQUINA, porque isso dá `2026-10-01`,
//     que é ordenável como string e é a CHAVE que agrupa os jogos por dia
//
// Traduzir o segundo não muda rótulo nenhum. Muda a CHAVE, e o agrupamento
// quebra em silêncio: a regra desta casa é que o dia de um jogo vem do kickoff
// convertido para Brasília, e 288 dos 2.128 jogos de 2026 são noturnos — eles
// cairiam no dia seguinte.
//
// Foi por isso que data não foi junto com número no #529, e é isto que esta
// guarda existe para impedir. Ela é a única razão de a costura de data ter
// nome próprio em vez de ser mais uma troca de `pt-BR` por idioma ativo.
// ============================================================================

const JOGO_NOTURNO = '2026-10-01T00:30:00Z'; // 21:30 de 30/09 em Brasília

describe('a chave do dia ignora o idioma', () => {
  afterEach(() => definirLocaleAtivo(LOCALE_PADRAO));

  it('é a mesma em português e em espanhol', () => {
    const d = new Date(JOGO_NOTURNO);
    const emPortugues = brtDateStr(d);
    definirLocaleAtivo('es-419');
    expect(brtDateStr(d), 'a chave do dia mudou com o idioma').toBe(emPortugues);
  });

  it('continua no formato ordenável, que é o que a torna chave', () => {
    definirLocaleAtivo('es-419');
    // Se virasse "01/10/2026" a ordenação por string quebraria, e o
    // agrupamento junto — sem nenhum erro, só com o dia errado.
    expect(brtDateStr(new Date(JOGO_NOTURNO))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('⚠️ o jogo noturno continua caindo no dia de Brasília', () => {
    // É o caso que custou a regra: 00:30 UTC de 01/10 é 21:30 de 30/09 em
    // Brasília. Agrupar pela data UTC jogaria 288 jogos para o dia seguinte.
    definirLocaleAtivo('es-419');
    expect(brtDayOf(JOGO_NOTURNO)).toBe('2026-09-30');
  });
});

describe('o rótulo que a pessoa lê, esse sim acompanha', () => {
  afterEach(() => definirLocaleAtivo(LOCALE_PADRAO));

  it('muda de idioma, ao contrário da chave', () => {
    // ⚠️ Recebe a CHAVE do dia, não um kickoff — quem agrupa já resolveu o
    // fuso. Passar um timestamp aqui devolve travessão, e a primeira versão
    // deste teste fez exatamente isso: comparou dois travessões e "passou"
    // sem exercitar nada.
    const dia = '2026-10-01';
    const emPortugues = fmtDayHeader(dia);
    definirLocaleAtivo('es-419');
    const emEspanhol = fmtDayHeader(dia);

    // O teste não crava as frases: elas são do CLDR e podem mudar com a
    // versão do navegador. O que ele cobra é a DIFERENÇA — se as duas saírem
    // iguais, o rótulo parou de seguir o idioma e ninguém notaria.
    expect(emEspanhol, `as duas saíram "${emPortugues}"`).not.toBe(emPortugues);
  });
});
