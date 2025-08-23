// Core Sports Data Types
export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  sport: 'NBA' | 'NFL' | 'MLB' | 'NHL';
  jerseyNumber?: number;
  height?: string;
  weight?: number;
  experience?: number;
  college?: string;
  imageUrl?: string;
}

export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  status: 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled';
  homeScore?: number;
  awayScore?: number;
  quarter?: number;
  timeRemaining?: string;
  venue?: string;
  broadcast?: string;
}

export interface PlayerGame {
  id: string;
  playerId: string;
  gameId: string;
  team: string;
  opponent: string;
  isHome: boolean;
  minutesPlayed: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus: number;
}

export interface PropBet {
  id: string;
  playerId: string;
  gameId: string;
  type: 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'threePointers' | 'freeThrows' | 'turnovers' | 'fouls';
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
  lastUpdated: string;
  isActive: boolean;
}

export interface PlayerStats {
  playerId: string;
  season: string;
  gamesPlayed: number;
  averageMinutes: number;
  averagePoints: number;
  averageRebounds: number;
  averageAssists: number;
  averageSteals: number;
  averageBlocks: number;
  averageTurnovers: number;
  averageFouls: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  freeThrowPercentage: number;
  plusMinus: number;
}

export interface PropAnalysis {
  id: string;
  playerId: string;
  gameId: string;
  propType: string;
  recommendedSide: 'over' | 'under' | 'pass';
  confidence: number; // 0-100
  edge: number; // percentage edge
  reasoning: string[];
  historicalData: {
    last10Games: number[];
    seasonAverage: number;
    vsOpponent: number;
    homeAwaySplit: { home: number; away: number };
  };
  riskFactors: string[];
  timestamp: string;
}

export interface BettingLine {
  id: string;
  blockId: string;
  bookmaker: string;
  overLine: number;
  underLine: number;
  overOdds: number;
  underOdds: number;
  juice: number;
  lastUpdated: string;
}

export interface InjuryReport {
  id: string;
  playerId: string;
  team: string;
  injury: string;
  status: 'probable' | 'questionable' | 'doubtful' | 'out' | 'injured_reserve';
  description: string;
  expectedReturn?: string;
  lastUpdated: string;
}

// New interface for BigQuery injury insights data
export interface InjuryInsight {
  id: string;
  teamName: string;
  injuredPlayer: string;
  nextPlayer: string;
  category: 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'threePointers' | 'freeThrows' | 'turnovers' | 'fouls';
  createdAt: string;
  impact: 'high' | 'medium' | 'low';
  // Optional fields that may not be available from BigQuery
  injuredPlayerStats?: {
    seasonAverage: number;
    last10Games: number[];
  };
  nextPlayerStats?: {
    seasonAverage: number;
    last10Games: number[];
  };
  opportunity?: {
    description: string;
    confidence: number;
    edge: number;
  };
}

export interface TeamStats {
  teamId: string;
  season: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  pointsPerGame: number;
  pointsAllowedPerGame: number;
  pace: number; // possessions per 48 minutes
  offensiveRating: number;
  defensiveRating: number;
  netRating: number;
  threePointPercentage: number;
  threePointPercentageAllowed: number;
  reboundPercentage: number;
  assistPercentage: number;
}

export interface ModelPerformance {
  id: string;
  date: string;
  totalPicks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  roi: number;
  averageEdge: number;
  totalVolume: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Filter Types
export interface PlayerFilters {
  search?: string;
  team?: string;
  position?: string;
  sport?: string;
  minGames?: number;
  minMinutes?: number;
}

export interface GameFilters {
  date?: string;
  team?: string;
  status?: string;
  sport?: string;
}

export interface PropFilters {
  playerId?: string;
  gameId?: string;
  type?: string;
  bookmaker?: string;
  minEdge?: number;
  maxLine?: number;
}

// Dashboard Data Types
export interface DashboardStats {
  totalPlayers: number;
  activeGames: number;
  activeProps: number;
  modelWinRate: number;
  averageEdge: number;
  topOpportunities: PropAnalysis[];
}

export interface WatchlistItem {
  id: string;
  playerId: string;
  userId: string;
  addedAt: string;
  notes?: string;
  alerts: boolean;
}
