import React from 'react';
import { Badge } from '@/components/ui/badge';
import { UserPlus } from 'lucide-react';

interface ShareLayoutProps {
  ownerName: string;
  filtersSnapshot: Record<string, unknown>;
  children: React.ReactNode;
}

function getFilterChips(filters: Record<string, unknown>): string[] {
  const chips: string[] = [];
  const status = filters.status as string[] | undefined;
  if (status?.length) chips.push(`Status: ${status.join(', ')}`);
  const sports = filters.sports as string[] | undefined;
  if (sports?.length) chips.push(...sports.filter((v: string) => v !== '__empty__'));
  const leagues = filters.leagues as string[] | undefined;
  if (leagues?.length) chips.push(...leagues.filter((v: string) => v !== '__empty__'));
  const markets = filters.markets as string[] | undefined;
  if (markets?.length) chips.push(...markets.filter((v: string) => v !== '__empty__'));
  const dateFrom = filters.date_from as string | undefined;
  if (dateFrom) chips.push(`De ${dateFrom}`);
  const dateTo = filters.date_to as string | undefined;
  if (dateTo) chips.push(`Até ${dateTo}`);
  const search = filters.search as string | undefined;
  if (search?.trim()) chips.push(`Busca: "${search.trim()}"`);
  return chips;
}

export const ShareLayout: React.FC<ShareLayoutProps> = ({
  ownerName,
  filtersSnapshot,
  children,
}) => {
  const filterChips = getFilterChips(filtersSnapshot);

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text">
      <header className="border-b border-terminal-border bg-terminal-dark-gray">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-terminal-green">
                Apostas de {ownerName}
              </h1>
              <Badge
                variant="secondary"
                className="bg-terminal-gray/50 border-terminal-border text-terminal-text text-xs"
              >
                Visão compartilhada — somente leitura
              </Badge>
            </div>

            <a
              href="/betinho"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-terminal-black transition-colors rounded"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Criar conta grátis
            </a>
          </div>
          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filterChips.map((label, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-terminal-gray border-terminal-border text-terminal-text text-xs"
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};
