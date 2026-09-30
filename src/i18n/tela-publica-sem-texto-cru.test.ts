import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// Tela pública não tem texto escrito direto no código (#532)
// ============================================================================
// ⚠️ ESTA GUARDA NASCEU DO BURACO QUE DEIXOU CINCO OUTRAS PASSAREM VERDES.
//
// O usuário abriu o site em espanhol e fotografou português no rodapé, na tela
// de entrar, no tour, no Betinho e no cabeçalho de navegação — que aparece em
// 44 telas. Nenhuma guarda acusou, e o motivo é estrutural:
//
//   As outras guardas medem o CATÁLOGO. Uma tela que nunca foi ligada à
//   tradução NÃO TEM CHAVE — não há o que faltar, não há órfã, não há voseo.
//   Ela é invisível para elas.
//
// Medir arquivo de tradução não é medir tela. Esta guarda olha o OUTRO lado:
// texto em português escrito direto no código de tela pública.
//
// ⚠️ PRECISÃO ACIMA DE COBERTURA, E É DECISÃO. Ela só acusa o que é
// inequivocamente português — a ortografia que não existe em espanhol (ç, ã, õ)
// e um punhado de palavras sem cognato. Uma guarda que grita em cima de texto
// correto é uma guarda que alguém desliga na terceira vez, e aí não guarda
// nada. Prefiro deixar passar texto duvidoso a perder a guarda inteira.
//
// Ela NÃO substitui olhar a página pintada: o que vem de `src/utils` (#544) e
// de data (#530) ela não vê, porque não está escrito na tela.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const ler = (caminho: string) => readFileSync(resolve(RAIZ, caminho), 'utf8').replace(/\r\n/g, '\n');
const APP = ler('src/App.tsx');

