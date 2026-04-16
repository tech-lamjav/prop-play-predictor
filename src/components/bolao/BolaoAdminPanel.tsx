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
} from 'lucide-react';
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
}

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
  { value: 'standard',        label: 'Padrão',        result: 1, exact: 3, weighted: false },
  { value: 'classic',         label: 'Clássico',       result: 1, exact: 5, weighted: false },
  { value: 'weighted_stages', label: 'Fases valem +',  result: 1, exact: 3, weighted: true  },
] as const;

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
}) => {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [specialExpanded, setSpecialExpanded] = useState(false);

  // Scoring state
  const [customResult, setCustomResult] = useState(scoringResult);
  const [customExact, setCustomExact] = useState(scoringExact);
  const [useWeighted, setUseWeighted] = useState(scoringPreset === 'weighted_stages');

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
  };

  const handleSaveScoring = () => {
    const preset = useWeighted ? 'weighted_stages' : 'custom';
    updateScoring.mutate(
      {
        bolaoId,
        preset,
        scoringResult: customResult,
        scoringExact: customExact,
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
                    <input
                      type="number"
                      min={1} max={50}
                      value={champPoints}
                      onChange={(e) => setChampPoints(Number(e.target.value))}
                      disabled={!champEnabled}
                      className="w-10 text-center text-[11px] font-bold bg-terminal-dark-gray border border-terminal-border rounded py-0.5 focus:border-terminal-blue focus:outline-none disabled:opacity-20"
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
                          <input
                            type="number"
                            min={1} max={50}
                            value={specialPoints[type] ?? 0}
                            onChange={(e) => setSpecialPoints({ ...specialPoints, [type]: Number(e.target.value) })}
                            disabled={!specialConfig[type]}
                            className="w-10 text-center text-[11px] font-bold bg-terminal-dark-gray border border-terminal-border rounded py-0.5 focus:border-terminal-blue focus:outline-none disabled:opacity-20"
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
                {/* Quick presets */}
                <div>
                  <p className="text-[10px] opacity-40 mb-2">Presets rápidos</p>
                  <div className="flex gap-1.5">
                    {SCORING_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => handleApplyPreset(p)}
                        className={`px-3 py-1.5 rounded border text-[10px] font-medium transition-all ${
                          customResult === p.result && customExact === p.exact && useWeighted === p.weighted
                            ? 'border-terminal-blue bg-terminal-blue/10 text-terminal-blue'
                            : 'border-terminal-border-subtle opacity-50 hover:opacity-80'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editable values */}
                <div className="p-3 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-[10px] opacity-50 shrink-0">Acertar resultado</label>
                      <input
                        type="number"
                        min={1} max={10}
                        value={customResult}
                        onChange={(e) => setCustomResult(Number(e.target.value))}
                        className="w-14 text-center text-sm font-bold bg-terminal-dark-gray border border-terminal-border rounded py-1 focus:border-terminal-blue focus:outline-none"
                      />
                      <span className="text-[10px] opacity-30">pts</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-[10px] opacity-50 shrink-0">Placar exato</label>
                      <input
                        type="number"
                        min={1} max={20}
                        value={customExact}
                        onChange={(e) => setCustomExact(Number(e.target.value))}
                        className="w-14 text-center text-sm font-bold bg-terminal-dark-gray border border-terminal-border rounded py-1 focus:border-terminal-blue focus:outline-none"
                      />
                      <span className="text-[10px] opacity-30">pts</span>
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
                    <div className="text-[10px] opacity-50 space-y-0.5 pl-1">
                      <p>Grupos: 1× · R32/R16: 1.5× · Quartas: 2×</p>
                      <p>Semis: 3× · 3º lugar: 2× · Final: 5×</p>
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
              <div className="p-3 rounded border border-terminal-border-subtle bg-terminal-dark-gray/10 opacity-50">
                <p className="text-xs">Pontuação padrão: {scoringResult}pt resultado / {scoringExact}pts placar exato</p>
                <p className="text-[10px] opacity-50 mt-1">Personalização disponível no Premium</p>
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
              <div className="grid grid-cols-4 gap-1.5 opacity-30 pointer-events-none">
                {THEME_COLORS.map((c) => (
                  <div key={c.value} className="flex flex-col items-center gap-1 p-2 rounded border border-terminal-border-subtle">
                    <div className={`w-6 h-6 rounded border ${c.bg} ${c.border}`} />
                    <span className="text-[9px] opacity-40">{c.label}</span>
                  </div>
                ))}
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
              <div className="flex items-center gap-2 p-3 rounded border border-dashed border-terminal-border-subtle opacity-30 pointer-events-none">
                <ImagePlus className="w-3.5 h-3.5" />
                <span className="text-xs">Upload disponível no Premium</span>
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
