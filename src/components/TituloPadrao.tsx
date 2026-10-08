import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { idiomaAtivo } from '@/i18n/init';
import { PADRAO_DA_MARCA } from '@/components/Seo';

/**
 * O título da aba para quem NÃO monta `<Seo>`.
 *
 * ⚠️ Nasceu de um defeito que o usuário viu: seis telas públicas — entrar,
 * lista de espera, jogos, detalhe do jogo, painel da NBA e home da NBA — não
 * montam `<Seo>`, então herdavam o `<title>` FIXO do esqueleto da página, que
 * está em português. Página inteira em espanhol, aba em português.
 *
 * Fica na raiz, e não em cada uma das seis, por dois motivos: montar `<Seo>`
 * nelas mudaria indexação, porque aquele componente SEMPRE emite a marca de
 * robots — e indexação está fora do escopo do #532; e tela pública nova
 * nasceria com o mesmo defeito sem ninguém lembrar.
 *
 * ⚠️ USA `defaultTitle`, E NÃO UM `<title>`. A primeira tentativa foi um
 * `<title>` aqui, e ele GANHOU das telas que já tinham o seu: a de planos
 * passou a mostrar o título genérico. A precedência do Helmet é por ordem de
 * renderização, não por profundidade na árvore, então um título na raiz
 * atropela os de baixo. `defaultTitle` é o mecanismo certo: ele só entra
 * quando ninguém definiu título nenhum.
 *
 * Por isso também não há `description` aqui — ela cairia na mesma armadilha,
 * e não existe "defaultDescription".
 */
export function TituloPadrao() {
  // Assina a troca de idioma: sem isto o título congela no idioma de abertura.
  useTranslation();
  const idioma = idiomaAtivo();

  return <Helmet defaultTitle={PADRAO_DA_MARCA[idioma].title} />;
}
