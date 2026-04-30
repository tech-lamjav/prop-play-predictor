import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Trophy,
  Check,
  AlertCircle,
  Users,
  Clock,
  Sparkles,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJoinBolao, useBolao, useUserBoloes } from '@/hooks/use-bolao';
import AnalyticsNav from '@/components/AnalyticsNav';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

const BolaoJoin: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const joinBolao = useJoinBolao();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [retryCode, setRetryCode] = useState('');

  // 2ª chamada: detalhes do bolão (após join success)
  const { data: bolaoData } = useBolao(bolaoId || undefined);
  // Pra pegar pending_predictions do user nesse bolão
  const { data: userBoloes } = useUserBoloes();
  const userBolao = userBoloes?.find((b) => b.id === bolaoId);
  const pendingPredictions = userBolao?.pending_predictions ?? 0;

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMessage('Código de convite inválido');
      return;
    }

    joinBolao.mutate(code, {
      onSuccess: (result) => {
        if (result.success) {
          setStatus('success');
          setBolaoId(result.bolao_id || null);
        } else {
          setStatus('error');
          setErrorMessage(result.error || 'Erro ao entrar no bolão');
        }
      },
      onError: (err: any) => {
        setStatus('error');
        setErrorMessage(err.message || 'Erro ao entrar no bolão');
      },
    });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    const trimmed = retryCode.trim().toUpperCase();
    if (trimmed.length < 4) return;
    navigate(`/bolao/entrar/${trimmed}`);
  };

  // OG image dinâmica gerada pela edge function og-bolao
  const ogImageUrl =
    code && SUPABASE_URL
      ? `${SUPABASE_URL}/functions/v1/og-bolao?invite=${encodeURIComponent(code.toUpperCase())}`
      : null;

  return (
    <>
      <AnalyticsNav />
      <Helmet>
        <title>Entrar no Bolão Copa 2026 | Smart Betting</title>
        <meta name="description" content="Você foi convidado pra um bolão da Copa 2026. Entre em 1 clique e palpite os 104 jogos." />
        {ogImageUrl && (
          <>
            <meta property="og:image" content={ogImageUrl} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:type" content="website" />
            <meta property="og:title" content="Bolão Copa 2026 — Entre na disputa" />
            <meta property="og:description" content="104 jogos, palpite de campeão, ranking ao vivo." />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:image" content={ogImageUrl} />
          </>
        )}
      </Helmet>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16">
        {/* Badge identidade do bolão acima do card (Smart Betting já está no nav) */}
        <div className="mb-5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-rebrand-sm bg-forest grid place-items-center text-amber">
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-2 font-semibold">
            Bolão Copa do Mundo 2026
          </span>
        </div>

        <div className="w-full max-w-[460px]">
        {/* ─── LOADING ─── */}
        {status === 'loading' && (
          <div className="bg-white rounded-rebrand-xl border border-line shadow-sm p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full border-[3px] border-line border-t-forest animate-spin shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-ink leading-tight">Verificando convite…</p>
                <p className="text-[12px] text-ink-2 mt-0.5">
                  código <span className="font-mono font-semibold text-ink">{code?.toUpperCase()}</span>
                </p>
              </div>
            </div>
            <div className="rounded-rebrand-lg border border-line bg-canvas p-5">
              <div className="h-5 w-44 bg-canvas-2 rounded animate-pulse mb-3" />
              <div className="h-3 w-28 bg-canvas-2 rounded animate-pulse" />
            </div>
          </div>
        )}

        {/* ─── SUCCESS ─── */}
        {status === 'success' && (
          <div className="bg-white rounded-rebrand-xl border border-line shadow-sm overflow-hidden">
            {/* Banner verde */}
            <div className="bg-forest px-6 py-5 text-white relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-amber/15 pointer-events-none" />
              <div className="absolute top-6 right-12 w-12 h-12 rounded-full bg-amber/15 pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber text-forest flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[15px] font-bold leading-tight">Você entrou!</p>
                  <p className="text-[12px] opacity-80 mt-0.5">Bem-vindo ao bolão</p>
                </div>
              </div>
            </div>

            {/* Preview do bolão */}
            <div className="p-5">
              {bolaoData ? (
                <div className="rounded-rebrand-lg border border-line bg-canvas p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-rebrand-md flex items-center justify-center shrink-0 ${
                        bolaoData.is_premium ? 'bg-amber text-forest' : 'bg-forest text-white'
                      }`}
                    >
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-ink leading-tight">
                        {bolaoData.name}
                      </p>
                      {bolaoData.description && (
                        <p className="text-[12px] text-ink-2 mt-0.5 truncate">
                          {bolaoData.description}
                        </p>
                      )}
                      {bolaoData.is_premium && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-2 bg-amber/15 px-2 py-0.5 rounded">
                          <Sparkles className="w-2.5 h-2.5" /> Premium
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div className="flex items-center gap-2 text-ink">
                      <Users className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                      <span>
                        <span className="font-semibold tabular-nums">
                          {userBolao?.member_count ?? '—'}
                        </span>{' '}
                        participantes
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-ink">
                      <Clock className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                      <span>
                        Código{' '}
                        <span className="font-mono font-semibold tabular-nums">
                          {bolaoData.invite_code}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                // Loading do preview enquanto useBolao busca
                <div className="rounded-rebrand-lg border border-line bg-canvas p-5">
                  <div className="h-5 w-44 bg-canvas-2 rounded animate-pulse mb-3" />
                  <div className="h-3 w-28 bg-canvas-2 rounded animate-pulse" />
                </div>
              )}

              {/* Pendências de palpites */}
              {pendingPredictions > 0 && (
                <div className="mt-4 rounded-rebrand-md border border-amber/40 bg-amber/[0.08] px-3.5 py-2.5 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-2 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-ink leading-snug">
                    <span className="font-semibold">
                      Você tem {pendingPredictions} jogo{pendingPredictions !== 1 ? 's' : ''} para palpitar.
                    </span>{' '}
                    Comece agora — leva poucos minutos.
                  </p>
                </div>
              )}

              {/* CTAs */}
              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate(`/bolao/${bolaoId}`)}
                  className="flex-1 h-11 rounded-rebrand-md text-[13px] font-medium text-ink-2 hover:bg-canvas-2 border border-line transition-colors"
                >
                  Ver depois
                </button>
                <Button
                  variant="forest"
                  onClick={() => navigate(`/bolao/${bolaoId}/palpites`)}
                  className="flex-[2] h-11 rounded-rebrand-md text-[13px] gap-2"
                >
                  <Target className="w-4 h-4" />
                  Fazer meus palpites
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ERROR ─── */}
        {status === 'error' && (
          <div className="bg-white rounded-rebrand-xl border border-line shadow-sm overflow-hidden">
            {/* Banner escuro */}
            <div className="bg-ink px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-status-danger/20 border border-status-danger/40 text-status-danger flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[15px] font-bold leading-tight">Convite não encontrado</p>
                  {code && (
                    <p className="text-[12px] opacity-60 mt-0.5">
                      código <span className="font-mono">{code.toUpperCase()}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-[13px] text-ink leading-relaxed">
                {errorMessage || (
                  <>
                    Esse código pode ter <span className="font-semibold">expirado</span>, ou o dono{' '}
                    <span className="font-semibold">encerrou as inscrições</span>. Pede pra ele um link novo.
                  </>
                )}
              </p>

              {/* Possíveis causas */}
              <div className="rounded-rebrand-md border border-line bg-canvas p-3.5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2">
                  Por que pode ter dado erro
                </p>
                <ul className="text-[12px] text-ink space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-ink-3 mt-0.5">·</span>
                    O bolão está com inscrições encerradas pelo dono
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ink-3 mt-0.5">·</span>
                    Você digitou o código errado (cheque com quem te chamou)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ink-3 mt-0.5">·</span>
                    O bolão foi deletado ou está cheio
                  </li>
                </ul>
              </div>

              {/* Tentar de novo */}
              <div>
                <label
                  htmlFor="retry-code"
                  className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-2 mb-1.5 block"
                >
                  Tentar outro código
                </label>
                <div className="flex gap-2">
                  <input
                    id="retry-code"
                    value={retryCode}
                    onChange={(e) => setRetryCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleRetry()}
                    placeholder="ex: ABC12345"
                    maxLength={8}
                    className="flex-1 h-11 px-3.5 rounded-rebrand-md border border-line bg-white text-[14px] text-ink font-mono uppercase tracking-wider placeholder:text-ink-3 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none"
                  />
                  <Button
                    variant="forest"
                    onClick={handleRetry}
                    disabled={retryCode.trim().length < 4}
                    className="h-11 px-4 rounded-rebrand-md text-[13px]"
                  >
                    Entrar
                  </Button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/bolao')}
                className="w-full h-10 rounded-rebrand-md text-[12px] text-ink-2 hover:bg-canvas-2 border border-line transition-colors"
              >
                Voltar para meus bolões
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </>
  );
};

export default BolaoJoin;
