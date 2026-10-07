import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { nomeDoDiaDaSemana, nomeDoMes } from '@/utils/nomes-de-data';

export interface BriefingKPIs {
  games: number;
  opps: number;
  highConf: number;
  keyInjuries: number;
}

interface NBABriefingStripProps {
  /** Data do dia (ISO yyyy-MM-dd ou Date) */
  date: Date;
  kpis: BriefingKPIs;
  /** Hora da última atualização (ex: "14:32"). Se omitida, esconde a linha de status. */
  updatedAt?: string;
  /** Minutos para próxima atualização. Se omitida, esconde. */
  nextUpdateMin?: number;
  /** Slot opcional pra encaixar a busca (ou outro widget) na coluna esquerda */
  searchSlot?: React.ReactNode;
}

// Dia e mês vêm do `Intl` no idioma ativo. Eram três tabelas escritas em
// português, e a home em espanhol dizia "Terça, 6 de outubro".

export const NBABriefingStrip: React.FC<NBABriefingStripProps> = ({ date, kpis, updatedAt, nextUpdateMin, searchSlot }) => {
  const { t } = useTranslation('nba');
  const isMobile = useIsMobile();
  const weekday = nomeDoDiaDaSemana(date.getDay());
  const day = date.getDate();
  const month = nomeDoMes(date.getMonth(), isMobile ? 'short' : 'long');

  if (isMobile) {
    return (
      <div className="px-4 pt-4 pb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-2">{t('briefing.etiqueta')}</div>
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight mt-1 text-ink">
          {t('briefing.dataLonga', { semana: weekday, dia: day, mes: month })}
        </h1>
        <p className="text-[12px] mt-1 text-ink-2">
          <Trans
            t={t}
            i18nKey="briefing.resumoMobile"
            values={{ jogos: kpis.games, opps: kpis.opps, alta: kpis.highConf }}
            components={[
              <span className="font-semibold text-ink" key="jogos" />,
              <span className="font-semibold text-forest" key="alta" />,
            ]}
          />
        </p>
        {updatedAt && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] tabular text-ink-2/70">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest" />
            <span>{t('briefing.atualizado', { hora: updatedAt })}</span>
          </div>
        )}

        {searchSlot && <div className="mt-3">{searchSlot}</div>}

        {/* Mini KPI row */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white border border-line rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] font-semibold text-ink-2/70">{t('briefing.kpiJogos')}</div>
            <div className="text-[20px] font-semibold tabular tracking-tight leading-none mt-1.5 text-ink">{kpis.games}</div>
          </div>
          <div className="bg-white border border-line rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] font-semibold text-ink-2/70">{t('briefing.kpiOport3Curto')}</div>
            <div className="text-[20px] font-semibold tabular tracking-tight leading-none mt-1.5 text-forest">{kpis.highConf}</div>
          </div>
          <div className="bg-white border border-line rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] font-semibold text-ink-2/70">{t('briefing.kpiLesoes')}</div>
            <div className="text-[20px] font-semibold tabular tracking-tight leading-none mt-1.5 text-status-warning">{kpis.keyInjuries}</div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div className="grid grid-cols-12 gap-5 items-start">
      <div className="col-span-7">
        <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-ink-2">{t('briefing.etiqueta')}</div>
        <h1 className="text-[40px] font-semibold tracking-tight leading-none text-ink mt-1">
          {t('briefing.dataLonga', { semana: weekday, dia: day, mes: month })}
        </h1>
        <p className="text-[14px] mt-2 text-ink-2">
          <Trans
            t={t}
            i18nKey="briefing.resumoDesktop"
            values={{ jogos: kpis.games, opps: kpis.opps, alta: kpis.highConf }}
            components={[
              <span className="font-semibold text-ink" key="jogos" />,
              <span className="font-semibold text-forest ml-1" key="alta" />,
            ]}
          />
        </p>
        {updatedAt && (
          <div className="flex items-center gap-2 mt-3 text-[11px] tabular text-ink-2/70">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest" />
            <span>
              {t('briefing.atualizado', { hora: updatedAt })}
              {nextUpdateMin != null && nextUpdateMin > 0 && t('briefing.proximaAtualizacao', { min: nextUpdateMin })}
            </span>
          </div>
        )}
        {searchSlot && <div className="mt-4">{searchSlot}</div>}
      </div>
      <div className="col-span-5 grid grid-cols-3 gap-3">
        <KpiCard label={t('briefing.kpiJogos')} value={kpis.games} sub={t('briefing.kpiJogosSub')} tone="ink" />
        <KpiCard label={t('briefing.kpiOport3')} value={kpis.highConf} sub={t('briefing.kpiOport3Sub')} tone="green" />
        <KpiCard label={t('briefing.kpiLesoes')} value={kpis.keyInjuries} sub={t('briefing.kpiLesoesSub')} tone="amber" />
      </div>
    </div>
  );
};

type KpiTone = 'ink' | 'green' | 'amber';

interface KpiCardProps {
  label: string;
  value: number | string;
  sub: string;
  tone: KpiTone;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, tone }) => {
  const colorClass = tone === 'green' ? 'text-forest' : tone === 'amber' ? 'text-status-warning' : 'text-ink';
  return (
    <div className="bg-white border border-line rounded-xl px-3 pt-3 pb-2">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-2">{label}</div>
      <div className={`text-[30px] font-semibold tabular tracking-tight leading-none mt-2 ${colorClass}`}>{value}</div>
      <div className="text-[11px] mt-1.5 text-ink-2/70">{sub}</div>
    </div>
  );
};
