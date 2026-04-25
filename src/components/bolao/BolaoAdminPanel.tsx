import React, { useState, useRef } from 'react';
import {
  Shield,
  UserX,
  Lock,
  Unlock,
  AlertTriangle,
  Palette,
  SlidersHorizontal,
  ImagePlus,
  X,
  Users,
  Trophy,
  Star,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  Check,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
} from '@/hooks/use-bolao';
import { useToast } from '@/hooks/use-toast';
import type { BolaoRankingEntry } from '@/services/bolao.service';

interface BolaoAdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bolaoId: string;
  isClosed: boolean;
  isPremium: boolean;
  scoringPreset: string | null;
  scoringResult: number;
  scoringExact: number;
  scoringWeights: Record<string, number> | null;
  customColor: string | null;
  customBannerUrl: string | null;
  championEnabled: boolean;
  specialPredictionsEnabled: boolean;
  specialPredictionsConfig: Record<string, boolean>;
  specialPredictionsPoints: Record<string, number>;
  championPoints: number;
  ranking: BolaoRankingEntry[];
  currentUserId: string | undefined;
  ownerUserId: string;
  predictionDeadlineMode: 'per_match' | 'per_round' | 'tournament_start';
}

const DEADLINE_MODE_LABELS: Record<string, { label: string; description: string }> = {
  per_match:        { label: 'Por jogo',     description: 'Até o apito inicial de cada partida' },
  per_round:        { label: 'Por fase',     description: 'Até o início da primeira partida da fase' },
  tournament_start: { label: 'Copa inteira', description: 'Até a abertura da Copa' },
};

// ── Color Theme ────────────────────────────────────────────────────
const THEME_COLORS: { value: string; label: string; bg: string; border: string }[] = [
  { value: 'blue',    label: 'Azul',     bg: 'bg-blue-900/30',    border: 'border-blue-500/60'    },
  { value: 'green',   label: 'Verde',    bg: 'bg-emerald-900/30', border: 'border-emerald-500/60' },
  { value: 'gold',    label: 'Dourado',  bg: 'bg-yellow-900/30',  border: 'border-yellow-500/60'  },
  { value: 'purple',  label: 'Roxo',     bg: 'bg-purple-900/30',  border: 'border-purple-500/60'  },
  { value: 'red',     label: 'Vinho',    bg: 'bg-red-900/30',     border: 'border-red-700/60'     },
  { value: 'cyan',    label: 'Ciano',    bg: 'bg-cyan-900/30',    border: 'border-cyan-500/60'    },
  { value: 'orange',  label: 'Laranja',  bg: 'bg-orange-900/30',  border: 'border-orange-500/60'  },
  { value: 'default', label: 'Padrão',   bg: 'bg-transparent',    border: 'border-terminal-border'},
];

// ── Scoring Presets (quick-fill shortcuts) ─────────────────────────
const SCORING_PRESETS = [
  {
    value: 'standard',
    label: 'Casual',
    description: 'Simples, sem multiplicador',
    result: 1,
    exact: 3,
    weighted: false,
  },
  {
    value: 'classic',
    label: 'Clássico',
    description: 'Placar exato vale mais',
    result: 1,
    exact: 5,
    weighted: false,
  },
  {
    value: 'weighted_stages',
    label: 'Campeonato',
    description: 'Mata-mata decide tudo',
    result: 1,
    exact: 3,
    weighted: true,
  },
] as const;

// ── Stage labels + default multipliers ─────────────────────────────
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

