import { useTranslation } from 'react-i18next';
import { faixaBadgeCls, type Faixa, type OpcaoDeFaixa } from '@/utils/futebol-score';
import { useCopyDoFutebol } from '@/hooks/use-copy-do-futebol';

/** A chave do catálogo que descreve cada faixa. O texto mora no catálogo. */
const chaveDaDescricao: Record<Faixa, string> = {
  alta: 'faixas.descricao.alta',
  media: 'faixas.descricao.media',
  baixa: 'faixas.descricao.baixa',
};

/**
 * O selo só aparece quando a janela declara a escala. Numa janela indefinida
 * `opcoesDeFaixa` devolve `selo: null` de propósito — as duas escalas convivem
 * e um número cravado descreveria errado metade da lista. A explicação em
 * palavras vale nos dois casos, então a legenda continua legível sem o número.
 */
export function FaixasLegenda({ opcoes }: { opcoes: readonly OpcaoDeFaixa[] }) {
  const { t } = useTranslation('futebol');
  const copy = useCopyDoFutebol();
  return (
    <ul className="mt-2 space-y-2 text-[12px] text-ink-2">
      {opcoes.map(({ tone, selo }) => (
        <li key={tone} className="flex items-center gap-2">
          {selo && (
            // A cor sai do `tone`, e não mais do rótulo: pintar a partir da
            // palavra obrigava a legenda a ter a palavra em português para
            // acertar a classe, e em espanhol o selo sairia cinza (#544).
            <span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls(tone)}`}>
              {selo}
            </span>
          )}
          <span>
            {t('faixas.item', {
              rotulo: copy.palavraDaFaixa(tone),
              descricao: t(chaveDaDescricao[tone]),
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
