// ============================================================
// RegistrarAposta — cross-sell Futebol → Betinho (Apostas)
// ============================================================
// CTA "Apostou nessa oportunidade? Registre sua aposta" + modal que grava
// direto em public.bets (mesma tabela do Betinho), já com os campos da
// oportunidade preenchidos. O usuário só confirma a stake e, se pegou outra
// odd, ajusta. Espelha o insert de createBet (Bets.tsx): bet_type 'single',
// potential_return calculado, status 'pending'. channel 'futebol' p/ atribuição.
// Só aparece quando o pick está visível (não bloqueado) — i.e. trial/assinante.
// ============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Check, Loader2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { createClient } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { pickLabel, marketLabel } from '@/utils/futebol-score';
import type { FutebolBetDraft } from './registrar-aposta-utils';

const COMP_LABEL: Record<string, string> = { brasileirao: 'Brasileirão', copa_mundo: 'Copa do Mundo' };

function kickoffDate(raw: string | null): string | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function RegistrarApostaModal({
  open, onOpenChange, draft,
}: { open: boolean; onOpenChange: (o: boolean) => void; draft: FutebolBetDraft | null }) {
  const { user } = useAuth();
  const [stake, setStake] = useState('');
  const [odd, setOdd] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && draft) {
      setStake('');
      setOdd(draft.bestOdd ? draft.bestOdd.toFixed(2) : '');
      setDone(false); setError(null); setSaving(false);
    }
  }, [open, draft]);

  const pick = draft ? pickLabel(draft.market, draft.outcome, draft.lineValue, draft.homeName, draft.awayName) : '';
  const match = draft ? `${draft.homeName} x ${draft.awayName}` : '';
  const mkt = draft ? marketLabel(draft.market) : '';
  const league = draft ? (COMP_LABEL[draft.competition] || draft.competition) : '';

  const stakeN = parseFloat(stake.replace(',', '.'));
  const oddN = parseFloat(odd.replace(',', '.'));
  const valid = !isNaN(stakeN) && stakeN > 0 && !isNaN(oddN) && oddN > 1;
  const retorno = valid ? stakeN * oddN : null;

  const handleSave = async () => {
    if (!draft || !user?.id || !valid) return;
    setSaving(true); setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('bets').insert({
        user_id: user.id,
        bet_type: 'single',
        bet_description: pick,
        match_description: match,
        sport: 'Futebol',
        league,
        betting_market: mkt,
        odds: oddN,
        stake_amount: stakeN,
        potential_return: stakeN * oddN,
        is_credit_bet: false,
        bet_date: new Date().toISOString(),
        match_date: kickoffDate(draft.kickoffUtc),
        status: 'pending',
        channel: 'futebol',
      });
      if (err) throw err;
      setDone(true);
    } catch {
      setError('Não foi possível registrar a aposta. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-bolao bg-white border-line p-0 gap-0 max-w-md overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-forest">
            <Receipt className="w-3.5 h-3.5" /> Registrar no Betinho
          </div>
          <p className="text-[12px] text-ink-3 mt-1">Salva no seu controle de apostas com os campos já preenchidos.</p>
        </div>

        {done ? (
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <span className="w-12 h-12 rounded-full bg-forest/10 text-forest grid place-items-center"><Check className="w-6 h-6" /></span>
            <div className="text-[16px] font-bold text-ink">Aposta registrada</div>
            <p className="text-[13px] text-ink-2 leading-snug">
              <b className="text-ink">{pick}</b> · {fmtBRL(stakeN)} @ {oddN.toFixed(2)} já está no seu Betinho como pendente.
            </p>
            <div className="flex items-center gap-2 mt-1 w-full">
              <button onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-rebrand-sm border border-line text-[13px] font-semibold text-ink hover:bg-canvas-2 transition">Fechar</button>
              <Link to="/bets" className="flex-1 h-10 rounded-rebrand-sm bg-forest text-canvas text-[13px] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-forest-2 transition">
                Ver no Betinho <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {/* Resumo do pick (read-only) */}
            <div className="rounded-rebrand-md bg-canvas-2 border border-line p-3.5">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 h-5 inline-flex items-center rounded text-[9px] font-semibold uppercase tracking-[0.08em] bg-white text-ink-2 border border-line">{mkt}</span>
                <span className="text-[11px] text-ink-3 truncate">{league}</span>
              </div>
              <div className="text-[17px] font-bold tracking-tight text-ink mt-1.5 leading-tight">{pick}</div>
              <div className="text-[12px] text-ink-3 mt-0.5">{match}</div>
            </div>

            {/* Stake + Odd */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-3">Valor (R$)</span>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0" placeholder="0,00"
                  value={stake} onChange={(e) => setStake(e.target.value)} autoFocus
                  className="h-11 px-3 rounded-rebrand-sm border border-line bg-white text-[15px] font-semibold text-ink tabular-nums focus:outline-none focus:border-forest"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-3">Odd</span>
                <input
                  type="number" inputMode="decimal" step="0.01" min="1" placeholder="1.00"
                  value={odd} onChange={(e) => setOdd(e.target.value)}
                  className="h-11 px-3 rounded-rebrand-sm border border-line bg-white text-[15px] font-semibold text-ink tabular-nums focus:outline-none focus:border-forest"
                />
              </label>
            </div>
            <p className="text-[11px] text-ink-3 -mt-2">Pegou outra odd? Ajuste acima — preenchemos com a melhor que encontramos ({draft?.bestOdd.toFixed(2)}).</p>

            {/* Retorno potencial */}
            <div className="flex items-center justify-between rounded-rebrand-sm bg-forest/5 border border-forest/15 px-3.5 py-2.5">
              <span className="text-[12px] text-ink-2">Retorno potencial</span>
              <span className="text-[16px] font-bold tabular-nums text-forest">{retorno != null ? fmtBRL(retorno) : '—'}</span>
            </div>

            {error && <p className="text-[12px] text-status-danger">{error}</p>}
            {!user && <p className="text-[12px] text-amber-2">Entre na sua conta para registrar a aposta.</p>}

            <button
              onClick={handleSave}
              disabled={!valid || saving || !user}
              className={`h-11 rounded-rebrand-sm text-[14px] font-bold inline-flex items-center justify-center gap-2 transition ${
                !valid || saving || !user ? 'bg-canvas-2 text-ink-3 cursor-default' : 'bg-forest text-canvas hover:bg-forest-2'
              }`}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</> : <>Registrar aposta</>}
            </button>
            <p className="text-[10px] text-ink-3 text-center -mt-1">Controle pessoal de apostas. Não é recomendação nem garantia de retorno.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * CTA que abre o modal de registro. Gerencia seu próprio estado.
 * - 'footer': rodapé editorial (faixa canvas-2 + label + botão sólido forest).
 *   Pensado pra ser o ÚLTIMO filho de um card (rounded/overflow-hidden) — Jogo.
 * - 'text': linha discreta (estilo bolão) — usada FORA da área clicável da linha/card
 *   da Oportunidades, pra não disparar a navegação e só abrir o modal.
 */
export function RegistrarApostaCTA({ draft, variant = 'footer' }: { draft: FutebolBetDraft; variant?: 'footer' | 'text' }) {
  const [open, setOpen] = useState(false);
  const trigger = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); setOpen(true); };

  return (
    <>
      {variant === 'footer' && (
        <div className="flex items-center flex-wrap gap-x-3 gap-y-2 px-5 md:px-6 py-3 border-t border-line" style={{ background: 'var(--canvas-2)' }}>
          <span className="text-[13px] font-semibold text-ink">Apostou nessa oportunidade?</span>
          <button type="button" onClick={trigger}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-rebrand-sm bg-forest text-canvas text-[12px] font-bold hover:bg-forest-2 transition">
            Registrar no Betinho <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {variant === 'text' && (
        <span className="text-[11px] text-ink-3">
          Apostou nessa oportunidade?{' '}
          <button type="button" onClick={trigger} className="text-forest font-semibold hover:underline underline-offset-2">
            Registre no Betinho
          </button>
        </span>
      )}

      <RegistrarApostaModal open={open} onOpenChange={setOpen} draft={draft} />
    </>
  );
}
