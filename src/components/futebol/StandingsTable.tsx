import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Crest } from './Crest';
import type { FutebolStandingRow } from '@/services/futebol-data.service';

/**
 * A classificação, em blocos por zona.
 *
 * Antes eram as 9 primeiras linhas com um "tabela completa" que abria modal. Duas
 * perdas nisso: o rebaixamento, que é metade do interesse de quem acompanha, só
 * existia dentro do modal; e a zona só aparecia como uma barrinha colorida sem
 * legenda. Aqui as pontas ficam sempre à vista (classificação e rebaixamento) e o
 * miolo, que é onde ninguém olha, abre e fecha (protótipo "Futebol Campeonato").
 *
 * Os blocos NÃO são fixos em G4/G6/Z4: eles saem do `rank_description` oficial da
 * API, que muda por liga e por temporada. No Brasileirão dá Libertadores (1-5),
 * Sul-Americana (6-11), miolo e rebaixamento; na Premier daria Champions e
 * Europa. Liga sem descrição vira um bloco só, sem inventar zona.
 */

const GRID = 'grid grid-cols-[26px_1fr_24px_24px_24px_24px_34px_38px] gap-1.5 items-center';
const GRID_M = 'grid grid-cols-[22px_1fr_24px_32px_34px] gap-2 items-center';

/** Traduz a descrição oficial da API para o rótulo curto que vai na tela. */
function rotuloZona(desc: string): { texto: string; cor: string } {
  const d = desc.toLowerCase();
  if (d.includes('relegation')) return { texto: 'Rebaixamento', cor: '#be123c' };
  if (d.includes('libertadores')) {
    return d.includes('qualification')
      ? { texto: 'Pré-Libertadores', cor: '#2f7d50' }
      : { texto: 'Libertadores', cor: '#0a3d2e' };
  }
  if (d.includes('sudamericana')) return { texto: 'Sul-Americana', cor: '#1a5fb4' };
  if (d.includes('champions league')) return { texto: 'Champions League', cor: '#0a3d2e' };
  if (d.includes('europa league')) return { texto: 'Europa League', cor: '#2f7d50' };
  if (d.includes('conference')) return { texto: 'Conference League', cor: '#1a5fb4' };
  if (d.includes('promotion')) return { texto: 'Acesso', cor: '#0a3d2e' };
  return { texto: desc, cor: '#6b6350' };
}

type Bloco = { chave: string; zona: { texto: string; cor: string } | null; linhas: FutebolStandingRow[] };

/** Quebra a tabela em faixas seguidas de mesma descrição. */
function blocos(rows: FutebolStandingRow[]): Bloco[] {
  const out: Bloco[] = [];
  rows.forEach((r) => {
    const desc = r.rank_description ?? '';
    const ultimo = out[out.length - 1];
    if (ultimo && (ultimo.linhas[0].rank_description ?? '') === desc) {
      ultimo.linhas.push(r);
      return;
    }
    // Chave pelo time, não pelo rank: em copa com grupos o rank repete (1 a 4 em
    // cada grupo) e dois blocos acabavam com a mesma chave.
    out.push({ chave: `${desc}-${r.team_id}`, zona: desc ? rotuloZona(desc) : null, linhas: [r] });
  });
  return out;
}

function Linha({
  r,
  onTeam,
  cor,
  compacto,
}: {
  r: FutebolStandingRow;
  onTeam: (id: number) => void;
  cor: string | null;
  compacto: boolean;
}) {
  const sgTexto = r.goals_diff > 0 ? `+${r.goals_diff}` : r.goals_diff < 0 ? `−${Math.abs(r.goals_diff)}` : '0';
  const sgCor = r.goals_diff > 0 ? '#0a3d2e' : r.goals_diff < 0 ? '#be123c' : '#6b6350';
  const num = 'text-center text-[11.5px] tabular-nums';

  return (
    <button
      onClick={() => onTeam(r.team_id)}
      className={`w-full text-left px-3 sm:px-4 py-2 hover:bg-canvas-2 transition ${compacto ? GRID_M : GRID}`}
      style={{ borderTop: '1px solid #f1e9d6' }}
    >
      <span className="flex items-center gap-1">
        <span
          className="w-[3px] h-4 rounded-full shrink-0"
          style={{ background: cor ?? 'transparent' }}
        />
        <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: '#6b6350' }}>
          {r.rank}
        </span>
      </span>
      <span className="flex items-center gap-2 min-w-0">
        <Crest name={r.team_name} id={r.team_id} size={20} />
        <span className="text-[12px] font-semibold text-ink truncate">{r.team_name}</span>
      </span>
      <span className={num} style={{ color: '#6b6350' }}>{r.played}</span>
      {!compacto && <span className={num} style={{ color: '#6b6350' }}>{r.wins}</span>}
      {!compacto && <span className={num} style={{ color: '#6b6350' }}>{r.draws}</span>}
      {!compacto && <span className={num} style={{ color: '#6b6350' }}>{r.loses}</span>}
      <span className={num} style={{ color: sgCor }}>{sgTexto}</span>
      <span className="text-center text-[13.5px] font-bold tabular-nums text-ink">{r.points}</span>
    </button>
  );
}

