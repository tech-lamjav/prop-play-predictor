import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROTA_DO_PLACAR } from '@/components/placar/placar-vocabulario';
import { ROTA_DO_CRM, ROTA_DOS_SOCIOS } from './crm-vocabulario';

// ============================================================================
// A rota não pode ser anunciada
// ============================================================================
// O painel não aparece em menu nenhum, e três arquivos podem estragar isso sem
// que ninguém perceba: o public-routes.json (que vira sitemap.xml no build), o
// robots.txt, e o próprio App.tsx se alguém montar a rota sem o portão.
//
// O robots.txt é o mais contraintuitivo dos três. Ele lista com Disallow tudo
// que exige login, e a tentação é acrescentar o painel na lista. Mas robots.txt
// é público: escrever o caminho lá é publicá-lo num arquivo que qualquer um lê.
// A rota fica de fora, e quem a protege é a política de linha no banco.
// ============================================================================

const raiz = (caminho: string) =>
  readFileSync(resolve(__dirname, '../../..', caminho), 'utf8').replace(/\r\n/g, '\n');

/**
 * As rotas da área dos sócios, como linhas do App.
 *
 * Procura as CONSTANTES, e não a string do endereço: depois que o CRM desceu um
 * andar (ADR 0001), a área tem rotas escritas com `ROTA_DOS_SOCIOS` — a raiz e o
 * endereço antigo da ficha —, rotas com `ROTA_DO_CRM` e a do placar, com
 * `ROTA_DO_PLACAR`. Filtrar por uma só deixaria parte da área sem guarda.
 *
 * ⚠️ Este arquivo guarda a ÁREA inteira, os dois andares, e não só o CRM. Foi
 * escrito quando a área era só o CRM, e dividi-lo em dois por contexto criaria
 * a chance de um andar novo nascer sem portão e sem noindex — que é justamente
 * o que ele existe para impedir.
 */
const rotasDaArea = () =>
  raiz('src/App.tsx')
    .split('\n')
    .filter((l) => l.includes('<Route') && /ROTA_DO(S_SOCIOS|_CRM|_PLACAR)\b/.test(l));

/**
 * As rotas que só redirecionam, e por isso não desenham página.
 *
 * Escrito à mão porque é curto e porque escrever o nome aqui é o momento em que
 * alguém lembra de que um redirecionamento também precisa do portão.
 */
const SO_REDIRECIONAM = ['FichaAntiga'];

describe('o painel não é anunciado', () => {
  it('não entra no sitemap', () => {
    expect(raiz('src/seo/public-routes.json')).not.toContain(ROTA_DOS_SOCIOS);
  });

  it('não entra no robots.txt — listar o caminho lá é publicá-lo', () => {
    expect(raiz('public/robots.txt')).not.toContain(ROTA_DOS_SOCIOS);
  });

  /**
   * Toda página do CRM é noindex, e não só a primeira.
   *
   * Ficar fora do sitemap não basta: o Google chega por qualquer link, e uma
   * página de app sem noindex vira página fantasma no índice. O guarda nasceu
   * olhando só o painel, e as duas seções que vieram depois passaram ao largo
   * dele — a de assinaturas chegou a entrar sem ninguém conferir.
   *
   * A lista é escrita à mão porque é curta e porque escrever o nome aqui é o
   * momento em que alguém lembra da regra.
   */
  const PAGINAS = [
    'PainelDosSocios',
    'FeedbacksDoCrm',
    'AssinaturasDoCrm',
    // O outro andar da área. Ele não é CRM, mas a regra de não ser anunciado é
    // a mesma — e uma lista que só conhecesse um andar deixaria o outro passar.
    'PlacarDaMetodologia',
  ];

  for (const pagina of PAGINAS) {
    it(`a página ${pagina} é noindex`, () => {
      expect(raiz(`src/pages/${pagina}.tsx`)).toMatch(/<Seo\s+noindex/);
    });
  }

  it('toda página do CRM está na lista acima', () => {
    // Sem isto, uma quarta seção nasceria sem noindex e o laço de cima ficaria
    // verde ignorando ela. A conta sai do App: cada rota do painel monta uma
    // página, e são essas que precisam estar aqui.
    const montadas = rotasDaArea()
      .flatMap((l) => [...l.matchAll(/<(\w+) \/>/g)].map((m) => m[1]))
      .filter((nome) => !SO_REDIRECIONAM.includes(nome));
    expect(montadas.length).toBeGreaterThan(0);
    expect(new Set(montadas)).toEqual(new Set(PAGINAS));
  });
});

