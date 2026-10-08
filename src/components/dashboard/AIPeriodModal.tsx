import React, { useMemo, useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { X, Sparkles, Info, Check } from 'lucide-react';
import {
  filterBetsByDateRange,
  getDateRangeForPreset,
  type DateRangePreset,
} from '@/utils/bettingStats';
import {
  isSettled,
  applyFocus,
  isEmptyFocus,
  EMPTY_FOCUS,
  type FocusFilter,
  type BetWithTags,
} from '@/utils/dashboardAggregations';
import type { Bet } from '@/hooks/use-bets';

/* Tabela fora do componente: guarda CHAVE, nunca texto. */
const PRESETS: { value: DateRangePreset; chave: string }[] = [
  { value: '7', chave: 'painel.novaAnalise.presets.d7' },
  { value: '30', chave: 'painel.novaAnalise.presets.d30' },
  { value: '90', chave: 'painel.novaAnalise.presets.d90' },
  { value: 'all', chave: 'painel.novaAnalise.presets.tudo' },
];

interface AIPeriodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bets: Bet[];
  /** Bets com tags pra computar chips de foco por tag. */
  betsWithTags: BetWithTags[];
  /** Top ligas e tags pra gerar os chips de foco. */
  focusOptions: { leagues: string[]; tags: string[] };
  currentPeriod: DateRangePreset;
  currentFocus: FocusFilter;
  /** Chamado quando o usuário confirma com período + foco. Modal fecha automaticamente. */
  onConfirm: (period: DateRangePreset, focus: FocusFilter) => void;
}