export function StandingsTable({
  rows,
  loading,
  onTeam,
  compacto = false,
  legenda,
  vazio,
}: {
  rows?: FutebolStandingRow[];
  loading: boolean;
  onTeam: (id: number) => void;
  /** Mobile: esconde V, E e D, que não cabem em 390px. */
  compacto?: boolean;
  /** Texto do canto direito do cabeçalho, ex.: "após 22 rodadas". */
  legenda?: string;
  /** O que dizer quando a competição não tem tabela. */
  vazio?: { titulo: string; texto: string };
}) {
  const [miolo, setMiolo] = useState(false);
  const grupos = useMemo(() => blocos(rows ?? []), [rows]);

  if (loading) {
    return (
      <div className="bg-white rounded-rebrand-lg overflow-hidden p-4 space-y-2" style={{ border: '1px solid #ded2b6' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full bg-canvas-2 rounded" />
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div
        className="bg-white rounded-rebrand-lg px-6 py-9 text-center"
        style={{ border: '1px dashed #ded2b6' }}
      >
        <div className="text-[14px] font-semibold text-ink">
          {vazio?.titulo ?? 'Classificação não disponível'}
        </div>
        <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: '#8d8672' }}>
          {vazio?.texto ?? 'Entra assim que a competição passar pela coleta.'}
        </div>
      </div>
    );
  }

  // O miolo é o bloco sem zona no meio da tabela: é o que ninguém abre. Só vale
  // esconder quando ele é grande, senão a linha de "mostrar" custa mais que as
  // linhas que ela economiza.
  const iMiolo = grupos.findIndex((g, i) => !g.zona && i > 0 && i < grupos.length - 1 && g.linhas.length >= 4);

  return (
    <div className="bg-white rounded-rebrand-lg overflow-hidden" style={{ border: '1px solid #ded2b6' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{ background: '#f4eddc', borderBottom: '1px solid #ded2b6' }}
      >
        <span className="text-[10.5px] uppercase tracking-[0.16em] font-bold" style={{ color: '#6b6350' }}>
          Classificação
        </span>
        {legenda && <span className="text-[10.5px]" style={{ color: '#8d8672' }}>{legenda}</span>}
      </div>

      <div
        className={`px-3 sm:px-4 py-2 text-[9.5px] uppercase tracking-[0.12em] font-bold ${compacto ? GRID_M : GRID}`}
        style={{ background: '#fdfbf6', borderBottom: '1px solid #f1e9d6', color: '#8d8672' }}
      >
        <span>#</span>
        <span>Time</span>
        <span className="text-center">J</span>
        {!compacto && <span className="text-center">V</span>}
        {!compacto && <span className="text-center">E</span>}
        {!compacto && <span className="text-center">D</span>}
        <span className="text-center">SG</span>
        <span className="text-center">Pts</span>
      </div>

      {grupos.map((g, i) => {
        const escondido = i === iMiolo && !miolo;
        return (
          <div key={g.chave}>
            {g.zona ? (
              <div
                className="px-3 sm:px-4 py-1.5 flex items-center gap-1.5"
                style={{ background: '#f8f4ea', borderTop: '1px solid #f1e9d6', borderBottom: '1px solid #f1e9d6' }}
              >
                <span className="w-[3px] h-2.5 rounded-full" style={{ background: g.zona.cor }} />
                <span
                  className="text-[9px] uppercase tracking-[0.12em] font-bold"
                  style={{ color: g.zona.cor }}
                >
                  {g.zona.texto} · {g.linhas.length === 1 ? `${g.linhas[0].rank}º` : `${g.linhas[0].rank}º ao ${g.linhas[g.linhas.length - 1].rank}º`}
                </span>
              </div>
            ) : i === iMiolo ? (
              <button
                onClick={() => setMiolo((v) => !v)}
                className="w-full px-3 sm:px-4 py-2.5 flex items-center gap-2 text-left"
                style={{ background: '#fdfbf6', borderTop: '1px solid #f1e9d6', borderBottom: '1px solid #f1e9d6' }}
              >
                <span className="text-[11.5px] font-semibold" style={{ color: '#6b6350' }}>
                  {g.linhas[0].rank}º ao {g.linhas[g.linhas.length - 1].rank}º · {g.linhas.length} times
                </span>
                <span className="flex-1 h-px" style={{ background: '#f1e9d6' }} />
                <span className="text-[11px] font-semibold text-forest inline-flex items-center gap-1">
                  {miolo ? 'ocultar' : 'mostrar'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${miolo ? 'rotate-180' : ''}`} />
                </span>
              </button>
            ) : null}

            {!escondido &&
              g.linhas.map((r) => (
                <Linha key={r.team_id} r={r} onTeam={onTeam} cor={g.zona?.cor ?? null} compacto={compacto} />
              ))}
          </div>
        );
      })}
    </div>
  );
}
