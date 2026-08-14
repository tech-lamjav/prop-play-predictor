import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { LigaCrest } from '@/components/futebol/LigaCrest';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolCompetitions } from '@/hooks/use-futebol-data';
import { competitionLabel, sortCompetitions } from '@/utils/futebol-competitions';
import { brtToday, fmtDayShort, yearOf } from '@/utils/futebol-datas';

/**
 * Lista de campeonatos, ponto de entrada pra navegar por liga.
 *
 * Data-driven de propósito: sai da RPC get_futebol_competitions, não da lista fixa
 * ALL_COMPETITIONS. Aquela lista tinha 8 slugs escritos na mão enquanto o mart tinha
 * 9 competições, e a champions_league (76 jogos em 2026) não aparecia em tela nenhuma.
 * Liga nova que o Mateus subir passa a aparecer aqui sozinha, com nome humanizado até
 * alguém dar um rótulo bonito em utils/futebol-competitions.
 */

export default function FutebolCampeonatos() {
  const { data: comps, isLoading, isError } = useFutebolCompetitions();
  const hoje = brtToday();

  /** Uma linha por liga, com as temporadas que ela tem e a mais recente na frente. */
  const ligas = useMemo(() => {
    const byComp = new Map<string, { season: number; jogos: number; primeiro: string | null; ultimo: string | null }[]>();
    (comps ?? []).forEach((c) => {
      const arr = byComp.get(c.competition) ?? [];
      arr.push({ season: Number(c.season), jogos: Number(c.jogos), primeiro: c.primeiro, ultimo: c.ultimo });
      byComp.set(c.competition, arr);
    });
    return sortCompetitions([...byComp.keys()]).map((slug) => {
      const temporadas = (byComp.get(slug) ?? []).sort((a, b) => b.season - a.season);
      return { slug, temporadas, atual: temporadas[0] };
    });
  }, [comps]);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack backTo="/futebol/jogos" />

      <div className="bg-white border-b border-line">
        <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-5 md:py-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink-3">Futebol</div>
            <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">
              Campeonatos
            </h1>
            <p className="text-[13px] mt-1 text-ink-2">
              Escolha um campeonato pra ver rodadas, classificação e artilheiros.
            </p>
          </div>
          <Link
            to="/futebol/jogos"
            className="h-9 px-3 shrink-0 self-start sm:self-auto rounded-rebrand-sm text-xs font-semibold bg-white text-ink border border-line hover:bg-canvas-2 transition inline-flex items-center gap-1.5"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Jogos do dia
          </Link>
        </div>
      </div>

      <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-6 flex-1">
        {isError ? (
          <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-status-danger">
            Erro ao carregar os campeonatos.
          </div>
        ) : isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full bg-canvas-2 rounded-rebrand-md" />
            ))}
          </div>
        ) : ligas.length === 0 ? (
          <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-ink-3">
            Nenhum campeonato disponível.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ligas.map(({ slug, temporadas, atual }) => {
              // "Em andamento" é só a janela de datas do mart, não status oficial.
              const emAndamento = !!(atual?.primeiro && atual?.ultimo && atual.primeiro <= hoje && atual.ultimo >= hoje);
              return (
                <Link
                  key={slug}
                  to={`/futebol/campeonato/${slug}`}
                  className="bg-white border border-line rounded-rebrand-md p-4 hover:bg-canvas-2 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 rounded-rebrand-sm bg-canvas-2 border border-line grid place-items-center shrink-0">
                      <LigaCrest slug={slug} size={26} />
                    </div>
                    {emAndamento && (
                      <span className="px-1.5 h-5 inline-flex items-center rounded text-[9px] font-bold uppercase tracking-[0.1em] bg-forest/10 text-forest">
                        Em andamento
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-[15px] font-bold tracking-tight text-ink">{competitionLabel(slug)}</div>
                  <div className="text-[12px] text-ink-2 mt-0.5">
                    {atual ? `${atual.jogos} jogos · temporada ${atual.season}` : 'Sem jogos'}
                  </div>
                  {atual?.primeiro && atual?.ultimo && (
                    <div className="text-[11px] text-ink-3 mt-0.5">
                      {fmtDayShort(atual.primeiro)} até{' '}
                      {/* Ano só quando a temporada atravessa o ano (La Liga vai de
                          ago/2026 a mai/2027), senão "30 de mai" fica ambíguo. */}
                      {fmtDayShort(atual.ultimo, yearOf(atual.primeiro) !== yearOf(atual.ultimo))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-ink-3">
                      {temporadas.length > 1 ? `${temporadas.length} temporadas` : '1 temporada'}
                    </span>
                    <span className="text-[11px] font-semibold text-forest inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                      Abrir <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
