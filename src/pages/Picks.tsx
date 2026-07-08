import { useState, useEffect, useMemo } from 'react';
import { usePostHog } from '@posthog/react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle, ArrowRight, ChevronRight, Filter, LayoutGrid, List,
  Loader2, Star, X as XIcon, Info, ChevronDown,
} from 'lucide-react';
import { nbaDataService, DailyOpportunity } from '@/services/nba-data.service';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import { NBAHomeNav } from '@/components/nba-home/NBAHomeHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { useSubscription } from '@/hooks/use-subscription';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_threes: '3 Pontos',
  player_steals: 'Roubos',
  player_blocks: 'Bloqueios',
  player_turnovers: 'Turnovers',
  player_minutes: 'Minutos',
  player_points_assists: 'Pts + Ast',
  player_points_rebounds: 'Pts + Reb',
  player_rebounds_assists: 'Reb + Ast',
  player_points_rebounds_assists: 'PRA',
  player_blocks_steals: 'Blk + Stl',
};

// Paleta fixa de 9 cores — cada gatilho ganha uma cor estável por hash do player_id
const TRIGGER_PALETTE = [
  '#7c2d12', '#1d4ed8', '#ea7c1e', '#6d28d9', '#9a6c00',
  '#0a3d2e', '#9a1f2e', '#0e7490', '#be185d',
];

function getTriggerColor(triggerId: number): string {
  return TRIGGER_PALETTE[Math.abs(triggerId) % TRIGGER_PALETTE.length];
}

function statusBadgeMeta(status: string): { text: string; cls: string } {
  const s = (status ?? '').toLowerCase();
  if (s === 'out' || s.includes('out')) return { text: 'OUT', cls: 'bg-rose-100 text-rose-700' };
  if (s.includes('doubtful')) return { text: 'DTD', cls: 'bg-orange-100 text-orange-700' };
  return { text: 'Q', cls: 'bg-amber-100 text-amber-700' };
}

// Versão por extenso em pt-BR — usada quando há espaço pra ler o status completo
function statusFullPT(status: string): { label: string; cls: string } {
  const s = (status ?? '').toLowerCase();
  if (s.includes('out for season')) return { label: 'Fora da temporada', cls: 'text-rose-700' };
  if (s === 'out' || s.includes('out')) return { label: 'Fora', cls: 'text-rose-700' };
  if (s.includes('doubtful')) return { label: 'Duvidoso', cls: 'text-orange-700' };
  if (s.includes('probable')) return { label: 'Provável', cls: 'text-emerald-700' };
  return { label: 'Questionável', cls: 'text-amber-700' };
}

function scoreBadgeCls(score: number | null): { cls: string; tone: 'green' | 'tint' | 'amber' | 'gray' } {
  if (score == null) return { cls: 'bg-canvas-2 text-ink-2', tone: 'gray' };
  if (score >= 80) return { cls: 'bg-forest text-white', tone: 'green' };
  if (score >= 70) return { cls: 'bg-emerald-100 text-forest', tone: 'tint' };
  if (score >= 60) return { cls: 'bg-amber-100 text-amber-700', tone: 'amber' };
  return { cls: 'bg-canvas-2 text-ink-2', tone: 'gray' };
}

function lastName(full: string): string {
  return full.trim().split(/\s+/).pop() ?? full;
}

function initials(name: string): string {
  return name.split(/[\s-]/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────────

function PlayerPhoto({ name, teamAbbr, size = 32 }: { name: string; teamAbbr: string; size?: number }) {
  const init = initials(name);
  return (
    <div
      className="rounded-full overflow-hidden bg-canvas-2 border border-line shrink-0 grid place-items-center"
      style={{ width: size, height: size }}
    >
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={name}
        className="w-full h-full object-cover object-top"
        loading="lazy"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.insertAdjacentHTML('beforeend', `<span class="text-[10px] font-semibold text-ink-2">${init}</span>`);
          }
        }}
      />
    </div>
  );
}

function StarRow({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(3, n));
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {[0, 1, 2].map(i => (
        <Star key={i} className={`w-3 h-3 ${i < filled ? 'text-amber-400 fill-amber-400' : 'text-ink-3'}`} />
      ))}
    </span>
  );
}

