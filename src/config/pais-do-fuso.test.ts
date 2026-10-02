import { describe, expect, it } from 'vitest';
import { paisDoFuso } from './pais-do-fuso';
import { PAISES, PAIS_PADRAO } from './paises';

// ============================================================================
// O chute inicial do campo de país
// ============================================================================
// O cadastro abria sempre no Brasil. Para o lançamento em Peru, Argentina,
// México e Chile isso é o padrão errado para todo mundo que o lançamento quer
// alcançar — e o campo é obrigatório, então era um clique cobrado de cada
// pessoa de fora.
// ============================================================================

describe('o país do fuso', () => {
  it('acerta os cinco países da operação', () => {
    expect(paisDoFuso('America/Sao_Paulo')).toBe('BR');
    expect(paisDoFuso('America/Lima')).toBe('PE');
    expect(paisDoFuso('America/Argentina/Buenos_Aires')).toBe('AR');
    expect(paisDoFuso('America/Mexico_City')).toBe('MX');
    expect(paisDoFuso('America/Santiago')).toBe('CL');
  });

  it('cobre a Argentina inteira pelo prefixo, e não cidade por cidade', () => {
    // Nenhum dos doze fusos argentinos se chama "Argentina": são cidades. Ler o
    // prefixo é o que não quebra quando a base de fusos muda de cidade.
    for (const cidade of ['Cordoba', 'Mendoza', 'Ushuaia', 'Salta', 'Jujuy', 'San_Luis']) {
      expect(paisDoFuso(`America/Argentina/${cidade}`), cidade).toBe('AR');
    }
  });

  it('cai no padrão quando não conhece o fuso', () => {
    expect(paisDoFuso('Asia/Kolkata')).toBe(PAIS_PADRAO);
    expect(paisDoFuso('')).toBe(PAIS_PADRAO);
    expect(paisDoFuso('lixo')).toBe(PAIS_PADRAO);
  });

  it('nunca devolve país que o seletor não oferece', () => {
    // ⚠️ É A GARANTIA QUE IMPORTA. Um palpite fora da lista deixaria o campo
    // mostrando um país que a pessoa não consegue escolher de novo se trocar
    // por engano — pior que o padrão errado.
    const oferecidos = new Set(PAISES.map((p) => p.codigo));
    const fusos = [
      'America/Sao_Paulo', 'America/Lima', 'America/Argentina/Cordoba',
      'America/Mexico_City', 'America/Santiago', 'Europe/Lisbon', 'Asia/Tokyo',
      'Asia/Kolkata', 'Africa/Nairobi', 'Antarctica/Troll', '',
    ];
    for (const fuso of fusos) {
      expect(oferecidos.has(paisDoFuso(fuso)), `${fuso} devolveu país de fora da lista`).toBe(true);
    }
  });

  it('funciona sem argumento, lendo o navegador', () => {
    // Não dá para afirmar QUAL país sai aqui: depende da máquina que roda o
    // teste. Dá para afirmar que sai um da lista, que é o contrato.
    expect(PAISES.map((p) => p.codigo)).toContain(paisDoFuso());
  });
});
