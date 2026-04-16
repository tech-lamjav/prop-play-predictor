import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Plus,
  Users,
  ChevronRight,
  Hash,
  ArrowRight,
  Zap,
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

function CopaCountdown() {
  const now = new Date();
  const diff = COPA_START.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  if (days === 0) return <span className="text-terminal-blue font-bold text-xl">Hoje!</span>;
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-terminal-blue font-bold text-xl">{days}</span>
      <span className="text-xs opacity-50">dias</span>
    </div>
  );
}

function RankLabel({ rank, memberCount }: { rank: number; memberCount: number }) {
  if (memberCount <= 1) return null;
  const label = `${rank}º lugar`;
  const color =
    rank === 1
      ? 'text-yellow-400'
      : rank === 2
      ? 'text-slate-300'
      : rank === 3
      ? 'text-orange-400'
      : 'opacity-40';
  return <span className={`text-[10px] font-bold ${color}`}>{label}</span>;
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
  const [currentUserId, setCurrentUserId] = React.useState<string | undefined>();

  React.useEffect(() => {
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
    });
  }, []);

  // Group stage matches organised by matchday (Rodada 1/2/3), sorted chronologically.
  // Group letter is shown as a label on each row instead of a section header.
  const matchesByRound = useMemo(() => {
    if (!matches) return {} as Record<string, NonNullable<typeof matches>>;

    const byGroup: Record<string, NonNullable<typeof matches>> = {};
    matches
      .filter((m) => m.group_name && m.home_team_code !== 'TBD')
      .forEach((m) => {
        const g = m.group_name!;
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(m);
      });
    Object.values(byGroup).forEach((gm) =>
      gm.sort(
        (a, b) =>
          a.match_date.localeCompare(b.match_date) ||
          a.match_time_brasilia.localeCompare(b.match_time_brasilia)
      )
    );

    const rounds: Record<string, NonNullable<typeof matches>> = {
      'Rodada 1': [],
      'Rodada 2': [],
      'Rodada 3': [],
    };
    Object.values(byGroup).forEach((gm) => {
      gm.forEach((m, idx) => {
        const key = idx < 2 ? 'Rodada 1' : idx < 4 ? 'Rodada 2' : 'Rodada 3';
        rounds[key].push(m);
      });
    });
    // Sort each round chronologically
    Object.values(rounds).forEach((rm) =>
      rm.sort(
        (a, b) =>
          a.match_date.localeCompare(b.match_date) ||
          a.match_time_brasilia.localeCompare(b.match_time_brasilia)
      )
    );
    return rounds;
  }, [matches]);

  // Stripe: dynamic checkout (preferred) or static payment link (fallback)
  const BOLAO_PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_BOLAO as string | undefined;
  const BOLAO_PRO_PAYMENT_LINK = 'https://buy.stripe.com/4gMcMXgG43089uVg6zaR20b';

  const handleCreate = async (data: { name: string; description?: string; plan: 'free' | 'pro' }) => {
    if (data.plan === 'free') {
      // Free: cria imediatamente e navega
      createBolao.mutate({ name: data.name, description: data.description }, {
        onSuccess: (bolao) => {
          setShowCreate(false);
          toast({ title: 'Bolão criado!', description: `Código: ${bolao.invite_code}` });
          navigate(`/bolao/${bolao.id}?settings=true`);
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' });
        },
      });
      return;
    }

    // Premium — bolão só é criado APÓS confirmação do pagamento no webhook
    if (BOLAO_PRO_PRICE_ID) {
      // Checkout dinâmico: webhook cria o bolão com o UUID pré-gerado
      setShowCreate(false);
      const preGeneratedId = crypto.randomUUID();
      toast({ title: 'Redirecionando para pagamento...', description: 'Bolão Premium criado após confirmação.' });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Usuário não autenticado');
        const { data: fnData, error } = await supabase.functions.invoke('stripe-create-checkout', {
          body: {
            priceId: BOLAO_PRO_PRICE_ID,
            productType: 'bolao_premium',
            bolaoId: preGeneratedId,
            bolaoName: data.name,
            bolaoDescription: data.description || null,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (error) throw error;
        window.location.href = fnData.url;
      } catch (err: any) {
        toast({ title: 'Erro ao iniciar checkout', description: err?.message, variant: 'destructive' });
      }
    } else {
      // Fallback sem Price ID: cria o bolão e redireciona para payment link estático
      // O webhook upgrada via client_reference_id
      createBolao.mutate({ name: data.name, description: data.description }, {
        onSuccess: (bolao) => {
          setShowCreate(false);
          toast({ title: 'Redirecionando para pagamento...', description: 'Aguarde.' });
          window.location.href = `${BOLAO_PRO_PAYMENT_LINK}?client_reference_id=${bolao.id}`;
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao criar bolão', description: err.message, variant: 'destructive' });
        },
      });
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

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      <AnalyticsNav />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Copa 2026 Hero — full width */}
        <div className="terminal-container p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-terminal-blue shrink-0" />
                <h1 className="text-lg font-bold leading-tight">Bolão Copa do Mundo 2026</h1>
              </div>
              <p className="text-xs opacity-40 mb-4">EUA · México · Canadá — 48 seleções, 104 jogos</p>

              <div className="flex items-center gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-40 mb-0.5">Copa começa em</p>
                  <CopaCountdown />
                </div>
                <div className="w-px h-8 bg-terminal-border-subtle" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-40 mb-0.5">Jogos</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-terminal-blue font-bold text-xl">104</span>
                  </div>
                </div>
                <div className="w-px h-8 bg-terminal-border-subtle" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-40 mb-0.5">Grupos</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-terminal-blue font-bold text-xl">12</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">

          {/* LEFT COLUMN */}
          <div className="space-y-4">

            {/* Criar / Entrar — unified card */}
            <div className="terminal-container p-4">
              <p className="text-[10px] uppercase tracking-wider opacity-40 mb-3">Meus Bolões</p>

              {/* Criar + Entrar — same row */}
              <div className="flex gap-2 min-w-0">
                <Button
                  onClick={() => setShowCreate(true)}
                  size="sm"
                  className="bg-transparent border border-terminal-blue text-terminal-blue hover:bg-terminal-blue/10 gap-1 shrink-0 h-[38px] px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Criar</span>
                </Button>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  placeholder="Código de convite"
                  maxLength={8}
                  className="min-w-0 flex-1 bg-terminal-dark-gray border border-terminal-border rounded px-3 py-2 text-sm font-mono placeholder:opacity-30 focus:outline-none focus:border-terminal-blue transition-colors"
                />
                <Button
                  onClick={handleJoin}
                  disabled={inviteCode.trim().length < 4 || joinBolao.isPending}
                  variant="outline"
                  size="sm"
                  className="border-terminal-blue/50 text-terminal-blue hover:bg-terminal-blue/10 gap-1 px-3 h-[38px] shrink-0"
                >
                  {joinBolao.isPending ? (
                    'Entrando...'
                  ) : (
                    <>
                      <span className="hidden sm:inline">Entrar</span> <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Bolões list */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded border border-terminal-border animate-pulse bg-terminal-dark-gray/30"
                  />
                ))}
              </div>
            ) : !boloes || boloes.length === 0 ? (
              <div className="terminal-container p-8 text-center">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <h2 className="text-base font-bold mb-1">Nenhum bolão ainda</h2>
                <p className="text-sm opacity-50">
                  Crie o seu ou peça o código de convite para um amigo
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {boloes.map((bolao) => (
                  <button
                    key={bolao.id}
                    onClick={() => navigate(`/bolao/${bolao.id}`)}
                    className="w-full text-left terminal-container p-4 hover:border-terminal-blue/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-bold text-sm truncate">{bolao.name}</h3>
                          {bolao.is_premium && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold shrink-0">
                              PREMIUM
                            </span>
                          )}
                          {bolao.pending_predictions > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-terminal-blue/15 text-terminal-blue rounded font-bold shrink-0 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" />
                              {bolao.pending_predictions} pendentes
                            </span>
                          )}
                          {!bolao.has_champion_prediction && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded font-bold shrink-0 flex items-center gap-0.5">
                              <Trophy className="w-2.5 h-2.5" />
                              Campeão
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs opacity-50">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {bolao.is_premium
                              ? bolao.member_count
                              : `${bolao.member_count}/${bolao.max_participants}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {bolao.invite_code}
                          </span>
                          {bolao.owner_id === currentUserId && (
                            <span className="text-terminal-green">Criador</span>
                          )}
                          {bolao.is_closed && (
                            <span className="text-terminal-red opacity-80">Fechado</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <RankLabel rank={bolao.user_rank} memberCount={bolao.member_count} />
                          <div className="text-xl font-bold text-terminal-blue leading-tight">
                            {bolao.user_points}
                          </div>
                          <div className="text-[10px] opacity-40">pontos</div>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-70 transition-opacity" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — Copa Info */}
          <div className="terminal-container p-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-wider opacity-40 font-bold">Tabela de Jogos</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowGrupos(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-terminal-border text-xs hover:border-terminal-blue/50 hover:text-terminal-blue transition-colors"
                >
                  <LayoutGrid className="w-3 h-3" />
                  Grupos
                </button>
                <button
                  onClick={() => setShowBracket(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-terminal-border text-xs hover:border-terminal-blue/50 hover:text-terminal-blue transition-colors"
                >
                  <GitBranch className="w-3 h-3" />
                  Mata-mata
                </button>
              </div>
            </div>

            {/* Match schedule grouped by matchday → group */}
            {/* Column header */}
            <div className="flex items-center gap-1.5 pr-3 pb-2 border-b border-terminal-border-subtle mb-2">
              <span className="text-[9px] uppercase opacity-30 w-[76px] shrink-0">Data</span>
              <span className="text-[9px] uppercase opacity-30 w-[68px] shrink-0 text-right">Casa</span>
              <span className="text-[9px] uppercase opacity-30 w-9 shrink-0 text-center"></span>
              <span className="text-[9px] uppercase opacity-30 w-[68px] shrink-0">Fora</span>
              <span className="ml-auto text-[9px] uppercase opacity-30 shrink-0">Gr</span>
            </div>

            <div className="overflow-y-auto max-h-[500px] pr-3 scrollbar-thin">
              {Object.keys(matchesByRound).length === 0 ? (
                <div className="text-center py-6 opacity-30 text-sm">Carregando...</div>
              ) : (
                Object.entries(matchesByRound).map(([roundName, roundMatches], roundIdx) => (
                  <div key={roundName}>
                    {/* Rodada divider */}
                    {roundIdx > 0 && (
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-terminal-border-subtle" />
                      </div>
                    )}
                    <p className="text-[10px] uppercase font-bold tracking-wider text-terminal-blue mb-1.5">
                      {roundName}
                    </p>
                    <div className="space-y-0.5">
                      {roundMatches.map((m) => {
                        const dateStr = new Date(m.match_date + 'T00:00:00').toLocaleDateString(
                          'pt-BR', { day: '2-digit', month: '2-digit' }
                        );
                        const timeStr = m.match_time_brasilia.slice(0, 5);
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center gap-1.5 py-0.5 ${m.is_finished ? 'opacity-50' : ''}`}
                          >
                            <span className="opacity-40 tabular-nums text-[10px] shrink-0 w-[76px]">
                              {dateStr} {timeStr}
                            </span>
                            <div className="flex items-center justify-end gap-1 w-[68px] shrink-0">
                              <span className="font-mono font-bold text-[11px]">{m.home_team_code}</span>
                              <TeamFlag code={m.home_team_code} />
                            </div>
                            {m.is_finished ? (
                              <span className="font-bold text-[11px] w-9 text-center shrink-0">
                                {m.home_score}x{m.away_score}
                              </span>
                            ) : (
                              <span className="opacity-30 w-9 text-center shrink-0 text-[11px]">×</span>
                            )}
                            <div className="flex items-center gap-1 w-[68px] shrink-0">
                              <TeamFlag code={m.away_team_code} />
                              <span className="font-mono font-bold text-[11px]">{m.away_team_code}</span>
                            </div>
                            <span className="ml-auto text-[9px] font-bold opacity-30 shrink-0">
                              {m.group_name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default BolaoHome;
