import { Crest } from './Crest';
import { fmtTime, isFinished, isLive } from '@/utils/futebol-datas';
import { chancePct, marketShort, pickLabel } from '@/utils/futebol-score';
import { REGUA_SCORE } from '@/utils/futebol-leitura';
import { settleFutebol, isHit } from '@/utils/futebol-settlement';
import type { FutebolFixture, FutebolValueBoardRow } from '@/services/futebol-data.service';

/**
 * Uma linha de jogo na lista.
 *
 * Times EMPILHADOS (casa em cima, fora embaixo), não lado a lado. A versão lado a
 * lado dava dois nomes truncados a ~100px em tela de 375px, e "A. × R." não é jogo
 * nenhum. Empilhado, o nome ganha a largura inteira da linha e cabe em qualquer
 * viewport. É também o formato do SofaScore, inclusive no desktop.
 *
 * A LEITURA vive na própria linha (protótipo "Futebol Jogos"): mercado, pick, odd,
 * chance e o Score em selo. É o que deixa varrer o dia inteiro sem clicar em nada,
 * e sobra para o painel só a pergunta "por quê".
 *
 * Em jogo encerrado o vencedor fica em destaque e o perdedor recua, pra varredura
 * ficar mais rápida do que ler dois placares.
 */
export function FixtureRow({
  fixture,
  best,
  selected = false,
  onClick,
}: {
  fixture: FutebolFixture;
  best: FutebolValueBoardRow | null;
  selected?: boolean;
  onClick: () => void;
}) {
  const fim = isFinished(fixture.status_short);
  const live = isLive(fixture.status_short);
  const temPlacar = fim || live;
  const gh = fixture.goals_home;
  const ga = fixture.goals_away;
  const casaVenceu = fim && gh != null && ga != null && gh > ga;
  const foraVenceu = fim && gh != null && ga != null && ga > gh;

  const nomeCls = (venceu: boolean, perdeu: boolean) =>
    `truncate flex-1 min-w-0 text-[13px] tracking-tight ${
      venceu ? 'font-bold text-ink' : perdeu ? 'font-medium text-ink-3' : 'font-semibold text-ink'
    }`;
  const golCls = (venceu: boolean, perdeu: boolean) =>
    `w-5 shrink-0 text-right text-[13px] tabular-nums ${
      venceu ? 'font-bold text-ink' : perdeu ? 'font-medium text-ink-3' : 'font-semibold text-ink'
    }`;

  const alto = !!best && best.score >= 60;
  const chance = best ? chancePct(best.prob_justa_fechamento) : null;

  // Jogo encerrado não precisa mais do Score, que é uma previsão: o que importa
  // ali é se a leitura bateu. O selo vira ✓ ou ✕ pelo placar.
  const liquidacao =
    fim && best ? settleFutebol(best, gh, ga) : null;
  const bateu = liquidacao != null ? isHit(liquidacao) : null;

  return (
    <button
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className="w-full text-left px-3 sm:px-4 py-2.5 flex items-center gap-2.5 sm:gap-3.5 transition"
      style={{
        borderTop: '1px solid #f1e9d6',
        background: selected ? '#fbfdfb' : undefined,
        boxShadow: selected ? 'inset 3px 0 0 #0a3d2e' : undefined,
      }}
    >
      <div className="w-10 sm:w-11 shrink-0 text-center">
        {live ? (
          <span className="text-[9px] uppercase tracking-[0.1em] font-bold text-status-danger">Ao vivo</span>
        ) : fim ? (
          <span className="text-[9px] uppercase tracking-[0.1em] font-bold" style={{ color: '#8d8672' }}>Fim</span>
        ) : (
          <span className="text-[12.5px] font-semibold tabular-nums text-ink">{fmtTime(fixture.kickoff_utc) || '—'}</span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <Crest name={fixture.home_team_name} id={fixture.home_team_id} size={20} />
          <span className={nomeCls(casaVenceu, foraVenceu)}>{fixture.home_team_name}</span>
          {temPlacar && <span className={golCls(casaVenceu, foraVenceu)}>{gh ?? 0}</span>}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Crest name={fixture.away_team_name} id={fixture.away_team_id} size={20} />
          <span className={nomeCls(foraVenceu, casaVenceu)}>{fixture.away_team_name}</span>
          {temPlacar && <span className={golCls(foraVenceu, casaVenceu)}>{ga ?? 0}</span>}
        </div>
      </div>

      {/* A leitura da linha. No celular cabe o pick e a odd; o rótulo do mercado e a
          chance ficam para o desktop. Sem odds coletadas não existe pick, e a linha
          diz isso em cinza em vez de inventar um. */}
      <div className="w-[96px] sm:w-[160px] shrink-0 text-right min-w-0">
        <span className="hidden sm:block text-[9px] uppercase tracking-[0.14em] font-semibold" style={{ color: '#8d8672' }}>
          {best ? marketShort(best.market) : fim ? 'sem leitura' : 'sem leitura ainda'}
        </span>
        {best ? (
          <>
            <span className="block sm:mt-0.5 text-[11.5px] sm:text-[12.5px] font-semibold text-ink truncate">
              {pickLabel(best, fixture.home_team_name, fixture.away_team_name)}
            </span>
            <span className="block mt-px text-[10.5px] sm:text-[11px] tabular-nums truncate" style={{ color: '#8d8672' }}>
              odd {best.best_odd.toFixed(2)}
              {chance != null ? <span className="hidden sm:inline">{` · ${chance}% chance`}</span> : null}
            </span>
          </>
        ) : (
          <span className="block sm:mt-0.5 text-[10.5px] sm:text-[11px] truncate" style={{ color: '#8d8672' }}>
            <span className="sm:hidden">sem leitura</span>
            {/* Em jogo encerrado não faz sentido prometer que as odds entram. */}
            <span className="hidden sm:inline">{fim ? 'não teve odds coletadas' : 'odds entram perto do jogo'}</span>
          </span>
        )}
      </div>

      <div
        className="shrink-0 grid place-items-center tabular-nums font-bold w-8 h-8 sm:w-[38px] sm:h-[38px] text-[13px] sm:text-[14px]"
        style={
          !best
            ? { borderRadius: 11, background: '#fdfbf6', border: '1px dashed #e5d9bd', color: '#c4bda8' }
            : bateu != null
              ? bateu
                ? { borderRadius: 11, background: '#dcefe2', border: '1px solid #a9d4bb', color: '#0a3d2e' }
                : { borderRadius: 11, background: '#fbe3e8', border: '1px solid #f0c2cc', color: '#be123c' }
              : alto
                ? { borderRadius: 11, background: '#0a3d2e', color: '#fff' }
                : best.score >= REGUA_SCORE
                  ? { borderRadius: 11, background: '#fdf3d9', border: '1px solid #eccf85', color: '#b8870f' }
                  : { borderRadius: 11, background: '#f4eddc', color: '#8d8672' }
        }
        title={bateu != null ? (bateu ? 'a leitura bateu' : 'a leitura não bateu') : undefined}
      >
        {!best ? '—' : bateu != null ? (bateu ? '✓' : '✕') : best.score}
      </div>
    </button>
  );
}