interface FilterChipProps {
  active?: boolean;
  removable?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
function FilterChip({ active, removable, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 text-[12px] font-semibold rounded-md inline-flex items-center gap-1.5 shrink-0 transition-colors ${
        active
          ? 'bg-forest text-white border border-forest hover:bg-forest-soft'
          : 'bg-white text-ink border border-line hover:border-forest/30'
      }`}
    >
      {children}
      {active && removable && <XIcon className="w-3 h-3 opacity-80" />}
    </button>
  );
}

// Chip que abre um popover — usado por Score, Estatística, Jogo
function PopoverChip({
  active,
  label,
  onClear,
  children,
}: {
  active: boolean;
  label: React.ReactNode;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-8 px-3 text-[12px] font-semibold rounded-md inline-flex items-center gap-1.5 shrink-0 transition-colors ${
            active
              ? 'bg-forest text-white border border-forest hover:bg-forest-soft'
              : 'bg-white text-ink border border-line hover:border-forest/30'
          }`}
        >
          <span>{label}</span>
          {active && onClear ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onClear();
                }
              }}
              className="inline-flex items-center justify-center rounded hover:bg-white/20 -mr-1 w-4 h-4"
              aria-label="Limpar filtro"
            >
              <XIcon className="w-3 h-3 opacity-80" />
            </span>
          ) : (
            <ChevronDown className="w-3 h-3 opacity-70" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 bg-white text-ink border-line">
        {children}
      </PopoverContent>
    </Popover>
  );
}

const SCORE_PRESETS = [60, 70, 75, 80] as const;
const EDGE_PRESETS = [10, 20, 30, 50] as const;

interface GameOption {
  id: number;
  label: string;
  time: string | null;
}

// ── Fields (UI puro, sem popover) ──────────────────────────────────────────
function RangeField({
  label, helpText, min, max, step, presets, suffix,
  value, onChange,
}: {
  label: string;
  helpText?: string;
  min: number; max: number; step: number;
  presets: readonly number[];
  suffix: '+' | '%+';
  value: number;
  onChange: (v: number) => void;
}) {
  const valueLabel = value > 0
    ? suffix === '%+' ? `≥ ${value}%` : `${value}+`
    : 'Todos';
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-2">{label}</span>
          <span className="text-[14px] font-semibold tabular text-ink">{valueLabel}</span>
        </div>
        {helpText && <p className="text-[10px] text-ink-2/70 mt-1">{helpText}</p>}
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0] ?? 0)} />
      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`h-6 px-2 text-[11px] font-semibold rounded transition-colors ${
              value === p ? 'bg-forest text-white' : 'bg-canvas-2 text-ink-2 hover:bg-canvas-3'
            }`}
          >
            {p}{suffix}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`h-6 px-2 text-[11px] font-semibold rounded transition-colors ${
            value === 0 ? 'bg-forest text-white' : 'bg-canvas-2 text-ink-2 hover:bg-canvas-3'
          }`}
        >
          Todos
        </button>
      </div>
    </div>
  );
}

function StatField({
  options, selected, onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (s: string) => {
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]);
  };
  return (
    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
      <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-2 pb-2">Estatística</div>
      {options.length === 0 && (
        <div className="text-[12px] text-ink-2/70 py-2">Nenhuma estatística disponível</div>
      )}
      {options.map((s) => (
        <label key={s} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-canvas-2 cursor-pointer">
          <Checkbox checked={selected.includes(s)} onCheckedChange={() => toggle(s)} />
          <span className="text-[12px] text-ink">{STAT_LABELS[s] ?? s}</span>
        </label>
      ))}
    </div>
  );
}

