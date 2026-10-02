import { useTranslation } from 'react-i18next';
import { periodoDosUltimos, type Periodo } from './crm-painel';

/**
 * Os atalhos de data, e o "escolher no calendário".
 *
 * A lista é curta de propósito: são os recortes que a abordagem usa de verdade
 * — quem chegou esta semana, este mês, este trimestre. Um seletor com doze
 * opções cobriria mais casos e faria escolher custar mais que abordar.
 *
 * `dias` nulo é o atalho que não recorta nada. `personalizado` não tem dias
 * porque quem manda nele são os dois campos de data.
 */
/**
 * ⚠️ Guarda CHAVE, e não texto. A tabela é avaliada uma vez, no carregamento do
 * módulo: texto aqui congelaria o idioma da primeira pintura e trocar de idioma
 * não mexeria no seletor. O `t()` acontece no render, e o `key` do React é o
 * `id`. Mesmo desenho de `src/config/menu-da-conta.ts`.
 */
const ATALHOS: { id: string; chave: string; dias: number | null }[] = [
  { id: 'sempre', chave: 'painel.filtroPeriodo.atalhos.sempre', dias: null },
  { id: '7', chave: 'painel.filtroPeriodo.atalhos.ultimos7', dias: 7 },
  { id: '30', chave: 'painel.filtroPeriodo.atalhos.ultimos30', dias: 30 },
  { id: '90', chave: 'painel.filtroPeriodo.atalhos.ultimos90', dias: 90 },
  { id: 'personalizado', chave: 'painel.filtroPeriodo.atalhos.personalizado', dias: null },
];

export const ATALHO_PADRAO = 'sempre';

/**
 * O período do filtro, pelo dia de cadastro.
 *
 * O atalho escolhido fica por fora, no estado de quem chama, porque a tela
 * precisa saber a diferença entre "desde sempre" e um personalizado com os dois
 * campos vazios: os dois filtram igual, e só um deve abrir os campos de data.
 *
 * ⚠️ Este filtro recorta a LISTA, e não os números do topo nem o funil. É a
 * mesma regra da busca, e ela existe porque os números respondem "como está a
 * operação" — uma resposta que não pode mudar porque alguém foi olhar quem
 * chegou esta semana.
 */
export function FiltroDePeriodo({
  atalho,
  periodo,
  hoje,
  aoMudar,
}: {
  atalho: string;
  periodo: Periodo;
  hoje: string;
  aoMudar: (atalho: string, periodo: Periodo) => void;
}) {
  const { t } = useTranslation('socios');

  const escolher = (id: string) => {
    const encontrado = ATALHOS.find((a) => a.id === id);
    if (id === 'personalizado') {
      // Começa vazio em vez de herdar o atalho anterior: herdar faria o
      // calendário abrir já com um recorte que o sócio não escolheu.
      aoMudar(id, { de: null, ate: null });
      return;
    }
    aoMudar(
      id,
      encontrado?.dias ? periodoDosUltimos(encontrado.dias, hoje) : { de: null, ate: null },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={atalho}
        onChange={(e) => escolher(e.target.value)}
        aria-label={t('painel.filtroPeriodo.aria')}
        className="h-11 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[14px] text-ink"
      >
        {ATALHOS.map((a) => (
          <option key={a.id} value={a.id}>
            {t(a.chave)}
          </option>
        ))}
      </select>

      {atalho === 'personalizado' && (
        <>
          <input
            type="date"
            value={periodo.de ?? ''}
            max={periodo.ate ?? undefined}
            onChange={(e) => aoMudar(atalho, { ...periodo, de: e.target.value || null })}
            aria-label={t('painel.filtroPeriodo.de')}
            className="h-11 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[14px] text-ink"
          />
          <input
            type="date"
            value={periodo.ate ?? ''}
            min={periodo.de ?? undefined}
            onChange={(e) => aoMudar(atalho, { ...periodo, ate: e.target.value || null })}
            aria-label={t('painel.filtroPeriodo.ate')}
            className="h-11 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[14px] text-ink"
          />
        </>
      )}
    </div>
  );
}
