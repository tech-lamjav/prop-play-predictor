import { useTranslation } from 'react-i18next';
import { faixaBadgeCls, type Faixa, type OpcaoDeFaixa } from '@/utils/futebol-score';

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
  return (
    <ul className="mt-2 space-y-2 text-[12px] text-ink-2">
      {opcoes.map(({ tone, rotulo, selo }) => (
        <li key={tone} className="flex items-center gap-2">
          {selo && (
            <span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls(rotulo)}`}>
              {selo}
            </span>
          )}
          <span>{t('faixas.item', { rotulo, descricao: t(chaveDaDescricao[tone]) })}</span>
        </li>
      ))}
    </ul>
  );
}
