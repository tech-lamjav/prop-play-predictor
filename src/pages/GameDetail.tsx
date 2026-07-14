import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePostHog } from '@posthog/react';
import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Calendar as CalendarIcon, Loader2,
} from 'lucide-react';
import { NBAHomeNav } from '@/components/nba-home/NBAHomeHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  nbaDataService, type B2BBoxScorePlayer, type BoxScorePlayer,
  type DailyOpportunity, type Game, type Team, type TeamPlayer,
} from '@/services/nba-data.service';
import { gamesCache } from '@/pages/Games';
import { useAnalise360Data } from '@/hooks/use-analise360';
import { getPlayerPhotoUrl, getTeamLogoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

// ─── Cache ────────────────────────────────────────────────────────────────

interface GameDetailCache {
  game: Game;
  homePlayers: TeamPlayer[];
  visitorPlayers: TeamPlayer[];
  homeTeam: Team | null;
  visitorTeam: Team | null;
  b2bData?: { home: B2BBoxScorePlayer[]; visitor: B2BBoxScorePlayer[] };
}
const gameDetailCache = new Map<string, GameDetailCache>();

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseGameDate(d: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00-03:00`);
  return new Date(d);
}

function formatGameDateLong(d: string): string {
  const date = parseGameDate(d);
  return date.toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatGameDateShort(d: string): string {
  // "ter., 12 de mai. de 2026"
  const date = parseGameDate(d);
  return date.toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatTimeBR(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: SAO_PAULO_TZ, hour: '2-digit', minute: '2-digit',
  });
}

function timeUntilKickoff(iso: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / (60 * 60 * 1000));
  const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (h >= 24) return `EM ${Math.floor(h / 24)}D ${h % 24}H`;
  if (h > 0) return `EM ${h}H ${m}MIN`;
  return `EM ${m}MIN`;
}

function formatPct(val: number | null): string {
  if (val == null) return '—';
  // RPC pode devolver 0–1 (fração) ou 0–100 (já em pct). Detectamos por magnitude.
  const pct = val <= 1 ? val * 100 : val;
  return pct % 1 === 0 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
}

function ordinalRank(n: number | null | undefined): string {
  if (n == null) return '—';
  return `#${n}`;
}

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
}

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'G-F', 'F-C', 'N/A'];

function sortLineupPlayers(a: TeamPlayer, b: TeamPlayer): number {
  const sd = (b.rating_stars ?? 0) - (a.rating_stars ?? 0);
  if (sd !== 0) return sd;
  const ai = POSITION_ORDER.indexOf(a.position || 'N/A');
  const bi = POSITION_ORDER.indexOf(b.position || 'N/A');
  const pd = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  if (pd !== 0) return pd;
  return a.player_name.localeCompare(b.player_name);
}

