import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Trophy, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJoinBolao } from '@/hooks/use-bolao';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

const BolaoJoin: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const joinBolao = useJoinBolao();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [bolaoId, setBolaoId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setMessage('Código de convite inválido');
      return;
    }

    joinBolao.mutate(code, {
      onSuccess: (result) => {
        if (result.success) {
          setStatus('success');
          setMessage(result.already_member ? 'Você já está neste bolão!' : 'Você entrou no bolão!');
          setBolaoId(result.bolao_id || null);
        } else {
          setStatus('error');
          setMessage(result.error || 'Erro ao entrar no bolão');
        }
      },
      onError: (err: any) => {
        setStatus('error');
        setMessage(err.message || 'Erro ao entrar no bolão');
      },
    });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // OG image dinâmica gerada pela edge function og-bolao
  const ogImageUrl = code && SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/og-bolao?invite=${encodeURIComponent(code.toUpperCase())}`
    : null;

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text flex items-center justify-center">
      {/* SEO + OG meta — preview rico em WhatsApp/Telegram/etc quando colam o link */}
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

      <div className="max-w-sm w-full mx-4">
        <div className="terminal-container p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-terminal-green" />
              <h2 className="text-lg font-bold mb-2">Entrando no bolão...</h2>
              <p className="text-sm opacity-50">Código: {code}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-terminal-green" />
              <h2 className="text-lg font-bold mb-2">{message}</h2>
              <Button
                onClick={() => navigate(bolaoId ? `/bolao/${bolaoId}` : '/bolao')}
                className="mt-4 bg-terminal-green text-terminal-bg hover:bg-terminal-green/90 gap-2"
              >
                <Trophy className="w-4 h-4" />
                {bolaoId ? 'Ver bolão' : 'Meus bolões'}
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-terminal-red" />
              <h2 className="text-lg font-bold mb-2">Ops!</h2>
              <p className="text-sm opacity-70 mb-4">{message}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="ghost" onClick={() => navigate('/bolao')}>
                  Meus bolões
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BolaoJoin;
