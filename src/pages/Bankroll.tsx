import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';
import { BetsHeader } from '../components/bets/BetsHeader';
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
      <div className="min-h-screen bg-terminal-black text-terminal-text flex items-center justify-center">
        <div className="text-terminal-blue">Carregando...</div>
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
    <div className="min-h-screen bg-terminal-black text-terminal-text">
      <BetsHeader />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            className="border-terminal-green text-terminal-green hover:bg-terminal-green/10"
            onClick={() => {
              setEditingMovement(null);
              setMovementType('deposit');
              setMovementAmount('');
              setMovementDesc('');
              setMovementDate('');
              setMovementModalOpen(true);
            }}
          >
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            Adicionar Aporte
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-terminal-red text-terminal-red hover:bg-terminal-red/10"
            onClick={() => {
              setEditingMovement(null);
              setMovementType('withdrawal');
              setMovementAmount('');
              setMovementDesc('');
              setMovementDate('');
              setMovementModalOpen(true);
            }}
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            Adicionar Resgate
          </Button>
        </div>

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
      </div>

      <Dialog
        open={movementModalOpen}
        onOpenChange={(open) => {
          if (!open) setEditingMovement(null);
          setMovementModalOpen(open);
        }}
      >
        <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMovement
                ? movementType === 'deposit'
                  ? 'Editar Aporte'
                  : 'Editar Resgate'
                : movementType === 'deposit'
                  ? 'Adicionar Aporte'
                  : 'Adicionar Resgate'}
            </DialogTitle>
            <DialogDescription>
              {editingMovement
                ? 'Altere os dados da movimentação.'
                : movementType === 'deposit'
                  ? 'Registre um aporte de capital na sua banca.'
                  : 'Registre um resgate de capital da sua banca.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                className="bg-terminal-black border-terminal-border text-terminal-text"
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover open={movementDatePopoverOpen} onOpenChange={setMovementDatePopoverOpen} modal>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-terminal-black border-terminal-border text-terminal-text hover:bg-terminal-gray"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {(() => {
                      const date = parseDateString(movementDate);
                      return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data';
                    })()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
                  <CalendarComponent
                    mode="single"
                    selected={parseDateString(movementDate) || undefined}
                    onSelect={(date) => {
                      setMovementDate(formatDateToString(date));
                      setMovementDatePopoverOpen(false);
                    }}
                    initialFocus
                    className="bg-terminal-dark-gray"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição (opcional)</Label>
              <Input
                id="desc"
                type="text"
                placeholder="Ex: Depósito mensal"
                value={movementDesc}
                onChange={(e) => setMovementDesc(e.target.value)}
                className="bg-terminal-black border-terminal-border text-terminal-text"
              />
            </div>
            <Button
              onClick={handleSaveMovement}
              disabled={movementSaving || !movementAmount || parseFloat(movementAmount) <= 0}
              className="w-full"
            >
              {movementSaving ? 'Salvando...' : editingMovement ? 'Salvar alterações' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingMovementId !== null} onOpenChange={(open) => !open && setDeletingMovementId(null)}>
        <AlertDialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir este aporte/resgate? O saldo será recalculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConfirming}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="bg-terminal-red hover:bg-terminal-red/90"
              disabled={deleteConfirming}
              onClick={handleConfirmDelete}
            >
              {deleteConfirming ? 'Excluindo...' : 'Excluir'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
