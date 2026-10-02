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

/**
 * Invólucros de rota. Não são tela: dizem QUEM entra, não O QUE se vê.
 *
 * ⚠️ ESTA LISTA É O QUE FAZIA A VARREDURA DA ÁREA LOGADA MEDIR NADA. O
 * roteador escreve a rota protegida em três linhas —
 * `element={` / `<ProtectedRoute>` / `<Dashboard />` — então o primeiro
 * componente depois de `element={` é o INVÓLUCRO, e não a tela. A primeira
 * versão desta guarda descartava essas rotas com um `continue`, e o engano
 * ficou escondido atrás do descarte: ao passar a lê-las, a varredura achou
 * UMA tela logada em vez de vinte e poucas, e teria dado verde por vacuidade
 * se o teste de sanidade não existisse.
 */
const INVOLUCROS = new Set([
  'ProtectedRoute',
  'PremiumRoute',
  'PortaoDoSocio',
  'Navigate',
  'Outlet',
  'Suspense',
  'BolaoLayout',
]);

/** Invólucro que exige conta. `PortaoDoSocio` é a porta da área interna. */
const EXIGE_CONTA = /<(ProtectedRoute|PremiumRoute|PortaoDoSocio)\b/;

/**
 * As telas, lidas do ROTEADOR e não de uma lista escrita à mão, separadas por
 * quem entra nelas.
 *
 * ⚠️ A SEPARAÇÃO NÃO É UMA FRONTEIRA DE QUALIDADE, é só o que já foi migrado.
 * Quem usa o produto não vê essa fronteira: entra na conta e o menu fala
 * espanhol enquanto a tela fala português. Agora as duas são lidas, e a
 * diferença entre elas é só o prazo.
 */
function telas(): { publicas: string[]; logadas: string[] } {
  const publicas = new Set<string>();
  const logadas = new Set<string>();

  for (const bloco of APP.split('<Route ').slice(1)) {
    const corpo = bloco.split('<Route')[0];
    const nomes = [...corpo.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]);
    const tela = nomes.find((n) => !INVOLUCROS.has(n));
    if (!tela) continue;

    // `requireAuth={false}` é o ProtectedRoute usado ao contrário: ele existe
    // para MANDAR EMBORA quem já entrou, então a tela é pública.
    const protegida = EXIGE_CONTA.test(corpo) && !/requireAuth=\{false\}/.test(corpo);
    (protegida ? logadas : publicas).add(tela);
  }

  return { publicas: [...publicas], logadas: [...logadas] };
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

/**
 * Já é CHAVE de tradução, e não texto.
 *
 * ⚠️ SEM ISTO A GUARDA BRIGA COM O PRÓPRIO CONSERTO. Quando uma tabela fora do
 * componente é migrada, o rótulo vira chave no lugar: `title: 'inicio.futebol.
 * titulo'`. O casador de `title:` continua vendo a string, e "futebol" está na
 * lista de palavras só-português — então a tela migrada passava a ser acusada
 * justamente por ter sido migrada.
 *
 * Chave tem forma reconhecível e que texto de tela não tem: minúscula, pontos
 * no meio, nenhum espaço.
 */
const FORMA_DE_CHAVE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;

function ehPortugues(texto: string): boolean {
  if (NAO_E_TEXTO_DE_TELA.some((t) => texto.includes(t))) return false;
  if (FORMA_DE_CHAVE.test(texto)) return false;
  const limpo = texto.replace(PROPRIOS, '');
  if (ORTOGRAFIA_SO_PT.test(limpo) || SUFIXO_SO_PT.test(limpo)) return true;
  const palavras = limpo.toLowerCase().match(/[a-záéíóúâêôãõçà-]{3,}/g) ?? [];
  return palavras.some((p) => SO_PORTUGUES.has(p));
}

