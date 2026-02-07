import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search, Star, Trophy, Lock, Zap, BarChart3, CheckCircle, ArrowRight, TrendingUp } from 'lucide-react';
import { nbaDataService, Player } from '@/services/nba-data.service';
import { useSubscription } from '@/hooks/use-subscription';
import { isFreePlayer } from '@/config/freemium';
import { Button } from '@/components/ui/button';
import AnalyticsNav from '@/components/AnalyticsNav';
import { getInjuryStatusStyle, getInjuryStatusLabel } from '@/utils/injury-status';

export default function Home() {
  const navigate = useNavigate();
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load players
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const playersData = await nbaDataService.getAllPlayers();

        // Remove duplicates based on player ID
        const uniquePlayers = playersData.filter((player, index, self) => 
          index === self.findIndex(p => p.player_id === player.player_id)
        );
        
        // Sort by rating stars (highest first)
        const sortedPlayers = uniquePlayers.sort((a, b) => 
          (b.rating_stars || 0) - (a.rating_stars || 0)
        );
        
        setPlayers(sortedPlayers);
        setFilteredPlayers(sortedPlayers);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load player data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter players based on search term
  useEffect(() => {
    let filtered = players;

    if (searchTerm) {
      filtered = filtered.filter(player =>
        player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team_abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm]);

  const handlePlayerSelect = (playerId: number) => {
    const player = players.find(p => p.player_id === playerId);
    if (player) {
      const slug = player.player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
      navigate(`/nba-dashboard/${slug}`);
    }
  };

  // Separate free and premium players
  const freePlayers = filteredPlayers.filter(p => isFreePlayer(p.player_name));
  const premiumPlayers = filteredPlayers.filter(p => !isFreePlayer(p.player_name));

  if (isLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terminal-green mx-auto"></div>
          <p className="mt-4 text-terminal-text font-mono">LOADING SYSTEM...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-terminal-red text-xl mb-4">⚠️ SYSTEM ERROR</div>
          <p className="text-terminal-text mb-4 font-mono">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="terminal-button px-4 py-2 rounded"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <AnalyticsNav />
      
      {/* Hero Section */}
      <section className="border-b border-terminal-border-subtle bg-gradient-to-b from-terminal-dark-gray/50 to-terminal-black">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-4xl mx-auto">
            {/* Title and Badge */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-terminal-green/20 border border-terminal-green rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-terminal-green" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl md:text-3xl font-bold tracking-wider text-terminal-green mb-1">
                  NBA ANALYTICS
                </h1>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-terminal-text opacity-60">
                    {isPremium ? 'PREMIUM ACCESS' : 'FREEMIUM MODE'}
                  </span>
                  {!isPremium && (
                    <span className="text-[10px] bg-terminal-yellow/20 text-terminal-yellow px-2 py-0.5 rounded border border-terminal-yellow/30">
                      EXPERIMENTE GRÁTIS
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Value Proposition */}
            <p className="text-center text-sm md:text-base text-terminal-text opacity-80 mb-6 max-w-2xl mx-auto">
              Análises avançadas de dados para suas apostas na NBA. 
              <span className="text-terminal-green font-semibold"> Baseado em evidências, não em palpites.</span>
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Free Players Section */}
        {freePlayers.length > 0 && (
          <section>
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="w-5 h-5 text-terminal-green" />
                <h2 className="section-title text-base md:text-lg">JOGADORES GRATUITOS</h2>
                <span className="text-xs bg-terminal-green/20 text-terminal-green px-2 py-1 rounded border border-terminal-green/30">
                  {freePlayers.length}
                </span>
              </div>
              <p className="text-xs text-terminal-text opacity-60">
                Experimente grátis e veja o poder das análises avançadas
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {freePlayers.map((player) => (
                <div 
                  key={`free-${player.player_id}`}
                  onClick={() => handlePlayerSelect(player.player_id)}
                  className="terminal-button p-6 rounded-lg cursor-pointer group hover:border-terminal-green hover:bg-terminal-dark-gray/50 transition-all relative border-2 border-terminal-green/30"
                >
                  <div className="absolute top-3 right-3">
                    <div className="bg-terminal-green/20 px-2 py-1 rounded border border-terminal-green/30">
                      <span className="text-[10px] text-terminal-green font-bold">GRÁTIS</span>
                    </div>
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                      <div className="text-lg font-bold text-terminal-green group-hover:text-white transition-colors mb-2">
                        {player.player_name}
                      </div>
                      <div className="text-xs text-terminal-text opacity-70 mb-3">
                        {player.team_abbreviation} • {player.position}
                      </div>
                      {player.rating_stars > 0 && (
                        <div className="flex items-center space-x-1 bg-terminal-dark-gray px-2 py-1 rounded border border-terminal-border-subtle w-fit">
                          <span className="text-xs font-bold text-terminal-green">{player.rating_stars}</span>
                          <Star className="w-3 h-3 text-terminal-green fill-current" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-terminal-border-subtle">
                    <div className={`text-xs px-3 py-1.5 rounded border ${
                      player.current_status?.toLowerCase() === 'active' 
                        ? 'text-terminal-green border-terminal-green/30 bg-terminal-green/10' 
                        : 'text-terminal-red border-terminal-red/30 bg-terminal-red/10'
                    }`}>
                      {player.current_status?.substring(0, 3).toUpperCase() || 'UNK'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-terminal-green font-semibold group-hover:text-terminal-green-bright transition-colors">
                      <span>EXPLORAR</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conversion Section - Between Free and Premium */}
        {!isPremium && (
          <section className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-6 md:p-8">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-terminal-green/20 border-2 border-terminal-green rounded-full mb-4">
                  <Zap className="w-8 h-8 text-terminal-green" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-terminal-green mb-2">
                  Desbloqueie Análises Avançadas
                </h2>
                <p className="text-sm text-terminal-text opacity-70">
                  Acesse todos os {premiumPlayers.length} jogadores e análises completas
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-start gap-3 p-4 bg-terminal-black/50 rounded border border-terminal-border-subtle">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-terminal-green/20 border border-terminal-green/30 flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-4 h-4 text-terminal-green" />
                  </div>
                  <div>
                    <p className="font-semibold text-terminal-text text-sm mb-1">Análises Detalhadas</p>
                    <p className="text-xs text-terminal-text opacity-60">
                      Estatísticas avançadas de todos os jogadores
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-terminal-black/50 rounded border border-terminal-border-subtle">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-terminal-green/20 border border-terminal-green/30 flex items-center justify-center mt-0.5">
                    <BarChart3 className="w-4 h-4 text-terminal-green" />
                  </div>
                  <div>
                    <p className="font-semibold text-terminal-text text-sm mb-1">Insights Exclusivos</p>
                    <p className="text-xs text-terminal-text opacity-60">
                      Dados que outros não têm acesso
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-terminal-black/50 rounded border border-terminal-border-subtle">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-terminal-green/20 border border-terminal-green/30 flex items-center justify-center mt-0.5">
                    <TrendingUp className="w-4 h-4 text-terminal-green" />
                  </div>
                  <div>
                    <p className="font-semibold text-terminal-text text-sm mb-1">Atualizações em Tempo Real</p>
                    <p className="text-xs text-terminal-text opacity-60">
                      Informações sempre relevantes
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Button
                  onClick={() => navigate('/paywall-platform')}
                  className="terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold text-sm md:text-base px-6 py-3"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  ASSINAR AGORA
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Premium Players Preview Section */}
        {premiumPlayers.length > 0 && (
          <section>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-terminal-yellow" />
                <h2 className="section-title text-base md:text-lg">
                  {isPremium ? 'TODOS OS JOGADORES' : 'PREVIEW - JOGADORES PREMIUM'}
                </h2>
                <span className="text-xs bg-terminal-yellow/20 text-terminal-yellow px-2 py-1 rounded border border-terminal-yellow/30">
                  {premiumPlayers.length}
                </span>
              </div>
              
              {/* Search Bar */}
              <div className="relative max-w-md md:max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-terminal-text opacity-50 h-4 w-4" />
                <Input
                  placeholder="BUSCAR JOGADORES..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="terminal-input pl-10 h-10 text-sm w-full"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {premiumPlayers.slice(0, isPremium ? premiumPlayers.length : 12).map((player) => {
                const canAccess = isPremium || isFreePlayer(player.player_name);
                
                return (
                  <div 
                    key={`premium-${player.player_id}`}
                    onClick={() => canAccess ? handlePlayerSelect(player.player_id) : undefined}
                    className={`terminal-button p-3 md:p-4 rounded transition-all relative ${
                      canAccess 
                        ? 'cursor-pointer group hover:border-terminal-green hover:bg-terminal-dark-gray/50' 
                        : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    {/* Simple Lock Badge - No Heavy Overlay */}
                    {!canAccess && (
                      <div className="absolute top-2 right-2 bg-terminal-yellow/20 p-1.5 rounded-full border border-terminal-yellow/30 z-10">
                        <Lock className="w-3 h-3 text-terminal-yellow" />
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs md:text-sm font-bold transition-colors truncate ${
                            canAccess 
                              ? 'text-terminal-green group-hover:text-white' 
                              : 'text-terminal-text opacity-50'
                          }`}>
                            {player.player_name}
                          </div>
                          <div className="text-[10px] text-terminal-text opacity-60 truncate">
                            {player.team_abbreviation} • {player.position}
                          </div>
                        </div>
                      </div>
                      
                      {player.rating_stars > 0 && (
                        <div className="flex items-center space-x-1 bg-terminal-dark-gray px-1.5 py-0.5 rounded border border-terminal-border-subtle w-fit">
                          <span className="text-[10px] font-bold text-terminal-green">{player.rating_stars}</span>
                          <Star className="w-2 h-2 text-terminal-green fill-current" />
                        </div>
                      )}
                      
                      <div className={`text-[10px] px-2 py-1 rounded border w-fit ${
                        (() => {
                          const style = getInjuryStatusStyle(player.current_status);
                          return `${style.textClass} ${style.borderClass} ${style.bgClass}`;
                        })()
                      }`}>
                        {getInjuryStatusLabel(player.current_status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isPremium && premiumPlayers.length > 12 && (
              <div className="text-center mt-8">
                <Button
                  onClick={() => navigate('/paywall-platform')}
                  className="terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold text-sm md:text-base px-6 py-3"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  VER TODOS OS {premiumPlayers.length} JOGADORES
                </Button>
              </div>
            )}
          </section>
        )}

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-terminal-text opacity-50 font-mono">
            <p className="text-sm mb-2">NENHUM JOGADOR ENCONTRADO</p>
            <p className="text-xs opacity-60">Tente buscar com outros termos</p>
          </div>
        )}

        {/* Footer CTA Section */}
        {!isPremium && (
          <section className="border-t border-terminal-border-subtle pt-12">
            <div className="max-w-2xl mx-auto text-center">
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-terminal-green mb-3">
                  Pronto para melhorar suas apostas?
                </h2>
                <p className="text-sm text-terminal-text opacity-70">
                  Junte-se aos apostadores que já economizam tempo e tomam decisões baseadas em dados confiáveis.
                </p>
              </div>
              <Button
                onClick={() => navigate('/paywall-platform')}
                className="terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold text-base px-8 py-4"
              >
                <Zap className="w-5 h-5 mr-2" />
                ASSINAR PLANO PREMIUM
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-xs text-terminal-text opacity-50 mt-4">
                Cancele quando quiser, sem compromisso
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
