import React, { useMemo } from 'react';
import { DollarSign, Pencil, Trash2 } from 'lucide-react';
import type { CapitalMovement } from '@/hooks/use-capital-movements';
import { Button } from '@/components/ui/button';

interface Bet {
  id: string;
  bet_description: string;
  status: 'won' | 'lost' | 'cashout' | 'pending' | 'void' | 'half_won' | 'half_lost';
  stake_amount: number;
  potential_return: number;
  cashout_amount?: number;
  bet_date: string;
}

interface CashFlowTableProps {
  bets: Bet[];
  initialBankroll: number | null;
  formatCurrency: (amount: number) => string;
  capitalMovements?: CapitalMovement[];
  onEditCapitalMovement?: (id: string) => void;
  onDeleteCapitalMovement?: (id: string) => void;
  canEditMovement?: (id: string) => boolean;
}

interface CashFlowEntry {
  id: string;
  date: string;
  dateSort: number;
  description: string;
  type: 'win' | 'loss' | 'cashout' | 'half_win' | 'half_loss' | 'initial' | 'deposit' | 'withdrawal';
  amount: number;
  balance: number;
  affectsBalance: boolean;
}

export const CashFlowTable: React.FC<CashFlowTableProps> = ({
  bets,
  initialBankroll,
  formatCurrency,
  capitalMovements = [],
  onEditCapitalMovement,
  onDeleteCapitalMovement,
  canEditMovement,
}) => {
  const showActions = Boolean(onEditCapitalMovement || onDeleteCapitalMovement);
  const isCapitalEntry = (type: CashFlowEntry['type']) => type === 'deposit' || type === 'withdrawal';
  const canEdit = (id: string) => canEditMovement === undefined || canEditMovement(id);
  const cashFlowData = useMemo(() => {
    const startBalance = initialBankroll || 0;

    const betEntries: Omit<CashFlowEntry, 'balance' | 'affectsBalance'>[] = bets
      .filter((bet) => ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(bet.status))
      .map((bet) => {
        let amount = 0;
        let type: CashFlowEntry['type'] = 'loss';
        if (bet.status === 'won') {
          amount = bet.potential_return - bet.stake_amount;
          type = 'win';
        } else if (bet.status === 'lost') {
          amount = -bet.stake_amount;
          type = 'loss';
        } else if (bet.status === 'cashout' && bet.cashout_amount) {
          amount = bet.cashout_amount - bet.stake_amount;
          type = 'cashout';
        } else if (bet.status === 'half_won') {
          amount = (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
          type = 'half_win';
        } else if (bet.status === 'half_lost') {
          amount = bet.stake_amount / 2 - bet.stake_amount;
          type = 'half_loss';
        }
        return {
          id: bet.id,
          date: new Date(bet.bet_date).toLocaleDateString('pt-BR'),
          dateSort: new Date(bet.bet_date).getTime(),
          description: bet.bet_description,
          type,
          amount,
        };
      });

    const movementEntries: (Omit<CashFlowEntry, 'balance'> & { affectsBalance: boolean })[] = capitalMovements.map((m) => ({
      id: m.id,
      date: new Date(m.movement_date).toLocaleDateString('pt-BR'),
      dateSort: new Date(m.movement_date).getTime(),
      description:
        m.source === 'bankroll_edit'
          ? m.type === 'deposit'
            ? 'Ajuste de banca (aporte)'
            : 'Ajuste de banca (resgate)'
          : m.description || (m.type === 'deposit' ? 'Aporte' : 'Resgate'),
      type: m.type === 'deposit' ? 'deposit' : 'withdrawal',
      amount: m.type === 'deposit' ? m.amount : -m.amount,
      affectsBalance: m.affects_balance,
    }));

    const betEntriesWithAffects: (Omit<CashFlowEntry, 'balance'> & { affectsBalance: boolean })[] = betEntries.map((e) => ({
      ...e,
      affectsBalance: true,
    }));

    const allEntries = [...betEntriesWithAffects, ...movementEntries].sort((a, b) => a.dateSort - b.dateSort);

    if (allEntries.length === 0) return [];

    const entries: CashFlowEntry[] = [];
    let currentBalance = startBalance;

    entries.push({
      id: 'initial',
      date: 'Início',
      dateSort: 0,
      description: 'Saldo Inicial',
      type: 'initial',
      amount: 0,
      balance: startBalance,
      affectsBalance: true,
    });

    allEntries.forEach((e) => {
      if (e.affectsBalance) currentBalance += e.amount;

      entries.push({
        ...e,
        balance: currentBalance,
      });
    });

    return entries.reverse(); // Show newest first
  }, [bets, initialBankroll, capitalMovements]);

  const getTypeLabel = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'win':
        return 'GANHOU';
      case 'loss':
        return 'PERDEU';
      case 'cashout':
        return 'CASHOUT';
      case 'half_win':
        return '1/2 GREEN';
      case 'half_loss':
        return '1/2 RED';
      case 'initial':
        return 'INICIAL';
      case 'deposit':
        return 'APORTE';
      case 'withdrawal':
        return 'RESGATE';
    }
  };

  const getTypeColor = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'win':
        return 'text-terminal-green';
      case 'loss':
        return 'text-terminal-red';
      case 'cashout':
        return 'text-terminal-blue';
      case 'half_win':
        return 'text-terminal-green opacity-80';
      case 'half_loss':
        return 'text-terminal-red opacity-80';
      case 'initial':
        return 'text-terminal-text opacity-70';
      case 'deposit':
        return 'text-terminal-green';
      case 'withdrawal':
        return 'text-terminal-red';
    }
  };

  if (cashFlowData.length === 0) {
    return (
      <div className="terminal-container p-6 mb-6 text-center">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm opacity-60">Nenhuma transação para exibir</p>
        <p className="text-xs opacity-40 mt-1">Apostas finalizadas aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="terminal-container p-4 mb-6">
      <div className="mb-4">
        <h3 className="section-title flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-terminal-blue" />
          FLUXO DE CAIXA
        </h3>
        <p className="text-xs opacity-60 mt-1">Histórico completo de transações</p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-terminal-border">
              <th className="text-left py-3 px-2 text-xs uppercase opacity-50 font-bold">Data</th>
              <th className="text-left py-3 px-2 text-xs uppercase opacity-50 font-bold">Descrição</th>
              <th className="text-center py-3 px-2 text-xs uppercase opacity-50 font-bold">Tipo</th>
              <th className="text-right py-3 px-2 text-xs uppercase opacity-50 font-bold">Valor</th>
              <th className="text-right py-3 px-2 text-xs uppercase opacity-50 font-bold">Saldo</th>
              {showActions && (
                <th className="text-center py-3 px-2 text-xs uppercase opacity-50 font-bold w-24">Ações</th>
              )}
            </tr>
          </thead>
          <tbody>
            {cashFlowData.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-terminal-border-subtle hover:bg-terminal-dark-gray/30 transition-colors"
              >
                <td className="py-3 px-2 text-sm opacity-70">{entry.date}</td>
                <td className="py-3 px-2 text-sm">{entry.description}</td>
                <td className="text-center py-3 px-2">
                  <span className={`text-xs px-2 py-1 rounded ${getTypeColor(entry.type)}`}>
                    {getTypeLabel(entry.type)}
                  </span>
                </td>
                <td className={`text-right py-3 px-2 text-sm font-bold ${
                  entry.amount > 0 ? 'text-terminal-green' :
                  entry.amount < 0 ? 'text-terminal-red' :
                  'opacity-50'
                }`}>
                  {entry.amount !== 0 && (
                    <>
                      {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                    </>
                  )}
                </td>
                <td className="text-right py-3 px-2 text-sm font-bold">
                  {formatCurrency(entry.balance)}
                </td>
                {showActions && (
                  <td className="py-3 px-2 text-center">
                    {isCapitalEntry(entry.type) && (
                      <div className="flex items-center justify-center gap-1">
                        {onEditCapitalMovement && canEdit(entry.id) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-terminal-text hover:text-terminal-blue"
                            onClick={() => onEditCapitalMovement(entry.id)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDeleteCapitalMovement && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-terminal-text hover:text-terminal-red"
                            onClick={() => onDeleteCapitalMovement(entry.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {cashFlowData.map((entry) => (
          <div
            key={entry.id}
            className="bg-terminal-dark-gray/30 border border-terminal-border-subtle rounded p-3"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="text-xs opacity-50 mb-1">{entry.date}</div>
                <div className="text-sm font-medium">{entry.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${getTypeColor(entry.type)}`}>
                  {getTypeLabel(entry.type)}
                </span>
                {showActions && isCapitalEntry(entry.type) && (
                  <div className="flex gap-1">
                    {onEditCapitalMovement && canEdit(entry.id) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-terminal-text hover:text-terminal-blue"
                        onClick={() => onEditCapitalMovement(entry.id)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteCapitalMovement && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-terminal-text hover:text-terminal-red"
                        onClick={() => onDeleteCapitalMovement(entry.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-terminal-border-subtle">
              <div>
                <div className="text-[10px] opacity-50 uppercase">Valor</div>
                <div className={`text-sm font-bold ${
                  entry.amount > 0 ? 'text-terminal-green' :
                  entry.amount < 0 ? 'text-terminal-red' :
                  'opacity-50'
                }`}>
                  {entry.amount !== 0 ? (
                    <>{entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}</>
                  ) : '-'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] opacity-50 uppercase">Saldo</div>
                <div className="text-sm font-bold">{formatCurrency(entry.balance)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