export const AIPeriodModal: React.FC<AIPeriodModalProps> = ({
  open,
  onOpenChange,
  bets,
  betsWithTags,
  focusOptions,
  currentPeriod,
  currentFocus,
  onConfirm,
}) => {
  const { t } = useTranslation('apostas');
  const [selected, setSelected] = useState<DateRangePreset>(
    PRESETS.some((p) => p.value === currentPeriod) ? currentPeriod : '30'
  );
  const [focus, setFocus] = useState<FocusFilter>(currentFocus);

  useEffect(() => {
    if (open) {
      setSelected(PRESETS.some((p) => p.value === currentPeriod) ? currentPeriod : '30');
      setFocus(currentFocus);
    }
  }, [open, currentPeriod, currentFocus]);

  const hasAnyOption =
    focusOptions.leagues.length > 0 || focusOptions.tags.length > 0;

  const toggleLeague = (name: string) => {
    setFocus((prev) => ({
      ...prev,
      leagues: prev.leagues.includes(name)
        ? prev.leagues.filter((n) => n !== name)
        : [...prev.leagues, name],
    }));
  };

  const toggleTag = (name: string) => {
    setFocus((prev) => ({
      ...prev,
      tags: prev.tags.includes(name)
        ? prev.tags.filter((n) => n !== name)
        : [...prev.tags, name],
    }));
  };

  const clearFocus = () => setFocus(EMPTY_FOCUS);

  const counts = useMemo(() => {
    const map: Partial<Record<DateRangePreset, number>> = {};
    PRESETS.forEach((p) => {
      const { from, to } = getDateRangeForPreset(p.value);
      const filtered = filterBetsByDateRange(bets, from, to).filter(isSettled);
      map[p.value] = filtered.length;
    });
    return map;
  }, [bets]);

  // Apply selected period + focus to derive the actual count shown in the summary
  const selectedCount = useMemo(() => {
    const { from, to } = getDateRangeForPreset(selected);
    const periodFiltered = filterBetsByDateRange(betsWithTags, from, to);
    const focused = applyFocus(periodFiltered, focus);
    return focused.filter(isSettled).length;
  }, [selected, focus, betsWithTags]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-rebrand bg-white border-line p-0 overflow-hidden max-w-lg shadow-[0_30px_60px_-20px_rgba(0,0,0,0.3)] [&>button]:hidden">
        {/* Header forest */}
        <div className="relative overflow-hidden bg-forest text-white px-6 py-5">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '8px 8px',
            }}
          />
          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-400 text-forest grid place-items-center text-[18px] font-bold shrink-0">
              B
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 font-bold">
                {t('painel.novaAnalise.eyebrow')}
              </div>
              <DialogTitle className="text-[18px] font-extrabold tracking-tight leading-tight mt-0.5">
                {t('painel.novaAnalise.titulo')}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-white/65 mt-1">
                {t('painel.novaAnalise.descricao')}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 grid place-items-center shrink-0 transition-colors"
              aria-label={t('painel.acoes.fechar')}
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-2 font-bold mb-2">
            {t('painel.novaAnalise.periodosSugeridos')}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((p) => {
              const isOn = selected === p.value;
              const n = counts[p.value] ?? 0;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSelected(p.value)}
                  className={`rounded-lg p-3 text-left border-2 transition-colors ${
                    isOn
                      ? 'bg-forest text-white border-forest'
                      : 'bg-white text-ink border-line hover:border-forest/50'
                  }`}
                >
                  <div className="text-[14px] font-bold">{t(p.chave)}</div>
                  <div className={`text-[10px] tabular ${isOn ? 'text-amber-300' : 'text-ink-2'}`}>
                    {t('painel.novaAnalise.contagem', { count: n })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Focus filter chips */}
          {hasAnyOption && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-2 font-bold">
                  {t('painel.novaAnalise.foco')}{' '}
                  <span className="normal-case tracking-normal text-[10px] text-ink-2/70 font-normal">
                    {t('painel.novaAnalise.focoOpcional')}
                  </span>
                </div>
                {!isEmptyFocus(focus) && (
                  <button
                    type="button"
                    onClick={clearFocus}
                    className="text-[10px] font-bold text-forest hover:underline"
                  >
                    {t('painel.novaAnalise.limpar')}
                  </button>
                )}
              </div>

              {/* Ligas */}
              {focusOptions.leagues.length > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-2/70 font-bold mb-1.5">
                    {t('painel.novaAnalise.ligas')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {focusOptions.leagues.map((lg) => {
                      const isOn = focus.leagues.includes(lg);
                      return (
                        <button
                          key={`league:${lg}`}
                          type="button"
                          onClick={() => toggleLeague(lg)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                            isOn
                              ? 'bg-forest text-white border-forest'
                              : 'bg-white text-ink border-line hover:border-forest/50'
                          }`}
                        >
                          {isOn && <Check className="w-3 h-3" />}
                          <span>{lg}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags */}
              {focusOptions.tags.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-2/70 font-bold mb-1.5">
                    {t('painel.novaAnalise.etiquetas')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {focusOptions.tags.map((tag) => {
                      const isOn = focus.tags.includes(tag);
                      return (
                        <button
                          key={`tag:${tag}`}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                            isOn
                              ? 'bg-forest text-white border-forest'
                              : 'bg-white text-ink border-line hover:border-forest/50'
                          }`}
                        >
                          {isOn && <Check className="w-3 h-3" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="mt-6 pt-5 border-t border-line">
            <div className="flex items-center gap-2 text-[11px] text-ink-2 mb-4">
              <Info className="w-3.5 h-3.5 shrink-0 text-forest" />
              {selectedCount > 0 ? (
                <span>
                  {/* A frase inteira mora no catálogo: o destaque é o <0>, e a
                      posição dele dentro da frase é decisão de cada idioma. */}
                  <Trans
                    t={t}
                    i18nKey="painel.novaAnalise.resumo"
                    count={selectedCount}
                    components={[
                      <span className="text-ink font-bold tabular" key="quantas" />,
                    ]}
                  />
                </span>
              ) : (
                <span>{t('painel.novaAnalise.semApostas')}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 px-4 rounded-md border border-line text-[12px] font-bold text-ink-2 hover:text-ink hover:bg-canvas-2 transition-colors flex-1"
              >
                {t('painel.novaAnalise.cancelar')}
              </button>
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => onConfirm(selected, focus)}
                className="h-10 px-5 rounded-md bg-amber-400 text-forest font-bold text-[12px] hover:bg-amber-300 transition-colors flex-[2] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {selectedCount > 0
                  ? t('painel.novaAnalise.analisarContagem', { count: selectedCount })
                  : t('painel.novaAnalise.analisar')}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