/** As telas públicas, lidas do ROTEADOR e não de uma lista escrita à mão. */
function telasPublicas(): string[] {
  const nomes = new Set<string>();
  for (const bloco of APP.split('<Route ').slice(1)) {
    const corpo = bloco.split('<Route')[0];
    if (/ProtectedRoute|PortaoDoSocio/.test(corpo)) continue;
    const comp = /element=\{<([A-Z][A-Za-z0-9_]*)/.exec(corpo);
    if (comp) nomes.add(comp[1]);
  }
  return [...nomes];
}

/**
 * Componentes que não são tela mas aparecem em cima de tela pública.
 *
 * Os quatro primeiros são exatamente os que escaparam: o roteador não os
 * menciona, então varrer só as telas não bastaria.
 */
const COMPARTILHADOS = [
  'src/components/Footer.tsx',
  'src/components/AnalyticsNav.tsx',
  'src/components/MainNav.tsx',
  'src/components/UserNav.tsx',
  'src/components/SeletorDeIdioma.tsx',
  'src/components/onboarding/tours.tsx',
  'src/components/onboarding/OnboardingTooltip.tsx',
];

/** Nome próprio e sigla: português na grafia, mas não é texto a traduzir. */
const PROPRIOS =
  /Bolão|São Paulo|Brasileirão|Betinho|Grêmio|Atlético|Coritiba|Smartbetting|Smart Betting|Libertadores|Sudamericana|Conceição/g;

/**
 * Palavras que são português e NÃO existem em espanhol.
 *
 * Lista curta de propósito. Cognato aqui dentro faz a guarda acusar espanhol
 * correto — foi o que sujou a varredura manual, onde "grupo", "entrar",
 * "amigos", "retorno" e "rebotes" apareceram como se fossem defeito.
 */
const SO_PORTUGUES = new Set([
  'não', 'você', 'vocês', 'são', 'três', 'mês', 'também', 'então', 'hoje', 'amanhã',
  'ontem', 'jogo', 'jogos', 'futebol', 'análise', 'análises', 'gestão', 'configurações',
  'ferramentas', 'senha', 'grátis', 'preços', 'palpite', 'palpites', 'gols', 'sair',
  'voltar', 'pular', 'conteúdo', 'recomendação', 'jogue', 'aposta', 'apostas', 'decisão',
  'começar', 'usuário', 'placar', 'vitória', 'rodada', 'escanteios', 'cartões', 'mando',
  'relatório', 'campeonatos', 'bem-vindo', 'olá', 'próximo', 'segunda-feira',
  'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'março', 'maio',
  'setembro', 'outubro', 'novembro', 'dezembro',
]);

const ORTOGRAFIA_SO_PT = /[çÇãÃõÕ]/;
const SUFIXO_SO_PT = /(ção|ções|lh[aeiou])/i;

/**
 * Arquivos que a guarda não varre, com o motivo de cada um.
 *
 * ⚠️ Acrescentar aqui é DECISÃO, não conserto de teste. Cada linha diz por que
 * aquele arquivo pode ter português dentro.
 */
const FORA_DA_VARREDURA: Record<string, string> = {
  'src/pages/Privacidade.tsx':
    'texto JURÍDICO. Traduzir política de privacidade por conta própria cria ' +
    'exposição legal: quem decide a versão em outro idioma é advogado, não ' +
    'tradutor. Fica em português até alguém com essa responsabilidade escrever.',
};

/**
 * Trechos que a guarda ignora em qualquer arquivo, com o motivo.
 *
 * ⚠️ Nomear trecho é o último recurso. Se a lista crescer, o detector é que
 * está errado.
 */
const NAO_E_TEXTO_DE_TELA = [
  // Nome de arquivo inventado dentro de um mock de conversa. Ninguém traduz
  // nome de arquivo, e o `lh` de "bilhete" casa com o sufixo do português.
  'bilhete_bet365.png',
  // Dado estruturado para buscador, e não texto que alguém lê na tela. O
  // casador de `name:` pega campo de dado junto com rótulo de interface —
  // custo conhecido de manter `name:` na lista, que é onde os itens de menu
  // moravam antes de virarem chave.
  'Smart Betting Grátis',
];

/** Tira comentário: o código é comentado EM PORTUGUÊS, e isso é correto. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** O que a pessoa lê: texto solto no JSX e as props que viram rótulo. */
function candidatos(codigo: string): string[] {
  const limpo = semComentarios(codigo);
  const achados: string[] = [];

  for (const [, texto] of limpo.matchAll(/>([^<>{}\n]{4,80})</g)) achados.push(texto.trim());
  for (const [, , texto] of limpo.matchAll(
    /\b(label|title|placeholder|aria-label|alt|name|rotulo)\s*[:=]\s*["']([^"'\n]{4,80})["']/g,
  )) {
    achados.push(texto.trim());
  }
  return achados.filter(Boolean);
}

function ehPortugues(texto: string): boolean {
  if (NAO_E_TEXTO_DE_TELA.some((t) => texto.includes(t))) return false;
  const limpo = texto.replace(PROPRIOS, '');
  if (ORTOGRAFIA_SO_PT.test(limpo) || SUFIXO_SO_PT.test(limpo)) return true;
  const palavras = limpo.toLowerCase().match(/[a-záéíóúâêôãõçà-]{3,}/g) ?? [];
  return palavras.some((p) => SO_PORTUGUES.has(p));
}

describe('tela pública não tem texto escrito direto no código', () => {
  const arquivos = [
    ...telasPublicas().map((n) => `src/pages/${n}.tsx`),
    ...COMPARTILHADOS,
  ].filter((c) => existsSync(resolve(RAIZ, c)) && !(c in FORA_DA_VARREDURA));

  it('o roteador foi lido de verdade', () => {
    // Sem isto, um parser quebrado faria o teste abaixo passar por vacuidade.
    expect(arquivos.length, 'quase nenhum arquivo para varrer').toBeGreaterThan(15);
  });

  for (const caminho of COMPARTILHADOS) {
    it(`compartilhado: ${caminho.split('/').pop()}`, () => {
      // Os compartilhados têm teste próprio porque foram eles que escaparam:
      // o roteador não os menciona, e aparecem em dezenas de telas.
      const crus = candidatos(ler(caminho)).filter(ehPortugues);
      expect(
        [...new Set(crus)],
        `texto em português escrito direto em ${caminho}:\n  ${[...new Set(crus)].join('\n  ')}`,
      ).toEqual([]);
    });
  }

  it('nenhuma tela pública tem texto cru', () => {
    const porArquivo: string[] = [];
    for (const caminho of arquivos) {
      const crus = [...new Set(candidatos(ler(caminho)).filter(ehPortugues))];
      if (crus.length) porArquivo.push(`${caminho}\n  ${crus.slice(0, 6).join('\n  ')}`);
    }
    expect(
      porArquivo,
      `texto em português escrito direto no código de tela pública:\n\n${porArquivo.join('\n\n')}\n\n` +
        'Mova para o catálogo do idioma (src/i18n/locales) e use t().',
    ).toEqual([]);
  });
});