describe('tela pública não tem texto escrito direto no código', () => {
  const arquivos = [
    ...telas().publicas.map((n) => `src/pages/${n}.tsx`),
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

// ============================================================================
// A área logada, com catraca
// ============================================================================
// A área logada tem 14.320 linhas e está sendo migrada por bloco. Uma guarda
// que simplesmente reprovasse hoje seria desligada hoje, e aí não guardaria
// nada — então ela nasce com um BACKLOG declarado, no mesmo espírito da dívida
// de tipos de `scripts/typecheck.mjs`.
//
// A catraca tem dois dentes, e o segundo é o que importa:
//
//   1. tela logada FORA do backlog não pode ter texto cru — é isto que faz a
//      próxima tela nascer traduzida, em vez de este trabalho se repetir;
//   2. tela logada DENTRO do backlog tem de estar suja de verdade. Quando
//      alguém a migra, o teste reprova pedindo que a linha SAIA daqui.
//
// Sem o segundo dente a lista viraria gaveta: ninguém tira nome de lá, e uma
// regressão numa tela já migrada entraria calada.
// ============================================================================

/**
 * Telas logadas que ainda não foram migradas, cada uma com o bloco a que
 * pertence. A lista só ENCURTA.
 */
const BACKLOG_DA_AREA_LOGADA: Record<string, string> = {
  // Bloco da NBA logada.
  'src/pages/Picks.tsx': 'NBA logada',
  'src/pages/Report.tsx': 'NBA logada',
  // Bloco da Análise 360.
  'src/pages/Analise360List.tsx': 'Análise 360',
  'src/pages/Analise360Detail.tsx': 'Análise 360',
  // Bloco do bolão logado.
  'src/pages/BolaoDetail.tsx': 'bolão logado',
  'src/pages/BolaoJoin.tsx': 'bolão logado',
  'src/pages/BolaoWelcome.tsx': 'bolão logado',
  'src/pages/BolaoPalpites.tsx': 'bolão logado',
  // Bloco dos sócios, que é uso interno e vem por último.
  'src/pages/AssinaturasDoCrm.tsx': 'sócios',
};

describe('a área logada tem catraca, e ela só aperta', () => {
  const logadas = telas()
    .logadas.map((n) => `src/pages/${n}.tsx`)
    .filter((c) => existsSync(resolve(RAIZ, c)) && !(c in FORA_DA_VARREDURA));

  it('o roteador foi lido de verdade', () => {
    expect(logadas.length, 'quase nenhuma tela logada encontrada').toBeGreaterThan(10);
  });

  it('tela logada FORA do backlog não tem texto cru', () => {
    const porArquivo: string[] = [];
    for (const caminho of logadas.filter((c) => !(c in BACKLOG_DA_AREA_LOGADA))) {
      const crus = [...new Set(candidatos(ler(caminho)).filter(ehPortugues))];
      if (crus.length) porArquivo.push(`${caminho}\n  ${crus.slice(0, 6).join('\n  ')}`);
    }
    expect(
      porArquivo,
      `texto em português escrito direto em tela logada:\n\n${porArquivo.join('\n\n')}\n\n` +
        'Mova para o catálogo do idioma (src/i18n/locales) e use t().\n' +
        '⚠️ NÃO acrescente o arquivo ao BACKLOG para calar isto: o backlog é o ' +
        'que já estava sujo quando a catraca nasceu, e ele só encurta.',
    ).toEqual([]);
  });

  it('o backlog não tem nome a mais', () => {
    // O segundo dente. Tela migrada tem de SAIR do backlog, senão a lista
    // apodrece e passa a esconder regressão em vez de registrar dívida.
    const limpas = Object.keys(BACKLOG_DA_AREA_LOGADA).filter(
      (c) => existsSync(resolve(RAIZ, c)) && !candidatos(ler(c)).some(ehPortugues),
    );
    expect(
      limpas,
      `estas telas já estão limpas e continuam no backlog:\n  ${limpas.join('\n  ')}\n\n` +
        'Apague a linha de cada uma em BACKLOG_DA_AREA_LOGADA. A catraca só ' +
        'aperta: nome que sai não volta.',
    ).toEqual([]);
  });

  it('o backlog não tem nome que não existe', () => {
    const fantasmas = Object.keys(BACKLOG_DA_AREA_LOGADA).filter(
      (c) => !existsSync(resolve(RAIZ, c)),
    );
    expect(fantasmas, `arquivo inexistente no backlog: ${fantasmas.join(', ')}`).toEqual([]);
  });
});
