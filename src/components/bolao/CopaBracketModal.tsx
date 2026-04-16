import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWcMatches } from '@/hooks/use-bolao';
import { TeamFlag } from './TeamFlag';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import type { WcMatch } from '@/services/bolao.service';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Layout constants ──────────────────────────────────────────────
const CARD_W = 128;
const CARD_H = 40;
const BASE_GAP = 4;
const SLOT = CARD_H + BASE_GAP;
const STAGE_GAP = 40;
const STAGE_STEP = CARD_W + STAGE_GAP;
const LABEL_H = 28;
const R32_COUNT = 16;
const TOTAL_H = R32_COUNT * SLOT + LABEL_H;
const BRACKET_W = 5 * CARD_W + 4 * STAGE_GAP;

const STAGES: { key: string; label: string; count: number }[] = [
  { key: 'round_of_32', label: 'Rodada 32', count: 16 },
  { key: 'round_of_16', label: 'Oitavas', count: 8 },
  { key: 'quarter', label: 'Quartas', count: 4 },
  { key: 'semi', label: 'Semis', count: 2 },
  { key: 'final', label: 'Final', count: 1 },
];

function stageX(i: number) {
  return i * STAGE_STEP;
}
function cardCenterY(stageIdx: number, cardIdx: number) {
  const slotH = SLOT * Math.pow(2, stageIdx);
  return LABEL_H + slotH / 2 + cardIdx * slotH;
}

