import type { Bet } from '@/hooks/use-bets';

function profitForBet(bet: Bet): number {
  if (bet.status === 'won') return bet.potential_return - bet.stake_amount;
  if (bet.status === 'lost') return -bet.stake_amount;
  if (bet.status === 'cashout' && bet.cashout_amount != null)
    return bet.cashout_amount - bet.stake_amount;
  if (bet.status === 'half_won')
    return (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
  if (bet.status === 'half_lost') return bet.stake_amount / 2 - bet.stake_amount;
  return 0;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exports bets to a CSV file and triggers download.
 * Columns: data_aposta, esporte, liga, mercado, descricao, odds, valor_apostado, retorno_potencial, status, lucro.
 */
export function exportBetsToCSV(
  bets: Bet[],
  formatValue: (n: number) => string
): void {
  const headers = [
    'data_aposta',
    'esporte',
    'liga',
    'mercado',
    'descricao',
    'odds',
    'valor_apostado',
    'retorno_potencial',
    'status',
    'lucro',
  ];

  const rows = bets.map((bet) => {
    const profit = profitForBet(bet);
    const betDate = bet.bet_date ? new Date(bet.bet_date).toLocaleDateString('pt-BR') : '';
    return [
      escapeCsvField(betDate),
      escapeCsvField(bet.sport ?? ''),
      escapeCsvField(bet.league ?? ''),
      escapeCsvField(bet.betting_market ?? ''),
      escapeCsvField(bet.bet_description ?? ''),
      String(bet.odds),
      formatValue(bet.stake_amount),
      formatValue(bet.potential_return),
      escapeCsvField(bet.status),
      formatValue(profit),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toISOString().slice(0, 10);
  link.download = `apostas-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
