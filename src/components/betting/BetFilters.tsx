import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Badge } from '../ui/badge';
import { 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  Search,
  Target,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BetFiltersProps {
  onFiltersChange: (filters: BetFiltersState) => void;
  onClearFilters: () => void;
}

export interface BetFiltersState {
  search: string;
  status: string;
  sport: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  minOdds: string;
  maxOdds: string;
  minAmount: string;
  maxAmount: string;
}

const initialFilters: BetFiltersState = {
  search: '',
  status: 'all',
  sport: 'all',
  dateFrom: null,
  dateTo: null,
  minOdds: '',
  maxOdds: '',
  minAmount: '',
  maxAmount: '',
};

const statusOptions = [
  { value: 'all', label: 'Todos', icon: Target },
  { value: 'pending', label: 'Pendente', icon: Clock },
  { value: 'won', label: 'Ganha', icon: TrendingUp },
  { value: 'lost', label: 'Perdida', icon: TrendingDown },
  { value: 'half_won', label: '1/2 Green', icon: TrendingUp },
  { value: 'half_lost', label: '1/2 Red', icon: TrendingDown },
  { value: 'void', label: 'Anulada', icon: X },
];

const sportOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'futebol', label: 'Futebol' },
  { value: 'basquete', label: 'Basquete' },
  { value: 'tênis', label: 'Tênis' },
  { value: 'vôlei', label: 'Vôlei' },
  { value: 'outros', label: 'Outros' },
];

export default function BetFilters({ onFiltersChange, onClearFilters }: BetFiltersProps) {
  const [filters, setFilters] = useState<BetFiltersState>(initialFilters);
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof BetFiltersState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    onClearFilters();
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.sport !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.minOdds || filters.maxOdds) count++;
    if (filters.minAmount || filters.maxAmount) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="space-y-4">
      {/* Search and Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar apostas..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={filters.sport} onValueChange={(value) => updateFilter('sport', value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Esporte" />
            </SelectTrigger>
            <SelectContent>
              {sportOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filtros Avançados</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Período</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dateFrom || undefined}
                          onSelect={(date) => updateFilter('dateFrom', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dateTo || undefined}
                          onSelect={(date) => updateFilter('dateTo', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Odds Range */}
                <div className="space-y-2">
                  <Label>Faixa de Odds</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Mín"
                      type="number"
                      step="0.01"
                      value={filters.minOdds}
                      onChange={(e) => updateFilter('minOdds', e.target.value)}
                    />
                    <Input
                      placeholder="Máx"
                      type="number"
                      step="0.01"
                      value={filters.maxOdds}
                      onChange={(e) => updateFilter('maxOdds', e.target.value)}
                    />
                  </div>
                </div>

                {/* Amount Range */}
                <div className="space-y-2">
                  <Label>Valor da Aposta</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Mín"
                      type="number"
                      step="0.01"
                      value={filters.minAmount}
                      onChange={(e) => updateFilter('minAmount', e.target.value)}
                    />
                    <Input
                      placeholder="Máx"
                      type="number"
                      step="0.01"
                      value={filters.maxAmount}
                      onChange={(e) => updateFilter('maxAmount', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => setIsOpen(false)}>
                    Aplicar Filtros
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>Busca: {filters.search}</span>
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('search', '')}
              />
            </Badge>
          )}
          
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>Status: {statusOptions.find(s => s.value === filters.status)?.label}</span>
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('status', 'all')}
              />
            </Badge>
          )}
          
          {filters.sport !== 'all' && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>Esporte: {sportOptions.find(s => s.value === filters.sport)?.label}</span>
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('sport', 'all')}
              />
            </Badge>
          )}
          
          {filters.dateFrom && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>De: {format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR })}</span>
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('dateFrom', null)}
              />
            </Badge>
          )}
          
          {filters.dateTo && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>Até: {format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR })}</span>
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('dateTo', null)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
