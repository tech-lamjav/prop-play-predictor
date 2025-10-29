import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  Target,
  MoreHorizontal,
  Edit,
  Trash2,
  Filter,
  Search,
  List
} from 'lucide-react';
import { Bet } from '../../hooks/use-bets';

interface BetListCompactProps {
  bets: Bet[];
  onEdit?: (bet: Bet) => void;
  onDelete?: (betId: string) => void;
  onStatusChange?: (betId: string, status: string) => void;
  onCashout?: (bet: Bet) => void;
  isLoading?: boolean;
}

export default function BetListCompact({ 
  bets, 
  onEdit, 
  onDelete, 
  onStatusChange, 
  onCashout,
  isLoading 
}: BetListCompactProps) {
  const [filters, setFilters] = useState({
    status: 'all',
    sport: 'all',
    searchQuery: '',
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500', text: 'Pendente', icon: Clock },
      won: { color: 'bg-green-500', text: 'Ganhou', icon: TrendingUp },
      lost: { color: 'bg-red-500', text: 'Perdeu', icon: TrendingDown },
      void: { color: 'bg-gray-500', text: 'Anulada', icon: Clock },
      cashout: { color: 'bg-blue-500', text: 'Cashout', icon: DollarSign }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white flex items-center gap-1 text-xs`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'futebol':
      case 'football':
        return '⚽';
      case 'basquete':
      case 'basketball':
        return '🏀';
      case 'tênis':
      case 'tennis':
        return '🎾';
      case 'vôlei':
      case 'volleyball':
        return '🏐';
      default:
        return '🏆';
    }
  };

  // Get unique sports from bets
  const uniqueSports = Array.from(new Set(bets.map(bet => bet.sport).filter(Boolean))).sort();

  // Filter bets based on filters
  const filteredBets = bets.filter(bet => {
    // Status filter
    if (filters.status !== 'all' && bet.status !== filters.status) {
      return false;
    }

    // Sport filter
    if (filters.sport !== 'all' && bet.sport !== filters.sport) {
      return false;
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchDescription = bet.bet_description?.toLowerCase().includes(query);
      const matchMatch = bet.match_description?.toLowerCase().includes(query);
      const matchLeague = bet.league?.toLowerCase().includes(query);
      
      if (!matchDescription && !matchMatch && !matchLeague) {
        return false;
      }
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <List className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Lista de Apostas</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredBets.length} de {bets.length}
          </Badge>
        </div>

        {/* Compact Filters */}
        <div className="grid grid-cols-1 gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar apostas..."
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="pl-10 h-8 text-sm"
            />
          </div>

          {/* Status and Sport filters */}
          <div className="grid grid-cols-2 gap-2">
            <Select 
              value={filters.status} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="won">Ganhou</SelectItem>
                <SelectItem value="lost">Perdeu</SelectItem>
                <SelectItem value="cashout">Cashout</SelectItem>
                <SelectItem value="void">Anulada</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.sport} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, sport: value }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Esporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueSports.map((sport) => (
                  <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bets List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {filteredBets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Target className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 text-center">
                  {bets.length === 0 ? 'Nenhuma aposta encontrada' : 'Nenhuma aposta corresponde aos filtros'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredBets.map((bet) => (
              <Card key={bet.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(bet.status)}
                          <span className="text-lg">{getSportIcon(bet.sport)}</span>
                          <span className="text-xs text-muted-foreground">{bet.sport}</span>
                        </div>
                        <h4 className="font-medium text-sm truncate">{bet.bet_description}</h4>
                        {bet.match_description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {bet.match_description}
                          </p>
                        )}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit?.(bet)}>
                            <Edit className="w-3 h-3 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {onStatusChange && bet.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => onStatusChange(bet.id, 'won')}>
                                <TrendingUp className="w-3 h-3 mr-2" />
                                Marcar como Ganha
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onStatusChange(bet.id, 'lost')}>
                                <TrendingDown className="w-3 h-3 mr-2" />
                                Marcar como Perdida
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onCashout?.(bet)}>
                                <DollarSign className="w-3 h-3 mr-2" />
                                Cashout
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => onDelete?.(bet.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Values */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Valor</p>
                        <p className="font-semibold">{formatCurrency(bet.stake_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Odds</p>
                        <p className="font-semibold">{bet.odds}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {bet.is_cashout ? 'Cashout' : 'Retorno'}
                        </p>
                        <p className="font-semibold text-green-600">
                          {bet.is_cashout && bet.cashout_amount 
                            ? formatCurrency(bet.cashout_amount)
                            : formatCurrency(bet.potential_return)
                          }
                        </p>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-muted-foreground">
                      {formatDate(bet.bet_date)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
