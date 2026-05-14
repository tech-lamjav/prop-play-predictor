import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Plus,
  Users,
  ChevronRight,
  ChevronLeft,
  Clock,
  Check,
  LayoutGrid,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserBoloes, useCreateBolao, useJoinBolao, useWcMatches } from '@/hooks/use-bolao';
import { CreateBolaoModal } from '@/components/bolao/CreateBolaoModal';
import { CopaGruposModal } from '@/components/bolao/CopaGruposModal';
import { CopaBracketModal } from '@/components/bolao/CopaBracketModal';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { useToast } from '@/hooks/use-toast';
import AnalyticsNav from '@/components/AnalyticsNav';
import { supabase } from '@/integrations/supabase/client';

const COPA_START = new Date('2026-06-11T12:00:00-03:00');

/**
 * Limite de participantes do plano Free.
 *
 * Mantemos uma constante no front por dois motivos:
 *   1. O DB pode estar com valor stale na coluna `max_participants` se a
 *      migration 052 ainda não foi aplicada — sem isso o card mostraria
 *      "N/10" (errado) até o backfill rodar.
 *   2. Source-of-truth do enforcement continua sendo o RPC `join_bolao_by_code`
 *      (migration 050). Aqui é só display.
 *
 * Se o limite mudar, atualizar AQUI + na migration 050 (enforcement) e
 * 052 (default da coluna).
 */
const FREE_PARTICIPANT_LIMIT = 20;

