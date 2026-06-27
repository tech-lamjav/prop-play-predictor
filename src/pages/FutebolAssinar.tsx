import AnalyticsNav from '@/components/AnalyticsNav';
import { useNavigate } from 'react-router-dom';
import { Check, Lock } from 'lucide-react';

const PERKS = [
  'Picks de valor dos 5 mercados (Resultado, Gols, Handicap, Ambos marcam, Dupla chance)',
  'Score de Confiabilidade e o "Por quê" de cada aposta',
  'Oportunidades do dia ranqueadas, atualizadas de hora em hora',
];

/**
 * Placeholder de assinatura do Futebol (SKU próprio). Fase 2 troca pelo
 * checkout do Stripe. Por ora, captura de interesse / "em breve".
 */
export default function FutebolAssinar() {
  const navigate = useNavigate();
  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <div className="max-w-xl w-full mx-auto px-4 md:px-6 py-10 flex-1">
        <div className="bg-white border border-line rounded-2xl p-6 md:p-8">
          <span className="w-11 h-11 rounded-full bg-forest text-canvas grid place-items-center"><Lock className="w-5 h-5" /></span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Assine o Futebol</h1>
          <p className="mt-1 text-sm text-ink-2">
            Destrave as oportunidades de valor. O resto da análise (Score, jogos, tabela, perfil dos times) continua livre.
          </p>

          <ul className="mt-5 space-y-2.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[13px] text-ink">
                <Check className="w-4 h-4 text-forest mt-0.5 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-rebrand-md border border-amber/40 bg-amber/10 px-4 py-3 text-[12px] text-amber-2">
            Pagamento em breve. Estamos finalizando os planos — por enquanto, o acesso é via teste grátis de 7 dias.
          </div>

          <button
            onClick={() => navigate('/futebol')}
            className="mt-6 w-full inline-flex items-center justify-center rounded-rebrand-sm bg-forest text-canvas text-sm font-bold h-11 hover:bg-forest-2 transition"
          >
            Voltar pro Futebol
          </button>
        </div>
      </div>
    </div>
  );
}
