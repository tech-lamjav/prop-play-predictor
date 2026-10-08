import React, { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { fmtPct, fmtDinheiroDaPessoa } from '@/utils/formato';
import type { OddsBucket } from '@/utils/dashboardAggregations';

interface OddsHistogramProps {
  data: OddsBucket[];
  formatValue?: (value: number) => string;
}

export const OddsHistogram: React.FC<OddsHistogramProps> = ({
  data,
  formatValue = (v) => fmtDinheiroDaPessoa(v, { casas: 0 }),
}) => {
  const { t } = useTranslation('apostas');
  const filledBuckets = data.filter((b) => b.n > 0);
  const totalBets = data.reduce((s, b) => s + b.n, 0);
  const totalProfit = data.reduce((s, b) => s + b.profit, 0);
  const maxAbsRoi = Math.max(...data.map((b) => Math.abs(b.roi)), 10);
  // Default: esconde faixas vazias — consistente com BigHeatmap
  const [hideEmpty, setHideEmpty] = useState(true);
  const hasEmpty = data.some((b) => b.n === 0);
  const displayData = hideEmpty ? filledBuckets : data;

  const sweetSpot = useMemo(() => {
    if (filledBuckets.length === 0) return null;
    // Só conta faixa lucrativa: n >= 3 E ROI positivo (senão "mais lucrativa" engana).
    const candidates = filledBuckets.filter((b) => b.n >= 3 && b.roi > 0);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, b) => (b.roi > best.roi ? b : best), candidates[0]);
  }, [filledBuckets]);

  const sweetSpotShare = useMemo(() => {
    if (!sweetSpot || totalBets === 0) return null;
    const volumeShare = (sweetSpot.n / totalBets) * 100;
    const profitShare = totalProfit !== 0 ? (sweetSpot.profit / totalProfit) * 100 : 0;
    return { volumeShare, profitShare };
  }, [sweetSpot, totalBets, totalProfit]);

  /**
   * Qual das três frases da faixa mais lucrativa a tela diz.
   *
   * Sai do JSX porque o DESTAQUE da ponta muda de cor junto com a frase: na
   * que fala de lucro ele é tinta, nas outras duas é verde.
   */
  const fraseDaFaixa =
    !sweetSpot || !sweetSpotShare
      ? null
      : totalProfit > 0 && sweetSpot.profit > 0
        ? 'volumeELucro'
        : sweetSpot.profit > 0
          ? 'volumeEGanho'
          : 'volumeERoi';

  if (filledBuckets.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-5 h-full flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">{t('painel.faixaDeOdd.etiqueta')}</div>
        <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">{t('painel.faixaDeOdd.titulo')}</h2>
        <p className="text-[13px] text-ink-2 py-8 text-center">{t('painel.faixaDeOdd.vazio')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">{t('painel.faixaDeOdd.etiqueta')}</div>
          <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">{t('painel.faixaDeOdd.titulo')}</h2>
        </div>
        {hasEmpty && (
          <button
            type="button"
            onClick={() => setHideEmpty((v) => !v)}
            className={`shrink-0 h-7 px-2.5 text-[11px] font-medium rounded-md inline-flex items-center gap-1 transition-colors ${
              hideEmpty
                ? 'bg-forest-tint text-forest border border-forest/30'
                : 'bg-white text-ink-2 border border-line hover:bg-canvas-2'
            }`}
            aria-pressed={hideEmpty}
            title={
              hideEmpty
                ? t('painel.faixaDeOdd.mostrarTudoTitulo')
                : t('painel.faixaDeOdd.esconderVaziosTitulo')
            }
          >
            {hideEmpty ? t('painel.faixaDeOdd.mostrarTudo') : t('painel.faixaDeOdd.esconderVazios')}
          </button>
        )}
      </div>

      {/* Bars */}
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: `repeat(${displayData.length}, 1fr)` }}
      >
        {displayData.map((b) => {
          const height = b.n === 0 ? 4 : Math.max(8, (Math.abs(b.roi) / maxAbsRoi) * 100);
          const isPositive = b.roi > 0;
          const isEmpty = b.n === 0;
          return (
            <div key={b.range} className="flex flex-col items-center gap-1">
              <div
                className={`text-[10px] tabular font-bold ${
                  isEmpty ? 'text-ink-2/50' : isPositive ? 'text-forest' : 'text-rose-700'
                }`}
              >
                {isEmpty ? '—' : `${b.roi > 0 ? '+' : ''}${fmtPct(b.roi / 100, 0)}`}
              </div>
              <div className="w-full h-32 flex items-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    isEmpty ? 'bg-canvas-2' : isPositive ? 'bg-forest' : 'bg-rose-700'
                  }`}
                  style={{ height: `${height}%` }}
                  title={
                    // A faixa é número de odd, e odd segue o SETOR: ponto em
                    // qualquer idioma. Por isso `b.range` entra como está.
                    isEmpty
                      ? t('painel.faixaDeOdd.barraSemDados', { faixa: b.range })
                      : t('painel.faixaDeOdd.barra', {
                          faixa: b.range,
                          count: b.n,
                          roi: fmtPct(b.roi / 100, 1),
                          valor: formatValue(b.profit),
                        })
                  }
                />
              </div>
              <div className="text-[10px] tabular text-ink font-bold">{b.range}</div>
              <div className="text-[9px] tabular text-ink-2">{isEmpty ? '—' : `n=${b.n}`}</div>
            </div>
          );
        })}
      </div>

      {/* Faixa mais lucrativa */}
      <div className="mt-auto pt-3 border-t border-line text-[12px] text-ink-2 leading-relaxed">
        {sweetSpot && sweetSpotShare && fraseDaFaixa ? (
          /* ⚠️ A FRASE INTEIRA MORA NO CATÁLOGO, e não em pedaços costurados
             aqui: a ordem das partes muda de idioma para idioma, e frase
             montada por concatenação só sabe a ordem de quem a escreveu.
             Os <0>…<3> do catálogo são os destaques desta lista, nesta ordem. */
          <Trans
            t={t}
            i18nKey={`painel.faixaDeOdd.${fraseDaFaixa}`}
            values={{
              faixa: sweetSpot.range,
              volume: fmtPct(sweetSpotShare.volumeShare / 100, 0),
              lucro: fmtPct(sweetSpotShare.profitShare / 100, 0),
              valor: `+${formatValue(sweetSpot.profit)}`,
              roi: fmtPct(sweetSpot.roi / 100, 1),
            }}
            components={[
              <span className="text-ink font-bold" key="rotulo" />,
              <span className="text-forest font-bold tabular" key="faixa" />,
              <span className="text-ink font-bold tabular" key="volume" />,
              fraseDaFaixa === 'volumeELucro' ? (
                <span className="text-ink font-bold tabular" key="ponta" />
              ) : (
                <span className="text-forest font-bold tabular" key="ponta" />
              ),
            ]}
          />
        ) : (
          <>{t('painel.faixaDeOdd.semFaixa')}</>
        )}
      </div>
    </div>
  );
};
