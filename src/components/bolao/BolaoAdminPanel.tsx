import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  UserX,
  Lock,
  Unlock,
  AlertTriangle,
  ImagePlus,
  X,
  Users,
  Clock,
  Check,
  Sparkles,
  Target,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useRemoveMember,
  useToggleBolaoClose,
  useUpdateBolaoScoring,
  useUpdateBolaoTheme,
  useUploadBolaoLogo,
  useUpdateBolaoSettings,
  useUpdateBolaoDeadlineMode,
  useBolaoStats,
  useDeleteBolao,
} from '@/hooks/use-bolao';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import type { BolaoRankingEntry } from '@/services/bolao.service';

interface BolaoAdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bolaoId: string;
  bolaoName?: string;
  isClosed: boolean;
  isPremium: boolean;
  scoringPreset: string | null;
  scoringResult: number;
  scoringExact: number;
  scoringWeights: Record<string, number> | null;
  customBannerUrl: string | null;
  championEnabled: boolean;
  specialPredictionsEnabled: boolean;
  specialPredictionsConfig: Record<string, boolean>;
  specialPredictionsPoints: Record<string, number>;
  championPoints: number;
  ranking: BolaoRankingEntry[];
  currentUserId: string | undefined;
  ownerUserId: string;
  predictionDeadlineMode: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start';
}

type SectionId = 'geral' | 'pontuacao' | 'prazo' | 'modalidades' | 'membros';

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'geral',       label: 'Geral',             icon: Settings },
  { id: 'pontuacao',   label: 'Pontuação',         icon: Target },
  { id: 'prazo',       label: 'Prazo de palpites', icon: Clock },
  { id: 'modalidades', label: 'Modalidades',       icon: Sparkles },
  { id: 'membros',     label: 'Membros',           icon: Users },
];

const DEADLINE_MODE_LABELS: Record<string, { label: string; description: string }> = {
  per_match: { label: 'Por jogo',   description: 'Até o apito inicial de cada partida' },
  per_day:   { label: 'Por dia',    description: 'Até o início do primeiro jogo do dia' },
  per_round: { label: 'Por rodada', description: 'Fase de grupos: R1/R2/R3 separadas. Mata-mata: cada eliminatória.' },
  per_stage: { label: 'Por fase',   description: 'Fase de grupos inteira fecha junto. Mata-mata: cada eliminatória.' },
};

const SCORING_PRESETS = [
  { value: 'standard',        label: 'Casual',     description: 'Simples, todos os jogos valem o mesmo', result: 1, exact: 3, weighted: false },
  { value: 'classic',         label: 'Clássico',   description: 'Placar exato vale mais',                result: 1, exact: 5, weighted: false },
  { value: 'weighted_stages', label: 'Campeonato', description: 'Mata-mata vale mais que grupos',        result: 1, exact: 3, weighted: true },
] as const;

const STAGE_LABELS: { key: string; label: string; defaultWeight: number }[] = [
  { key: 'group',       label: 'Grupos',    defaultWeight: 1.0 },
  { key: 'round_of_32', label: 'R32',       defaultWeight: 1.5 },
  { key: 'round_of_16', label: 'R16',       defaultWeight: 1.5 },
  { key: 'quarter',     label: 'Quartas',   defaultWeight: 2.0 },
  { key: 'semi',        label: 'Semis',     defaultWeight: 3.0 },
  { key: 'third_place', label: '3º lugar',  defaultWeight: 2.0 },
  { key: 'final',       label: 'Final',     defaultWeight: 5.0 },
];

const DEFAULT_WEIGHTS: Record<string, number> = STAGE_LABELS.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.defaultWeight }),
  {}
);

const SPECIAL_TYPES: Record<string, string> = {
  finalist: 'Finalistas',
  semifinalist: 'Semifinalistas',
  quarterfinalist: 'Quartas de Final',
  round_of_32: 'Mata-mata (32)',
};

