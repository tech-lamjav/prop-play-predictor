import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { comDia, PARAM_DO_DIA } from './use-dia-na-url';

// ============================================================================
// O dia atravessa a navegação
// ============================================================================
// O defeito que isto impede: estando em "amanhã" na home e clicando em "Ver
// todas", a lista abria em HOJE. O destino nascia com estado zerado e caía no
// padrão, e a pessoa achava que tinha clicado errado.
//
// O guarda de fonte no fim é o que segura a regressão de verdade: um `to=`
// escrito à mão numa das telas volta a perder o dia, e nenhum teste de unidade
// perceberia.
// ============================================================================

const fonte = (caminho: string) =>
  readFileSync(resolve(__dirname, '..', caminho), 'utf8').replace(/\r\n/g, '\n');

const HOME = fonte('pages/FutebolHoje.tsx');

describe('comDia', () => {
  it('carrega o dia escolhido para a rota de destino', () => {
    expect(comDia('/futebol/oportunidades', '2026-09-11')).toBe(
      `/futebol/oportunidades?${PARAM_DO_DIA}=2026-09-11`,
    );
  });

  it('sem dia, o destino fica limpo em vez de ganhar parâmetro vazio', () => {
    expect(comDia('/futebol/jogos', null)).toBe('/futebol/jogos');
    expect(comDia('/futebol/jogos', undefined)).toBe('/futebol/jogos');
  });

  it('dia malformado não vira parâmetro', () => {
    // Vem da URL, então vem de fora: qualquer coisa pode chegar aqui.
    expect(comDia('/futebol/jogos', 'amanhã')).toBe('/futebol/jogos');
    expect(comDia('/futebol/jogos', '2026-9-1')).toBe('/futebol/jogos');
    expect(comDia('/futebol/jogos', '')).toBe('/futebol/jogos');
  });
});

describe('os atalhos da home levam o dia junto', () => {
  it('nenhum link para as duas telas de dia é escrito à mão', () => {
    // `to="/futebol/oportunidades"` cru é exatamente o bug voltando.
    const crus = HOME.split('\n').filter((l) =>
      /to="\/futebol\/(oportunidades|jogos)"/.test(l),
    );
    expect(crus).toEqual([]);
  });

  it('e os dois passam pelo comDia', () => {
    expect(HOME).toContain("comDia('/futebol/oportunidades'");
    expect(HOME).toContain("comDia('/futebol/jogos'");
  });
});
