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

  it('rota que já tem query não vira URL com dois pontos de interrogação', () => {
    // Nenhum destino de hoje tem query. Concatenar funcionava por sorte, e a
    // sorte acaba no dia em que alguém acrescentar um parâmetro na rota.
    expect(comDia('/futebol/jogos?jogo=9', '2026-09-11')).toBe(
      '/futebol/jogos?jogo=9&dia=2026-09-11',
    );
  });
});

// ============================================================================
// As três telas concordam sobre o nome do parâmetro
// ============================================================================
// A docstring de PARAM_DO_DIA promete "num lugar só". A agenda tinha a própria
// cópia da regex e a string 'dia' literal, então a promessa era falsa e nada
// avisava: trocar o parâmetro para `?data=` quebraria a navegação entre telas
// sem um teste ficar vermelho.
//
// A agenda mantém o SETTER próprio de propósito — ao trocar de dia ela descarta
// o `?jogo=`, e o `trocar` daqui preserva os outros parâmetros. O que precisava
// ser compartilhado é o nome e a validação, não a escrita.
// ============================================================================

describe('o parâmetro do dia é um só', () => {
  const AGENDA = fonte('pages/FutebolJogos.tsx');

  it('a agenda lê o nome e a validação daqui', () => {
    expect(AGENDA).toContain("from '@/hooks/use-dia-na-url'");
    expect(AGENDA).toContain('params.get(PARAM_DO_DIA)');
  });

  it('e não guarda uma segunda cópia da validação', () => {
    expect(AGENDA).not.toMatch(/const DIA_RE\s*=/);
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