// ── NumberStepper (light theme) ───────────────────────────────────
interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const NumberStepper: React.FC<NumberStepperProps> = ({
  value, onChange, min, max, step = 1, suffix, ariaLabel, className, disabled, size = 'md',
}) => {
  const bump = (delta: number) => {
    const next = value + delta;
    const snapped = step < 1 ? Math.round(next / step) * step : Math.round(next);
    onChange(Math.min(max, Math.max(min, snapped)));
  };
  const handleInput = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    onChange(Math.min(max, Math.max(min, parsed)));
  };
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;
  const containerH = size === 'sm' ? 'h-9' : 'h-11';
  const btnW = size === 'sm' ? 'w-9' : 'w-11';
  const btnText = size === 'sm' ? 'text-base' : 'text-lg';
  const inputText = size === 'sm' ? 'text-xs' : 'text-sm';
  return (
    <div className={`flex items-stretch ${containerH} rounded-rebrand-md border border-line bg-white overflow-hidden ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => bump(-step)}
        disabled={!canDec}
        aria-label={ariaLabel ? `Diminuir ${ariaLabel}` : 'Diminuir'}
        className={`${btnW} flex items-center justify-center text-ink-2 hover:bg-canvas-2 hover:text-ink active:bg-canvas-2 font-bold ${btnText} leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        −
      </button>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`flex-1 min-w-[44px] text-center font-bold tabular-nums bg-white text-ink ${inputText} focus:bg-canvas-2 focus:outline-none focus:ring-1 focus:ring-forest/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed`}
      />
      {suffix && (
        <span className="flex items-center px-2.5 border-l border-line text-[11px] text-ink-3 bg-canvas-2 font-medium">
          {suffix}
        </span>
      )}
      <button
        type="button"
        onClick={() => bump(step)}
        disabled={!canInc}
        aria-label={ariaLabel ? `Aumentar ${ariaLabel}` : 'Aumentar'}
        className={`${btnW} flex items-center justify-center text-ink-2 hover:bg-canvas-2 hover:text-ink active:bg-canvas-2 font-bold ${btnText} leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        +
      </button>
    </div>
  );
};

// ── Toggle component (light) ──────────────────────────────────────
const Toggle: React.FC<{
  on: boolean;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
}> = ({ on, onClick, ariaLabel, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={on}
    disabled={disabled}
    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-forest' : 'bg-canvas-2 border border-line'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <span
      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
    />
  </button>
);

// ── Card wrapper ─────────────────────────────────────────────────
const Card: React.FC<{
  title: string;
  sub?: string;
  /** Acao no canto direito do header (ex: Toggle de habilitado/desabilitado). */
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, sub, action, children }) => (
  <section className="rounded-rebrand-lg border border-line bg-white">
    <header className="px-5 pt-4 pb-3 border-b border-line flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[14px] font-bold tracking-tight text-ink leading-tight">{title}</p>
        {sub && <p className="text-[11px] text-ink-2 mt-0.5">{sub}</p>}
      </div>
      {action && <div className="shrink-0 mt-0.5">{action}</div>}
    </header>
    <div className="px-5">{children}</div>
  </section>
);

// ── SettingsRow ──────────────────────────────────────────────────
const SettingsRow: React.FC<{ title: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="flex items-center justify-between gap-6 py-4 border-b border-line last:border-0">
    <div className="min-w-0">
      <p className="text-[13px] font-semibold tracking-tight text-ink leading-tight">{title}</p>
      {sub && <p className="text-[11px] text-ink-2 mt-0.5 leading-snug">{sub}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const BolaoAdminPanel: React.FC<BolaoAdminPanelProps> = ({
  open,
  onOpenChange,
  bolaoId,
  bolaoName,
  isClosed,
  isPremium,
  scoringPreset,
  scoringResult,
  scoringExact,
  scoringWeights,
  customBannerUrl,
  championEnabled,
  specialPredictionsEnabled,
  specialPredictionsConfig,
  specialPredictionsPoints,
  championPoints,
  ranking,
  currentUserId,
  ownerUserId,
  predictionDeadlineMode,
}) => {
  const [activeSection, setActiveSection] = useState<SectionId>('geral');
  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Reseta scroll do content area quando troca de seção, pra cabeçalho da nova
  // seção sempre aparecer no topo (sem herdar offset da seção anterior).
  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeSection]);
  const navigate = useNavigate();
  const pendingRemovalsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingRemovedIds, setPendingRemovedIds] = useState<Set<string>>(new Set());
  const [pendingDeadlineMode, setPendingDeadlineMode] = useState<
    'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start' | null
  >(null);

  // Delete bolão (zona de perigo) — exige digitar o nome pra confirmar
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Edição inline do nome do bolão
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(bolaoName ?? '');

  // Scoring state — toggles permitem desativar uma categoria. Quando OFF,
  // salva 0 no banco; o valor "ultimo ligado" fica em customResult/customExact
  // pra ser restaurado quando user religar (UX: nao precisa redigitar).
  const [resultadoEnabled, setResultadoEnabled] = useState(scoringResult > 0);
  const [exatoEnabled, setExatoEnabled] = useState(scoringExact > 0);
  const [customResult, setCustomResult] = useState(scoringResult > 0 ? scoringResult : 1);
  const [customExact, setCustomExact] = useState(scoringExact > 0 ? scoringExact : 3);
  const [useWeighted, setUseWeighted] = useState(scoringPreset === 'weighted_stages');
  const [customWeights, setCustomWeights] = useState<Record<string, number>>(
    { ...DEFAULT_WEIGHTS, ...(scoringWeights ?? {}) }
  );

  // Modalidades state
  const [champEnabled, setChampEnabled] = useState(championEnabled);
  const [specialConfig, setSpecialConfig] = useState<Record<string, boolean>>(specialPredictionsConfig);
  const [specialPoints, setSpecialPoints] = useState<Record<string, number>>(specialPredictionsPoints);
  const [champPoints, setChampPoints] = useState(championPoints);

  const { toast } = useToast();
  const removeMember = useRemoveMember();
  const toggleClose = useToggleBolaoClose();
  const updateScoring = useUpdateBolaoScoring();
  const updateTheme = useUpdateBolaoTheme();
  const uploadLogo = useUploadBolaoLogo();
  const updateSettings = useUpdateBolaoSettings();
  const updateDeadlineMode = useUpdateBolaoDeadlineMode();
  const deleteBolao = useDeleteBolao();
  const { data: bolaoStats } = useBolaoStats(bolaoId, open && currentUserId === ownerUserId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modo read-only pra membros (nao-dono): mostra config mas tudo disabled,
  // com banner explicando que so o dono pode alterar. Antes desse refactor
  // nao-dono nao via nada (return null) — pessoa não conseguia nem checar
  // qual era a pontuacao do bolao.
  const isOwner = currentUserId === ownerUserId;

  // ─────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────

  const handleRemove = (userId: string, userName: string) => {
    if (pendingRemovalsRef.current.has(userId)) return;

    setPendingRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });

    const undo = () => {
      const timer = pendingRemovalsRef.current.get(userId);
      if (timer) clearTimeout(timer);
      pendingRemovalsRef.current.delete(userId);
      setPendingRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    const timer = setTimeout(() => {
      pendingRemovalsRef.current.delete(userId);
      removeMember.mutate(
        { bolaoId, userId },
        {
          onError: (err: any) => {
            setPendingRemovedIds((prev) => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
            toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
          },
        }
      );
    }, 5000);

    pendingRemovalsRef.current.set(userId, timer);

    toast({
      title: `${userName} removido`,
      description: 'Você pode desfazer em 5s',
      action: (
        <ToastAction altText="Desfazer remoção" onClick={undo}>
          Desfazer
        </ToastAction>
      ),
    });
  };

  const handleToggleClose = () => {
    toggleClose.mutate(bolaoId, {
      onSuccess: (result) => {
        toast({ title: result.is_closed ? 'Inscrições encerradas' : 'Inscrições reabertas' });
      },
      onError: (err: any) => {
        toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      },
    });
  };

  const handleApplyPreset = (preset: typeof SCORING_PRESETS[number]) => {
    setCustomResult(preset.result);
    setCustomExact(preset.exact);
    setResultadoEnabled(preset.result > 0);
    setExatoEnabled(preset.exact > 0);
    setUseWeighted(preset.weighted);
    if (preset.weighted) setCustomWeights({ ...DEFAULT_WEIGHTS });
  };

  const isPresetActive = (preset: typeof SCORING_PRESETS[number]) => {
    const effectiveResult = resultadoEnabled ? customResult : 0;
    const effectiveExact = exatoEnabled ? customExact : 0;
    return effectiveResult === preset.result &&
      effectiveExact === preset.exact &&
      useWeighted === preset.weighted &&
      (!preset.weighted || STAGE_LABELS.every((s) => customWeights[s.key] === s.defaultWeight));
  };

  const applyDeadlineModeChange = (mode: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start') => {
    updateDeadlineMode.mutate(
      { bolaoId, mode },
      {
        onSuccess: () => toast({ title: `Prazo atualizado: ${DEADLINE_MODE_LABELS[mode]?.label}` }),
        onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleDeadlineModeChange = (mode: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start') => {
    if (mode === predictionDeadlineMode) return;
    const hasPredictions = bolaoStats != null && bolaoStats.total_predictions > 0;
    if (hasPredictions) {
      setPendingDeadlineMode(mode);
      return;
    }
    applyDeadlineModeChange(mode);
  };

  const handleSaveScoring = () => {
    const preset = useWeighted ? 'weighted_stages' : 'custom';
    // Toggle off => salva 0; toggle on => valor do stepper
    const effectiveResult = resultadoEnabled ? customResult : 0;
    const effectiveExact = exatoEnabled ? customExact : 0;
    updateScoring.mutate(
      { bolaoId, preset, scoringResult: effectiveResult, scoringExact: effectiveExact, scoringWeights: useWeighted ? customWeights : null },
      {
        onSuccess: (res) => toast({ title: `Pontuação atualizada: ${res.scoring_result}pt / ${res.scoring_exact}pts` }),
        onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleToggleChampion = () => {
    const newVal = !champEnabled;
    setChampEnabled(newVal);
    updateSettings.mutate(
      { bolaoId, settings: { champion_enabled: newVal } },
      {
        onSuccess: () => toast({ title: newVal ? 'Palpite de campeão habilitado' : 'Palpite de campeão desabilitado' }),
        onError: (err: any) => {
          setChampEnabled(!newVal);
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleToggleSpecialType = (type: string) => {
    const newConfig = { ...specialConfig, [type]: !specialConfig[type] };
    const prevConfig = { ...specialConfig };
    setSpecialConfig(newConfig);
    const anyEnabled = Object.values(newConfig).some(Boolean);
    updateSettings.mutate(
      { bolaoId, settings: { special_predictions_config: newConfig, special_predictions_enabled: anyEnabled } },
      {
        onSuccess: () => toast({ title: newConfig[type] ? `${SPECIAL_TYPES[type]} habilitado` : `${SPECIAL_TYPES[type]} desabilitado` }),
        onError: (err: any) => {
          setSpecialConfig(prevConfig);
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleSaveChampionPoints = () => {
    updateSettings.mutate(
      { bolaoId, settings: { champion_points: champPoints } },
      {
        onSuccess: () => toast({ title: `Pontos do campeão: ${champPoints}pts` }),
        onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleSaveSpecialPoints = () => {
    updateSettings.mutate(
      { bolaoId, settings: { special_predictions_points: specialPoints } },
      {
        onSuccess: () => toast({ title: 'Pontuação dos palpites especiais atualizada' }),
        onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleSaveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast({ title: 'Nome não pode ficar vazio', variant: 'destructive' });
      return;
    }
    if (trimmed === bolaoName) {
      setEditingName(false);
      return;
    }
    updateSettings.mutate(
      { bolaoId, settings: { name: trimmed } },
      {
        onSuccess: () => {
          toast({ title: 'Nome do bolão atualizado' });
          setEditingName(false);
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao atualizar nome', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 2MB', variant: 'destructive' });
      return;
    }
    uploadLogo.mutate(
      { bolaoId, file },
      {
        onSuccess: (logoUrl) => {
          updateTheme.mutate(
            { bolaoId, logoUrl },
            {
              onSuccess: () => toast({ title: 'Logo atualizado!' }),
              onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
            }
          );
        },
        onError: (err: any) => toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' }),
      }
    );
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    updateTheme.mutate(
      { bolaoId, logoUrl: '' },
      {
        onSuccess: () => toast({ title: 'Logo removido' }),
        onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const closeDeleteDialog = () => {
    setDeleteOpen(false);
    setDeleteConfirmText('');
  };

  const handleDeleteBolao = () => {
    deleteBolao.mutate(bolaoId, {
      onSuccess: () => {
        toast({ title: 'Bolão excluído' });
        closeDeleteDialog();
        onOpenChange(false);
        navigate('/bolao');
      },
      onError: (err: any) => {
        toast({
          title: 'Erro ao excluir',
          description: err?.message ?? 'Tente novamente',
          variant: 'destructive',
        });
      },
    });
  };

  const deleteConfirmMatches =
    !!bolaoName && deleteConfirmText.trim().toLowerCase() === bolaoName.trim().toLowerCase();

  // ─────────────────────────────────────────────────────────────────
  // Sections
  // ─────────────────────────────────────────────────────────────────

  const renderGeral = () => (
    <>
      <SectionHeader title="Geral" subtitle="Identificação e status do bolão." />

      <Card title="Identificação" sub="Nome e logo aparecem pra todos os participantes">
        <div className="py-4 border-b border-line">
          <p className="text-[13px] font-semibold text-ink leading-tight mb-1">Nome do bolão</p>
          {editingName ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setNameDraft(bolaoName ?? '');
                    setEditingName(false);
                  }
                }}
                maxLength={60}
                aria-label="Nome do bolão"
                autoFocus
                className="flex-1 h-10 px-3 rounded-rebrand-md border border-line bg-white text-[13px] text-ink focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={updateSettings.isPending}
                className="h-10 px-3 rounded-rebrand-md bg-forest text-white text-[12px] font-semibold hover:bg-forest-2 disabled:opacity-50 transition-colors"
              >
                {updateSettings.isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(bolaoName ?? '');
                  setEditingName(false);
                }}
                disabled={updateSettings.isPending}
                aria-label="Cancelar edição"
                className="h-10 w-10 inline-flex items-center justify-center rounded-rebrand-md text-ink-2 hover:bg-canvas-2 hover:text-ink disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 mt-1">
              <p className="text-[14px] text-ink truncate">{bolaoName || '—'}</p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(bolaoName ?? '');
                    setEditingName(true);
                  }}
                  className="h-9 px-3 rounded-rebrand-md text-[12px] font-semibold text-ink-2 border border-line hover:border-line-2 hover:bg-canvas-2 hover:text-ink inline-flex items-center gap-1.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
            </div>
          )}
        </div>

        <div className="py-4">
          <p className="text-[13px] font-semibold text-ink leading-tight mb-1">Logo do bolão</p>
          {isOwner && (
            <p className="text-[11px] text-ink-2 mb-3">JPG ou PNG, máximo 2MB. Aparece no header e nos cards.</p>
          )}
          {customBannerUrl ? (
            <div className="flex items-center gap-3">
              <img src={customBannerUrl} alt="Logo" className="w-14 h-14 rounded-rebrand-sm border border-line bg-canvas-2 object-contain" />
              <p className="flex-1 min-w-0 text-[11px] text-ink-2 truncate">{customBannerUrl.split('/').pop()}</p>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={updateTheme.isPending}
                  className="h-9 px-3 rounded-rebrand-md border border-line text-[12px] text-ink-2 hover:border-status-danger/40 hover:text-status-danger hover:bg-status-danger/[0.06] transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> Remover
                </button>
              )}
            </div>
          ) : isOwner ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLogo.isPending || updateTheme.isPending}
              className="w-full h-12 px-3 rounded-rebrand-md border border-dashed border-line text-[13px] text-ink-2 hover:border-forest/40 hover:bg-canvas-2 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ImagePlus className="w-4 h-4" />
              {uploadLogo.isPending ? 'Enviando...' : 'Escolher imagem'}
            </button>
          ) : (
            <p className="text-[11px] text-ink-3 italic">Sem logo definido</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoFileChange}
          />
        </div>
      </Card>

      <Card title="Inscrições">
        <SettingsRow
          title={isClosed ? 'Inscrições encerradas' : 'Inscrições abertas'}
          sub={isClosed ? 'Ninguém mais pode entrar.' : 'Qualquer um com o código pode entrar.'}
        >
          {isOwner ? (
            <button
              type="button"
              onClick={handleToggleClose}
              disabled={toggleClose.isPending}
              className={`h-9 px-3 rounded-rebrand-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                isClosed
                  ? 'border border-status-success/40 text-status-success bg-status-success/[0.08] hover:bg-status-success/[0.14]'
                  : 'border border-status-danger/40 text-status-danger bg-status-danger/[0.06] hover:bg-status-danger/[0.12]'
              }`}
            >
              {isClosed ? <><Unlock className="w-3.5 h-3.5" /> Reabrir</> : <><Lock className="w-3.5 h-3.5" /> Encerrar</>}
            </button>
          ) : (
            <span className={`text-[11px] font-semibold inline-flex items-center gap-1 ${isClosed ? 'text-status-danger' : 'text-status-success'}`}>
              {isClosed ? <><Lock className="w-3 h-3" /> Encerradas</> : <><Unlock className="w-3 h-3" /> Abertas</>}
            </span>
          )}
        </SettingsRow>
      </Card>

      {/* Zona de perigo — somente owner. Membros nao veem essa secao */}
      {isOwner && (
      <Card title="Zona de perigo" sub="Ações irreversíveis. Faça com cuidado.">
        <SettingsRow
          title="Excluir bolão"
          sub="Apaga o bolão, todos os palpites e o ranking. Não tem volta."
        >
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="h-9 px-3 rounded-rebrand-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors border border-status-danger/40 text-status-danger bg-status-danger/[0.06] hover:bg-status-danger/[0.12]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>
        </SettingsRow>
      </Card>
      )}
    </>
  );

  const renderPontuacao = () => (
    <>
      <SectionHeader
        title="Pontuação"
        subtitle={
          <>Como cada palpite conta. <span className="font-semibold text-ink">3 estilos prontos</span> ou customize do jeito que quiser.</>
        }
      />

      <Card title="Estilo de pontuação" sub="Escolha um preset ou customize abaixo">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4">
              {SCORING_PRESETS.map((p) => {
                const active = isPresetActive(p);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    disabled={!isOwner}
                    className={`text-left rounded-rebrand-md border p-4 transition-all disabled:cursor-not-allowed ${
                      active
                        ? 'border-forest bg-forest/[0.06] ring-2 ring-forest/15'
                        : 'border-line bg-white hover:border-line-2 hover:bg-canvas-2'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p className={`text-[13px] font-bold ${active ? 'text-forest' : 'text-ink'}`}>{p.label}</p>
                      {active && (
                        <span className="w-4 h-4 rounded-full bg-forest text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-2 leading-snug mb-3">{p.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-canvas-2 text-ink-2">{p.result} pt</span>
                      <span className="text-ink-3">·</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-canvas-2 text-ink-2">{p.exact} pts</span>
                      {p.weighted && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber/[0.18] text-amber-2 ml-auto">5× final</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Valores base" sub="Ajustes finos sobre o preset escolhido">
            <SettingsRow title="Acertar resultado" sub="Vencedor ou empate, sem o placar exato">
              <div className="flex items-center gap-3">
                <NumberStepper
                  value={customResult}
                  onChange={setCustomResult}
                  min={1} max={10} suffix="pts"
                  ariaLabel="pontos por acertar resultado"
                  className="w-32"
                  disabled={!resultadoEnabled || !isOwner}
                />
                <Toggle
                  on={resultadoEnabled}
                  onClick={() => setResultadoEnabled((v) => !v)}
                  ariaLabel={resultadoEnabled ? 'Desabilitar acertar resultado' : 'Habilitar acertar resultado'}
                  disabled={!isOwner}
                />
              </div>
            </SettingsRow>
            <SettingsRow title="Placar exato" sub="Acertou o placar inteiro (3×0, 2×1...)">
              <div className="flex items-center gap-3">
                <NumberStepper
                  value={customExact}
                  onChange={setCustomExact}
                  min={1} max={20} suffix="pts"
                  ariaLabel="pontos por placar exato"
                  className="w-32"
                  disabled={!exatoEnabled || !isOwner}
                />
                <Toggle
                  on={exatoEnabled}
                  onClick={() => setExatoEnabled((v) => !v)}
                  ariaLabel={exatoEnabled ? 'Desabilitar placar exato' : 'Habilitar placar exato'}
                  disabled={!isOwner}
                />
              </div>
            </SettingsRow>
            <SettingsRow title="Multiplicador por fase" sub="Mata-mata vale mais que jogo de grupo">
              <Toggle
                on={useWeighted}
                onClick={() => setUseWeighted((v) => !v)}
                ariaLabel={useWeighted ? 'Desabilitar multiplicador' : 'Habilitar multiplicador'}
                disabled={!isOwner}
              />
            </SettingsRow>
          </Card>

          {useWeighted && (
            <Card title="Multiplicador por fase" sub="Quanto cada acerto vale em cada momento da Copa">
              <div className="flex sm:grid sm:grid-cols-7 gap-2 py-4 overflow-x-auto sm:overflow-visible -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {STAGE_LABELS.map((stage) => {
                  const value = customWeights[stage.key] ?? stage.defaultWeight;
                  const heightPct = Math.min(100, (value / 5) * 100);
                  const isFinal = stage.key === 'final';
                  const setValue = (next: number) =>
                    setCustomWeights((w) => ({ ...w, [stage.key]: Math.min(10, Math.max(0.5, next)) }));
                  return (
                    <div
                      key={stage.key}
                      className="flex flex-col items-center min-w-[68px] sm:min-w-0 shrink-0 sm:shrink"
                    >
                      <p className="text-[10px] font-medium text-ink-2 mb-1.5 text-center min-h-[26px] flex items-end justify-center leading-tight">
                        {stage.label}
                      </p>
                      <div className="h-24 w-full bg-canvas-2 rounded-rebrand-md flex items-end overflow-hidden">
                        <div
                          className={`w-full ${isFinal ? 'bg-amber' : value >= 3 ? 'bg-amber-2' : 'bg-forest'}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <p className={`text-[14px] font-bold tabular-nums mt-2 ${isFinal ? 'text-amber-2' : 'text-ink'}`}>
                        {value}×
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setValue(value - 0.5)}
                          disabled={value <= 0.5 || !isOwner}
                          aria-label={`Diminuir peso de ${stage.label}`}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-line bg-white text-ink-2 text-[14px] font-semibold hover:bg-canvas-2 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => setValue(value + 0.5)}
                          disabled={value >= 10 || !isOwner}
                          aria-label={`Aumentar peso de ${stage.label}`}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-line bg-white text-ink-2 text-[14px] font-semibold hover:bg-canvas-2 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setCustomWeights({ ...DEFAULT_WEIGHTS })}
                  className="text-[11px] text-forest hover:underline font-medium pb-4"
                >
                  Resetar para valores padrão
                </button>
              )}
            </Card>
          )}

      {isOwner && (
        <button
          type="button"
          onClick={handleSaveScoring}
          disabled={updateScoring.isPending}
          className="h-11 px-5 rounded-rebrand-md bg-forest text-white text-[13px] font-bold hover:bg-forest-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateScoring.isPending ? 'Salvando...' : 'Salvar pontuação'}
        </button>
      )}
    </>
  );

  const renderPrazo = () => (
    <>
      <SectionHeader
        title="Prazo de palpites"
        subtitle="Quando os palpites de cada jogo deixam de ser editáveis."
      />

      <Card title="Modo de prazo" sub="Aplica a todos os jogos do bolão">
        <div className="space-y-2 py-4">
          {(['per_match', 'per_day', 'per_round', 'per_stage'] as const).map((mode) => {
            const active = predictionDeadlineMode === mode;
            const meta = DEADLINE_MODE_LABELS[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleDeadlineModeChange(mode)}
                disabled={updateDeadlineMode.isPending || !isOwner}
                className={`w-full text-left rounded-rebrand-md border p-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  active
                    ? 'border-forest bg-forest/[0.06] ring-2 ring-forest/15'
                    : 'border-line bg-white hover:border-line-2 hover:bg-canvas-2'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    active ? 'border-forest bg-forest' : 'border-line'
                  }`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-semibold ${active ? 'text-forest' : 'text-ink'}`}>{meta?.label}</p>
                    <p className="text-[11px] text-ink-2 mt-0.5 leading-snug">{meta?.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {bolaoStats && bolaoStats.total_predictions > 0 && (
        <div className="p-3 rounded-rebrand-md border border-status-warning/40 bg-status-warning/[0.08]">
          <p className="text-[12px] text-ink-2 leading-snug flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-status-warning shrink-0 mt-0.5" />
            <span>
              <span className="font-bold text-ink">{bolaoStats.total_members}</span> {bolaoStats.total_members === 1 ? 'pessoa já fez' : 'pessoas já fizeram'}{' '}
              <span className="font-bold text-ink">{bolaoStats.total_predictions}</span> palpite{bolaoStats.total_predictions !== 1 ? 's' : ''}.
              Mudar o prazo afeta todos eles — pediremos confirmação.
            </span>
          </p>
        </div>
      )}
    </>
  );

  const renderModalidades = () => (
    <>
      <SectionHeader
        title="Modalidades"
        subtitle="Quais tipos de palpite existem no bolão."
      />

      <Card
        title="Palpite de Campeão"
        sub="Membros palpitam quem vai vencer a Copa"
        action={
          <Toggle
            on={champEnabled}
            onClick={handleToggleChampion}
            ariaLabel="Toggle palpite de campeão"
            disabled={!isOwner}
          />
        }
      >
        {champEnabled && (
          <SettingsRow title="Pontos do campeão" sub="Acerto vale esses pontos">
            <div className="flex items-center gap-2">
              <NumberStepper
                value={champPoints}
                onChange={setChampPoints}
                min={1} max={50} suffix="pts"
                ariaLabel="pontos do campeão"
                className="w-32"
                disabled={!isOwner}
              />
              {isOwner && champPoints !== championPoints && (
                <button
                  type="button"
                  onClick={handleSaveChampionPoints}
                  disabled={updateSettings.isPending}
                  className="h-9 px-3 rounded-rebrand-md bg-forest text-white text-[12px] font-semibold hover:bg-forest-2 disabled:opacity-50"
                >
                  Salvar
                </button>
              )}
            </div>
          </SettingsRow>
        )}
      </Card>

      <Card title="Palpites Especiais" sub="Cada modalidade pode ser ativada e ter pontos próprios">
        {Object.entries(SPECIAL_TYPES).map(([type, label]) => (
          <SettingsRow
            key={type}
            title={label}
            sub={specialConfig[type] ? `Vale ${specialPoints[type] ?? 1} pt(s) cada` : 'Desabilitado'}
          >
            <div className="flex items-center gap-2">
              <NumberStepper
                value={specialPoints[type] ?? 1}
                onChange={(v) => setSpecialPoints({ ...specialPoints, [type]: v })}
                min={1}
                max={50}
                suffix="pts"
                size="sm"
                disabled={!specialConfig[type] || !isOwner}
                ariaLabel={`pontos de ${label}`}
                className="w-28"
              />
              <Toggle
                on={!!specialConfig[type]}
                onClick={() => handleToggleSpecialType(type)}
                ariaLabel={`Toggle ${label}`}
                disabled={!isOwner}
              />
            </div>
          </SettingsRow>
        ))}
        {isOwner && JSON.stringify(specialPoints) !== JSON.stringify(specialPredictionsPoints) && (
          <div className="py-3 border-t border-line">
            <button
              type="button"
              onClick={handleSaveSpecialPoints}
              disabled={updateSettings.isPending}
              className="h-10 px-4 rounded-rebrand-md bg-forest text-white text-[13px] font-bold hover:bg-forest-2 disabled:opacity-50"
            >
              {updateSettings.isPending ? 'Salvando...' : 'Salvar pontuação'}
            </button>
          </div>
        )}
      </Card>
    </>
  );

  const renderMembros = () => {
    const visible = ranking.filter((m) => !pendingRemovedIds.has(m.user_id));
    return (
      <>
        <SectionHeader
          title="Membros"
          subtitle={`${visible.length} ${visible.length === 1 ? 'pessoa' : 'pessoas'} no bolão.`}
        />

        <Card
          title="Participantes"
          sub={isOwner ? "Você é o dono. Pode remover quem quiser (com 5s de undo)" : "Lista de quem está no bolão"}
        >
          <div className="py-3 space-y-2">
            {visible.map((member) => {
              const memberIsCreator = member.user_id === ownerUserId;
              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-rebrand-sm border border-line bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{member.user_name || member.user_email}</p>
                    <p className="text-[11px] text-ink-2 mt-0.5">
                      {member.total_points} pts · {member.total_predictions} palpites
                    </p>
                  </div>
                  {memberIsCreator ? (
                    <span className="text-[11px] font-bold text-forest shrink-0">Criador</span>
                  ) : isOwner ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.user_id, member.user_name || member.user_email)}
                      aria-label={`Remover ${member.user_name || member.user_email} do bolão`}
                      className="h-9 px-3 rounded-rebrand-md text-[11px] font-semibold text-ink-2 border border-line hover:border-status-danger/40 hover:text-status-danger hover:bg-status-danger/[0.06] transition-colors inline-flex items-center gap-1.5"
                    >
                      <UserX className="w-3.5 h-3.5" /> Remover
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      </>
    );
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-5xl h-[85vh] sm:min-h-[560px] max-h-[92vh] overflow-hidden p-0 flex flex-col rounded-rebrand-xl">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-4 shrink-0 border-b border-line bg-white">
            <div className="flex items-start justify-between gap-3 pr-7">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3 mb-0.5">
                  {bolaoName ? `${bolaoName} · ` : ''}{isOwner ? 'Admin' : 'Configurações'}
                </p>
                <DialogTitle className="font-display text-[20px] sm:text-[22px] font-bold text-ink leading-tight">
                  Configurações
                </DialogTitle>
              </div>
              {isOwner ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-forest bg-forest/[0.10] border border-forest/30 px-2.5 py-1 rounded-rebrand-sm shrink-0">
                  Você é dono
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-2 bg-canvas-2 border border-line px-2.5 py-1 rounded-rebrand-sm shrink-0">
                  Somente leitura
                </span>
              )}
            </div>
            {!isOwner && (
              <div className="mt-3 rounded-rebrand-sm border border-amber/40 bg-amber/[0.08] px-3 py-2 text-[11px] text-ink-2 leading-snug">
                Você é membro deste bolão. Pra alterar pontuação, modalidades ou prazos, peça pro dono.
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[220px_1fr] overflow-hidden min-w-0">
            {/* Sidebar — relative pra fade gradient mobile (indicador de scroll) */}
            <div className="relative border-b lg:border-b-0 lg:border-r border-line bg-white shrink-0 min-w-0">
              <nav
                className="py-3 px-2 lg:py-5 lg:px-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ touchAction: 'pan-x' }}
              >
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-rebrand-sm text-[13px] text-left transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-forest/[0.10] text-forest font-semibold'
                        : 'text-ink-2 hover:text-ink hover:bg-canvas-2'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-forest' : 'text-ink-3'}`} />
                    <span className="flex-1">{s.label}</span>
                  </button>
                );
              })}
              <div className="hidden lg:block pt-3 mt-3 border-t border-line px-3">
                <p className="text-[10px] text-ink-3 leading-snug">
                  Mudanças aplicam <span className="font-semibold text-ink-2">imediatamente</span> a todos os participantes.
                </p>
              </div>
              </nav>
              {/* Fade right (mobile only) — indica que há mais abas pra direita */}
              <div className="lg:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white via-white/85 to-transparent" />
            </div>

            {/* Content */}
            <div ref={contentScrollRef} className="flex-1 lg:flex-none overflow-y-auto overflow-x-hidden min-w-0 px-5 sm:px-7 py-6 space-y-5">
              {activeSection === 'geral' && renderGeral()}
              {activeSection === 'pontuacao' && renderPontuacao()}
              {activeSection === 'prazo' && renderPrazo()}
              {activeSection === 'modalidades' && renderModalidades()}
              {activeSection === 'membros' && renderMembros()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de mudança de deadline mode (quando há palpites) */}
      <ConfirmDialog
        open={pendingDeadlineMode !== null}
        onOpenChange={(o) => !o && setPendingDeadlineMode(null)}
        title="Confirmar mudança de prazo"
        description={
          <>
            <p className="mb-3">
              Você está mudando o prazo de palpites de{' '}
              <span className="font-bold text-ink">{DEADLINE_MODE_LABELS[predictionDeadlineMode]?.label}</span>{' '}
              para <span className="font-bold text-status-warning">{pendingDeadlineMode && DEADLINE_MODE_LABELS[pendingDeadlineMode]?.label}</span>.
            </p>
            {bolaoStats && (
              <div className="rounded-rebrand-md border border-status-warning/30 bg-status-warning/[0.08] p-3 text-[12px] mb-3">
                <p className="font-bold mb-1.5 text-ink">Impacto:</p>
                <ul className="space-y-1 text-ink-2">
                  <li>• <span className="font-bold text-ink">{bolaoStats.total_members}</span> {bolaoStats.total_members === 1 ? 'pessoa será afetada' : 'pessoas serão afetadas'}</li>
                  <li>• <span className="font-bold text-ink">{bolaoStats.total_predictions}</span> {bolaoStats.total_predictions === 1 ? 'palpite foi feito' : 'palpites foram feitos'} no modo atual</li>
                  <li>• Alguns palpites podem ficar fora do novo prazo</li>
                </ul>
              </div>
            )}
            <p className="text-[11px] text-ink-3">
              Avise os participantes antes de confirmar — mudanças no meio do bolão podem gerar confusão.
            </p>
          </>
        }
        confirmLabel="Sim, mudar mesmo assim"
        variant="destructive"
        onConfirm={() => {
          if (pendingDeadlineMode) {
            applyDeadlineModeChange(pendingDeadlineMode);
            setPendingDeadlineMode(null);
          }
        }}
        isLoading={updateDeadlineMode.isPending}
      />

      {/* Excluir bolão — exige digitar o nome pra confirmar */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!o) closeDeleteDialog();
        }}
      >
        <DialogContent className="theme-bolao bg-canvas border border-status-danger/30 w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md p-5 rounded-rebrand-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-[18px] font-bold text-status-danger pr-6">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Excluir bolão?
            </DialogTitle>
          </DialogHeader>

          <div className="text-[13px] text-ink-2 leading-relaxed space-y-3 mt-1">
            <p>
              Isso vai apagar permanentemente <span className="font-bold text-ink">"{bolaoName}"</span>,
              todos os palpites e o ranking. <span className="font-bold text-status-danger">Não tem volta.</span>
            </p>
            {bolaoStats && (bolaoStats.total_members > 1 || bolaoStats.total_predictions > 0) && (
              <div className="rounded-rebrand-md border border-status-danger/30 bg-status-danger/[0.06] p-3 text-[12px]">
                <p className="font-bold mb-1.5 text-ink">Impacto:</p>
                <ul className="space-y-1 text-ink-2">
                  <li>• <span className="font-bold text-ink">{bolaoStats.total_members}</span> {bolaoStats.total_members === 1 ? 'membro' : 'membros'}</li>
                  <li>• <span className="font-bold text-ink">{bolaoStats.total_predictions}</span> {bolaoStats.total_predictions === 1 ? 'palpite' : 'palpites'} feitos</li>
                </ul>
              </div>
            )}
            <p className="text-[12px]">
              Pra confirmar, digite o nome do bolão (<span className="font-bold text-ink">{bolaoName}</span>) abaixo:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={bolaoName ?? ''}
              aria-label="Confirmar nome do bolão"
              autoFocus
              className="w-full h-10 px-3 rounded-rebrand-md border border-line bg-white text-[13px] text-ink focus:border-status-danger focus:ring-2 focus:ring-status-danger/20 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={closeDeleteDialog}
              disabled={deleteBolao.isPending}
              className="h-11 px-4 rounded-rebrand-md text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-canvas-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteBolao}
              disabled={!deleteConfirmMatches || deleteBolao.isPending}
              className="h-11 px-5 rounded-rebrand-md text-[13px] font-bold text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-status-danger hover:bg-status-danger/90"
            >
              {deleteBolao.isPending ? 'Excluindo...' : 'Excluir permanentemente'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── Section header (eyebrow + title + subtitle) ────────────────────
const SectionHeader: React.FC<{ title: string; subtitle?: React.ReactNode }> = ({ title, subtitle }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">Configurações</p>
    <h2 className="text-[22px] font-bold tracking-tight text-ink leading-tight font-display mt-0.5">{title}</h2>
    {subtitle && <p className="text-[12px] text-ink-2 mt-1 max-w-[60ch] leading-snug">{subtitle}</p>}
  </div>
);