// ── Match card ────────────────────────────────────────────────────
function BracketMatchCard({
  match,
  style,
}: {
  match: WcMatch;
  style: React.CSSProperties;
}) {
  const isTbd = match.home_team_code === 'TBD';
  const homeWin =
    match.is_finished &&
    match.home_score != null &&
    match.away_score != null &&
    match.home_score > match.away_score;
  const awayWin =
    match.is_finished &&
    match.home_score != null &&
    match.away_score != null &&
    match.away_score > match.home_score;

  const dateStr = new Date(match.match_date + 'T00:00:00').toLocaleDateString(
    'pt-BR',
    { day: '2-digit', month: 'short' }
  );
  const timeStr = match.match_time_brasilia.slice(0, 5);

  return (
    <div
      className={`absolute rounded border text-[10px] leading-tight overflow-hidden ${
        match.is_finished
          ? 'border-terminal-border bg-terminal-dark-gray/40'
          : isTbd
          ? 'border-terminal-border-subtle/40 bg-terminal-dark-gray/15'
          : 'border-terminal-border bg-terminal-dark-gray/20'
      }`}
      style={{ ...style, width: CARD_W, height: CARD_H }}
    >
      <div
        className={`flex items-center gap-1 px-1.5 h-1/2 ${
          homeWin ? 'text-terminal-green font-bold' : isTbd ? 'opacity-40' : ''
        }`}
      >
        <TeamFlag code={match.home_team_code} />
        <span className="font-mono flex-1 truncate">{match.home_team_code}</span>
        {match.is_finished ? (
          <span className="tabular-nums">{match.home_score}</span>
        ) : (
          <span className="text-[8px] opacity-30 tabular-nums shrink-0">{dateStr}</span>
        )}
      </div>
      <div className="border-t border-terminal-border-subtle/20" />
      <div
        className={`flex items-center gap-1 px-1.5 h-1/2 ${
          awayWin ? 'text-terminal-green font-bold' : isTbd ? 'opacity-40' : ''
        }`}
      >
        <TeamFlag code={match.away_team_code} />
        <span className="font-mono flex-1 truncate">{match.away_team_code}</span>
        {match.is_finished ? (
          <span className="tabular-nums">{match.away_score}</span>
        ) : (
          <span className="text-[8px] opacity-30 tabular-nums shrink-0">{timeStr}</span>
        )}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────
export const CopaBracketModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { data: matches } = useWcMatches();

  // Zoom & pan state
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2))), []);
  const resetView = useCallback(() => {
    setZoom(0.85);
    setPan({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan({
        x: dragRef.current.panX + dx / zoom,
        y: dragRef.current.panY + dy / zoom,
      });
    },
    [isDragging, zoom]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.3, Math.min(2, +(z + delta).toFixed(2))));
    },
    []
  );

  const stageMatches = useMemo(() => {
    if (!matches) return {} as Record<string, WcMatch[]>;
    const byStage: Record<string, WcMatch[]> = {};
    matches
      .filter((m) => !m.group_name)
      .forEach((m) => {
        if (!byStage[m.stage]) byStage[m.stage] = [];
        byStage[m.stage].push(m);
      });
    Object.values(byStage).forEach((arr) =>
      arr.sort((a, b) => a.match_number - b.match_number)
    );
    return byStage;
  }, [matches]);

  const thirdPlace = stageMatches['third_place']?.[0];
  const hasKnockout = Object.values(stageMatches).some(
    (arr) => arr.length > 0
  );

  const connectorLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let si = 0; si < STAGES.length - 1; si++) {
      const count = STAGES[si].count;
      const xStart = stageX(si) + CARD_W + 3;
      const xEnd = stageX(si + 1) - 3;
      const xMid = (xStart + xEnd) / 2;
      for (let p = 0; p < count / 2; p++) {
        const yTop = cardCenterY(si, p * 2);
        const yBot = cardCenterY(si, p * 2 + 1);
        const yMid = (yTop + yBot) / 2;
        lines.push({ x1: xStart, y1: yTop, x2: xMid, y2: yTop });
        lines.push({ x1: xStart, y1: yBot, x2: xMid, y2: yBot });
        lines.push({ x1: xMid, y1: yTop, x2: xMid, y2: yBot });
        lines.push({ x1: xMid, y1: yMid, x2: xEnd, y2: yMid });
      }
    }
    return lines;
  }, []);

  // Reset view when modal opens
  React.useEffect(() => {
    if (open) resetView();
  }, [open, resetView]);

  if (!hasKnockout) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-terminal-bg border-terminal-border text-terminal-text max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Mata-mata — Copa 2026
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full border-2 border-terminal-border-subtle flex items-center justify-center mx-auto mb-4 opacity-30">
              <span className="text-2xl font-bold">?</span>
            </div>
            <p className="text-sm font-medium opacity-60">
              Mata-mata ainda não começou
            </p>
            <p className="text-xs opacity-40 mt-1">
              Os confrontos serão definidos após a fase de grupos
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const zoomPct = Math.round(zoom * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-bg border-terminal-border text-terminal-text max-w-[95vw] w-auto max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3">
          <DialogTitle className="text-base font-bold">
            Mata-mata — Copa 2026
          </DialogTitle>
        </DialogHeader>

        {/* Viewport with zoom + pan */}
        <div
          className="flex-1 overflow-hidden relative select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Zoom controls — floating bottom-right */}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-terminal-dark-gray/90 border border-terminal-border-subtle rounded-lg p-1 backdrop-blur-sm pointer-events-auto">
            <button
              onClick={(e) => { e.stopPropagation(); zoomOut(); }}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-terminal-gray/40 transition-colors text-terminal-text"
              title="Diminuir zoom"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] tabular-nums opacity-60 w-9 text-center">
              {zoomPct}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); zoomIn(); }}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-terminal-gray/40 transition-colors text-terminal-text"
              title="Aumentar zoom"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-terminal-border-subtle mx-0.5" />
            <button
              onClick={(e) => { e.stopPropagation(); resetView(); }}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-terminal-gray/40 transition-colors text-terminal-text"
              title="Resetar visualização"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Transformable canvas */}
          <div
            className="origin-top-left will-change-transform"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              width: BRACKET_W,
              height: TOTAL_H + 80,
            }}
          >
            {/* Bracket */}
            <div
              className="relative"
              style={{ width: BRACKET_W, height: TOTAL_H }}
            >
              {/* Stage labels */}
              {STAGES.map((stage, i) => (
                <div
                  key={stage.key + '-label'}
                  className="absolute text-[9px] uppercase font-bold tracking-wider text-terminal-blue text-center"
                  style={{ left: stageX(i), top: 0, width: CARD_W }}
                >
                  {stage.label}
                </div>
              ))}

              {/* SVG connectors */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={BRACKET_W}
                height={TOTAL_H}
              >
                {connectorLines.map((l, i) => (
                  <line
                    key={i}
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>

              {/* Match cards */}
              {STAGES.map((stage, si) => {
                const roundMatches = stageMatches[stage.key] || [];
                return roundMatches.map((m, mi) => (
                  <BracketMatchCard
                    key={m.id}
                    match={m}
                    style={{
                      left: stageX(si),
                      top: cardCenterY(si, mi) - CARD_H / 2,
                    }}
                  />
                ));
              })}
            </div>

            {/* 3rd place */}
            {thirdPlace && (
              <div className="mt-4 pt-4 border-t border-terminal-border-subtle/30">
                <p className="text-[9px] uppercase font-bold tracking-wider text-terminal-blue mb-2">
                  Disputa de 3º Lugar
                </p>
                <div
                  className={`inline-block rounded border text-[10px] leading-tight overflow-hidden ${
                    thirdPlace.home_team_code === 'TBD'
                      ? 'border-terminal-border-subtle/40 bg-terminal-dark-gray/15'
                      : 'border-terminal-border bg-terminal-dark-gray/20'
                  }`}
                  style={{ width: CARD_W, height: CARD_H }}
                >
                  <div
                    className={`flex items-center gap-1 px-1.5 h-1/2 ${
                      thirdPlace.home_team_code === 'TBD' ? 'opacity-40' : ''
                    }`}
                  >
                    <TeamFlag code={thirdPlace.home_team_code} />
                    <span className="font-mono flex-1 truncate">
                      {thirdPlace.home_team_code}
                    </span>
                  </div>
                  <div className="border-t border-terminal-border-subtle/20" />
                  <div
                    className={`flex items-center gap-1 px-1.5 h-1/2 ${
                      thirdPlace.away_team_code === 'TBD' ? 'opacity-40' : ''
                    }`}
                  >
                    <TeamFlag code={thirdPlace.away_team_code} />
                    <span className="font-mono flex-1 truncate">
                      {thirdPlace.away_team_code}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
