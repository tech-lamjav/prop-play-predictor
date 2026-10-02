import { useTranslation } from 'react-i18next';

/**
 * O nome acessível do botão de fechar, lido em voz alta por leitor de tela.
 *
 * ⚠️ Vive num arquivo próprio porque os dois primitivos que precisam dele —
 * o diálogo e a gaveta — são setas de RETORNO IMPLÍCITO vindas do shadcn, e
 * converter o corpo de cada uma só para poder chamar um hook seria mexer mais
 * neles do que o necessário. A primeira versão disto estava COPIADA nos dois,
 * comentário incluído, e uma revisão pegou.
 *
 * ⚠️ Estava em inglês ("Close") num produto em português — anunciado assim por
 * leitor de tela em 30 telas. Atualizar aqueles primitivos a partir da origem
 * tende a trazer o inglês de volta; se acontecer, é aqui que se conserta.
 */
export function RotuloFechar() {
  const { t } = useTranslation('comum');
  return <span className="sr-only">{t('acoes.fechar')}</span>;
}
