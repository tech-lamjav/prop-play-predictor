import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getTeamLogoUrl } from '@/utils/team-logos';
import { nbaDataService } from '@/services/nba-data.service';

interface Team {
  name: string;
  abbreviation: string;
}

// Static list of NBA teams as fallback
const NBA_TEAMS: Team[] = [
  { name: 'Atlanta Hawks', abbreviation: 'ATL' },
  { name: 'Boston Celtics', abbreviation: 'BOS' },
  { name: 'Brooklyn Nets', abbreviation: 'BKN' },
  { name: 'Charlotte Hornets', abbreviation: 'CHA' },
  { name: 'Chicago Bulls', abbreviation: 'CHI' },
  { name: 'Cleveland Cavaliers', abbreviation: 'CLE' },
  { name: 'Dallas Mavericks', abbreviation: 'DAL' },
  { name: 'Denver Nuggets', abbreviation: 'DEN' },
  { name: 'Detroit Pistons', abbreviation: 'DET' },
  { name: 'Golden State Warriors', abbreviation: 'GSW' },
  { name: 'Houston Rockets', abbreviation: 'HOU' },
  { name: 'Indiana Pacers', abbreviation: 'IND' },
  { name: 'LA Clippers', abbreviation: 'LAC' },
  { name: 'Los Angeles Lakers', abbreviation: 'LAL' },
  { name: 'Memphis Grizzlies', abbreviation: 'MEM' },
  { name: 'Miami Heat', abbreviation: 'MIA' },
  { name: 'Milwaukee Bucks', abbreviation: 'MIL' },
  { name: 'Minnesota Timberwolves', abbreviation: 'MIN' },
  { name: 'New Orleans Pelicans', abbreviation: 'NOP' },
  { name: 'New York Knicks', abbreviation: 'NYK' },
  { name: 'Oklahoma City Thunder', abbreviation: 'OKC' },
  { name: 'Orlando Magic', abbreviation: 'ORL' },
  { name: 'Philadelphia 76ers', abbreviation: 'PHI' },
  { name: 'Phoenix Suns', abbreviation: 'PHX' },
  { name: 'Portland Trail Blazers', abbreviation: 'POR' },
  { name: 'Sacramento Kings', abbreviation: 'SAC' },
  { name: 'San Antonio Spurs', abbreviation: 'SAS' },
  { name: 'Toronto Raptors', abbreviation: 'TOR' },
  { name: 'Utah Jazz', abbreviation: 'UTA' },
  { name: 'Washington Wizards', abbreviation: 'WAS' },
];

interface TeamAutocompleteProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function TeamAutocomplete({ value, onValueChange, placeholder = 'Selecione um time...' }: TeamAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>(NBA_TEAMS);

  useEffect(() => {
    // Try to load teams from players data
    nbaDataService.getAllPlayers()
      .then(players => {
        const uniqueTeams = new Map<string, Team>();
        players.forEach(player => {
          if (player.team_name && player.team_abbreviation) {
            uniqueTeams.set(player.team_name, {
              name: player.team_name,
              abbreviation: player.team_abbreviation,
            });
          }
        });
        if (uniqueTeams.size > 0) {
          setTeams(Array.from(uniqueTeams.values()).sort((a, b) => a.name.localeCompare(b.name)));
        }
      })
      .catch(() => {
        // Fallback to static list if API fails
        setTeams(NBA_TEAMS);
      });
  }, []);

  const selectedTeam = teams.find(team => team.abbreviation === value);

  const filteredTeams = teams.filter(team => {
    if (!value || value.length === 0) return true;
    const searchLower = value.toLowerCase();
    return (
      team.name.toLowerCase().includes(searchLower) ||
      team.abbreviation.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="terminal-input h-9 w-full justify-between text-sm"
        >
          {selectedTeam ? (
            <div className="flex items-center gap-2">
              <img
                src={getTeamLogoUrl(selectedTeam.name)}
                alt={selectedTeam.abbreviation}
                className="w-4 h-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span>{selectedTeam.name}</span>
            </div>
          ) : (
            <span className="text-terminal-text opacity-50">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar time..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum time encontrado.</CommandEmpty>
            <CommandGroup>
              {filteredTeams.map((team) => (
                <CommandItem
                  key={team.abbreviation}
                  value={team.abbreviation}
                  onSelect={() => {
                    onValueChange(team.abbreviation === value ? '' : team.abbreviation);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === team.abbreviation ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <img
                      src={getTeamLogoUrl(team.name)}
                      alt={team.abbreviation}
                      className="w-4 h-4"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span>{team.name}</span>
                    <span className="text-xs opacity-50 ml-auto">{team.abbreviation}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
