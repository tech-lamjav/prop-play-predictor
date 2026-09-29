import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { definirLocaleAtivo } from '@/utils/formato';
import { carregarArea } from './carregar';
import { idiomaInicial } from './idioma-inicial';
import {
  IDIOMAS,
  IDIOMA_DE_REFERENCIA,
  LOCALE_DO_IDIOMA,
  ehIdioma,
  type Area,
  type Idioma,
} from './idiomas';

// ============================================================================
// init.ts — a inicialização, e é UMA só
// ============================================================================
// Antes disto, três telas importavam o i18next cada uma por conta própria e
// nenhuma delas usava (#534). A inicialização agora é global, acontece uma
// vez, na raiz, e todo o resto do produto só consome.
// ============================================================================

/**
 * Onde a escolha fica guardada.
 *
 * NO NAVEGADOR, e não no perfil: quem escolhe espanhol no computador e abre no
 * celular volta em português. Guardar no perfil é mudança de schema, e schema
 * neste produto tem regra própria — ficou fora do escopo do #532 de propósito.
 */
const CHAVE_GUARDADA = 'smartbetting.idioma';

/**
 * Ler e escrever armazenamento pode LANÇAR — janela anônima, cookie
 * bloqueado, política de empresa. Nenhuma das duas pode derrubar a página:
 * sem armazenamento o produto ainda funciona, só esquece a escolha.
 */
export function idiomaGuardado(): string | null {
  try {
    return localStorage.getItem(CHAVE_GUARDADA);
  } catch {
    return null;
  }
}

function guardarIdioma(idioma: Idioma): void {
  try {
    localStorage.setItem(CHAVE_GUARDADA, idioma);
  } catch {
    /* sem armazenamento, a escolha vale só nesta aba */
  }
}

/**
 * O atributo de idioma do documento.
 *
 * ⚠️ Não é enfeite: é critério de acessibilidade de NÍVEL A (WCAG 3.1.1). É o
 * que faz leitor de tela trocar a pronúncia. Antes disto o esqueleto da página
 * dizia `pt-BR` fixo, e diria isso mesmo com a tela inteira em espanhol.
 */
function aplicarIdiomaNoDocumento(idioma: Idioma): void {
  document.documentElement.lang = LOCALE_DO_IDIOMA[idioma];
}

/**
 * O que o idioma ativo arrasta junto, além do texto.
 *
 * A formatação de número passa a seguir o idioma. O DINHEIRO não entra aqui, e
 * é decisão e não esquecimento: ver `definirLocaleAtivo` em `formato.ts`.
 */
function aplicarEfeitos(idioma: Idioma): void {
  aplicarIdiomaNoDocumento(idioma);
  definirLocaleAtivo(LOCALE_DO_IDIOMA[idioma]);
}

/**
 * O carregador de texto, na forma que o i18next espera.
 *
 * Ele delega para `carregarArea`, que é a MESMA função que a guarda de
 * paridade exercita. Um segundo caminho de carregamento aqui seria uma
 * segunda chance de divergir em silêncio.
 */
const carregadorDeTexto = {
  type: 'backend' as const,
  init: () => {},
  read(
    idioma: string,
    area: string,
    pronto: (erro: unknown, dados?: Record<string, unknown> | false) => void,
  ) {
    if (!ehIdioma(idioma)) return pronto(new Error(`idioma desconhecido: ${idioma}`), false);
    carregarArea(idioma, area as Area).then(
      (dados) => pronto(null, dados),
      (erro) => pronto(erro, false),
    );
  },
};

/** O idioma com que esta visita abre. */
export function idiomaDeAbertura(): Idioma {
  return idiomaInicial(
    idiomaGuardado(),
    typeof navigator === 'undefined' ? undefined : navigator.languages,
  );
}

let iniciado = false;

export function iniciarIdioma(): typeof i18next {
  if (iniciado) return i18next;
  iniciado = true;

  const idioma = idiomaDeAbertura();
  aplicarEfeitos(idioma);

  void i18next
    .use(carregadorDeTexto)
    .use(initReactI18next)
    .init({
      lng: idioma,
      // Chave sem tradução mostra o PORTUGUÊS, nunca o código da chave. É rede
      // de segurança e não estratégia: quem impede a chave faltante de chegar
      // na develop é a guarda de paridade, não este recuo.
      fallbackLng: IDIOMA_DE_REFERENCIA,
      supportedLngs: [...IDIOMAS],
      ns: ['comum'],
      defaultNS: 'comum',
      // O React já escapa; escapar de novo transformaria acento em entidade.
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });

  return i18next;
}

/** Troca o idioma: na hora, sem recarregar, e lembrando da escolha. */
export async function trocarIdioma(idioma: Idioma): Promise<void> {
  guardarIdioma(idioma);
  aplicarEfeitos(idioma);
  await i18next.changeLanguage(idioma);
}

/** O idioma ativo agora, sempre um que o produto fala. */
export function idiomaAtivo(): Idioma {
  const atual = i18next.resolvedLanguage ?? i18next.language;
  return ehIdioma(atual) ? atual : IDIOMA_DE_REFERENCIA;
}
