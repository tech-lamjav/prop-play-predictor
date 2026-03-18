import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import type { ShareResolveBet } from '@/hooks/use-share-resolve';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  won: 'text-terminal-green bg-terminal-green/10',
  lost: 'text-terminal-red bg-terminal-red/10',
  half_won: 'text-terminal-green bg-terminal-green/20',
  half_lost: 'text-terminal-red bg-terminal-red/20',
  pending: 'text-terminal-yellow bg-terminal-yellow/10',
  cashout: 'text-terminal-blue bg-terminal-blue/10',
  void: 'opacity-70 bg-terminal-gray/50',
};

const STATUS_LABELS: Record<string, string> = {
  won: 'Ganhou',
  lost: 'Perdeu',
  half_won: '1/2 Green',
  half_lost: '1/2 Red',
  pending: 'Pendente',
  cashout: 'Cashout',
  void: 'Void',
};

function getResult(bet: ShareResolveBet): number | null {
  if (bet.status === 'won') return bet.potential_return;
  if (bet.status === 'cashout' && bet.cashout_amount != null) return bet.cashout_amount;
  if (bet.status === 'half_won') return (bet.stake_amount + bet.potential_return) / 2;
  if (bet.status === 'half_lost') return bet.stake_amount / 2;
  if (bet.status === 'lost') return 0;
  return null;
}

interface ShareBetsTableProps {
  bets: ShareResolveBet[];
}

export const ShareBetsTable: React.FC<ShareBetsTableProps> = ({ bets }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sortedBets = useMemo(
    () => [...bets].sort((a, b) => new Date(b.bet_date).getTime() - new Date(a.bet_date).getTime()),
    [bets]
  );

  const totalPages = Math.ceil(sortedBets.length / PAGE_SIZE) || 1;
  const paginatedBets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedBets.slice(start, start + PAGE_SIZE);
  }, [sortedBets, currentPage]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isMultiple = (bet: ShareResolveBet) =>
    (bet.bet_type === 'multiple' || bet.bet_type === 'multipla') && (bet.bet_legs?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-terminal-blue">Apostas</h2>
      <div className="rounded-md border border-terminal-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-terminal-border hover:bg-transparent">
              <TableHead className="text-terminal-text/80 text-xs w-8" />
              <TableHead className="text-terminal-text/80 text-xs">Data</TableHead>
              <TableHead className="text-terminal-text/80 text-xs">Descrição</TableHead>
              <TableHead className="text-terminal-text/80 text-xs">Esporte / Liga</TableHead>
              <TableHead className="text-terminal-text/80 text-xs text-right">Odds</TableHead>
              <TableHead className="text-terminal-text/80 text-xs text-right">Stake</TableHead>
              <TableHead className="text-terminal-text/80 text-xs text-right">Resultado</TableHead>
              <TableHead className="text-terminal-text/80 text-xs text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBets.map((bet) => (
              <React.Fragment key={bet.id}>
                <TableRow className="border-terminal-border">
                  <TableCell className="w-8 p-2">
                    {isMultiple(bet) ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(bet.id)}
                        className="p-0.5 hover:bg-terminal-gray/50 rounded"
                      >
                        {expandedIds.has(bet.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(bet.bet_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={bet.bet_description}>
                    {bet.bet_description}
                  </TableCell>
                  <TableCell className="text-xs">
                    {[bet.sport, bet.league].filter(Boolean).join(' / ') || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-right">{bet.odds.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-right">
                    R$ {bet.stake_amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {getResult(bet) != null ? (
                      <>R$ {getResult(bet)!.toFixed(2)}</>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="secondary"
                      className={STATUS_STYLES[bet.status] || 'bg-terminal-gray/50'}
                    >
                      {STATUS_LABELS[bet.status] || bet.status}
                    </Badge>
                  </TableCell>
                </TableRow>
                {isMultiple(bet) && (
                  <TableRow className="border-terminal-border">
                    <TableCell colSpan={8} className="p-0">
                      <Collapsible open={expandedIds.has(bet.id)}>
                        <CollapsibleContent>
                          <div className="bg-terminal-black/50 px-4 py-2 pl-12">
                            <div className="text-xs font-medium text-terminal-text/80 mb-2">
                              Legs da aposta
                            </div>
                            <div className="space-y-1.5">
                              {bet.bet_legs!.map((leg, i) => (
                                <div
                                  key={leg.bet_id + i}
                                  className="flex items-center gap-4 text-xs"
                                >
                                  <span className="text-terminal-green/80 w-6">
                                    {leg.leg_number}.
                                  </span>
                                  <span className="flex-1 truncate">{leg.bet_description}</span>
                                  <span className="opacity-70">{leg.odds.toFixed(2)}</span>
                                  <Badge
                                    variant="secondary"
                                    className={STATUS_STYLES[leg.status] || 'bg-terminal-gray/50'}
                                  >
                                    {STATUS_LABELS[leg.status] || leg.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-terminal-text/70">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="terminal-button border-terminal-border"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="terminal-button border-terminal-border"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
