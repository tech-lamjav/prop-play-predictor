import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

/**
 * Tira as linhas de `console`: elas falam com quem PROGRAMA, não com quem usa.
 *
 * "Erro ao verificar sessão" e "VITE_STRIPE_PRICE_ID_FUTEBOL não configurado"
 * são diagnóstico, e traduzir diagnóstico só dificulta a vida de quem for ler
 * o console às duas da manhã. Entrou junto com a varredura de literais, que
 * passou a enxergar esse tipo de texto pela primeira vez.
 */
function semConsole(codigo: string): string {
  return codigo.replace(/console.(log|warn|error|info|debug)([^;]*);?/g, '');
}

/** Tira comentário: o código é comentado EM PORTUGUÊS, e isso é correto. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Um literal de string é TEXTO, e não identificador?
 *
 * ⚠️ O TERCEIRO BURACO DO EXTRATOR, e ele deixou cinco arquivos de um bloco
 * inteiro passarem. `{allDone ? 'Análise pronta' : '…'}` não é texto solto de
 * JSX nem propriedade nomeada — é literal dentro de expressão, e o extrator
 * não olhava para lá. Quem contou foi quem migrou o bloco, não a guarda.
 *
 * Olhar TODO literal, porém, mede ruído: a varredura saltou de 52 para 194
 * arquivos, e o que entrou foi caminho de importe (`./pages/FutebolHoje`),
 * nome de área (`apostas`) e evento de analytics
 * (`crosssell_futebol_preview_open`) — todos casando por conterem "futebol"
 * ou "apostas". Uma guarda que grita assim é desligada na terceira vez.
 *
 * Então o literal só conta se PARECER FRASE: tem espaço, não começa como
 * caminho e não é um identificador pontuado. Com a régua, 52 vira 89 — e os
 * 37 são texto de tela de verdade, incluindo o FAQ da landing.
 */
function ehFrase(valor: string): boolean {
  if (!valor.includes(' ')) return false;
  if (/^[.@~/]|^https?:/.test(valor)) return false;
  if (/^[a-z0-9_]+(\.[a-z0-9_]+)*$/i.test(valor)) return false;
  return /[a-zA-ZÀ-ÿ]{3}/.test(valor);
}

