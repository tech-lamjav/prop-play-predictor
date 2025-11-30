import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface Bet {
  id: string;
  bet_description: string;
  status: 'won' | 'lost' | 'cashout' | 'pending' | 'void';
  stake_amount: number;
  potential_return: number;
  cashout_amount?: number;
  bet_date: string;
}

interface CashFlowTableProps {
  bets: Bet[];
  initialBankroll: number | null;
  formatCurrency: (amount: number) => string;
}

interface CashFlowEntry {
  id: string;
  date: string;
  description: string;
  type: 'win' | 'loss' | 'cashout' | 'initial';
  amount: number;
  balance: number;
}

export const CashFlowTable: React.FC<CashFlowTableProps> = ({
  bets,
  initialBankroll,
  formatCurrency
}) => {
  const cashFlowData = useMemo(() => {
    const startBalance = initialBankroll || 0;
    
    // Filter settled bets and sort by date ascending
    const settledBets = bets
      .filter(bet => ['won', 'lost', 'cashout'].includes(bet.status))
      .sort((a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime());

    if (settledBets.length === 0) return [];

    const entries: CashFlowEntry[] = [];
    let currentBalance = startBalance;

    // Add initial balance entry
    entries.push({
      id: 'initial',
      date: 'Início',
      description: 'Saldo Inicial',
      type: 'initial',
      amount: 0,
      balance: startBalance
    });

    // Process each settled bet
    settledBets.forEach(bet => {
      let amount = 0;
      let type: 'win' | 'loss' | 'cashout' = 'loss';

      if (bet.status === 'won') {
        amount = bet.potential_return - bet.stake_amount;
        type = 'win';
      } else if (bet.status === 'lost') {
        amount = -bet.stake_amount;
        type = 'loss';
      } else if (bet.status === 'cashout' && bet.cashout_amount) {
        amount = bet.cashout_amount - bet.stake_amount;
        type = 'cashout';
      }

      currentBalance += amount;

      entries.push({
        id: bet.id,
        date: new Date(bet.bet_date).toLocaleDateString('pt-BR'),
        description: bet.bet_description,
        type,
        amount,
        balance: currentBalance
      });
    });

    return entries.reverse(); // Show newest first
  }, [bets, initialBankroll]);

  const getTypeLabel = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'win': return 'GANHOU';
      case 'loss': return 'PERDEU';
      case 'cashout': return 'CASHOUT';
      case 'initial': return 'INICIAL';
    }
  };

  const getTypeColor = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'win': return 'text-terminal-green';
      case 'loss': return 'text-terminal-red';
      case 'cashout': return 'text-terminal-blue';
      case 'initial': return 'text-terminal-text opacity-70';
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
            </tr>
          </thead>
          <tbody>
            {cashFlowData.map((entry, index) => (
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
              <span className={`text-xs px-2 py-1 rounded ${getTypeColor(entry.type)}`}>
                {getTypeLabel(entry.type)}
              </span>
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