function statusBadgeStyle(status: string | null | undefined): { label: string; cls: string } {
  const s = (status ?? '').toLowerCase();
  if (!s || s === 'active' || s === 'available' || s === 'unk') {
    return { label: 'Disp.', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
  }
  if (s === 'out' || s.includes('out')) {
    return { label: 'OUT', cls: 'bg-status-danger text-white' };
  }
  if (s.includes('doubtful')) {
    return { label: 'DTD', cls: 'bg-status-warning/15 text-status-warning border border-status-warning/30' };
  }
  if (s.includes('questionable')) {
    return { label: 'Q', cls: 'bg-amber-100 text-amber-700 border border-amber-200' };
  }
  if (s.includes('probable')) {
    return { label: 'Prov.', cls: 'bg-lime-100 text-lime-700 border border-lime-200' };
  }
  return { label: status || '—', cls: 'bg-ink-3 text-ink-2 border border-line' };
}

// ─── Last 5 V/D ───────────────────────────────────────────────────────────

function LastFive({ results }: { results: string | null }) {
  if (!results) return <span className="text-ink-2 text-[11px]">—</span>;
  const last5 = results.replace(/\s/g, '').slice(0, 5).split('').reverse();
  const opacities = ['opacity-30', 'opacity-50', 'opacity-70', 'opacity-90', 'opacity-100'];
  return (
    <div className="flex items-center gap-0.5">
      {last5.map((r, i) => {
        const isWin = r === 'V' || r === 'W';
        return (
          <span
            key={i}
            title={isWin ? 'Vitória' : 'Derrota'}
            className={`w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded ${opacities[i] ?? 'opacity-100'} ${
              isWin
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-status-danger/10 text-status-danger border border-status-danger/20'
            }`}
          >
            {isWin ? 'V' : 'D'}
          </span>
        );
      })}
    </div>
  );
}

// ─── TeamHeaderBlock ──────────────────────────────────────────────────────

function TeamHeaderBlock({
  team, teamFallbackName, abbreviation, lastFive, isB2B, isHomeBlock, showRatings = false,
}: {
  team: Team | null;
  teamFallbackName: string;
  abbreviation: string;
  lastFive: string | null;
  isB2B: boolean;
  isHomeBlock: boolean;
  /** Quando true, mostra OFF/DEF rating abaixo do V/D (usado no mobile pra evitar row separado). */
  showRatings?: boolean;
}) {
  const wins = team?.wins ?? null;
  const losses = team?.losses ?? null;
  const conf = team?.conference;
  const rank = team?.conference_rank;
  const teamName = team?.team_name ?? teamFallbackName;

  return (
    <div className={`flex items-center gap-3 ${isHomeBlock ? '' : 'flex-row-reverse text-right'}`}>
      <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center">
        <img
          src={getTeamLogoUrl(teamName)}
          alt={abbreviation}
          className="w-full h-full object-contain"
          onError={(e) => {
            const t = e.target as HTMLImageElement;
            t.style.display = 'none';
            if (t.parentElement) {
              t.parentElement.innerHTML = `<span class="text-sm font-bold text-ink-2">${abbreviation}</span>`;
            }
          }}
        />
      </div>
      <div className="min-w-0">
        <div className={`flex items-center gap-1.5 ${isHomeBlock ? '' : 'justify-end'} flex-wrap`}>
          <h2 className="text-[16px] md:text-[20px] font-semibold text-ink truncate">
            {teamName}
          </h2>
          {isB2B && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
              B2B
            </span>
          )}
        </div>
        <div className={`text-[11px] text-ink-2 mt-0.5 flex items-center gap-1.5 ${isHomeBlock ? '' : 'justify-end'}`}>
          {wins != null && losses != null && (
            <span className="tabular-nums">{wins}-{losses}</span>
          )}
          {rank != null && conf && (
            <>
              <span className="text-line">·</span>
              <span>#{rank} {conf === 'East' || conf === 'Leste' ? 'East' : 'West'}</span>
            </>
          )}
        </div>
        <div className={`mt-1.5 flex ${isHomeBlock ? '' : 'justify-end'}`}>
          <LastFive results={lastFive} />
        </div>
        {showRatings && (team?.team_offensive_rating_rank != null || team?.team_defensive_rating_rank != null) && (
          <div className={`mt-2 flex items-center gap-3 ${isHomeBlock ? '' : 'justify-end'}`}>
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-amber-700/70">OFF</span>
              <span className="text-[12px] font-bold text-amber-700 tabular-nums">{ordinalRank(team?.team_offensive_rating_rank)}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-amber-700/70">DEF</span>
              <span className="text-[12px] font-bold text-amber-700 tabular-nums">{ordinalRank(team?.team_defensive_rating_rank)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PageHeader (Hero card) ───────────────────────────────────────────────

function HeroCard({
  game, homeTeam, visitorTeam,
}: {
  game: Game;
  homeTeam: Team | null;
  visitorTeam: Team | null;
}) {
  const finished = game.winner_team_id != null;
  const homeWon = finished && game.winner_team_id === game.home_team_id;
  const visitorWon = finished && game.winner_team_id === game.visitor_team_id;
  const winnerAbbr = homeWon ? game.home_team_abbreviation : visitorWon ? game.visitor_team_abbreviation : null;

  const time = formatTimeBR(game.game_datetime_brasilia);
  const countdown = !finished ? timeUntilKickoff(game.game_datetime_brasilia) : null;
  const dateLabel = formatGameDateLong(game.game_date);

  const centerContent = (
    <>
      <div className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold mb-1">
        {finished ? `${dateLabel} · FT` : dateLabel}
      </div>
      {finished ? (
        <>
          <div className="flex items-baseline justify-center gap-2 md:gap-3">
            <span className={`text-[28px] md:text-[36px] font-semibold tabular-nums leading-none ${homeWon ? 'text-ink' : 'text-ink-2'}`}>
              {game.home_team_score ?? '—'}
            </span>
            <span className="text-ink-2 text-[16px]">·</span>
            <span className={`text-[28px] md:text-[36px] font-semibold tabular-nums leading-none ${visitorWon ? 'text-ink' : 'text-ink-2'}`}>
              {game.visitor_team_score ?? '—'}
            </span>
          </div>
          {winnerAbbr && (
            <div className="mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-forest text-white uppercase tracking-wide">
                {winnerAbbr} venceu
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-[10px] text-ink-2 mb-0.5">vs</div>
          <div className="text-[24px] md:text-[30px] font-semibold text-ink tabular-nums leading-none">
            {time ?? '—'}
          </div>
          {countdown && (
            <div className="mt-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                {countdown}
              </span>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="bg-white border border-line rounded-xl px-4 md:px-6 py-5 md:py-6">
      {/* Mobile: empilhado (time → centro → time). Visitor é "espelhado" (logo à direita). */}
      <div className="md:hidden flex flex-col gap-3">
        <TeamHeaderBlock
          team={homeTeam}
          teamFallbackName={game.home_team_name}
          abbreviation={game.home_team_abbreviation}
          lastFive={homeTeam?.team_last_five_games || game.home_team_last_five}
          isB2B={game.home_team_is_b2b_game}
          isHomeBlock
          showRatings
        />
        <div className="text-center border-y border-line py-3">
          {centerContent}
        </div>
        <TeamHeaderBlock
          team={visitorTeam}
          teamFallbackName={game.visitor_team_name}
          abbreviation={game.visitor_team_abbreviation}
          lastFive={visitorTeam?.team_last_five_games || game.visitor_team_last_five}
          isB2B={game.visitor_team_is_b2b_game}
          isHomeBlock={false}
          showRatings
        />
      </div>

      {/* Desktop: lado a lado */}
      <div className="hidden md:flex items-center justify-between gap-5">
        <div className="flex-1 min-w-0">
          <TeamHeaderBlock
            team={homeTeam}
            teamFallbackName={game.home_team_name}
            abbreviation={game.home_team_abbreviation}
            lastFive={homeTeam?.team_last_five_games || game.home_team_last_five}
            isB2B={game.home_team_is_b2b_game}
            isHomeBlock
          />
        </div>
        <div className="text-center px-4 shrink-0">{centerContent}</div>
        <div className="flex-1 min-w-0">
          <TeamHeaderBlock
            team={visitorTeam}
            teamFallbackName={game.visitor_team_name}
            abbreviation={game.visitor_team_abbreviation}
            lastFive={visitorTeam?.team_last_five_games || game.visitor_team_last_five}
            isB2B={game.visitor_team_is_b2b_game}
            isHomeBlock={false}
          />
        </div>
      </div>

      {/* OFF / DEF ratings — estilo amber/gold como o mockup de prod (desktop apenas; mobile fica embutido no TeamHeaderBlock) */}
      <div className="hidden md:flex border-t border-line mt-5 pt-3 items-center justify-between gap-3">
        <div className="flex items-center gap-4 md:gap-6">
          <div>
            <div className="uppercase tracking-[0.12em] text-[9px] font-bold text-amber-700/70 mb-0.5">OFF RTG</div>
            <div className="text-amber-700 font-bold tabular-nums text-[15px] leading-none">{ordinalRank(homeTeam?.team_offensive_rating_rank)}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.12em] text-[9px] font-bold text-amber-700/70 mb-0.5">DEF RTG</div>
            <div className="text-amber-700 font-bold tabular-nums text-[15px] leading-none">{ordinalRank(homeTeam?.team_defensive_rating_rank)}</div>
          </div>
        </div>

        <div className="text-[9px] uppercase tracking-[0.18em] text-ink-2/60 font-semibold text-center hidden sm:block">
          Ratings da temporada
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="text-right">
            <div className="uppercase tracking-[0.12em] text-[9px] font-bold text-amber-700/70 mb-0.5">OFF RTG</div>
            <div className="text-amber-700 font-bold tabular-nums text-[15px] leading-none">{ordinalRank(visitorTeam?.team_offensive_rating_rank)}</div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-[0.12em] text-[9px] font-bold text-amber-700/70 mb-0.5">DEF RTG</div>
            <div className="text-amber-700 font-bold tabular-nums text-[15px] leading-none">{ordinalRank(visitorTeam?.team_defensive_rating_rank)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ângulo do confronto (matchup) ────────────────────────────────────────
// Mostra como o adversário se posiciona em cada categoria defensiva,
// dando "leitura" do confronto. Dado real de get_opponent_rankings.

function rankTone(rank: number | null | undefined): { label: string; cls: string } {
  if (rank == null) return { label: '—', cls: 'text-ink-2' };
  if (rank <= 5) return { label: `#${rank}`, cls: 'text-forest font-semibold' };       // ótima defesa
  if (rank <= 12) return { label: `#${rank}`, cls: 'text-emerald-700 font-medium' };
  if (rank <= 20) return { label: `#${rank}`, cls: 'text-ink-2' };
  return { label: `#${rank}`, cls: 'text-status-danger font-semibold' };                // defesa fraca
}

function MatchupAngleCard({
  homeAbbr, homeTeam, visitorAbbr, visitorTeam, homeId, visitorId,
}: {
  homeAbbr: string;
  homeTeam: Team | null;
  visitorAbbr: string;
  visitorTeam: Team | null;
  homeId: number;
  visitorId: number;
}) {
  // Os campos next_opponent_opp_*_rank descrevem o adversário do PRÓXIMO jogo.
  // Só são válidos se o jogo atual for o próximo confronto dos dois times.
  const homeAttacks = homeTeam && homeTeam.next_opponent_id === visitorId
    ? {
        pts: homeTeam.next_opponent_opp_pts_rank,
        reb: homeTeam.next_opponent_opp_reb_rank,
        ast: homeTeam.next_opponent_opp_ast_rank,
        fg3: homeTeam.next_opponent_opp_fg3_pct_rank,
        paint: homeTeam.next_opponent_opp_pts_paint_rank,
      }
    : null;
  const visitorAttacks = visitorTeam && visitorTeam.next_opponent_id === homeId
    ? {
        pts: visitorTeam.next_opponent_opp_pts_rank,
        reb: visitorTeam.next_opponent_opp_reb_rank,
        ast: visitorTeam.next_opponent_opp_ast_rank,
        fg3: visitorTeam.next_opponent_opp_fg3_pct_rank,
        paint: visitorTeam.next_opponent_opp_pts_paint_rank,
      }
    : null;

  if (!homeAttacks && !visitorAttacks) return null;

  const stats = [
    { key: 'pts',   label: 'Pts cedidos' },
    { key: 'reb',   label: 'Reb cedidos' },
    { key: 'ast',   label: 'Ast cedidas' },
    { key: 'fg3',   label: '3P% cedido' },
    { key: 'paint', label: 'Pts garrafão' },
  ] as const;

  const renderColumn = (attackerAbbr: string, ranks: typeof homeAttacks, defenderAbbr: string) => {
    if (!ranks) return null;
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-[11px] font-semibold text-ink">{attackerAbbr} ataca</span>
          <span className="text-[11px] text-ink-2">contra defesa do <span className="font-semibold">{defenderAbbr}</span></span>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-3">
          {stats.map(s => {
            const rank = ranks[s.key as keyof typeof ranks];
            const tone = rankTone(rank);
            return (
              <div key={s.key}>
                <div className="text-[9px] uppercase tracking-wider text-ink-2/70 font-semibold mb-1">{s.label}</div>
                <span className={`text-[15px] tabular-nums ${tone.cls}`}>{tone.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-line rounded-xl px-4 md:px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Ângulo do confronto</span>
        <span className="text-[10px] text-ink-2">rank do adversário na liga · #1 = melhor defesa</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:divide-x divide-line">
        {homeAttacks && <div className="md:pr-6">{renderColumn(homeAbbr, homeAttacks, visitorAbbr)}</div>}
        {visitorAttacks && <div className={`md:pl-6 ${homeAttacks ? 'pt-4 md:pt-0 border-t md:border-t-0 border-line' : ''}`}>{renderColumn(visitorAbbr, visitorAttacks, homeAbbr)}</div>}
      </div>
    </div>
  );
}

// ─── B2B Alert (apenas dado real do back) ─────────────────────────────────

// Coordenadas (lat,lng) por team_abbreviation pra calcular distância da viagem.
// Dado público e estável; não muda. Mantém aqui pra não bater em outra tabela.
const TEAM_CITY_LATLNG: Record<string, [number, number]> = {
  ATL: [33.7490, -84.3880], BOS: [42.3601, -71.0589], BKN: [40.6892, -73.9442],
  CHA: [35.2271, -80.8431], CHI: [41.8781, -87.6298], CLE: [41.4993, -81.6944],
  DAL: [32.7767, -96.7970], DEN: [39.7392, -104.9903], DET: [42.3314, -83.0458],
  GSW: [37.7749, -122.4194], HOU: [29.7604, -95.3698], IND: [39.7684, -86.1581],
  LAC: [34.0522, -118.2437], LAL: [34.0522, -118.2437], MEM: [35.1495, -90.0490],
  MIA: [25.7617, -80.1918], MIL: [43.0389, -87.9065], MIN: [44.9778, -93.2650],
  NOP: [29.9511, -90.0715], NYK: [40.7128, -74.0060], OKC: [35.4676, -97.5164],
  ORL: [28.5383, -81.3792], PHI: [39.9526, -75.1652], PHX: [33.4484, -112.0740],
  POR: [45.5152, -122.6784], SAC: [38.5816, -121.4944], SAS: [29.4241, -98.4936],
  TOR: [43.6532, -79.3832], UTA: [40.7608, -111.8910], WAS: [38.9072, -77.0369],
};

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))));
}

interface B2BPrevSummary {
  opponentAbbr: string;
  isHome: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  gameDateISO: string | null;
  gameDatetimeBrasilia: string | null;
  keyPlayers: Array<{ playerName: string; minutes: number; points: number }>;
}

/**
 * Sinal de carga: descrição qualitativa baseada no minutão do top líder.
 * Não tem número de queda de rendimento — esse dado precisa vir de um
 * modelo histórico real (em construção). Texto aqui é apenas qualitativo.
 */
function generateB2BLoadSignal(top: { playerName: string; minutes: number } | undefined): string | null {
  if (!top) return null;
  const lastName = top.playerName.split(' ').slice(-1)[0];
  if (top.minutes >= 38) {
    return `${lastName} jogou ${top.minutes} min ontem — carga muito alta.`;
  }
  if (top.minutes >= 32) {
    return `${lastName} jogou ${top.minutes} min ontem — carga alta.`;
  }
  return `Top minutagem ontem: ${lastName} com ${top.minutes} min — carga distribuída.`;
}

function B2BAlertCard({
  team, summary, currentGameDateISO,
}: {
  team: { name: string; abbreviation: string };
  summary: B2BPrevSummary;
  currentGameDateISO: string;
}) {
  const won = summary.teamScore != null && summary.opponentScore != null && summary.teamScore > summary.opponentScore;
  const weekdayLabels = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const prevDate = summary.gameDateISO ? new Date(`${summary.gameDateISO}T12:00:00-03:00`) : null;
  const weekday = prevDate ? weekdayLabels[prevDate.getDay()] : null;
  const dayMonth = summary.gameDateISO ? summary.gameDateISO.split('-').reverse().slice(0, 2).join('/') : null;
  const prevTime = summary.gameDatetimeBrasilia
    ? new Date(summary.gameDatetimeBrasilia).toLocaleTimeString('pt-BR', { timeZone: SAO_PAULO_TZ, hour: '2-digit', minute: '2-digit' })
    : null;

  // Descanso: diferença em dias × 24
  const restHours = (() => {
    if (!summary.gameDateISO) return null;
    const a = parseGameDate(summary.gameDateISO).getTime();
    const b = parseGameDate(currentGameDateISO).getTime();
    const days = Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
    return days * 24;
  })();

  // Viagem: cidade do jogo de ontem → cidade do jogo de hoje. Se ontem foi em casa,
  // saiu da cidade do team; se foi fora, saiu da cidade do oponente de ontem.
  const travelKm = (() => {
    const today = TEAM_CITY_LATLNG[team.abbreviation];
    const fromAbbr = summary.isHome ? team.abbreviation : summary.opponentAbbr;
    const yesterday = TEAM_CITY_LATLNG[fromAbbr];
    if (!today || !yesterday) return null;
    return haversineKm(yesterday, today);
  })();

  const loadSignal = generateB2BLoadSignal(summary.keyPlayers[0]);

  return (
    <div className="bg-gradient-to-r from-amber-50/60 via-amber-50 to-amber-100 border border-amber-200 rounded-xl px-4 md:px-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Alerta de B2B</span>
          </div>
          <div className="text-[14px] font-semibold text-ink leading-tight">{team.name} jogou ontem</div>
          {(restHours != null || travelKm != null) && (
            <div className="text-[11px] text-ink-2 mt-1.5">
              {restHours != null && <>Descanso: <span className="text-ink font-medium">{restHours}h</span></>}
              {restHours != null && travelKm != null && ' · '}
              {travelKm != null && <>Viagem: <span className="text-ink font-medium">{travelKm.toLocaleString('pt-BR')} km</span></>}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Jogo de ontem</div>
          <div className="text-[14px] font-semibold text-ink leading-tight">
            {team.abbreviation} {summary.isHome ? 'vs' : '@'} {summary.opponentAbbr}
            {summary.teamScore != null && summary.opponentScore != null && (
              <> · <span className={won ? 'text-forest' : 'text-status-danger'}>
                {summary.teamScore}-{summary.opponentScore}
              </span></>
            )}
          </div>
          {(weekday || dayMonth) && (
            <div className="text-[11px] text-ink-2 mt-1 capitalize">
              {weekday}{dayMonth ? ` ${dayMonth}` : ''}{prevTime ? ` · ${prevTime}` : ''}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Minutos ontem</div>
          <div className="space-y-1">
            {summary.keyPlayers.length === 0 ? (
              <p className="text-[11px] text-ink-2">Sem dados de minutos.</p>
            ) : (
              summary.keyPlayers.slice(0, 3).map(p => (
                <div key={p.playerName} className="text-[12px] flex items-center gap-2">
                  <span className="text-ink font-medium truncate">{p.playerName.split(' ').slice(-1)[0]}</span>
                  <span className={`inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold tabular-nums shrink-0 ${
                    p.minutes >= 38 ? 'bg-amber-200 text-amber-900' :
                    p.minutes >= 32 ? 'bg-amber-100 text-amber-700' :
                    'bg-canvas-2 text-ink-2'
                  }`}>
                    {p.minutes}min
                  </span>
                  <span className="text-ink-2 tabular-nums text-[11px] shrink-0">{p.points} pts</span>
                </div>
              ))
            )}
          </div>
        </div>

        {loadSignal && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Sinal de carga</div>
            <p className="text-[12px] text-ink leading-snug">{loadSignal}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, label, count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 md:px-3 py-2 text-[12px] md:text-[13px] font-semibold transition-colors border-b-2 -mb-px inline-flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? 'border-forest text-ink'
          : 'border-transparent text-ink-2 hover:text-ink'
      }`}
    >
      {label}
      {count != null && (
        <span className={`inline-flex items-center justify-center px-1.5 h-4 rounded-full text-[10px] font-semibold ${active ? 'bg-forest text-white' : 'bg-canvas-2 text-ink-2'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Lineup Table ─────────────────────────────────────────────────────────

function LineupTable({
  players, teamAbbr, teamName,
}: {
  players: TeamPlayer[];
  teamAbbr: string;
  teamName: string;
}) {
  const sorted = useMemo(() => [...players].sort(sortLineupPlayers), [players]);

  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
        <img
          src={getTeamLogoUrl(teamName)}
          alt={teamAbbr}
          className="w-4 h-4 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="text-[13px] font-semibold text-ink">{teamAbbr}</span>
        <span className="text-[11px] text-ink-2">· {sorted.length} jogadores</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">
            <th className="text-left px-4 py-2 font-semibold">Jogador</th>
            <th className="text-center px-2 py-2 font-semibold">Pos</th>
            <th className="text-right px-4 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const badge = statusBadgeStyle(p.current_status);
            return (
              <tr key={p.player_id} className="border-t border-line hover:bg-canvas-2/40 transition-colors">
                <td className="px-4 py-2">
                  <Link
                    to={`/nba-dashboard/${slugify(p.player_name)}`}
                    className="flex items-center gap-2.5 group"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-ink-3 border border-line shrink-0">
                      <img
                        src={getPlayerPhotoUrl(p.player_name, teamAbbr)}
                        alt={p.player_name}
                        className="w-full h-full object-cover object-top"
                        loading="lazy"
                        onError={(e) => {
                          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, p.player_name, teamAbbr);
                          if (!didTry) {
                            const el = e.target as HTMLImageElement;
                            el.style.display = 'none';
                            if (el.parentElement) {
                              const initials = p.player_name.split(' ').map(n => n[0]).join('').slice(0, 2);
                              el.parentElement.innerHTML = `<span class="text-[9px] font-semibold text-ink-2">${initials}</span>`;
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] text-ink font-medium truncate group-hover:text-forest transition-colors">
                        {p.player_name}
                      </div>
                      {p.rating_stars > 0 && (
                        <div className="text-[10px] text-amber-500" aria-label={`${p.rating_stars} estrelas`}>
                          {'★'.repeat(Math.min(3, p.rating_stars))}
                        </div>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-2 py-2 text-center text-[12px] text-ink-2 tabular-nums">{p.position || '—'}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`inline-flex items-center px-2 h-5 rounded text-[10px] font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── LineupsSection (mobile com toggle, desktop side-by-side) ─────────────

function LineupsSection({
  homePlayers, homeAbbr, homeName,
  visitorPlayers, visitorAbbr, visitorName,
}: {
  homePlayers: TeamPlayer[];
  homeAbbr: string;
  homeName: string;
  visitorPlayers: TeamPlayer[];
  visitorAbbr: string;
  visitorName: string;
}) {
  const [view, setView] = useState<'home' | 'visitor'>('home');
  return (
    <>
      {/* Mobile: toggle de time (full width, com logo) + uma única tabela */}
      <div className="lg:hidden">
        <div className="mb-3 grid grid-cols-2 bg-canvas-2 rounded-md p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setView('home')}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-[12px] font-semibold transition-all ${
              view === 'home' ? 'bg-white text-ink shadow-[0_1px_2px_-1px_rgba(0,0,0,0.08)]' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <img
              src={getTeamLogoUrl(homeName)}
              alt={homeAbbr}
              className="w-4 h-4 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {homeAbbr}
          </button>
          <button
            type="button"
            onClick={() => setView('visitor')}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-[12px] font-semibold transition-all ${
              view === 'visitor' ? 'bg-white text-ink shadow-[0_1px_2px_-1px_rgba(0,0,0,0.08)]' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <img
              src={getTeamLogoUrl(visitorName)}
              alt={visitorAbbr}
              className="w-4 h-4 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {visitorAbbr}
          </button>
        </div>
        {view === 'home' ? (
          <LineupTable players={homePlayers} teamAbbr={homeAbbr} teamName={homeName} />
        ) : (
          <LineupTable players={visitorPlayers} teamAbbr={visitorAbbr} teamName={visitorName} />
        )}
      </div>

      {/* Desktop: lado a lado */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4">
        <LineupTable players={homePlayers} teamAbbr={homeAbbr} teamName={homeName} />
        <LineupTable players={visitorPlayers} teamAbbr={visitorAbbr} teamName={visitorName} />
      </div>
    </>
  );
}

// ─── Box Score Table ──────────────────────────────────────────────────────

// RPC retorna home_away como "Casa" / "Fora" (PT). Normaliza para 'home' / 'visitor'.
function normalizeHomeAway(value: string | null | undefined): 'home' | 'visitor' | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === 'casa' || v === 'home') return 'home';
  if (v === 'fora' || v === 'visitor' || v === 'away') return 'visitor';
  return null;
}

function BoxScoreTable({
  rows, homeAbbr, visitorAbbr,
}: {
  rows: BoxScorePlayer[];
  homeAbbr: string;
  visitorAbbr: string;
}) {
  const [view, setView] = useState<'all' | 'home' | 'visitor'>('all');

  const filtered = useMemo(() => {
    let r = rows;
    if (view === 'home') r = rows.filter(p => normalizeHomeAway(p.home_away) === 'home');
    if (view === 'visitor') r = rows.filter(p => normalizeHomeAway(p.home_away) === 'visitor');
    return [...r].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  }, [rows, view]);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-8 text-center">
        <p className="text-sm text-ink-2">Box score ainda não disponível.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-line">
        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Box Score · {filtered.length}</span>
        <div className="inline-flex items-center bg-canvas-2 rounded-md p-0.5">
          {([['all','Ambos'],['home',homeAbbr],['visitor',visitorAbbr]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                view === k
                  ? 'bg-white text-ink shadow-[0_1px_2px_-1px_rgba(0,0,0,0.08)]'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold border-b border-line">
              <th className="text-left px-4 py-2 font-semibold">Jogador</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">Pts</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">Reb</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums" title="Rebotes ofensivos">OReb</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums" title="Rebotes defensivos">DReb</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">Ast</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">FG%</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">FT%</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">Min</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">3PM</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">STL</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">BLK</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums">TO</th>
              <th className="text-right px-2 py-2 font-semibold tabular-nums" title="Plus/Minus">+/−</th>
              <th className="text-right px-4 py-2 font-semibold">Pos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const team = normalizeHomeAway(p.home_away) === 'home' ? homeAbbr : visitorAbbr;
              const pm = p.plus_minus ?? null;
              return (
                <tr key={p.player_id} className="border-t border-line hover:bg-canvas-2/40 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-ink-3 border border-line shrink-0">
                        <img
                          src={getPlayerPhotoUrl(p.player_name, team)}
                          alt={p.player_name}
                          className="w-full h-full object-cover object-top"
                          loading="lazy"
                          onError={(e) => {
                            const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, p.player_name, team);
                            if (!didTry) {
                              const el = e.target as HTMLImageElement;
                              el.style.display = 'none';
                              if (el.parentElement) {
                                el.parentElement.innerHTML = `<span class="text-[8px] font-semibold text-ink-2">${p.player_name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>`;
                              }
                            }
                          }}
                        />
                      </div>
                      <span className="text-[12px] text-ink truncate">{p.player_name}</span>
                      <span className="text-[10px] text-ink-2">{team}</span>
                    </div>
                  </td>
                  <td className="text-right px-2 py-2 tabular-nums font-semibold text-ink">{p.points ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{p.rebounds ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums text-ink-2">{p.offensive_rebounds ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums text-ink-2">{p.defensive_rebounds ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{p.assists ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{formatPct(p.fg_pct)}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{formatPct(p.ft_pct)}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{p.minutes != null ? `${Math.round(p.minutes)}'` : '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{p.threes ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{p.steals ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{p.blocks ?? '—'}</td>
                  <td className="text-right px-2 py-2 tabular-nums">{p.turnovers ?? '—'}</td>
                  <td className={`text-right px-2 py-2 tabular-nums font-semibold ${pm == null ? '' : pm > 0 ? 'text-forest' : pm < 0 ? 'text-status-danger' : 'text-ink-2'}`}>
                    {pm == null ? '—' : pm > 0 ? `+${pm}` : pm}
                  </td>
                  <td className="text-right px-4 py-2 text-ink-2">{p.player_position || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Game Opportunities (dado real, filtrado de Análise 360) ──────────────

const STAT_LABEL_PT_LOCAL: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_points_rebounds_assists: 'PRA',
};

function GameOpportunitiesTable({
  opportunities, gameAbbrLabel,
}: {
  opportunities: DailyOpportunity[];
  gameAbbrLabel: string;
}) {
  const navigate = useNavigate();
  if (opportunities.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-8 text-center">
        <p className="text-sm text-ink-2 mb-1">Nenhuma oportunidade mapeada para {gameAbbrLabel} hoje.</p>
        <button
          type="button"
          onClick={() => navigate('/oportunidades')}
          className="text-[12px] font-semibold text-forest hover:underline mt-2 inline-flex items-center gap-1"
        >
          Ver todas oportunidades do dia
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }
  const sorted = [...opportunities].sort((a, b) => (b.score ?? b.gap_pct ?? 0) - (a.score ?? a.gap_pct ?? 0));

  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-line bg-canvas-2/40">
        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">
          Oportunidades · {sorted.length} {sorted.length === 1 ? 'pick' : 'picks'}
        </span>
        <button
          type="button"
          onClick={() => navigate('/oportunidades')}
          className="text-[11px] font-semibold text-forest hover:underline inline-flex items-center gap-1"
        >
          Ver todas
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold border-b border-line">
            <th className="text-left px-4 py-2 font-semibold">Jogador</th>
            <th className="text-left px-2 py-2 font-semibold">Stat</th>
            <th className="text-right px-2 py-2 font-semibold tabular-nums">Com</th>
            <th className="text-right px-2 py-2 font-semibold tabular-nums">Sem</th>
            <th className="text-right px-2 py-2 font-semibold tabular-nums">Linha</th>
            <th className="text-right px-2 py-2 font-semibold tabular-nums">Gap</th>
            <th className="text-right px-4 py-2 font-semibold">Score</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o, i) => {
            const isPos = o.gap_pct > 0;
            return (
              <tr
                key={i}
                className="border-t border-line hover:bg-canvas-2/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/analise-360/${o.trigger_player_id}`)}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-ink font-medium">{o.backup_player_name}</span>
                    <span className="text-[10px] text-ink-2">sem {o.trigger_name.split(' ').slice(-1)[0]}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-ink-2">{STAT_LABEL_PT_LOCAL[o.stat_type] ?? o.stat_type}</td>
                <td className="px-2 py-2 text-right tabular-nums">{o.avg_com.toFixed(1)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink">{o.avg_sem.toFixed(1)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{o.line_value != null ? o.line_value.toFixed(1) : '—'}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-semibold ${isPos ? 'text-forest' : 'text-status-danger'}`}>
                  {isPos ? '+' : ''}{o.gap_pct.toFixed(0)}%
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={`inline-flex items-center px-2 h-5 rounded text-[10px] font-bold tabular-nums ${
                    (o.score ?? 0) >= 75
                      ? 'bg-emerald-100 text-emerald-700'
                      : (o.score ?? 0) >= 60
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-ink-3 text-ink-2'
                  }`}>
                    {o.score ?? '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

type TabKey = 'lineups' | 'boxscore' | 'bets';

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const posthog = usePostHog();

  const initCache = gameId ? gameDetailCache.get(gameId) : undefined;
  const [game, setGame] = useState<Game | null>(initCache?.game ?? null);
  const [homePlayers, setHomePlayers] = useState<TeamPlayer[]>(initCache?.homePlayers ?? []);
  const [visitorPlayers, setVisitorPlayers] = useState<TeamPlayer[]>(initCache?.visitorPlayers ?? []);
  const [homeTeam, setHomeTeam] = useState<Team | null>(initCache?.homeTeam ?? null);
  const [visitorTeam, setVisitorTeam] = useState<Team | null>(initCache?.visitorTeam ?? null);
  const [isLoadingGame, setIsLoadingGame] = useState(!initCache);
  const [boxScore, setBoxScore] = useState<BoxScorePlayer[]>([]);
  const [isLoadingBoxScore, setIsLoadingBoxScore] = useState(false);
  const [b2bData, setB2bData] = useState<{ home: B2BBoxScorePlayer[]; visitor: B2BBoxScorePlayer[] }>(initCache?.b2bData ?? { home: [], visitor: [] });
  const [b2bLoaded, setB2bLoaded] = useState(!!initCache?.b2bData);
  const hasLoaded = useRef(false);

  const finished = game?.winner_team_id != null;
  const isB2B = !!(game?.home_team_is_b2b_game || game?.visitor_team_is_b2b_game);

  const [activeTab, setActiveTab] = useState<TabKey>('lineups');

  // Quando game muda (depois do carregamento), seta tab inicial certa
  useEffect(() => {
    if (game) setActiveTab(finished ? 'boxscore' : 'lineups');
  }, [game?.game_id, finished]);

  // Analytics: visualização do detalhe de jogo NBA (Marco 3 — retenção por superfície, N3).
  useEffect(() => {
    posthog?.capture('nba_game_viewed', { game_id: gameId });
  }, [gameId, posthog]);

  useEffect(() => {
    if (!authLoading && user && !hasLoaded.current) {
      loadGameData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, authLoading, user]);

  // Box score lazy load (caso preload não tenha completado)
  useEffect(() => {
    if (activeTab === 'boxscore' && game && finished && boxScore.length === 0 && !isLoadingBoxScore) {
      setIsLoadingBoxScore(true);
      nbaDataService.getGameBoxScore(game.game_id)
        .then(data => setBoxScore(data))
        .catch(err => console.error('Error loading box score:', err))
        .finally(() => setIsLoadingBoxScore(false));
    }
  }, [activeTab, game?.game_id, finished, boxScore.length, isLoadingBoxScore]);

  // B2B context — apenas dado real do back (sem mock de viagem/insight)
  const b2bSummary = useMemo<{ teamName: string; teamAbbr: string; summary: B2BPrevSummary } | null>(() => {
    if (!game || !isB2B) return null;
    const which: 'home' | 'visitor' = game.home_team_is_b2b_game ? 'home' : 'visitor';
    const teamName = which === 'home' ? game.home_team_name : game.visitor_team_name;
    const teamAbbr = which === 'home' ? game.home_team_abbreviation : game.visitor_team_abbreviation;
    const players = (which === 'home' ? b2bData.home : b2bData.visitor) ?? [];
    const keyPlayers = players
      .filter(p => p.minutes != null && p.minutes > 0)
      .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))
      .slice(0, 3)
      .map(p => ({ playerName: p.player_name, minutes: Math.round(p.minutes ?? 0), points: p.points ?? 0 }));
    const prevHomeAway = players[0]?.previous_home_away;
    const isHome = prevHomeAway === 'home' || prevHomeAway === 'Casa';
    return {
      teamName,
      teamAbbr,
      summary: {
        opponentAbbr: players[0]?.previous_opponent ?? '???',
        isHome,
        teamScore: players[0]?.previous_team_score ?? null,
        opponentScore: players[0]?.previous_opponent_score ?? null,
        gameDateISO: players[0]?.previous_game_date ?? null,
        gameDatetimeBrasilia: players[0]?.previous_game_datetime_brasilia ?? null,
        keyPlayers,
      },
    };
  }, [game?.game_id, isB2B, b2bData]);

  // Oportunidades do jogo (real) — vínculo com tela de Oportunidades / Análise 360
  const analise360 = useAnalise360Data();
  const gameOpps = useMemo(() => {
    if (!game) return [] as DailyOpportunity[];
    const allOpps = analise360.data?.opportunities ?? [];
    return allOpps.filter(o => o.game_id === game.game_id);
  }, [game?.game_id, analise360.data]);

  if (authLoading) {
    return (
      <div className="theme-rebrand min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-forest" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  async function loadGameData() {
    if (!gameId) return;
    const cached = gameDetailCache.get(gameId);
    if (cached) {
      setGame(cached.game);
      setHomePlayers(cached.homePlayers);
      setVisitorPlayers(cached.visitorPlayers);
      setHomeTeam(cached.homeTeam);
      setVisitorTeam(cached.visitorTeam);
      setIsLoadingGame(false);
      hasLoaded.current = true;
      return;
    }

    try {
      setIsLoadingGame(true);
      const params = new URLSearchParams(location.search);
      const gameDate = params.get('date') || undefined;

      let found: Game | undefined;
      if (gameDate) {
        const cgames = gamesCache.get(gameDate);
        if (cgames) found = cgames.find(g => g.game_id === parseInt(gameId));
      }
      if (!found) {
        const games = await nbaDataService.getGames({ gameDate });
        found = games.find(g => g.game_id === parseInt(gameId));
      }
      if (!found) {
        toast({ title: 'Jogo não encontrado', variant: 'destructive' });
        navigate('/home-games');
        return;
      }

      setGame(found);
      setIsLoadingGame(false);

      const [hp, ht, vp, vt] = await Promise.allSettled([
        nbaDataService.getTeamPlayers(found.home_team_id),
        nbaDataService.getTeamById(found.home_team_id),
        nbaDataService.getTeamPlayers(found.visitor_team_id),
        nbaDataService.getTeamById(found.visitor_team_id),
      ]);

      const loadedHp = hp.status === 'fulfilled' ? hp.value : [];
      const loadedHt = ht.status === 'fulfilled' ? ht.value : null;
      const loadedVp = vp.status === 'fulfilled' ? vp.value : [];
      const loadedVt = vt.status === 'fulfilled' ? vt.value : null;
      setHomePlayers(loadedHp);
      setHomeTeam(loadedHt);
      setVisitorPlayers(loadedVp);
      setVisitorTeam(loadedVt);

      gameDetailCache.set(gameId, {
        game: found,
        homePlayers: loadedHp,
        visitorPlayers: loadedVp,
        homeTeam: loadedHt,
        visitorTeam: loadedVt,
      });
      hasLoaded.current = true;

      // Preload box score / B2B
      if (found.winner_team_id != null) {
        nbaDataService.getGameBoxScore(found.game_id)
          .then(data => setBoxScore(data))
          .catch(err => console.error('preload box score:', err));
      }
      // Carrega B2B sempre que algum time estiver em back-to-back (futuro ou passado — em review é útil pra entender o resultado).
      const wantsB2B = found.home_team_is_b2b_game || found.visitor_team_is_b2b_game;
      if (wantsB2B) {
        const newB2B: { home: B2BBoxScorePlayer[]; visitor: B2BBoxScorePlayer[] } = { home: [], visitor: [] };
        const proms: Promise<void>[] = [];
        if (found.home_team_is_b2b_game) {
          proms.push(
            nbaDataService.getB2BPreviousGameBoxScore(found.game_id, found.home_team_id)
              .then(d => { newB2B.home = d; })
              .catch(() => {})
          );
        }
        if (found.visitor_team_is_b2b_game) {
          proms.push(
            nbaDataService.getB2BPreviousGameBoxScore(found.game_id, found.visitor_team_id)
              .then(d => { newB2B.visitor = d; })
              .catch(() => {})
          );
        }
        Promise.all(proms).then(() => {
          setB2bData(newB2B);
          setB2bLoaded(true);
          const c = gameDetailCache.get(gameId);
          if (c) gameDetailCache.set(gameId, { ...c, b2bData: newB2B });
        });
      }
    } catch (err) {
      console.error('loadGameData:', err);
      toast({ title: 'Erro ao carregar', description: 'Falha ao carregar o jogo.', variant: 'destructive' });
    } finally {
      setIsLoadingGame(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>{game ? `${game.home_team_abbreviation} vs ${game.visitor_team_abbreviation}` : 'Jogo'} — Smart Betting</title>
      </Helmet>

      <div className="theme-rebrand min-h-screen bg-canvas text-ink">
        <NBAHomeNav showBack backTo="/home-games" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
          {isLoadingGame || !game ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-44 w-full rounded-xl bg-canvas-2" />
              <Skeleton className="h-24 w-full rounded-xl bg-canvas-2" />
              <Skeleton className="h-64 w-full rounded-xl bg-canvas-2" />
            </div>
          ) : (
            <>
              {/* Hero */}
              <HeroCard game={game} homeTeam={homeTeam} visitorTeam={visitorTeam} />

              {/* Ângulo do confronto */}
              <MatchupAngleCard
                homeAbbr={game.home_team_abbreviation}
                homeTeam={homeTeam}
                homeId={game.home_team_id}
                visitorAbbr={game.visitor_team_abbreviation}
                visitorTeam={visitorTeam}
                visitorId={game.visitor_team_id}
              />

              {/* B2B alert — só renderiza se houver dado real do back */}
              {b2bSummary && b2bSummary.summary.keyPlayers.length > 0 && (
                <B2BAlertCard
                  team={{ name: b2bSummary.teamName, abbreviation: b2bSummary.teamAbbr }}
                  summary={b2bSummary.summary}
                  currentGameDateISO={game.game_date}
                />
              )}

              {/* Tabs */}
              <div>
                <div className="border-b border-line flex items-center gap-0.5 md:gap-1">
                  {finished ? (
                    <TabButton
                      active={activeTab === 'boxscore'}
                      onClick={() => setActiveTab('boxscore')}
                      label="Box Score"
                      count={boxScore.length || undefined}
                    />
                  ) : (
                    <>
                      <TabButton
                        active={activeTab === 'lineups'}
                        onClick={() => setActiveTab('lineups')}
                        label="Escalações & Injury"
                        count={homePlayers.length + visitorPlayers.length}
                      />
                      <TabButton
                        active={activeTab === 'bets'}
                        onClick={() => setActiveTab('bets')}
                        label="Oportunidades do jogo"
                        count={gameOpps.length}
                      />
                    </>
                  )}
                </div>

                <div className="mt-4">
                  {activeTab === 'boxscore' && (
                    isLoadingBoxScore ? (
                      <div className="bg-white border border-line rounded-xl p-8 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-forest opacity-70 mx-auto" />
                      </div>
                    ) : (
                      <BoxScoreTable
                        rows={boxScore}
                        homeAbbr={game.home_team_abbreviation}
                        visitorAbbr={game.visitor_team_abbreviation}
                      />
                    )
                  )}
                  {activeTab === 'lineups' && (
                    <LineupsSection
                      homePlayers={homePlayers}
                      homeAbbr={game.home_team_abbreviation}
                      homeName={game.home_team_name}
                      visitorPlayers={visitorPlayers}
                      visitorAbbr={game.visitor_team_abbreviation}
                      visitorName={game.visitor_team_name}
                    />
                  )}
                  {activeTab === 'bets' && (
                    <GameOpportunitiesTable
                      opportunities={gameOpps}
                      gameAbbrLabel={`${game.home_team_abbreviation} vs ${game.visitor_team_abbreviation}`}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