function GameField({
  options, selected, onChange,
}: {
  options: GameOption[];
  selected: number[];
  onChange: (v: number[]) => void;
}) {
  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  return (
    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
      <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-2 pb-2">Jogo</div>
      {options.length === 0 && (
        <div className="text-[12px] text-ink-2/70 py-2">Nenhum jogo disponível</div>
      )}
      {options.map((g) => (
        <label key={g.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-canvas-2 cursor-pointer">
          <Checkbox checked={selected.includes(g.id)} onCheckedChange={() => toggle(g.id)} />
          <span className="text-[12px] text-ink">{g.label}</span>
          {g.time && <span className="ml-auto text-[11px] tabular text-ink-2/70">{g.time}</span>}
        </label>
      ))}
    </div>
  );
}

// ── Popovers (desktop) ────────────────────────────────────────────────────

function EdgePopover({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <PopoverChip
      active={value > 0}
      label={value > 0 ? `Vantagem ≥ ${value}%` : 'Vantagem'}
      onClear={value > 0 ? () => onChange(0) : undefined}
    >
      <RangeField
        label="Vantagem mínima"
        helpText="Diferença % entre média sem o gatilho e a linha da casa."
        min={0} max={100} step={5}
        presets={EDGE_PRESETS} suffix="%+"
        value={value} onChange={onChange}
      />
    </PopoverChip>
  );
}

function ScorePopover({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <PopoverChip
      active={value > 0}
      label={value > 0 ? `Score ${value}+` : 'Score'}
      onClear={value > 0 ? () => onChange(0) : undefined}
    >
      <RangeField
        label="Score mínimo"
        min={0} max={95} step={5}
        presets={SCORE_PRESETS} suffix="+"
        value={value} onChange={onChange}
      />
    </PopoverChip>
  );
}

function StatPopover({
  options, selected, onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const active = selected.length > 0;
  const label = active
    ? selected.length === 1
      ? (STAT_LABELS[selected[0]] ?? selected[0])
      : `${selected.length} estatísticas`
    : 'Estatística';
  return (
    <PopoverChip active={active} label={label} onClear={active ? () => onChange([]) : undefined}>
      <StatField options={options} selected={selected} onChange={onChange} />
    </PopoverChip>
  );
}

function GamePopover({
  options, selected, onChange,
}: {
  options: GameOption[];
  selected: number[];
  onChange: (v: number[]) => void;
}) {
  const active = selected.length > 0;
  const label = active
    ? selected.length === 1
      ? (options.find(o => o.id === selected[0])?.label ?? 'Jogo')
      : `${selected.length} jogos`
    : 'Jogo';
  return (
    <PopoverChip active={active} label={label} onClear={active ? () => onChange([]) : undefined}>
      <GameField options={options} selected={selected} onChange={onChange} />
    </PopoverChip>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────

type ViewMode = 'score' | 'trigger';

export default function Picks() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { isPremium } = useSubscription();

  const [opportunities, setOpportunities] = useState<DailyOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('score');

  // Filtros — chips ativos (toggle)
  const [minScore, setMinScore] = useState(0);
  const [threeStars, setThreeStars] = useState(false);
  const [minEdge, setMinEdge] = useState(0);
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [selectedGames, setSelectedGames] = useState<number[]>([]);

  // Free user paywall (mantém comportamento atual — adaptado pro tema light)
  const FREE_VISIBLE_COUNT = 2;
  const isRowFree = (idx: number) => isPremium || idx < FREE_VISIBLE_COUNT;
  const getBlur = (idx: number) => isRowFree(idx) ? '' : 'blur-sm select-none pointer-events-none';

  // Analytics: visualização da tela de Picks NBA (Marco 3 — retenção por superfície, N3).
  useEffect(() => {
    posthog?.capture('nba_picks_viewed');
  }, [posthog]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // ⚠️ TEMP — lock em 2026-05-10 pra iteração de layout do rebrand.
        // REVERTER pra `getDailyOpportunities()` (sem argumento) antes do merge.
        const data = await nbaDataService.getDailyOpportunities('2026-05-10');
        setOpportunities(data);
      } catch (err) {
        console.error('Error loading opportunities:', err);
        setError('Falha ao carregar oportunidades');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Listas únicas (calculadas antes do filter pra popular os selects)
  const availableStats = useMemo(() => {
    const set = new Set(opportunities.map(o => o.stat_type));
    return Array.from(set).sort((a, b) => (STAT_LABELS[a] ?? a).localeCompare(STAT_LABELS[b] ?? b));
  }, [opportunities]);

  const availableGames = useMemo(() => {
    const map = new Map<number, { id: number; label: string; time: string | null }>();
    for (const o of opportunities) {
      if (!map.has(o.game_id)) {
        map.set(o.game_id, {
          id: o.game_id,
          label: `${o.visitor_team_abbr} vs ${o.home_team_abbr}`,
          time: o.game_time,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }, [opportunities]);

  // Aplica filtros + ordena por score desc
  const filtered = useMemo(() => {
    let result = [...opportunities];
    if (minScore > 0) result = result.filter(o => (o.score ?? 0) >= minScore);
    if (threeStars) result = result.filter(o => (o.rating_stars ?? 0) >= 3);
    if (minEdge > 0) {
      result = result.filter(o => o.gap_vs_line_pct != null && Math.abs(o.gap_vs_line_pct) >= minEdge);
    }
    if (selectedStats.length > 0) result = result.filter(o => selectedStats.includes(o.stat_type));
    if (selectedGames.length > 0) result = result.filter(o => selectedGames.includes(o.game_id));
    result.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return result;
  }, [opportunities, minScore, threeStars, minEdge, selectedStats, selectedGames]);

  // Totais (após filtros)
  const totals = useMemo(() => {
    const games = new Set(filtered.map(o => o.game_id)).size;
    const opps = filtered.length;
    const highConf = filtered.filter(o => (o.score ?? 0) >= 80).length;
    const triggers = new Set(filtered.map(o => o.trigger_player_id)).size;
    return { games, opps, highConf, triggers };
  }, [filtered]);

  // Contador de filtros ativos (badge mobile)
  const activeFilterCount =
    (minScore > 0 ? 1 : 0) +
    (threeStars ? 1 : 0) +
    (minEdge > 0 ? 1 : 0) +
    (selectedStats.length > 0 ? 1 : 0) +
    (selectedGames.length > 0 ? 1 : 0);

  const clearAllFilters = () => {
    setMinScore(0);
    setThreeStars(false);
    setMinEdge(0);
    setSelectedStats([]);
    setSelectedGames([]);
  };

  // Display rows: Por Score (flat com collapse) vs Por Gatilho (grupos)
  type DisplayRow =
    | { kind: 'opp'; opp: DailyOpportunity; isFirstOfGroup: boolean }
    | { kind: 'groupHeader'; trigger: DailyOpportunity; count: number };

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (viewMode === 'trigger') {
      // Agrupa por trigger_player_id preservando ordem interna por score
      const map = new Map<number, DailyOpportunity[]>();
      for (const o of filtered) {
        if (!map.has(o.trigger_player_id)) map.set(o.trigger_player_id, []);
        map.get(o.trigger_player_id)!.push(o);
      }
      // Sort groups pelo maior score interno desc
      const sortedGroups = Array.from(map.entries()).sort((a, b) => {
        const ma = Math.max(...a[1].map(o => o.score ?? 0));
        const mb = Math.max(...b[1].map(o => o.score ?? 0));
        return mb - ma;
      });
      const out: DisplayRow[] = [];
      for (const [, opps] of sortedGroups) {
        out.push({ kind: 'groupHeader', trigger: opps[0], count: opps.length });
        opps.forEach(o => out.push({ kind: 'opp', opp: o, isFirstOfGroup: false }));
      }
      return out;
    }
    // Por Score: flat, com collapse de gatilho repetido em linhas adjacentes
    return filtered.map((o, i) => {
      const prev = filtered[i - 1];
      const isFirstOfGroup = !prev || prev.trigger_player_id !== o.trigger_player_id;
      return { kind: 'opp' as const, opp: o, isFirstOfGroup };
    });
  }, [filtered, viewMode]);

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  const handleAnalyze = (opp: DailyOpportunity, rowIdx: number) => {
    const canAccess = isRowFree(rowIdx);
    if (!canAccess) {
      navigate('/paywall-platform');
      return;
    }
    const slug = slugify(opp.backup_player_name);
    const params = new URLSearchParams({ stat: opp.stat_type, trigger: opp.trigger_name });
    navigate(`/nba-dashboard/${slug}?${params.toString()}`);
  };

  if (error) {
    return (
      <div className="theme-rebrand min-h-screen bg-canvas text-ink">
        <NBAHomeNav showBack />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-status-danger mx-auto mb-4" />
            <p className="text-status-danger text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-forest text-white hover:bg-forest-soft transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-rebrand min-h-screen bg-canvas text-ink">
      <Helmet>
        <title>Oportunidades do dia · Smart Betting NBA</title>
        <meta name="description" content="Quem se beneficia quando um titular não joga — ranqueado por score de confiança." />
      </Helmet>
      <NBAHomeNav showBack />

      {/* Page header (bg-white) */}
      <div className="bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-7">
          <h1 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-ink">
            Oportunidades do dia
          </h1>
          <p className="text-[13px] md:text-[14px] mt-1.5 text-ink-2">
            Quem se beneficia quando um titular não joga · ranqueado por score de confiança
          </p>

          {!isLoading && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold tabular bg-canvas-2 text-ink">
                {totals.games} jogos · {totals.opps} oportunidades
              </span>
              <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-emerald-100 text-forest">
                ★ {totals.highConf} alta confiança
              </span>
              <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-amber-100 text-amber-700">
                {totals.triggers} gatilhos ativos
              </span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        {/* Filter row — mobile (drawer) */}
        <div className="md:hidden flex items-center gap-2">
          <Drawer>
            <DrawerTrigger asChild>
              <button
                type="button"
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-forest text-white text-[12px] font-semibold shadow-sm hover:bg-forest-soft transition-colors"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-1.5 h-4 inline-flex items-center justify-center rounded text-[9px] font-bold tabular bg-amber-300 text-forest">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-white">
              <div className="max-h-[80vh] overflow-y-auto px-4 pb-6 pt-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">Filtros</h2>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[12px] font-semibold text-ink-2 hover:text-ink"
                    >
                      Limpar tudo
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-6">
                  <RangeField
                    label="Score mínimo"
                    min={0} max={95} step={5}
                    presets={SCORE_PRESETS} suffix="+"
                    value={minScore} onChange={setMinScore}
                  />
                  <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-2">Confiança</span>
                      <span className="text-[13px] text-ink mt-0.5">Só ★ 3 estrelas</span>
                    </div>
                    <Checkbox checked={threeStars} onCheckedChange={(v) => setThreeStars(v === true)} />
                  </label>
                  <RangeField
                    label="Vantagem mínima"
                    helpText="Diferença % entre média sem o gatilho e a linha da casa."
                    min={0} max={100} step={5}
                    presets={EDGE_PRESETS} suffix="%+"
                    value={minEdge} onChange={setMinEdge}
                  />
                  <StatField
                    options={availableStats}
                    selected={selectedStats}
                    onChange={setSelectedStats}
                  />
                  <GameField
                    options={availableGames}
                    selected={selectedGames}
                    onChange={setSelectedGames}
                  />
                </div>
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="mt-6 w-full h-10 rounded-md bg-forest text-white text-[13px] font-semibold"
                  >
                    Ver {filtered.length} {filtered.length === 1 ? 'oportunidade' : 'oportunidades'}
                  </button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
          <div className="ml-auto inline-flex p-0.5 rounded-md bg-canvas-2 border border-line">
            <button
              type="button"
              onClick={() => setViewMode('score')}
              className={`h-7 px-3 text-[11px] font-semibold rounded inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'score'
                  ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'bg-transparent text-ink-2 hover:text-ink'
              }`}
            >
              <List className="w-3 h-3" />
              <span>Por Score</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('trigger')}
              className={`h-7 px-3 text-[11px] font-semibold rounded inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'trigger'
                  ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'bg-transparent text-ink-2 hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Por Gatilho</span>
            </button>
          </div>
        </div>

        {/* Filter row — desktop (chips inline) */}
        <div className="hidden md:flex rounded-xl bg-white border border-line p-3 items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-ink-2/60 ml-1 shrink-0" />
          <ScorePopover value={minScore} onChange={setMinScore} />
          <FilterChip active={threeStars} removable onClick={() => setThreeStars(v => !v)}>
            ★ 3 estrelas
          </FilterChip>
          <EdgePopover value={minEdge} onChange={setMinEdge} />
          <StatPopover
            options={availableStats}
            selected={selectedStats}
            onChange={setSelectedStats}
          />
          <GamePopover
            options={availableGames}
            selected={selectedGames}
            onChange={setSelectedGames}
          />
          <div className="flex-1" />
          {/* View toggle */}
          <div className="inline-flex p-0.5 rounded-md bg-canvas-2 border border-line">
            <button
              type="button"
              onClick={() => setViewMode('score')}
              className={`h-7 px-3 text-[11px] font-semibold rounded inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'score'
                  ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'bg-transparent text-ink-2 hover:text-ink'
              }`}
            >
              <List className="w-3 h-3" />
              <span>Por Score</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('trigger')}
              className={`h-7 px-3 text-[11px] font-semibold rounded inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'trigger'
                  ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'bg-transparent text-ink-2 hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Por Gatilho</span>
            </button>
          </div>
        </div>

        {/* Color hint banner — só na view Por Score */}
        {viewMode === 'score' && !isLoading && filtered.length > 0 && (
          <div className="text-[11px] flex items-center gap-2 text-ink-2">
            <Info className="w-3.5 h-3.5 text-ink-2/60 shrink-0" />
            <span>
              Cada gatilho tem uma cor própria. A faixa lateral colorida agrupa visualmente as oportunidades da mesma cadeia, mesmo quando elas aparecem misturadas pelo score.
            </span>
          </div>
        )}

        {/* Premium banner pra free user */}
        {!isPremium && !isLoading && filtered.length > FREE_VISIBLE_COUNT && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[12px] text-amber-700">
              Você vê as primeiras {FREE_VISIBLE_COUNT} oportunidades.
              Dados de score, médias e gaps das demais são exclusivos para assinantes Premium.
            </p>
            <button
              onClick={() => navigate('/paywall-platform')}
              className="text-[12px] font-semibold text-amber-700 hover:text-amber-900 shrink-0 inline-flex items-center gap-1"
            >
              Assinar
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        {isLoading ? (
          <div className="rounded-xl bg-white border border-line p-4 flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white border border-line p-12 text-center">
            <p className="text-[13px] text-ink-2">
              Nenhuma oportunidade encontrada com os filtros atuais.
            </p>
          </div>
        ) : (
          <>
            {/* ── Desktop table ── */}
            <div className="hidden lg:block rounded-xl bg-white border border-line overflow-hidden">
              {/* Headers */}
              <div className="grid grid-cols-[4px_64px_140px_180px_1fr_110px_180px_140px_92px] gap-3 items-center pr-4 py-2.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-2/70 bg-canvas-2 border-b border-line">
                <div />
                <div className="ml-0.5">Score ↓</div>
                <div>Jogo</div>
                <div>Gatilho</div>
                <div>Jogador</div>
                <div>Estatística</div>
                <div>Com → Sem</div>
                <div>vs Linha</div>
                <div />
              </div>

              {/* Rows */}
              {(() => {
                let oppRowCounter = 0; // index global pra paywall
                return displayRows.map((row, i) => {
                  if (row.kind === 'groupHeader') {
                    return <GroupHeader key={`g-${row.trigger.trigger_player_id}`} trigger={row.trigger} count={row.count} />;
                  }
                  const idx = oppRowCounter++;
                  return (
                    <OppRow
                      key={`o-${row.opp.trigger_player_id}-${row.opp.backup_player_id}-${row.opp.stat_type}-${i}`}
                      opp={row.opp}
                      collapsedTrigger={!row.isFirstOfGroup}
                      blur={getBlur(idx)}
                      free={isRowFree(idx)}
                      onAnalyze={() => handleAnalyze(row.opp, idx)}
                    />
                  );
                });
              })()}
            </div>

            {/* ── Mobile cards (simplified — refino fica pra Onda E) ── */}
            <div className="lg:hidden flex flex-col gap-2.5">
              {(() => {
                let oppRowCounter = 0;
                return displayRows.map((row, i) => {
                  if (row.kind === 'groupHeader') {
                    return (
                      <MobileGroupHeader
                        key={`mg-${row.trigger.trigger_player_id}`}
                        trigger={row.trigger}
                        count={row.count}
                      />
                    );
                  }
                  const idx = oppRowCounter++;
                  return (
                    <MobileOppCard
                      key={`mo-${row.opp.trigger_player_id}-${row.opp.backup_player_id}-${row.opp.stat_type}-${i}`}
                      opp={row.opp}
                      hideTrigger={viewMode === 'trigger' || !row.isFirstOfGroup}
                      blur={getBlur(idx)}
                      free={isRowFree(idx)}
                      onAnalyze={() => handleAnalyze(row.opp, idx)}
                    />
                  );
                });
              })()}
            </div>
          </>
        )}

        <div className="text-center text-[11px] py-2 text-ink-2/70">
          Metodologia: análise 360° com vs sem · Score automático (gap + amostra + freshness + matchup)
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Row components (desktop)
// ──────────────────────────────────────────────────────────────────────────────

interface OppRowProps {
  opp: DailyOpportunity;
  collapsedTrigger: boolean;
  blur: string;
  free: boolean;
  onAnalyze: () => void;
}

function OppRow({ opp, collapsedTrigger, blur, free, onAnalyze }: OppRowProps) {
  const color = getTriggerColor(opp.trigger_player_id);
  const scoreMeta = scoreBadgeCls(opp.score);
  const statusFull = statusFullPT(opp.trigger_status);
  const triggerLast = lastName(opp.trigger_name);
  const statLabel = STAT_LABELS[opp.stat_type] ?? opp.stat_type;

  return (
    <div className="grid grid-cols-[4px_64px_140px_180px_1fr_110px_180px_140px_92px] gap-3 items-center pr-4 py-3.5 border-t border-line hover:bg-canvas-2/50 transition-colors">
      {/* Color spine */}
      <div className="self-stretch" style={{ background: color, minHeight: 44 }} />

      {/* Score */}
      <div className={blur}>
        <div className={`inline-flex items-center justify-center rounded-md font-semibold tabular tracking-tight ${scoreMeta.cls}`}
          style={{ width: 44, height: 36, fontSize: 16 }}>
          {opp.score ?? '—'}
        </div>
      </div>

      {/* Jogo */}
      <div>
        <div className="text-[12px] font-semibold tracking-tight text-ink">
          {opp.visitor_team_abbr} <span className="font-normal text-ink-2">vs</span> {opp.home_team_abbr}
        </div>
        {opp.game_time && (
          <div className="text-[10px] tabular text-ink-2/70 mt-0.5">{opp.game_time}</div>
        )}
      </div>

      {/* Gatilho */}
      {collapsedTrigger ? (
        <div className="flex items-center gap-2 text-ink-2/70">
          <span className="text-[11px]">↳</span>
          <span className="text-[11px] truncate italic">mesmo gatilho</span>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-tight truncate text-ink">
            {triggerLast}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1.5 truncate">
            <span className={`font-semibold ${statusFull.cls}`}>{statusFull.label}</span>
            {opp.trigger_days_out != null && (
              <span className="tabular text-ink-2/70">· {opp.trigger_days_out}d fora</span>
            )}
          </div>
        </div>
      )}

      {/* Jogador */}
      <div className="flex items-center gap-2 min-w-0">
        <PlayerPhoto name={opp.backup_player_name} teamAbbr={opp.trigger_team_abbr} size={32} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold tracking-tight truncate text-ink">{opp.backup_player_name}</span>
            <StarRow n={opp.rating_stars ?? 0} />
          </div>
        </div>
      </div>

      {/* Stat */}
      <div className={`text-[12px] font-semibold tracking-tight text-ink ${blur}`}>{statLabel}</div>

      {/* Com → Sem (gap) */}
      <div className={`tabular text-[12px] flex items-center gap-1.5 text-ink-2 ${blur}`}>
        <span title={`com ${triggerLast}`}>{opp.avg_com?.toFixed(1) ?? '—'}</span>
        <ArrowRight className="w-3.5 h-3.5 text-ink-2/70 shrink-0" aria-hidden="true" />
        <span className="font-semibold text-[14px] text-ink" title={`sem ${triggerLast}`}>
          {opp.avg_sem?.toFixed(1) ?? '—'}
        </span>
        <span className="px-1.5 h-5 inline-flex items-center rounded text-[11px] font-semibold tabular bg-emerald-100 text-forest">
          +{opp.gap_pct?.toFixed(1) ?? '—'}%
        </span>
      </div>

      {/* vs Linha */}
      <div className={`tabular text-[12px] ${blur}`}>
        {opp.gap_vs_line_pct == null || opp.line_value == null ? (
          <span className="text-ink-3">—</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-ink-2/70">{opp.line_value.toFixed(1)}</span>
              <span className={`font-semibold text-[14px] ${opp.gap_vs_line_pct > 0 ? 'text-forest' : 'text-status-danger'}`}>
                {opp.gap_vs_line_pct > 0 ? '+' : ''}{opp.gap_vs_line_pct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-canvas-2">
              <div
                className="h-full bg-forest"
                style={{ width: `${Math.min(Math.abs(opp.gap_vs_line_pct) * 2, 100)}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* CTA */}
      <div className="text-right">
        <button
          type="button"
          onClick={onAnalyze}
          className="h-7 px-2.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 bg-white border border-line text-ink hover:border-forest/30 hover:bg-canvas-2 transition-colors"
        >
          <span>{free ? 'Analisar' : 'Premium'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function GroupHeader({ trigger, count }: { trigger: DailyOpportunity; count: number }) {
  const color = getTriggerColor(trigger.trigger_player_id);
  const statusMeta = statusBadgeMeta(trigger.trigger_status);
  return (
    <div className="grid grid-cols-[4px_1fr] gap-3 items-stretch border-t border-line bg-canvas-2">
      <div style={{ background: color }} />
      <div className="py-3.5 pr-4 flex items-center gap-3">
        <div className="rounded-full p-0.5 shrink-0" style={{ background: color }}>
          <PlayerPhoto name={trigger.trigger_name} teamAbbr={trigger.trigger_team_abbr} size={36} />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`px-1.5 h-4 inline-flex items-center rounded text-[9px] font-bold tabular ${statusMeta.cls}`}>
            {statusMeta.text}
          </span>
          <span className="text-[14px] font-semibold tracking-tight text-ink truncate">{trigger.trigger_name}</span>
          {trigger.trigger_days_out != null && (
            <span className="text-[11px] tabular text-ink-2/70">· {trigger.trigger_days_out}d</span>
          )}
        </div>
        <span className="text-[11px] ml-auto text-ink-2 shrink-0">
          {count} {count === 1 ? 'oportunidade destravada' : 'oportunidades destravadas'}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Mobile components (simplified — refino completo na Onda E)
// ──────────────────────────────────────────────────────────────────────────────

interface MobileOppCardProps {
  opp: DailyOpportunity;
  hideTrigger: boolean;
  blur: string;
  free: boolean;
  onAnalyze: () => void;
}

function MobileOppCard({ opp, hideTrigger, blur, free, onAnalyze }: MobileOppCardProps) {
  const color = getTriggerColor(opp.trigger_player_id);
  const scoreMeta = scoreBadgeCls(opp.score);
  const statusFull = statusFullPT(opp.trigger_status);
  const triggerLast = lastName(opp.trigger_name);
  const statLabel = STAT_LABELS[opp.stat_type] ?? opp.stat_type;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAnalyze}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAnalyze();
        }
      }}
      className="text-left rounded-xl overflow-hidden bg-white border border-line hover:border-forest/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
    >
      {/* Top stripe (trigger color) */}
      <div className="h-1" style={{ background: color }} />

      {/* Trigger header */}
      {hideTrigger ? (
        <div className="px-3 py-1.5 flex items-center gap-2 bg-canvas-2 border-b border-line text-ink-2/70">
          <span className="text-[11px]">↳</span>
          <span className="text-[11px] italic">mesmo gatilho · {triggerLast}</span>
        </div>
      ) : (
        <div className="px-3 py-2 bg-canvas-2 border-b border-line flex items-center gap-1.5 truncate">
          <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-2/70 shrink-0">Gatilho</span>
          <span className="text-[13px] font-semibold tracking-tight text-ink truncate">{triggerLast}</span>
          <span className={`text-[11px] font-semibold shrink-0 ${statusFull.cls}`}>{statusFull.label}</span>
          {opp.trigger_days_out != null && (
            <span className="text-[10px] tabular text-ink-2/70 shrink-0">· {opp.trigger_days_out}d</span>
          )}
        </div>
      )}

      {/* Player + score */}
      <div className="px-3 py-3 flex items-center gap-3">
        <PlayerPhoto name={opp.backup_player_name} teamAbbr={opp.trigger_team_abbr} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold tracking-tight truncate text-ink">{opp.backup_player_name}</span>
            <StarRow n={opp.rating_stars ?? 0} />
          </div>
          <div className="text-[10px] text-ink-2/70 mt-0.5">
            {opp.visitor_team_abbr} vs {opp.home_team_abbr}
            {opp.game_time && <span> · {opp.game_time}</span>}
          </div>
        </div>
        <div className={blur}>
          <div className={`inline-flex items-center justify-center rounded-md font-semibold tabular tracking-tight ${scoreMeta.cls}`}
            style={{ width: 38, height: 32, fontSize: 14 }}>
            {opp.score ?? '—'}
          </div>
        </div>
      </div>

      {/* Stat + numbers */}
      <div className={`px-3 pb-3 flex items-center gap-2 flex-wrap ${blur}`}>
        <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-canvas-2 text-ink">
          {statLabel}
        </span>
        <span className="text-[11px] tabular flex items-center gap-1.5 text-ink-2">
          <span>{opp.avg_com?.toFixed(1) ?? '—'}</span>
          <ArrowRight className="w-3.5 h-3.5 text-ink-2/70 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-[13px] text-ink">{opp.avg_sem?.toFixed(1) ?? '—'}</span>
        </span>
        <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold tabular bg-emerald-100 text-forest">
          +{opp.gap_pct?.toFixed(0) ?? '—'}%
        </span>
      </div>

      {/* vs Linha (se houver) */}
      {opp.line_value != null && opp.gap_vs_line_pct != null && (
        <div className={`px-3 pb-3 pt-1 border-t border-line ${blur}`}>
          <div className="flex items-baseline justify-between text-[11px] mt-2">
            <span className="text-ink-2/70">Linha {opp.line_value.toFixed(1)}</span>
            <span className={`font-semibold tabular ${opp.gap_vs_line_pct > 0 ? 'text-forest' : 'text-status-danger'}`}>
              {opp.gap_vs_line_pct > 0 ? '+' : ''}{opp.gap_vs_line_pct.toFixed(1)}% vs linha
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden bg-canvas-2">
            <div
              className="h-full bg-forest"
              style={{ width: `${Math.min(Math.abs(opp.gap_vs_line_pct) * 2, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Rodapé CTA — varia entre análise completa (free) e paywall (não-free) */}
      {free ? (
        <div className="px-3 py-2.5 border-t border-line flex items-center justify-end">
          <span className="text-[12px] font-semibold text-forest inline-flex items-center gap-1">
            Ver análise completa
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      ) : (
        <div className="px-3 py-2.5 border-t border-line bg-amber-50 flex items-center justify-end">
          <span className="text-[12px] font-semibold text-amber-700 inline-flex items-center gap-1">
            Desbloquear com Premium
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      )}
    </div>
  );
}

function MobileGroupHeader({ trigger, count }: { trigger: DailyOpportunity; count: number }) {
  const color = getTriggerColor(trigger.trigger_player_id);
  const statusMeta = statusBadgeMeta(trigger.trigger_status);
  return (
    <div className="rounded-lg overflow-hidden bg-canvas-2 border border-line">
      <div className="h-1" style={{ background: color }} />
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className="rounded-full p-0.5 shrink-0" style={{ background: color }}>
          <PlayerPhoto name={trigger.trigger_name} teamAbbr={trigger.trigger_team_abbr} size={32} />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`px-1.5 h-4 inline-flex items-center rounded text-[9px] font-bold tabular shrink-0 ${statusMeta.cls}`}>
            {statusMeta.text}
          </span>
          <span className="text-[13px] font-semibold tracking-tight truncate text-ink">{trigger.trigger_name}</span>
          {trigger.trigger_days_out != null && (
            <span className="text-[11px] tabular text-ink-2/70 shrink-0">· {trigger.trigger_days_out}d</span>
          )}
        </div>
        <span className="ml-auto text-[10px] text-ink-2 shrink-0">
          {count} {count === 1 ? 'opp.' : 'opps.'}
        </span>
      </div>
    </div>
  );
}