/** O que a pessoa lê: texto solto no JSX e as props que viram rótulo. */
function candidatos(codigo: string): string[] {
  const limpo = semConsole(semComentarios(codigo));
  const achados: string[] = [];

  for (const [, texto] of limpo.matchAll(/>([^<>{}\n]{4,80})</g)) achados.push(texto.trim());
  // ⚠️ OS NOMES DE PROP EM PORTUGUÊS FALTAVAM, e o código desta casa é em
  // português: uma tabela com `titulo` e `descricao` passava inteira sem ser
  // olhada. Foi assim que os módulos do placar guardaram título e explicação de
  // quebra em português dentro de uma tela já traduzida.
  for (const [, , texto] of limpo.matchAll(
    /\b(label|title|placeholder|aria-label|alt|name|rotulo|titulo|subtitulo|descricao|texto|legenda|explicacao|mensagem|aviso)\s*[:=]\s*["']([^"'\n]{4,80})["']/g,
  )) {
    achados.push(texto.trim());
  }
  // Literal dentro de expressão — ternário, objeto, argumento. Só o que
  // passa por `ehFrase`, senão a varredura vira ruído.
  for (const [, , texto] of limpo.matchAll(/(['"])([^'"\n]{4,80})\1/g)) {
    const valor = texto.trim();
    if (ehFrase(valor)) achados.push(valor);
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

/**
 * O candidato é CÓDIGO, e não texto que alguém lê.
 *
 * ⚠️ O casador de `>texto<` não sabe o que é JSX. Numa expressão de
 * comparação ele enxerga texto entre os sinais:
 *
 *   comecouEm > hoje || comecouEm < umAnoAtras(hoje)
 *            └──────────────────┘
 *            "hoje || comecouEm", e "hoje" está na lista de só-português
 *
 * Foi o que pôs `DarAssinatura.tsx` no backlog de componentes sem ele ter uma
 * palavra de texto cru. Operador lógico e de igualdade não aparecem em frase
 * de interface, então servem de assinatura do que é código.
 */
// `??` e `?.` não existem em frase; `palavra(` é chamada de função. Entraram
// quando o detector passou a olhar literal de string e trouxe junto um
// pedaço de `.localeCompare(y.jogos[0]?.kickoff_utc ??`.
const PARECE_CODIGO = /(\|\||&&|=>|===|!==|==|!=|\?\?|\?\.|\w\()/;
function ehPortugues(texto: string): boolean {
  if (NAO_E_TEXTO_DE_TELA.some((t) => texto.includes(t))) return false;
  if (FORMA_DE_CHAVE.test(texto)) return false;
  if (PARECE_CODIGO.test(texto)) return false;
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
  // As nove telas que estavam aqui foram migradas, e o segundo dente da catraca
  // cobrou a saída de cada nome. Esta voltou quando o detector passou a olhar
  // literal de string: o texto dela nunca esteve solto no JSX.
  'src/pages/Bets.tsx': 'Betinho: apostas',
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

// ============================================================================
// O que a tela DESENHA, e não só o arquivo da tela
// ============================================================================
// ⚠️ TERCEIRA VEZ QUE ESTA GUARDA MEDE MENOS DO QUE PARECE MEDIR, E A MAIOR.
//
// Primeiro ela media o catálogo, e catálogo certo não é tela certa. Depois
// passou a ler as telas, e descartava as protegidas. Agora: ela lê o ARQUIVO DA
// TELA, e a tela é feita de COMPONENTES.
//
// `BolaoDetail.tsx` está limpo. Dentro dele desenha `BolaoAdminPanel`, com
// 84 kB de português. A tela passa verde e a pessoa vê português — exatamente o
// mesmo engano das duas vezes anteriores, num nível mais fundo. Quem contou
// foram 38 componentes de bolão achados à mão, não esta guarda.
//
// Então a varredura segue os IMPORTES, a partir de cada tela, até onde eles
// levarem dentro de `src`. É mais caro e é o único alcance que corresponde ao
// que alguém vê.
// ============================================================================

/** Resolve `@/x`, `./x` e `../x` num caminho de arquivo dentro de `src`. */
function resolverImporte(de: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith('@/')) base = join('src', especificador.slice(2));
  else if (especificador.startsWith('.')) base = join(dirname(de), especificador);
  else return null; // pacote do node_modules: não é nosso texto

  base = base.split('\\').join('/');
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    if (existsSync(resolve(RAIZ, base + ext))) return base + ext;
  }
  return existsSync(resolve(RAIZ, base)) ? base : null;
}

/**
 * Todo arquivo nosso que uma tela alcança, direta ou indiretamente.
 *
 * Transitivo de propósito: `BolaoDetail` importa `PredictionsList`, que importa
 * `MatchPredictionCard`. Parar no primeiro nível deixaria o segundo invisível, e
 * é no segundo que mora o texto.
 */
function fechamentoDeImportes(sementes: string[]): string[] {
  const vistos = new Set<string>();
  const fila = [...sementes];

  while (fila.length) {
    const atual = fila.shift();
    if (!atual || vistos.has(atual) || !existsSync(resolve(RAIZ, atual))) continue;
    vistos.add(atual);
    for (const [, esp] of ler(atual).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const alvo = resolverImporte(atual, esp);
      // Só CÓDIGO. Esta guarda se chama "texto escrito direto no código", e
      // arquivo de dados é outro problema: `src/seo/public-routes.json` tem os
      // títulos das rotas públicas em português — achado de verdade, e que não
      // se conserta com `t()`, porque quem o lê é buscador e não componente.
      // Pela mesma régua, os próprios catálogos são JSON.
      if (alvo && !vistos.has(alvo) && /\.tsx?$/.test(alvo) && !/\.test\./.test(alvo)) {
        fila.push(alvo);
      }
    }
  }
  return [...vistos];
}

/**
 * Componentes que ainda não foram migrados, cada um com o bloco a que pertence.
 * A lista só ENCURTA, e vale o mesmo aviso do backlog das telas.
 */
const BACKLOG_DE_COMPONENTES: Record<string, string> = {
  'src/hooks/use-bets.ts': 'mensagem de erro de hook e serviço',
  'src/hooks/use-capital-movements.ts': 'mensagem de erro de hook e serviço',
  'src/hooks/use-futebol-publication-alerts.ts': 'mensagem de erro de hook e serviço',
  'src/hooks/use-settings-data.ts': 'mensagem de erro de hook e serviço',
  'src/hooks/use-share-link.ts': 'mensagem de erro de hook e serviço',
  'src/hooks/use-share-resolve.ts': 'mensagem de erro de hook e serviço',
  'src/hooks/use-user-unit.ts': 'mensagem de erro de hook e serviço',
  'src/services/bolao.service.ts': 'mensagem de erro de hook e serviço',
  // ⚠️ ACHADOS QUANDO O DETECTOR PASSOU A OLHAR LITERAL DE STRING.
  // Nenhum deles é regressão: o texto sempre esteve aí, dentro de ternário,
  // de objeto ou de argumento, onde a varredura não olhava. A lista só
  // encurta — SALVO quando o alcance da guarda cresce, que é este caso e está
  // registrado aqui de propósito.

  // sócios: módulos de apoio (6)
  'src/components/socios/crm-acesso.ts': 'sócios: módulos de apoio',
  'src/components/socios/crm-cobranca.ts': 'sócios: módulos de apoio',
  'src/components/socios/crm-etiquetas.ts': 'sócios: módulos de apoio',
  'src/components/socios/crm-ficha.ts': 'sócios: módulos de apoio',
  'src/components/socios/crm-linha-do-tempo.ts': 'sócios: módulos de apoio',
  'src/components/socios/crm-mensagens.ts': 'sócios: módulos de apoio',
  // futebol: frases de premissa, que são contrato do banco (8)
  'src/utils/futebol-criterio.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-desfalques.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-estado-da-premissa.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-historico.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-insumo-medido.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-motivos.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-score.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-tendencias.ts': 'futebol: frases de premissa (contrato do banco)',
  // demo do tour (2)
  'src/components/onboarding/demo/betinho.ts': 'demo do tour',
  'src/components/onboarding/demo/futebol.ts': 'demo do tour',
  // bolão: componentes (2)
  'src/components/bolao/BolaoHandoffCard.tsx': 'bolão: componentes',
  'src/components/bolao/useRankingShareImage.ts': 'bolão: componentes',
  // avulsos (4)
  'src/components/ReferralModal.tsx': 'avulso',
  'src/components/share/ShareErrorState.tsx': 'compartilhar',
  'src/components/placar/placar-por-premissa.ts': 'sócios: placar',
  'src/utils/rolagem.ts': 'avulso',
  // bolão: componentes (24)
  'src/components/bolao/AchievementProvider.tsx': 'bolão: componentes',
  'src/components/bolao/BolaoAdminPanel.tsx': 'bolão: componentes',
  'src/components/bolao/BolaoEmptyState.tsx': 'bolão: componentes',
  'src/components/bolao/BolaoRankingTable.tsx': 'bolão: componentes',
  'src/components/bolao/BolaoShareButton.tsx': 'bolão: componentes',
  'src/components/bolao/BolaoStatsPanel.tsx': 'bolão: componentes',
  'src/components/bolao/BolaoStatsTopCards.tsx': 'bolão: componentes',
  'src/components/bolao/ChampionHeroCard.tsx': 'bolão: componentes',
  'src/components/bolao/ChampionPickModal.tsx': 'bolão: componentes',
  'src/components/bolao/CopaBracketModal.tsx': 'bolão: componentes',
  'src/components/bolao/CreateBolaoModal.tsx': 'bolão: componentes',
  'src/components/bolao/GroupProjectionTable.tsx': 'bolão: componentes',
  'src/components/bolao/InsightsBanner.tsx': 'bolão: componentes',
  'src/components/bolao/MatchPredictionCard.tsx': 'bolão: componentes',
  'src/components/bolao/MyBolaoStatsPanel.tsx': 'bolão: componentes',
  'src/components/bolao/PlayerAwardsSection.tsx': 'bolão: componentes',
  'src/components/bolao/PredictionsList.tsx': 'bolão: componentes',
  'src/components/bolao/PredictionsModal.tsx': 'bolão: componentes',
  'src/components/bolao/QuickPickInline.tsx': 'bolão: componentes',
  'src/components/bolao/ShareCallout.tsx': 'bolão: componentes',
  'src/components/bolao/SpecialPredictionsModal.tsx': 'bolão: componentes',
  'src/components/bolao/SpecialPredictionsSection.tsx': 'bolão: componentes',
  'src/components/bolao/UserPredictionsModal.tsx': 'bolão: componentes',
  'src/components/bolao/useQuickPickUndo.ts': 'bolão: componentes',
  // avulso (5)
  'src/components/FutebolDayStepper.tsx': 'avulso',
  'src/components/Seo.tsx': 'avulso',
  'src/components/UnitConfigurationModal.tsx': 'avulso',
  'src/utils/futebol-escalacao.ts': 'avulso',
  'src/utils/perfil-declarado.ts': 'avulso',
  // compartilhar (2)
  'src/components/share/ShareBetsTable.tsx': 'compartilhar',
  'src/components/share/ShareKpiCards.tsx': 'compartilhar',
  // futebol: frases de premissa (contrato do banco) (2)
  'src/utils/futebol-evidencias.ts': 'futebol: frases de premissa (contrato do banco)',
  'src/utils/futebol-premissas.ts': 'futebol: frases de premissa (contrato do banco)',
  // sócios: placar (1)
  'src/components/placar/placar-periodo.ts': 'sócios: placar',
  // sócios (1)
  'src/components/socios/crm-assinatura-do-stripe.ts': 'sócios',
};

describe('o que a tela desenha também não tem texto cru', () => {
  const todos = fechamentoDeImportes(
    [...telas().publicas, ...telas().logadas]
      .map((n) => `src/pages/${n}.tsx`)
      .filter((c) => existsSync(resolve(RAIZ, c))),
  );

  // As telas têm os seus próprios testes acima; aqui é o que elas desenham.
  const componentes = todos.filter((c) => !c.startsWith('src/pages/'));

  it('o fechamento foi calculado de verdade', () => {
    // Sem isto, um resolvedor de importe quebrado faria o teste abaixo passar
    // por vacuidade — que é como esta guarda já falhou duas vezes.
    expect(componentes.length, 'quase nenhum componente alcançado').toBeGreaterThan(150);
  });

  it('componente FORA do backlog não tem texto cru', () => {
    const porArquivo: string[] = [];
    for (const caminho of componentes.filter((c) => !(c in BACKLOG_DE_COMPONENTES))) {
      const crus = [...new Set(candidatos(ler(caminho)).filter(ehPortugues))];
      if (crus.length) porArquivo.push(`${caminho}\n  ${crus.slice(0, 5).join('\n  ')}`);
    }
    expect(
      porArquivo,
      `texto em português escrito direto em componente de tela:\n\n${porArquivo.join('\n\n')}\n\n` +
        'Mova para o catálogo do idioma (src/i18n/locales) e use t().\n' +
        '⚠️ NÃO acrescente o arquivo ao BACKLOG para calar isto.',
    ).toEqual([]);
  });

  it('o backlog de componentes não tem nome a mais', () => {
    const limpos = Object.keys(BACKLOG_DE_COMPONENTES).filter(
      (c) => existsSync(resolve(RAIZ, c)) && !candidatos(ler(c)).some(ehPortugues),
    );
    expect(
      limpos,
      `estes componentes já estão limpos e continuam no backlog:\n  ${limpos.join('\n  ')}\n\n` +
        'Apague a linha de cada um. A catraca só aperta.',
    ).toEqual([]);
  });

  it('o backlog de componentes não tem nome que não existe', () => {
    const fantasmas = Object.keys(BACKLOG_DE_COMPONENTES).filter(
      (c) => !existsSync(resolve(RAIZ, c)),
    );
    expect(fantasmas, `arquivo inexistente no backlog: ${fantasmas.join(', ')}`).toEqual([]);
  });
});