function daysToCopa() {
  const now = new Date();
  const diff = COPA_START.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDeadline(matches: any[] | undefined, bolao: any) {
  if (!matches) return null;
  // Próximo jogo aberto
  const next = matches
    .filter((m) => !m.is_finished && m.home_team_code !== 'TBD')
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) ||
        a.match_time_brasilia.localeCompare(b.match_time_brasilia)
    )[0];
  if (!next) return null;
  const d = new Date(next.match_date + 'T00:00:00');
  const day = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${day} ${next.match_time_brasilia.slice(0, 5)}`;
}

const BolaoHome: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: boloes, isLoading } = useUserBoloes();
  const { data: matches } = useWcMatches();
  const createBolao = useCreateBolao();
  const joinBolao = useJoinBolao();
  const [showCreate, setShowCreate] = useState(false);
  const [showGrupos, setShowGrupos] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [checkoutRedirecting, setCheckoutRedirecting] = useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | undefined>();

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);

  // Lista de fases pra navegação por setas: Rodada 1/2/3 + mata-mata
  const phases = useMemo(() => {
    if (!matches) return [] as { id: string; label: string; subLabel: string; matches: typeof matches }[];

    const byDateTime = (a: any, b: any) =>
      a.match_date.localeCompare(b.match_date) ||
      a.match_time_brasilia.localeCompare(b.match_time_brasilia);

    // Group stage: divide em rodada 1/2/3 (cada grupo tem 6 jogos = 3 rodadas de 2)
    const byGroup: Record<string, typeof matches> = {};
    matches
      .filter((m) => m.stage === 'group' && m.home_team_code !== 'TBD')
      .forEach((m) => {
        const g = m.group_name!;
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(m);
      });
    Object.values(byGroup).forEach((gm) => gm.sort(byDateTime));

    const round1: typeof matches = [];
    const round2: typeof matches = [];
    const round3: typeof matches = [];
    Object.values(byGroup).forEach((gm) => {
      gm.forEach((m, idx) => {
        if (idx < 2) round1.push(m);
        else if (idx < 4) round2.push(m);
        else round3.push(m);
      });
    });
    [round1, round2, round3].forEach((rm) => rm.sort(byDateTime));

    // Knockout phases (só inclui se já tiver jogos)
    const byStage: Record<string, typeof matches> = {};
    matches
      .filter((m) => m.stage !== 'group')
      .forEach((m) => {
        if (!byStage[m.stage]) byStage[m.stage] = [];
        byStage[m.stage].push(m);
      });
    Object.values(byStage).forEach((rm) => rm.sort(byDateTime));

    const knockoutLabels: Record<string, { label: string; subLabel: string }> = {
      round_of_32: { label: 'Oitavas (32)', subLabel: '27 a 30 de junho' },
      round_of_16: { label: '16 Avos', subLabel: '03 a 05 de julho' },
      quarter: { label: 'Quartas', subLabel: '08 a 11 de julho' },
      semi: { label: 'Semifinal', subLabel: '14 a 15 de julho' },
      third_place: { label: '3º lugar', subLabel: '18 de julho' },
      final: { label: 'Final', subLabel: '19 de julho' },
    };

    const list: { id: string; label: string; subLabel: string; matches: typeof matches }[] = [
      { id: 'r1', label: 'Rodada 1', subLabel: '11 a 14 de junho', matches: round1 },
      { id: 'r2', label: 'Rodada 2', subLabel: '15 a 18 de junho', matches: round2 },
      { id: 'r3', label: 'Rodada 3', subLabel: '19 a 25 de junho', matches: round3 },
    ];
    ['round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final'].forEach((stage) => {
      const ms = byStage[stage] || [];
      if (ms.length > 0) {
        list.push({ id: stage, ...knockoutLabels[stage], matches: ms });
      }
    });

    return list.filter((p) => p.matches.length > 0);
  }, [matches]);

  const [phaseIndex, setPhaseIndex] = useState(0);
  // Reset índice se a lista de fases mudar (matches carregando)
  React.useEffect(() => {
    if (phaseIndex >= phases.length && phases.length > 0) setPhaseIndex(0);
  }, [phases.length, phaseIndex]);
  const currentPhase = phases[phaseIndex];

  const BOLAO_PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_BOLAO as string | undefined;
  const BOLAO_PRO_PAYMENT_LINK = 'https://buy.stripe.com/4gMcMXgG43089uVg6zaR20b';

  const handleCreate = async (data: { name: string; description?: string; plan: 'free' | 'pro' }) => {
    if (data.plan === 'free') {
      createBolao.mutate(
        { name: data.name, description: data.description },
        {
          onSuccess: (bolao) => {
            setShowCreate(false);
            toast({ title: 'Bolão criado!', description: `Código: ${bolao.invite_code}` });
            navigate(`/bolao/${bolao.id}?settings=true`);
          },
          onError: (err: any) => {
            toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' });
          },
        }
      );
      return;
    }

    if (BOLAO_PRO_PRICE_ID) {
      setShowCreate(false);
      setCheckoutRedirecting(true);
      const preGeneratedId = crypto.randomUUID();
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Usuário não autenticado');
        const { data: fnData, error } = await supabase.functions.invoke('stripe-create-checkout', {
          body: {
            priceId: BOLAO_PRO_PRICE_ID,
            productType: 'bolao_premium',
            bolaoId: preGeneratedId,
            bolaoName: data.name,
            bolaoDescription: data.description || null,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw error;
        window.location.href = fnData.url;
      } catch (err: any) {
        setCheckoutRedirecting(false);
        toast({ title: 'Erro ao iniciar checkout', description: err?.message, variant: 'destructive' });
      }
    } else {
      createBolao.mutate(
        { name: data.name, description: data.description },
        {
          onSuccess: (bolao) => {
            setShowCreate(false);
            setCheckoutRedirecting(true);
            window.location.href = `${BOLAO_PRO_PAYMENT_LINK}?client_reference_id=${bolao.id}`;
          },
          onError: (err: any) => {
            toast({ title: 'Erro ao criar bolão', description: err.message, variant: 'destructive' });
          },
        }
      );
    }
  };

  const handleJoin = () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code || code.length < 4) return;
    joinBolao.mutate(code, {
      onSuccess: (result: any) => {
        if (result.success && result.bolao_id) {
          toast({ title: result.message || 'Você entrou no bolão!' });
          navigate(`/bolao/${result.bolao_id}`);
        } else {
          toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
      },
      onError: (err: any) => {
        toast({ title: 'Erro ao entrar', description: err.message, variant: 'destructive' });
      },
    });
  };

  const days = daysToCopa();
  const empty = !isLoading && (!boloes || boloes.length === 0);

  return (
    <>
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ═══ HERO — chamada + dois CTAs (full-width) ═══ */}
        <div className="bg-forest text-white rounded-rebrand-xl p-7 relative overflow-hidden mb-8">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber/10 pointer-events-none" />
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold opacity-60 mb-2">
            Copa do Mundo 2026
          </div>
          <h1 className="font-display text-[40px] sm:text-[48px] leading-[1.05] font-extrabold mb-2">
            {days > 0 ? (
              <>
                Faltam <span className="text-amber">{days} dias</span>.<br />
                Já tá no bolão de quem?
              </>
            ) : (
              <>A Copa começou.<br />Bora palpitar?</>
            )}
          </h1>
          <p className="text-[13px] opacity-75 mb-5 max-w-[460px] leading-relaxed">
            Crie um do zero pra galera ou entre no de um amigo com o código. EUA · México · Canadá · 48 seleções · 104 jogos.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="amber"
              size="lg"
              onClick={() => setShowCreate(true)}
              className="rounded-rebrand-md gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Criar bolão
            </Button>
            <span className="opacity-40 text-[12px] mx-1">ou</span>
            <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-rebrand-md p-1">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Código (ex: ABC123)"
                maxLength={8}
                className="bg-transparent px-3 h-9 text-[13px] text-white placeholder:text-white/40 focus:outline-none w-[160px] sm:w-[180px] font-mono"
              />
              <button
                onClick={handleJoin}
                disabled={inviteCode.trim().length < 4 || joinBolao.isPending}
                className="h-9 px-3 text-[12px] font-semibold bg-white/15 hover:bg-white/25 text-white rounded inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {joinBolao.isPending ? '...' : <>Entrar <ChevronRight className="w-3 h-3" /></>}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ MEUS BOLÕES ═══ */}
        <div className="mb-8">
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="font-display text-[24px] font-bold">Meus bolões</h2>
            {!empty && boloes && (
              <span className="text-[12px] tabular-nums text-ink-2">
                · {boloes.length} ativo{boloes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[180px] rounded-rebrand-xl border border-line animate-pulse bg-canvas-2"
                />
              ))}
            </div>
          ) : empty ? (
            // ESTADO VAZIO — 2 cards-tutorial
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-line rounded-rebrand-xl p-6">
                <div className="w-12 h-12 rounded-rebrand-md bg-canvas-2 border border-forest/20 grid place-items-center text-forest mb-3">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="font-display text-[20px] font-bold mb-1.5 text-ink">Crie um do zero</h3>
                <p className="text-[13px] text-ink-2 leading-relaxed mb-4">
                  Você é o dono. Define a pontuação, convida a galera, customiza com banner. Free pra até 20 pessoas, Premium pra ranking ilimitado e palpites especiais.
                </p>
                <Button
                  variant="forest"
                  onClick={() => setShowCreate(true)}
                  className="rounded-rebrand-md gap-1.5"
                >
                  Criar agora <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="bg-white border border-line rounded-rebrand-xl p-6">
                <div className="w-12 h-12 rounded-rebrand-md bg-amber/10 border border-amber/30 grid place-items-center text-amber-2 mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-display text-[20px] font-bold mb-1.5 text-ink">Entre num bolão</h3>
                <p className="text-[13px] text-ink-2 leading-relaxed mb-4">
                  Pediu o código pro amigo? Cola aqui. Você entra direto, vê o ranking e começa a palpitar.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    placeholder="Código (ex: ABC123)"
                    maxLength={8}
                    className="flex-1 h-10 px-3 text-[13px] font-mono border border-line rounded-rebrand-md focus:outline-none focus:border-forest text-ink placeholder:text-ink-3"
                  />
                  <Button
                    variant="amber"
                    onClick={handleJoin}
                    disabled={inviteCode.trim().length < 4 || joinBolao.isPending}
                    className="rounded-rebrand-md"
                  >
                    Entrar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // COM BOLÕES — cards grandes
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boloes!.map((b) => {
                const total = (b.user_predictions ?? 0) + (b.pending_predictions ?? 0);
                const pct = total > 0 ? Math.round(((b.user_predictions ?? 0) / total) * 100) : 0;
                const podio = b.user_rank > 0 && b.user_rank <= 3 && b.member_count > 1;
                const medalha = b.user_rank === 1 ? '🥇' : b.user_rank === 2 ? '🥈' : b.user_rank === 3 ? '🥉' : null;
                const isCreator = b.owner_id === currentUserId;
                const allDone = pct === 100;
                const proxPrazo = formatDeadline(matches, b);
                const colorTone = b.is_premium ? 'amber' : 'forest';
                return (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/bolao/${b.id}`)}
                    className="bg-white border border-line rounded-rebrand-xl p-5 text-left hover:border-forest/40 hover:shadow-sm transition-all group"
                  >
                    {/* Header: avatar + nome + posição */}
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={`w-12 h-12 rounded-rebrand-md grid place-items-center shrink-0 overflow-hidden ${
                          colorTone === 'amber'
                            ? 'bg-amber/10 border border-amber/30 text-amber-2'
                            : 'bg-canvas-2 border border-forest/20 text-forest'
                        }`}
                      >
                        {b.custom_banner_url ? (
                          <img
                            src={b.custom_banner_url}
                            alt=""
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <Trophy className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <h3 className="font-display text-[20px] font-bold leading-tight truncate text-ink">
                            {b.name}
                          </h3>
                          {b.is_premium && (
                            <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber/15 text-amber-2 border border-amber/30">
                              PREMIUM
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-ink-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {b.is_premium ? b.member_count : `${b.member_count}/${FREE_PARTICIPANT_LIMIT}`}
                          </span>
                          <span className="font-mono opacity-70">#{b.invite_code}</span>
                          {isCreator && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-canvas-2 text-ink-2 border border-line">
                              dono
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Posição */}
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase tracking-wider text-ink-2 mb-0.5">posição</div>
                        <div
                          className={`font-display text-[22px] font-bold leading-none tabular-nums inline-flex items-center gap-1 ${
                            podio ? 'text-forest' : 'text-ink'
                          }`}
                        >
                          {medalha && <span className="text-[20px]">{medalha}</span>}
                          {b.member_count > 1 ? `${b.user_rank}º` : '—'}
                        </div>
                        <div className="text-[11px] tabular-nums text-ink-2 mt-0.5">
                          de {b.member_count}
                        </div>
                      </div>
                    </div>

                    {/* Progress de palpites */}
                    {total > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-2">
                            Seus palpites
                          </span>
                          <span className="text-[12px] tabular-nums">
                            <span className="font-semibold">{b.user_predictions}</span>
                            <span className="text-ink-2">
                              /{total} · {pct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-canvas-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-forest transition-all duration-500"
                            style={{ width: `${pct}%`, opacity: pct === 100 ? 1 : 0.7 }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-line">
                      <div className="flex items-center gap-1 text-[12px]">
                        {allDone ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-status-success" />
                            <span className="text-status-success font-medium">Tudo palpitado</span>
                          </>
                        ) : proxPrazo ? (
                          <>
                            <Clock className="w-3.5 h-3.5 text-status-warning" />
                            <span className="text-ink-2">próx prazo</span>
                            <span className="font-medium tabular-nums text-ink">{proxPrazo}</span>
                          </>
                        ) : (
                          <span className="text-ink-2">Aguardando jogos</span>
                        )}
                      </div>
                      <span className="text-ink-2 group-hover:text-forest transition-colors text-[12px] inline-flex items-center gap-0.5">
                        Abrir <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ TABELA DA COPA — collapse, secundária ═══ */}
        <details className="bg-white border border-line rounded-rebrand-xl overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer list-none flex items-center justify-between hover:bg-canvas-2 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Trophy className="w-4 h-4 text-forest" />
                <span className="font-display text-[18px] font-bold text-ink">Tabela da Copa</span>
              </div>
              <div className="text-[12px] text-ink-2">104 jogos · 12 grupos · do dia 11/06 ao 19/07</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setShowGrupos(true);
                }}
                className="h-8 px-2.5 text-[12px] font-medium text-ink-2 hover:text-ink border border-line rounded-rebrand-sm inline-flex items-center gap-1"
              >
                <LayoutGrid className="w-3 h-3" />
                Grupos
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setShowBracket(true);
                }}
                className="h-8 px-2.5 text-[12px] font-medium text-ink-2 hover:text-ink border border-line rounded-rebrand-sm inline-flex items-center gap-1"
              >
                <GitBranch className="w-3 h-3" />
                Mata-mata
              </button>
              <ChevronRight className="w-4 h-4 text-ink-2 ml-1" />
            </div>
          </summary>
          <div className="border-t border-line">
            {currentPhase ? (
              <>
                {/* Header da fase com setas de navegação */}
                <div className="px-3 py-2.5 bg-canvas-2 border-b border-line flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPhaseIndex((i) => Math.max(0, i - 1))}
                    disabled={phaseIndex === 0}
                    aria-label="Rodada anterior"
                    className="w-9 h-9 grid place-items-center rounded-rebrand-sm text-forest hover:bg-forest/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-forest">
                      {currentPhase.label}
                    </div>
                    {currentPhase.subLabel && (
                      <div className="text-[11px] text-ink-2 mt-0.5">{currentPhase.subLabel}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] tabular-nums text-ink-2 shrink-0">
                      {phaseIndex + 1}/{phases.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPhaseIndex((i) => Math.min(phases.length - 1, i + 1))}
                      disabled={phaseIndex === phases.length - 1}
                      aria-label="Próxima rodada"
                      className="w-9 h-9 grid place-items-center rounded-rebrand-sm text-forest hover:bg-forest/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Lista de jogos da fase atual */}
                <div className="divide-y divide-line">
                  {currentPhase.matches.map((m) => {
                    const dateStr = `${m.match_date.slice(8, 10)}/${m.match_date.slice(5, 7)}`;
                    const timeStr = m.match_time_brasilia.slice(0, 5);
                    return (
                      <div
                        key={m.id}
                        className="px-5 py-2 grid grid-cols-[80px_1fr_auto_60px_auto_1fr_30px] gap-3 items-center text-[13px] hover:bg-canvas-2/50"
                      >
                        <div className="text-[11px] tabular-nums text-ink-2">
                          <span className="font-medium text-ink">{dateStr}</span> {timeStr}
                        </div>
                        <div className="text-right font-medium text-ink truncate">
                          {m.home_team}
                        </div>
                        <TeamFlag code={m.home_team_code} size="md" />
                        {m.is_finished ? (
                          <span className="text-center font-semibold tabular-nums text-ink">
                            {m.home_score}×{m.away_score}
                          </span>
                        ) : (
                          <span className="text-center text-ink-3">×</span>
                        )}
                        <TeamFlag code={m.away_team_code} size="md" />
                        <div className="font-medium text-ink truncate">{m.away_team}</div>
                        <span className="text-[10px] font-bold text-ink-2 text-right">
                          {m.group_name || ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="px-5 py-8 text-center text-ink-2 text-[12px]">
                Carregando jogos…
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Modals */}
      <CreateBolaoModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={handleCreate}
        isLoading={createBolao.isPending}
      />
      <CopaGruposModal open={showGrupos} onOpenChange={setShowGrupos} />
      <CopaBracketModal open={showBracket} onOpenChange={setShowBracket} />

      {/* Lock overlay durante redirect pra Stripe */}
      {checkoutRedirecting && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="bg-white border border-amber/40 rounded-rebrand-xl p-6 max-w-sm text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-[3px] border-amber/30 border-t-amber rounded-full animate-spin" />
            <p className="text-[15px] font-bold text-amber-2 mb-1">Redirecionando para pagamento</p>
            <p className="text-[12px] text-ink-2">
              Aguarde a página da Stripe carregar. Não feche essa janela.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default BolaoHome;