describe('a rota nasce com o portão', () => {
  const APP = raiz('src/App.tsx');

  it('toda rota do painel passa pelo PortaoDoSocio', () => {
    // Montar a página sem o portão deixa o painel aberto para qualquer pessoa
    // logada. A tela quebraria sozinha na primeira consulta — a política de
    // linha devolve zero — mas a rota já teria confirmado que existe.
    //
    // O filtro procura a CONSTANTE, e não a string do endereço. Assim ele pega
    // também a segunda rota do painel, que vai nascer como `${ROTA}/:id` e não
    // conteria o endereço literal.
    //
    // Vale para os redirecionamentos também, e é a parte que surpreende: mandar
    // quem não é sócio de `/socios` para `/socios/crm` seria anunciar o andar de
    // baixo. O portão vem primeiro, o redirecionamento depois.
    const rotas = rotasDaArea();
    expect(rotas.length).toBeGreaterThan(0);
    for (const rota of rotas) expect(rota).toContain('PortaoDoSocio');
  });

  it('o App não escreve o endereço na mão', () => {
    // Com a string solta na tabela de rotas, mudar o endereço deixaria os
    // guardas do sitemap e do robots verdes protegendo um caminho morto.
    expect(APP).not.toContain(`path="${ROTA_DOS_SOCIOS}"`);
  });
});

describe('o painel usa o cabeçalho do site', () => {
  it('a página do painel monta o header do produto', () => {
    // O pedido foi explícito: o painel é uma tela interna do produto, e não um
    // lugar à parte. Sem este guarda, tirar o header não quebra teste nenhum —
    // e foi assim que ele nasceu sem header na primeira versão.
    expect(raiz('src/pages/PainelDosSocios.tsx')).toContain('<AnalyticsNav');
  });

  it('e a ficha herda isso, porque ela desenha a mesma página da lista', () => {
    // A rota da lista e a da ficha apontam para PainelDosSocios: a segunda é a
    // primeira com o modal aberto por cima. É isso que mantém o endereço
    // compartilhável sem tirar ninguém da lista.
    //
    // As outras duas seções têm página própria porque respondem outras
    // perguntas: a de feedbacks lista o que a gente ouviu, e a de assinaturas
    // lista quem precisa ser cobrado. Nenhuma das duas lista gente para
    // abordar, que é o que o painel faz.
    const rotas = rotasDaArea().filter((l) => l.includes('PainelDosSocios'));
    expect(rotas).toHaveLength(2);
  });

  it('a seção de feedbacks vem antes da rota com parâmetro', () => {
    // `/socios/feedbacks` e `/socios/<id>` competem pelo mesmo formato. O React
    // Router prioriza segmento fixo, então funcionaria de qualquer jeito — mas
    // a ordem no arquivo é o que torna isso visível para quem lê.
    const app = raiz('src/App.tsx');
    expect(app.indexOf('/feedbacks`}')).toBeLessThan(app.indexOf('/:id`}'));
  });

  it('e o painel tem a faixa de identidade do CRM', () => {
    expect(raiz('src/components/socios/PainelCrm.tsx')).toContain('<CabecalhoDoCrm');
  });
});

describe('a seção de feedbacks', () => {
  it('é noindex, como o resto do painel', () => {
    expect(raiz('src/pages/FeedbacksDoCrm.tsx')).toMatch(/<Seo\s+noindex/);
  });

  it('usa o header do site e a faixa do CRM', () => {
    const pagina = raiz('src/pages/FeedbacksDoCrm.tsx');
    expect(pagina).toContain('<AnalyticsNav');
    expect(pagina).toContain('<CabecalhoDoCrm');
  });

  it('não entra no sitemap nem no robots', () => {
    expect(raiz('src/seo/public-routes.json')).not.toContain('feedbacks');
    expect(raiz('public/robots.txt')).not.toContain('feedbacks');
  });
});

// ============================================================================
// Os dois andares da área (ADR 0001)
// ============================================================================
// O CRM morava na raiz `/socios`. Com o placar da metodologia nascendo ao lado,
// ele desceu para `/socios/crm` e a raiz virou a porta que manda para o andar
// certo. O que estes guardas protegem é o que quebra silenciosamente: o link
// antigo deixar de ser atendido, e o coringa da ficha voltar para a raiz.
// ============================================================================

