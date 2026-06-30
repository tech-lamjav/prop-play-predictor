import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

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

const PT_WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const PT_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const PT_MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const NBABriefingStrip: React.FC<NBABriefingStripProps> = ({ date, kpis, updatedAt, nextUpdateMin, searchSlot }) => {
  const isMobile = useIsMobile();
  const weekday = PT_WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = isMobile ? PT_MONTHS_SHORT[date.getMonth()] : PT_MONTHS[date.getMonth()];

  if (isMobile) {
    return (
      <div className="px-4 pt-4 pb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-2">Hoje na NBA</div>
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight mt-1 text-ink">
          {weekday}, {day} de {month}
        </h1>
        <p className="text-[12px] mt-1 text-ink-2">
          <span className="font-semibold text-ink">{kpis.games} jogos</span> · {kpis.opps} oport. ·{' '}
          <span className="font-semibold text-forest">{kpis.highConf} oportunidades 3★</span>
        </p>
        {updatedAt && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] tabular text-ink-2/70">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest" />
            <span>Atualizado às {updatedAt}</span>
          </div>
        )}

        {searchSlot && <div className="mt-3">{searchSlot}</div>}

        {/* Mini KPI row */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white border border-line rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] font-semibold text-ink-2/70">Jogos hoje</div>
            <div className="text-[20px] font-semibold tabular tracking-tight leading-none mt-1.5 text-ink">{kpis.games}</div>
          </div>
          <div className="bg-white border border-line rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] font-semibold text-ink-2/70">Oport. 3★</div>
            <div className="text-[20px] font-semibold tabular tracking-tight leading-none mt-1.5 text-forest">{kpis.highConf}</div>
          </div>
          <div className="bg-white border border-line rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] font-semibold text-ink-2/70">Lesões chave</div>
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
        <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-ink-2">Hoje na NBA</div>
        <h1 className="text-[40px] font-semibold tracking-tight leading-none text-ink mt-1">
          {weekday}, {day} de {month}
        </h1>
        <p className="text-[14px] mt-2 text-ink-2">
          <span className="font-semibold text-ink">{kpis.games} jogos</span> · {kpis.opps} oportunidades analisadas ·{' '}
          <span className="font-semibold text-forest ml-1">{kpis.highConf} oportunidades de alta confiança</span>
        </p>
        {updatedAt && (
          <div className="flex items-center gap-2 mt-3 text-[11px] tabular text-ink-2/70">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest" />
            <span>
              Atualizado às {updatedAt}
              {nextUpdateMin != null && nextUpdateMin > 0 && ` · próxima atualização em ${nextUpdateMin}min`}
            </span>
          </div>
        )}
        {searchSlot && <div className="mt-4">{searchSlot}</div>}
      </div>
      <div className="col-span-5 grid grid-cols-3 gap-3">
        <KpiCard label="Jogos hoje" value={kpis.games} sub="todos com análise" tone="ink" />
        <KpiCard label="Oportunidades 3★" value={kpis.highConf} sub="alta confiança" tone="green" />
        <KpiCard label="Lesões chave" value={kpis.keyInjuries} sub="gatilham análises" tone="amber" />
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
