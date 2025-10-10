import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  Target,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react';
import { Bet } from '../../hooks/use-bets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface BetCardProps {
  bet: Bet;
  onEdit?: (bet: Bet) => void;
  onDelete?: (betId: string) => void;
  onStatusChange?: (betId: string, status: string) => void;
}

export default function BetCard({ bet, onEdit, onDelete, onStatusChange }: BetCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'lost':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'void':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <TrendingUp className="w-4 h-4" />;
      case 'lost':
        return <TrendingDown className="w-4 h-4" />;
      case 'void':
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getSportIcon(bet.sport)}</span>
            <div>
              <CardTitle className="text-lg">{bet.sport}</CardTitle>
              {bet.league && (
                <p className="text-sm text-gray-600">{bet.league}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(bet.status)}>
              {getStatusIcon(bet.status)}
              <span className="ml-1 capitalize">{bet.status}</span>
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(bet)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                {onStatusChange && (
                  <>
                    <DropdownMenuItem onClick={() => onStatusChange(bet.id, 'won')}>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Marcar como Ganha
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(bet.id, 'lost')}>
                      <TrendingDown className="w-4 h-4 mr-2" />
                      Marcar como Perdida
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(bet.id, 'void')}>
                      <Clock className="w-4 h-4 mr-2" />
                      Marcar como Anulada
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem 
                  onClick={() => onDelete?.(bet.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Match Description */}
        {bet.match_description && (
          <div>
            <p className="text-sm font-medium text-gray-700">Partida:</p>
            <p className="text-sm text-gray-600">{bet.match_description}</p>
          </div>
        )}
        
        {/* Bet Description */}
        <div>
          <p className="text-sm font-medium text-gray-700">Aposta:</p>
          <p className="text-sm text-gray-600">{bet.bet_description}</p>
        </div>
        
        {/* Bet Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Odds</p>
              <p className="text-sm font-medium">{bet.odds.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Valor</p>
              <p className="text-sm font-medium">{formatCurrency(bet.stake_amount)}</p>
            </div>
          </div>
        </div>
        
        {/* Potential Return */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Retorno Potencial:</span>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(bet.potential_return)}
            </span>
          </div>
        </div>
        
        {/* Dates */}
        <div className="flex justify-between text-xs text-gray-500">
          <span>Aposta: {formatDate(bet.bet_date)}</span>
          {bet.match_date && (
            <span>Jogo: {formatDate(bet.match_date)}</span>
          )}
        </div>
        
        {/* Raw Input (if available) */}
        {bet.raw_input && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
              Ver input original
            </summary>
            <p className="mt-2 p-2 bg-gray-100 rounded text-gray-600">
              {bet.raw_input}
            </p>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