describe('os dois andares da área', () => {
  const APP = raiz('src/App.tsx');

  it('o CRM é um andar da área, e não outro lugar', () => {
    // Se o endereço do CRM deixar de começar pelo da área, os guardas do
    // sitemap e do robots — que perguntam pelo endereço da área — param de
    // cobri-lo sem ninguém perceber.
    expect(ROTA_DO_CRM.startsWith(`${ROTA_DOS_SOCIOS}/`)).toBe(true);
  });

  it('a raiz da área só redireciona para o CRM', () => {
    const raizDaArea = rotasDaArea().filter((l) => l.includes('path={ROTA_DOS_SOCIOS}'));
    expect(raizDaArea).toHaveLength(1);
    expect(raizDaArea[0]).toContain('Navigate');
    expect(raizDaArea[0]).toContain('ROTA_DO_CRM');
  });

  it('o endereço antigo da ficha continua atendido', () => {
    // Sem esta rota, o link que circula em conversa e favorito cai na página de
    // não encontrado — e quem clicou conclui que o lead sumiu.
    const antiga = rotasDaArea().filter((l) => l.includes('${ROTA_DOS_SOCIOS}/:id'));
    expect(antiga).toHaveLength(1);
    expect(antiga[0]).toContain('FichaAntiga');
  });

  it('o coringa da ficha não mora mais na raiz da área', () => {
    // Enquanto `/socios/<id>` era a ficha DO CRM, toda tela nova da área tinha
    // de ser declarada antes dela para não ser lida como um lead. Agora o
    // coringa que serve o CRM está um andar abaixo, e a raiz está livre.
    expect(APP).toContain('path={`${ROTA_DO_CRM}/:id`}');
  });

  it('o placar é irmão do CRM, e não uma seção dele', () => {
    // Se o placar nascesse abaixo de `/socios/crm`, ele entraria na barra de
    // seções do CRM — e o mapa de contextos manda não misturar "Leads" com
    // "Oportunidades" na mesma barra.
    expect(ROTA_DO_PLACAR.startsWith(`${ROTA_DOS_SOCIOS}/`)).toBe(true);
    expect(ROTA_DO_PLACAR.startsWith(ROTA_DO_CRM)).toBe(false);
  });

  it('as seções do CRM ficam abaixo do CRM, não da raiz da área', () => {
    for (const secao of ['feedbacks', 'assinaturas']) {
      const rota = rotasDaArea().filter((l) => l.includes(`/${secao}\``));
      expect(rota).toHaveLength(1);
      expect(rota[0]).toContain('ROTA_DO_CRM');
    }
  });
});

// ============================================================================
// A área navega como o resto do site
// ============================================================================
// Os dois andares trocam por pílula na faixa 2 do cabeçalho verde, no mesmo
// lugar em que Futebol e NBA se alternam. Antes eram dois botões no meio do
// conteúdo, e era isso que fazia a área parecer outro produto.
//
// O guarda lê o AnalyticsNav porque a porta de volta mora lá: sem ela, quem
// entra no placar fica preso nele.
// ============================================================================

describe('os dois andares na faixa do cabeçalho', () => {
  const NAV = raiz('src/components/AnalyticsNav.tsx');

  it('o cabeçalho conhece os dois andares, pelas constantes', () => {
    expect(NAV).toContain('SOCIOS_ITEMS');
    expect(NAV).toContain('ROTA_DO_CRM');
    expect(NAV).toContain('ROTA_DO_PLACAR');
  });

  it('e eles só aparecem dentro da área', () => {
    // A rota é gated e não se anuncia: a faixa não pode aparecer para quem está
    // em /planos ou /settings.
    expect(NAV).toContain('path.startsWith(ROTA_DOS_SOCIOS)');
  });

  it('a faixa de identidade da página não navega mais entre andares', () => {
    // Duas navegações para a mesma coisa, uma no verde e outra no branco, é o
    // tipo de coisa que diverge sozinha.
    expect(raiz('src/components/socios/CabecalhoDoCrm.tsx')).not.toContain('AbasDaArea');
    expect(raiz('src/components/placar/CabecalhoDoPlacar.tsx')).not.toContain('AbasDaArea');
  });
});
