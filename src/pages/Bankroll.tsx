import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';
import AnalyticsNav from '@/components/AnalyticsNav';
import { CashFlowTable } from '../components/bets/CashFlowTable';
import { useUserUnit } from '@/hooks/use-user-unit';
import { useCapitalMovements, type CapitalMovement } from '@/hooks/use-capital-movements';
import { createClient } from '../integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowDownCircle, ArrowUpCircle, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Bet {
  id: string;
  user_id: string;
  bet_type: string;
  sport: string;
  league?: string;
  match_description?: string;
  bet_description: string;
  odds: number;
  stake_amount: number;
  potential_return: number;
  status: 'pending' | 'won' | 'lost' | 'void' | 'cashout' | 'half_won' | 'half_lost';
  bet_date: string;
  match_date?: string;
  created_at: string;
  updated_at: string;
  raw_input?: string;
  processed_data?: any;
  cashout_amount?: number;
  cashout_date?: string;
  cashout_odds?: number;
  is_cashout?: boolean;
  channel?: string;
  tags?: Tag[];
}

const parseDateString = (dateString: string): Date | undefined => {
  if (!dateString) return undefined;
  const date = parse(dateString, 'yyyy-MM-dd', new Date());
  return isValid(date) ? date : undefined;
};

const formatDateToString = (date: Date | undefined): string => {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
};

