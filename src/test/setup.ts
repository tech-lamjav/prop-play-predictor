/**
 * Setup global executado antes de todos os testes.
 * - Adiciona matchers extras do jest-dom (toBeInTheDocument, toHaveClass, etc.)
 * - Faz cleanup automático do DOM entre testes
 * - Dá folga ao limite de espera da testing-library (ver abaixo)
 * - Liga a tradução em português, para a tela testada mostrar frase e não chave
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * A tradução, ligada de forma SÍNCRONA e só em português.
 *
 * Em produção o texto é baixado sob demanda (`src/i18n/carregar.ts`), e isso
 * aqui não serve: o teste renderiza uma vez e confere o que está na tela. Com o
 * carregamento assíncrono, a primeira pintura mostraria o CÓDIGO DA CHAVE, e
 * toda asserção sobre frase quebraria por causa do relógio, não do componente.
 *
 * ⚠️ Os catálogos entram pelo GLOB, e não por uma lista escrita à mão: área
 * nova (`src/i18n/idiomas.ts`) passa a valer aqui sozinha. Uma lista manual
 * deixaria a próxima área traduzida caindo na chave crua, num erro que parece
 * do componente.
 *
 * Só português: é o idioma de referência, o que as asserções deste repositório
 * escrevem, e quem guarda a paridade com o espanhol é `catalogo-paridade.test.ts`.
 */
const catalogosPt = import.meta.glob('../i18n/locales/pt/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;
const pt = Object.fromEntries(
  Object.entries(catalogosPt).map(([caminho, modulo]) => [
    caminho.split('/').pop()!.replace(/\.json$/, ''),
    modulo.default,
  ]),
);

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    lng: 'pt',
    fallbackLng: 'pt',
    ns: Object.keys(pt),
    defaultNS: 'comum',
    resources: { pt },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

/**
 * O limite de cada `findBy`/`waitFor`, e por que ele não é o padrão de 1s.
 *
 * `userEvent` digita caractere a caractere e espera o React entre cada passo.
 * Com a suíte inteira em paralelo — e mais ainda quando um `tsc` divide a CPU
 * na mesma máquina —, esse 1s estoura por saturação e não por regressão: os
 * mesmos testes passam sozinhos, no mesmo commit. Já apareceu em três arquivos
 * diferentes (Onboarding, OportunidadesFiltros, RegistrarAposta), sempre nos
 * que usam `userEvent`.
 *
 * Vive AQUI e não em cada arquivo porque o valor já estava copiado em três
 * lugares com o mesmo comentário — e um teste que pisca é pior que um teste
 * lento: ele ensina o time a reexecutar sem ler.
 */
configure({ asyncUtilTimeout: 10_000 });

/**
 * `matchMedia`, que o jsdom não implementa.
 *
 * O `useIsMobile` chama isto para saber a largura, e sem o stub qualquer
 * componente que decida arranjo por breakpoint quebra o teste com
 * "window.matchMedia is not a function" — um erro que fala de ambiente e não do
 * que o teste queria dizer.
 *
 * Responde SEMPRE `matches: false`, ou seja, desktop. É o mesmo lado que o
 * `window.innerWidth` padrão do jsdom (1024) já dá ao estado inicial do hook,
 * então o stub concorda com ele em vez de criar um terceiro comportamento.
 * Teste que precise do celular mocka o hook, como o da FaixaPartida faz.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});

/**
 * `ResizeObserver`, que o jsdom também não implementa.
 *
 * O recharts mede o contêiner para desenhar dentro dele, e sem o stub qualquer
 * teste que monte um gráfico morre com "ResizeObserver is not defined" — de
 * novo um erro que fala de ambiente e não do que o teste queria dizer.
 *
 * O dublê não observa nada, e é o suficiente: o que o gráfico precisa provar em
 * teste é que ele recebeu os pontos certos e reagiu ao clique, não que ele
 * calculou pixel. Tamanho de gráfico se confere no navegador.
 */
if (typeof globalThis !== 'undefined' && !('ResizeObserver' in globalThis)) {
  class ResizeObserverDuble {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverDuble;
}