// ── NumberStepper ─────────────────────────────────────────────────
// Reusable numeric input with −/+ buttons. Snaps to `step`, clamps to [min,max].
interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  highlight?: boolean;
  suffix?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const NumberStepper: React.FC<NumberStepperProps> = ({
  value, onChange, min, max, step = 1, highlight, suffix, ariaLabel, className, disabled, size = 'md',
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
  const btnW = size === 'sm' ? 'w-6' : 'w-7';
  const btnText = size === 'sm' ? 'text-xs' : 'text-sm';
  const inputPad = size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-xs';
  return (
    <div className={`flex items-stretch rounded border overflow-hidden ${
      highlight ? 'border-terminal-blue/50' : 'border-terminal-border'
    } ${disabled ? 'opacity-30' : ''} ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => bump(-step)}
        disabled={!canDec}
        aria-label={ariaLabel ? `Diminuir ${ariaLabel}` : 'Diminuir'}
        className={`${btnW} flex items-center justify-center bg-terminal-dark-gray/60 hover:bg-terminal-blue/20 text-terminal-blue font-bold ${btnText} transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-terminal-dark-gray/60`}
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
        className={`flex-1 min-w-0 text-center font-bold bg-terminal-dark-gray ${inputPad} focus:bg-terminal-blue/10 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed ${
          highlight ? 'text-terminal-blue' : ''
        }`}
      />
      {suffix && (
        <span className="flex items-center px-1 text-[10px] opacity-40 bg-terminal-dark-gray">{suffix}</span>
      )}
      <button
        type="button"
        onClick={() => bump(step)}
        disabled={!canInc}
        aria-label={ariaLabel ? `Aumentar ${ariaLabel}` : 'Aumentar'}
        className={`${btnW} flex items-center justify-center bg-terminal-dark-gray/60 hover:bg-terminal-blue/20 text-terminal-blue font-bold ${btnText} transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-terminal-dark-gray/60`}
      >
        +
      </button>
    </div>
  );
};

const SPECIAL_TYPES: Record<string, string> = {
  finalist: 'Finalistas',
  semifinalist: 'Semifinalistas',
  quarterfinalist: 'Quartas de Final',
  round_of_32: 'Mata-mata (32)',
};


export const BolaoAdminPanel: React.FC<BolaoAdminPanelProps> = ({
  open,
  onOpenChange,
  bolaoId,
  isClosed,
  isPremium,
  scoringPreset,
  scoringResult,
  scoringExact,
  scoringWeights,
  customColor,
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
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [specialExpanded, setSpecialExpanded] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Scoring state
  const [customResult, setCustomResult] = useState(scoringResult);
  const [customExact, setCustomExact] = useState(scoringExact);
  const [useWeighted, setUseWeighted] = useState(scoringPreset === 'weighted_stages');
  const [customWeights, setCustomWeights] = useState<Record<string, number>>(
    { ...DEFAULT_WEIGHTS, ...(scoringWeights ?? {}) }
  );

  // Feature toggles state
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
  const { data: bolaoStats } = useBolaoStats(bolaoId, open && currentUserId === ownerUserId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (currentUserId !== ownerUserId) return null;

  const handleRemove = (userId: string, userName: string) => {
    if (confirmRemove !== userId) {
      setConfirmRemove(userId);
      return;
    }
    removeMember.mutate(
      { bolaoId, userId },
      {
        onSuccess: () => {
          toast({ title: `${userName} removido do bolão` });
          setConfirmRemove(null);
        },
        onError: (err: any) => {
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
          setConfirmRemove(null);
        },
      }
    );
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
    setUseWeighted(preset.weighted);
    // Reset weights to defaults when applying a preset
    if (preset.weighted) {
      setCustomWeights({ ...DEFAULT_WEIGHTS });
    }
  };

  const isPresetActive = (preset: typeof SCORING_PRESETS[number]) =>
    customResult === preset.result
    && customExact === preset.exact
    && useWeighted === preset.weighted
    && (!preset.weighted || STAGE_LABELS.every(s => customWeights[s.key] === s.defaultWeight));

  const handleUpgradeToPremium = async () => {
    const BOLAO_PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_BOLAO as string | undefined;
    const BOLAO_PRO_PAYMENT_LINK = 'https://buy.stripe.com/4gMcMXgG43089uVg6zaR20b';
    setUpgradeLoading(true);
    try {
      if (BOLAO_PRO_PRICE_ID) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Usuário não autenticado');
        const { data: fnData, error } = await supabase.functions.invoke('stripe-create-checkout', {
          body: {
            priceId: BOLAO_PRO_PRICE_ID,
            productType: 'bolao_premium',
            bolaoId, // upgrade existing bolão
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw error;
        window.location.href = fnData.url;
      } else {
        // Fallback payment link with client_reference_id for webhook match
        window.location.href = `${BOLAO_PRO_PAYMENT_LINK}?client_reference_id=${bolaoId}`;
      }
    } catch (err: any) {
      setUpgradeLoading(false);
      toast({ title: 'Erro ao iniciar checkout', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDeadlineModeChange = (mode: 'per_match' | 'per_round' | 'tournament_start') => {
    if (mode === predictionDeadlineMode) return;
    updateDeadlineMode.mutate(
      { bolaoId, mode },
      {
        onSuccess: () => {
          toast({ title: `Prazo atualizado: ${DEADLINE_MODE_LABELS[mode]?.label}` });
        },
        onError: (err: any) => {
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleSaveScoring = () => {
    const preset = useWeighted ? 'weighted_stages' : 'custom';
    updateScoring.mutate(
      {
        bolaoId,
        preset,
        scoringResult: customResult,
        scoringExact: customExact,
        scoringWeights: useWeighted ? customWeights : null,
      },
      {
        onSuccess: (res) => {
          toast({ title: `Pontuação atualizada: ${res.scoring_result}pt / ${res.scoring_exact}pts` });
        },
        onError: (err: any) => {
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        },
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

  const handleColorChange = (color: string) => {
    const finalColor = color === 'default' ? null : color;
    updateTheme.mutate(
      { bolaoId, color: finalColor ?? undefined },
      {
        onSuccess: () => toast({ title: 'Cor atualizada!' }),
        onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-bg border-terminal-border max-w-lg max-h-[85vh] overflow-y-auto minimal-scrollbar p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-terminal-text">
            <Shield className="w-5 h-5 text-terminal-blue" />
            Configurações do Bolão
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 pt-4 space-y-5">

          {/* ── Inscrições ── */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {isClosed ? 'Inscrições encerradas' : 'Inscrições abertas'}
              </p>
              <p className="text-xs opacity-50 mt-0.5">
                {isClosed
                  ? 'Ninguém mais pode entrar no bolão'
                  : 'Qualquer um com o código pode entrar'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleClose}
              disabled={toggleClose.isPending}
              className={`shrink-0 gap-1.5 text-xs ${
                isClosed
                  ? 'border-terminal-green/40 text-terminal-green hover:bg-terminal-green/10'
                  : 'border-terminal-red/40 text-terminal-red/80 hover:bg-terminal-red/10'
              }`}
            >
              {isClosed ? (
                <><Unlock className="w-3 h-3" /> Reabrir</>
              ) : (
                <><Lock className="w-3 h-3" /> Encerrar</>
              )}
            </Button>
          </div>

          {/* ── Premium Upgrade CTA — only when not premium ── */}
          {!isPremium && (
            <div className="rounded-lg border border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
                  <Crown className="w-4.5 h-4.5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-yellow-300 flex items-center gap-1.5">
                    Desbloqueie o Bolão Premium
                    <Sparkles className="w-3.5 h-3.5" />
                  </p>
                  <p className="text-[11px] opacity-70 mt-0.5">
                    Pagamento único de <span className="font-bold text-yellow-300">R$ 19,90</span> · sem mensalidade
                  </p>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5 text-[11px]">
                <li className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>Participantes <span className="font-medium text-yellow-200">ilimitados</span> (free: até 10)</span>
                </li>
                <li className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>Pontuação customizável + multiplicador por fase</span>
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>Palpites especiais (campeão, finalistas, semis...)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>Fases finais valem até <span className="font-medium text-yellow-200">5×</span> mais</span>
                </li>
                <li className="flex items-center gap-2">
                  <Palette className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>Logo e cor personalizados do bolão</span>
                </li>
              </ul>

              <Button
                size="sm"
                onClick={handleUpgradeToPremium}
                disabled={upgradeLoading}
                className="w-full mt-3 bg-yellow-500 text-terminal-bg hover:bg-yellow-400 font-bold gap-1.5 text-xs h-9"
              >
                {upgradeLoading ? (
                  'Redirecionando...'
                ) : (
                  <>
                    <Crown className="w-3.5 h-3.5" />
                    Fazer upgrade · R$ 19,90
                  </>
                )}
              </Button>
            </div>
          )}

          {/* ── Features do Bolão ── */}
          <div className="border-t border-terminal-border-subtle pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-3.5 h-3.5 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Modalidades</p>
            </div>

            <div className="space-y-3">
              {/* Champion toggle + points inline */}
              <div className="rounded border border-terminal-border-subtle p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <p className="text-xs font-medium">Palpite de Campeão</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <NumberStepper
                      value={champPoints}
                      onChange={setChampPoints}
                      min={1}
                      max={50}
                      size="sm"
                      disabled={!champEnabled}
                      ariaLabel="pontos do campeão"
                      className="w-24"
                    />
                    <span className="text-[9px] opacity-30 w-5">pts</span>
                    <button onClick={handleToggleChampion} className="shrink-0">
                      {champEnabled ? (
                        <ToggleRight className="w-6 h-6 text-terminal-blue" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 opacity-30" />
                      )}
                    </button>
                  </div>
                </div>
                {champPoints !== championPoints && champEnabled && (
                  <button
                    onClick={handleSaveChampionPoints}
                    disabled={updateSettings.isPending}
                    className="w-full text-[10px] text-terminal-blue hover:underline disabled:opacity-30 mt-2"
                  >
                    Salvar pontuação
                  </button>
                )}
              </div>

              {/* Special predictions — collapsible individual toggles */}
              <div className="rounded border border-terminal-border-subtle overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSpecialExpanded(!specialExpanded)}
                  className="w-full flex items-center justify-between gap-3 p-3 hover:bg-terminal-dark-gray/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">Palpites Especiais</p>
                      <p className="text-[10px] opacity-40">
                        {Object.values(specialConfig).filter(Boolean).length} de {Object.keys(specialConfig).length} habilitados
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 opacity-30 transition-transform ${specialExpanded ? 'rotate-180' : ''}`} />
                </button>
                {specialExpanded && (
                  <div className="border-t border-terminal-border-subtle px-3 pb-3 pt-2 space-y-2.5">
                    {Object.entries(SPECIAL_TYPES).map(([type, label]) => (
                      <div key={type} className="flex items-center justify-between gap-2 pl-5">
                        <p className="text-[11px] flex-1 min-w-0">{label}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <NumberStepper
                            value={specialPoints[type] ?? 1}
                            onChange={(v) => setSpecialPoints({ ...specialPoints, [type]: v })}
                            min={1}
                            max={50}
                            size="sm"
                            disabled={!specialConfig[type]}
                            ariaLabel={`pontos de ${label}`}
                            className="w-24"
                          />
                          <span className="text-[9px] opacity-30 w-5">pts</span>
                          <button onClick={() => handleToggleSpecialType(type)} className="shrink-0">
                            {specialConfig[type] ? (
                              <ToggleRight className="w-6 h-6 text-terminal-blue" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 opacity-30" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                    {JSON.stringify(specialPoints) !== JSON.stringify(specialPredictionsPoints) && (
                      <button
                        onClick={() => {
                          updateSettings.mutate(
                            { bolaoId, settings: { special_predictions_points: specialPoints } },
                            {
                              onSuccess: () => toast({ title: 'Pontuação dos palpites especiais atualizada' }),
                              onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
                            }
                          );
                        }}
                        disabled={updateSettings.isPending}
                        className="w-full text-[10px] text-terminal-blue hover:underline disabled:opacity-30 pt-1"
                      >
                        Salvar pontuação
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Prazo de palpites ── */}
          <div className="border-t border-terminal-border-subtle pt-4">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-3.5 h-3.5 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Prazo de palpites</p>
            </div>
            <div className="space-y-1.5">
              {(['per_match', 'per_round', 'tournament_start'] as const).map((mode) => {
                const active = predictionDeadlineMode === mode;
                const meta = DEADLINE_MODE_LABELS[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleDeadlineModeChange(mode)}
                    disabled={updateDeadlineMode.isPending}
                    className={`w-full text-left rounded border p-2.5 transition-all disabled:opacity-60 ${
                      active
                        ? 'border-terminal-blue bg-terminal-blue/10'
                        : 'border-terminal-border-subtle hover:border-terminal-blue/40 bg-terminal-dark-gray/20'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                        active ? 'border-terminal-blue bg-terminal-blue' : 'border-terminal-border-subtle'
                      }`}>
                        {active && <Check className="w-2.5 h-2.5 text-terminal-bg" strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium ${active ? 'text-terminal-blue' : ''}`}>
                          {meta?.label}
                        </p>
                        <p className="text-[10px] opacity-50 mt-0.5">{meta?.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {bolaoStats && bolaoStats.total_predictions > 0 && (
              <div className="mt-2 p-2 rounded border border-terminal-yellow/30 bg-terminal-yellow/5">
                <p className="text-[10px] text-terminal-yellow/90">
                  <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                  Atenção: já existem {bolaoStats.total_predictions} palpite{bolaoStats.total_predictions !== 1 ? 's' : ''} registrado{bolaoStats.total_predictions !== 1 ? 's' : ''}. Mudar o prazo agora pode confundir os participantes.
                </p>
              </div>
            )}
          </div>

          {/* ── Pontuação ── */}
          <div className="border-t border-terminal-border-subtle pt-4">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-3.5 h-3.5 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Pontuação</p>
              {!isPremium && (
                <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold ml-auto">
                  PREMIUM
                </span>
              )}
            </div>

            {isPremium ? (
              <div className="space-y-4">
                {/* Quick presets — cards with description and values */}
                <div>
                  <p className="text-[10px] opacity-40 mb-2">Escolha um estilo</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SCORING_PRESETS.map((p) => {
                      const active = isPresetActive(p);
                      return (
                        <button
                          key={p.value}
                          onClick={() => handleApplyPreset(p)}
                          className={`text-left p-3 rounded border transition-all ${
                            active
                              ? 'border-terminal-blue bg-terminal-blue/10'
                              : 'border-terminal-border-subtle bg-terminal-dark-gray/20 hover:border-terminal-blue/40 hover:bg-terminal-dark-gray/40'
                          }`}
                        >
                          <p className={`text-xs font-bold mb-1 ${active ? 'text-terminal-blue' : ''}`}>
                            {p.label}
                          </p>
                          <p className="text-[10px] opacity-60 mb-2">{p.description}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-dark-gray/60 font-mono">
                              {p.result} pt
                            </span>
                            <span className="text-[10px] opacity-30">·</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-dark-gray/60 font-mono">
                              {p.exact} pts
                            </span>
                          </div>
                          {p.weighted && (
                            <p className="text-[10px] text-terminal-blue/80 mt-2">
                              Grupos 1× <span className="opacity-40">→</span> Final 5×
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Editable values */}
                <div className="p-3 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] opacity-50">Acertar resultado</label>
                      <div className="flex items-center gap-2">
                        <NumberStepper
                          value={customResult}
                          onChange={setCustomResult}
                          min={1}
                          max={10}
                          ariaLabel="pontos por acertar resultado"
                          className="flex-1"
                        />
                        <span className="text-[10px] opacity-30 shrink-0">pts</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] opacity-50">Placar exato</label>
                      <div className="flex items-center gap-2">
                        <NumberStepper
                          value={customExact}
                          onChange={setCustomExact}
                          min={1}
                          max={20}
                          ariaLabel="pontos por placar exato"
                          className="flex-1"
                        />
                        <span className="text-[10px] opacity-30 shrink-0">pts</span>
                      </div>
                    </div>
                  </div>

                  {/* Weighted stages toggle */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-terminal-border-subtle">
                    <div>
                      <p className="text-xs font-medium">Multiplicador por fase</p>
                      <p className="text-[10px] opacity-40">Mata-mata vale mais pontos</p>
                    </div>
                    <button onClick={() => setUseWeighted(!useWeighted)} className="shrink-0">
                      {useWeighted ? (
                        <ToggleRight className="w-7 h-7 text-terminal-blue" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 opacity-30" />
                      )}
                    </button>
                  </div>

                  {useWeighted && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] opacity-50">
                        Ajuste o peso de cada fase com os botões <span className="font-mono">−</span> / <span className="font-mono">+</span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {STAGE_LABELS.map(stage => {
                          const value = customWeights[stage.key] ?? stage.defaultWeight;
                          const isCustom = value !== stage.defaultWeight;
                          return (
                            <div key={stage.key} className="flex flex-col gap-1">
                              <label className="text-[9px] opacity-50 uppercase tracking-wider">
                                {stage.label}
                              </label>
                              <NumberStepper
                                value={value}
                                onChange={(v) => setCustomWeights(w => ({ ...w, [stage.key]: v }))}
                                min={0.5}
                                max={10}
                                step={0.5}
                                highlight={isCustom}
                                suffix="×"
                                ariaLabel={`peso de ${stage.label}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomWeights({ ...DEFAULT_WEIGHTS })}
                        className="text-[10px] text-terminal-blue/70 hover:text-terminal-blue underline"
                      >
                        Resetar para valores padrão
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={handleSaveScoring}
                  disabled={updateScoring.isPending}
                  className="w-full bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/30 hover:bg-terminal-blue/30 text-xs h-8"
                >
                  {updateScoring.isPending ? 'Salvando...' : 'Salvar pontuação'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5 opacity-50 pointer-events-none">
                  {SCORING_PRESETS.map(p => (
                    <div key={p.value} className="p-2 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20">
                      <p className="text-[10px] font-bold mb-0.5">{p.label}</p>
                      <p className="text-[9px] opacity-60 leading-tight mb-1">{p.description}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] px-1 py-0.5 rounded bg-terminal-dark-gray/60 font-mono">{p.result}pt</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-terminal-dark-gray/60 font-mono">{p.exact}pts</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded border border-yellow-500/30 bg-yellow-500/5">
                  <p className="text-[11px] text-yellow-200/90">
                    <Lock className="w-3 h-3 inline mr-1 -mt-0.5" />
                    Hoje: {scoringResult}pt resultado · {scoringExact}pts placar
                  </p>
                  <button
                    onClick={handleUpgradeToPremium}
                    disabled={upgradeLoading}
                    className="text-[11px] font-bold text-yellow-300 hover:text-yellow-200 whitespace-nowrap disabled:opacity-50"
                  >
                    Desbloquear →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Cor do bolão ── */}
          <div className="border-t border-terminal-border-subtle pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-3.5 h-3.5 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Cor do bolão</p>
              {!isPremium && (
                <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold ml-auto">
                  PREMIUM
                </span>
              )}
            </div>

            {isPremium ? (
              <div className="grid grid-cols-4 gap-1.5">
                {THEME_COLORS.map((c) => {
                  const isActive = customColor === c.value || (c.value === 'default' && !customColor);
                  return (
                    <button
                      key={c.value}
                      onClick={() => handleColorChange(c.value)}
                      disabled={updateTheme.isPending}
                      className={`flex flex-col items-center gap-1 p-2 rounded border transition-all ${
                        isActive ? 'border-terminal-green' : 'border-terminal-border-subtle hover:border-terminal-border'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded border ${c.bg} ${c.border}`} />
                      <span className={`text-[9px] ${isActive ? 'text-terminal-green font-bold' : 'opacity-40'}`}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-1.5 opacity-40 pointer-events-none">
                  {THEME_COLORS.map((c) => (
                    <div key={c.value} className="flex flex-col items-center gap-1 p-2 rounded border border-terminal-border-subtle">
                      <div className={`w-6 h-6 rounded border ${c.bg} ${c.border}`} />
                      <span className="text-[9px] opacity-40">{c.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded border border-yellow-500/30 bg-yellow-500/5">
                  <p className="text-[11px] text-yellow-200/90">
                    <Lock className="w-3 h-3 inline mr-1 -mt-0.5" />
                    8 cores para identificar seu bolão
                  </p>
                  <button
                    onClick={handleUpgradeToPremium}
                    disabled={upgradeLoading}
                    className="text-[11px] font-bold text-yellow-300 hover:text-yellow-200 whitespace-nowrap disabled:opacity-50"
                  >
                    Desbloquear →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Logo do bolão ── */}
          <div className="border-t border-terminal-border-subtle pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ImagePlus className="w-3.5 h-3.5 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Logo do bolão</p>
              {!isPremium && (
                <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold ml-auto">
                  PREMIUM
                </span>
              )}
            </div>

            {isPremium ? (
              <div className="flex items-center gap-3">
                {customBannerUrl ? (
                  <>
                    <img
                      src={customBannerUrl}
                      alt="Logo"
                      className="w-12 h-12 rounded border border-terminal-border object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] opacity-50 truncate">{customBannerUrl.split('/').pop()}</p>
                    </div>
                    <button
                      onClick={handleRemoveLogo}
                      disabled={updateTheme.isPending}
                      className="shrink-0 p-1.5 rounded border border-terminal-border-subtle hover:border-terminal-red/40 hover:text-terminal-red transition-colors opacity-50 hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadLogo.isPending || updateTheme.isPending}
                    className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-terminal-border hover:border-terminal-blue/50 transition-colors text-xs opacity-60 hover:opacity-100 w-full justify-center"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    {uploadLogo.isPending ? 'Enviando...' : 'Escolher imagem (JPG/PNG, max 2MB)'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 p-3 rounded border border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-center gap-2">
                  <ImagePlus className="w-3.5 h-3.5 text-yellow-400/70" />
                  <p className="text-[11px] text-yellow-200/90">
                    <Lock className="w-3 h-3 inline mr-1 -mt-0.5" />
                    Logo personalizado do bolão
                  </p>
                </div>
                <button
                  onClick={handleUpgradeToPremium}
                  disabled={upgradeLoading}
                  className="text-[11px] font-bold text-yellow-300 hover:text-yellow-200 whitespace-nowrap disabled:opacity-50"
                >
                  Desbloquear →
                </button>
              </div>
            )}
          </div>

          {/* ── Participantes ── */}
          <div className="border-t border-terminal-border-subtle pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Participantes</p>
              <span className="text-[10px] opacity-30 ml-auto">{ranking.length}</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto minimal-scrollbar">
              {ranking.map((member) => {
                const isOwner = member.user_id === ownerUserId;
                const isConfirming = confirmRemove === member.user_id;
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3 py-2 px-3 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user_name || member.user_email}
                      </p>
                      <p className="text-[10px] opacity-40">
                        {member.total_points} pts · {member.total_predictions} palpites
                      </p>
                    </div>
                    {isOwner ? (
                      <span className="text-[10px] text-terminal-green font-bold shrink-0">Criador</span>
                    ) : (
                      <button
                        onClick={() => handleRemove(member.user_id, member.user_name || member.user_email)}
                        disabled={removeMember.isPending}
                        className={`shrink-0 flex items-center gap-1 text-[10px] font-bold transition-colors px-2 py-1 rounded border ${
                          isConfirming
                            ? 'border-terminal-red/60 text-terminal-red bg-terminal-red/10'
                            : 'border-terminal-border opacity-50 hover:opacity-80 hover:border-terminal-red/40 hover:text-terminal-red'
                        }`}
                      >
                        {isConfirming ? (
                          <><AlertTriangle className="w-2.5 h-2.5" /> Confirmar</>
                        ) : (
                          <><UserX className="w-2.5 h-2.5" /> Remover</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