export default function Bankroll() {
  const { user, isLoading: authLoading } = useAuth();
  const { config, formatCurrency } = useUserUnit();
  const { movements: capitalMovements, addMovement, updateMovement, deleteMovement, fetchMovements } = useCapitalMovements(user?.id);
  const { toast } = useToast();
  const supabase = createClient();
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<CapitalMovement | null>(null);
  const [movementType, setMovementType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDesc, setMovementDesc] = useState('');
  const [movementDate, setMovementDate] = useState('');
  const [movementDatePopoverOpen, setMovementDatePopoverOpen] = useState(false);
  const [movementSaving, setMovementSaving] = useState(false);
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchBets();
    }
  }, [user?.id]);

  const fetchBets = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch tags for each bet
      const betsWithTags = await Promise.all(
        (data || []).map(async (bet) => {
          const { data: tags } = await supabase.rpc('get_bet_tags', { p_bet_id: bet.id });
          return { ...bet, tags: tags || [] };
        })
      );

      setBets(betsWithTags as any);
    } catch (err) {
      console.error('Error fetching bets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="theme-rebrand min-h-screen bg-canvas text-ink flex items-center justify-center">
        <div className="text-ink-2 text-[13px]">Carregando...</div>
      </div>
    );
  }

  const handleSaveMovement = async () => {
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0) return;
    setMovementSaving(true);
    try {
      if (editingMovement) {
        await updateMovement(editingMovement.id, {
          type: movementType,
          amount,
          description: movementDesc.trim() || undefined,
          movement_date: movementDate ? new Date(movementDate).toISOString() : undefined,
        });
        toast({ title: 'Movimentação atualizada.', variant: 'default' });
      } else {
        await addMovement({
          type: movementType,
          amount,
          description: movementDesc.trim() || undefined,
          movement_date: movementDate ? new Date(movementDate).toISOString() : undefined,
          source: 'manual',
          affects_balance: true,
        });
        toast({ title: 'Movimentação adicionada.', variant: 'default' });
      }
      setMovementModalOpen(false);
      setEditingMovement(null);
      setMovementAmount('');
      setMovementDesc('');
      setMovementDate('');
      fetchMovements();
    } catch {
      toast({ title: 'Erro ao salvar movimentação.', variant: 'destructive' });
    } finally {
      setMovementSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMovementId) return;
    setDeleteConfirming(true);
    try {
      await deleteMovement(deletingMovementId);
      toast({ title: 'Movimentação excluída.', variant: 'default' });
      setDeletingMovementId(null);
      fetchMovements();
    } catch {
      toast({ title: 'Erro ao excluir movimentação.', variant: 'destructive' });
    } finally {
      setDeleteConfirming(false);
    }
  };

  return (
    <div className="theme-rebrand w-full min-h-screen bg-canvas text-ink">
      <AnalyticsNav variant="rebrand" showBack />

      {/* Page Header */}
      <div className="bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.2em] text-ink-2 uppercase">Banca</div>
            <h1 className="text-[28px] font-semibold tracking-tight text-ink mt-1">Minha banca</h1>
            <p className="text-[13px] text-ink-2 mt-1">Visão geral, evolução e histórico de movimentações</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingMovement(null);
                setMovementType('withdrawal');
                setMovementAmount('');
                setMovementDesc('');
                setMovementDate('');
                setMovementModalOpen(true);
              }}
              className="h-9 px-3 inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors"
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>Resgate</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingMovement(null);
                setMovementType('deposit');
                setMovementAmount('');
                setMovementDesc('');
                setMovementDate('');
                setMovementModalOpen(true);
              }}
              className="h-9 px-4 inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-forest hover:bg-forest-soft rounded-md transition-colors"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>Aporte</span>
            </button>
          </div>
        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-6 focus:outline-none space-y-6">
        {/* KPIs — Resumo da banca */}
        {(() => {
          const startBalance = config.bank_amount ?? 0;
          const totalDeposits = capitalMovements
            .filter((m) => m.type === 'deposit' && m.affects_balance && m.source !== 'bankroll_edit')
            .reduce((sum, m) => sum + m.amount, 0);
          const totalWithdrawals = capitalMovements
            .filter((m) => m.type === 'withdrawal' && m.affects_balance && m.source !== 'bankroll_edit')
            .reduce((sum, m) => sum + m.amount, 0);
          const betProfit = bets
            .filter((bet) => ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(bet.status))
            .reduce((sum, bet) => {
              if (bet.status === 'won') return sum + (bet.potential_return - bet.stake_amount);
              if (bet.status === 'lost') return sum - bet.stake_amount;
              if (bet.status === 'cashout' && bet.cashout_amount) return sum + (bet.cashout_amount - bet.stake_amount);
              if (bet.status === 'half_won') return sum + (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
              if (bet.status === 'half_lost') return sum - bet.stake_amount / 2;
              return sum;
            }, 0);
          const currentBalance = startBalance + totalDeposits - totalWithdrawals + betProfit;
          const profitPct = startBalance > 0 ? (betProfit / startBalance) * 100 : 0;

          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-line rounded-lg p-4">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Saldo atual</div>
                <div className="text-[22px] font-semibold tabular text-ink mt-1 leading-tight">{formatCurrency(currentBalance)}</div>
                <div className="text-[11px] text-ink-2 mt-0.5">base {formatCurrency(startBalance)}</div>
              </div>
              <div className="bg-white border border-line rounded-lg p-4">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Total aportado</div>
                <div className="text-[22px] font-semibold tabular text-status-success mt-1 leading-tight">+{formatCurrency(totalDeposits)}</div>
                <div className="text-[11px] text-ink-2 mt-0.5">
                  {capitalMovements.filter(m => m.type === 'deposit' && m.source !== 'bankroll_edit').length} {capitalMovements.filter(m => m.type === 'deposit' && m.source !== 'bankroll_edit').length === 1 ? 'depósito' : 'depósitos'}
                </div>
              </div>
              <div className="bg-white border border-line rounded-lg p-4">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Total retirado</div>
                <div className={`text-[22px] font-semibold tabular mt-1 leading-tight ${totalWithdrawals > 0 ? 'text-status-danger' : 'text-ink-2'}`}>
                  {totalWithdrawals > 0 ? `-${formatCurrency(totalWithdrawals)}` : formatCurrency(0)}
                </div>
                <div className="text-[11px] text-ink-2 mt-0.5">
                  {capitalMovements.filter(m => m.type === 'withdrawal' && m.source !== 'bankroll_edit').length} {capitalMovements.filter(m => m.type === 'withdrawal' && m.source !== 'bankroll_edit').length === 1 ? 'saque' : 'saques'}
                </div>
              </div>
              <div className="bg-white border border-line rounded-lg p-4">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Lucro acumulado</div>
                <div className={`text-[22px] font-semibold tabular mt-1 leading-tight ${betProfit >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                  {betProfit >= 0 ? '+' : ''}{formatCurrency(betProfit)}
                </div>
                <div className="text-[11px] text-ink-2 mt-0.5">
                  {startBalance > 0 ? `${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(1)}% sobre a banca` : 'sobre as apostas'}
                </div>
              </div>
            </div>
          );
        })()}

        <CashFlowTable
          bets={bets}
          initialBankroll={config.bank_amount}
          formatCurrency={formatCurrency}
          capitalMovements={capitalMovements}
          onEditCapitalMovement={(id) => {
            const m = capitalMovements.find((x) => x.id === id);
            if (m && m.source === 'manual') {
              setEditingMovement(m);
              setMovementType(m.type);
              setMovementAmount(m.amount.toString());
              setMovementDesc(m.description ?? '');
              setMovementDate(m.movement_date ? m.movement_date.slice(0, 10) : '');
              setMovementModalOpen(true);
            }
          }}
          onDeleteCapitalMovement={(id) => setDeletingMovementId(id)}
          canEditMovement={(id) => capitalMovements.find((m) => m.id === id)?.source === 'manual'}
        />
      </main>

      <Dialog
        open={movementModalOpen}
        onOpenChange={(open) => {
          if (!open) setEditingMovement(null);
          setMovementModalOpen(open);
        }}
      >
        <DialogContent className="theme-rebrand bg-white border-line text-ink sm:max-w-md shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)]">
          <DialogHeader>
            <div className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${movementType === 'deposit' ? 'text-status-success' : 'text-status-danger'}`}>
              {movementType === 'deposit' ? 'Aporte' : 'Resgate'}
            </div>
            <DialogTitle className="text-[18px] font-semibold tracking-tight text-ink">
              {editingMovement
                ? movementType === 'deposit'
                  ? 'Editar aporte'
                  : 'Editar resgate'
                : movementType === 'deposit'
                  ? 'Adicionar aporte'
                  : 'Adicionar resgate'}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-ink-2">
              {editingMovement
                ? 'Altere os dados da movimentação.'
                : movementType === 'deposit'
                  ? 'Registre um aporte de capital na sua banca.'
                  : 'Registre um resgate de capital da sua banca.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">Valor</Label>
              <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
                <span className="pl-3 pr-1 text-[13px] text-ink-2 font-medium">R$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  autoComplete="off"
                  className="flex-1 h-9 bg-transparent border-0 text-ink text-[13px] tabular focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">Data</Label>
              <Popover open={movementDatePopoverOpen} onOpenChange={setMovementDatePopoverOpen} modal>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full h-10 px-3 inline-flex items-center bg-canvas border border-line rounded-md text-[13px] text-ink hover:border-forest/30 focus:border-forest/50 focus:ring-2 focus:ring-forest/10 outline-none transition-colors"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-forest" />
                    {(() => {
                      const date = parseDateString(movementDate);
                      return date ? (
                        <span className="tabular">{format(date, 'dd/MM/yyyy', { locale: ptBR })}</span>
                      ) : (
                        <span className="text-ink-2">Selecione a data</span>
                      );
                    })()}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                  <CalendarComponent
                    mode="single"
                    selected={parseDateString(movementDate) || undefined}
                    onSelect={(date) => {
                      setMovementDate(formatDateToString(date));
                      setMovementDatePopoverOpen(false);
                    }}
                    initialFocus
                    className="bg-white"
                    classNames={{
                      caption_label: 'text-sm font-semibold text-ink',
                      nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-ink-3/40 hover:text-ink rounded-md inline-flex items-center justify-center',
                      head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                      day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-ink-3/40 rounded-md aria-selected:opacity-100',
                      day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                      day_today: 'bg-ink-3 text-ink font-semibold',
                      day_outside: 'text-ink-2 opacity-40',
                      day_disabled: 'text-ink-2 opacity-30',
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">Descrição <span className="normal-case tracking-normal text-ink-2/70 font-normal">(opcional)</span></Label>
              <Input
                id="desc"
                type="text"
                placeholder={movementType === 'deposit' ? 'Ex: Depósito mensal' : 'Ex: Saque para conta'}
                value={movementDesc}
                onChange={(e) => setMovementDesc(e.target.value)}
                autoComplete="off"
                className="h-10 bg-canvas border-line text-ink text-[13px] focus-visible:border-forest/50 focus-visible:ring-2 focus-visible:ring-forest/10"
              />
            </div>
            <Button
              onClick={handleSaveMovement}
              disabled={movementSaving || !movementAmount || parseFloat(movementAmount) <= 0}
              className="w-full h-10 bg-forest hover:bg-forest-soft text-white font-semibold disabled:opacity-50"
            >
              {movementSaving ? 'Salvando...' : editingMovement ? 'Salvar alterações' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingMovementId !== null} onOpenChange={(open) => !open && setDeletingMovementId(null)}>
        <AlertDialogContent className="theme-rebrand bg-white border-line text-ink shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)]">
          <AlertDialogHeader>
            <div className="text-[11px] uppercase tracking-[0.16em] text-status-danger font-semibold">Excluir</div>
            <AlertDialogTitle className="text-[18px] font-semibold tracking-tight text-ink">Excluir movimentação</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-ink-2">
              Excluir este aporte/resgate? O saldo será recalculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteConfirming}
              className="h-9 px-4 text-[13px] font-medium text-ink-2 hover:text-ink border-line bg-white hover:bg-ink-3/40"
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={deleteConfirming}
              onClick={handleConfirmDelete}
              className="h-9 px-4 text-[13px] font-semibold text-white bg-status-danger hover:bg-status-danger/90"
            >
              {deleteConfirming ? 'Excluindo...' : 'Excluir'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
