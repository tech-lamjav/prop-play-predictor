import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Crest } from '@/components/futebol/Crest';
import { paraTela, posicoesNoCampo, reservasDoLado, type OrientacaoDoCampo } from '@/utils/futebol-campo';
import type { FutebolLineup, FutebolLineupPlayer, FutebolInjury } from '@/services/futebol-data.service';

/** A escalação de um time noutro jogo, já reetiquetada para o lado deste. */
export interface EscalacaoDeReferencia {
  jogadores: FutebolLineupPlayer[];
  formacao: string | null;
  tecnico: string | null;
  adversario: string;
  dia: string | null;
}

/**
 * A escalação dos dois times num campo só, na referência do Sofascore.
 *
 * Eram dois campinhos lado a lado, um por time, ambos apontando para cima. Lidos
 * assim, viravam duas fichas técnicas: a partida — quem enfrenta quem, qual zaga
 * pega qual ataque — não aparecia em lugar nenhum. Num campo só, o mandante
 * ataca para a metade do visitante, e a leitura passa a ser do confronto.
 *
 * A geometria e o giro moram em `futebol-campo.ts`, e este arquivo só desenha o
 * que eles devolvem. O espelho é a regra que dá para errar calado, e é a que tem
 * teste.
 *
 * O que a fonte NÃO dá, e por isso não está aqui: foto de jogador, nota por
 * jogador e árbitro. Nada disso existe no nosso payload — as notas voltam vazias
 * até em jogo encerrado, e árbitro não existe em tabela nenhuma. Desenhar espaço
 * para eles seria prometer o que não temos.
 */
export function CampoEscalacao({
  times,
  jogadores,
  injuries,
  homeName,
  awayName,
  homeId,
  awayId,
  vazio,
  referencia,
}: {
  times: FutebolLineup[];
  jogadores: FutebolLineupPlayer[];
  injuries: FutebolInjury[];
  homeName: string;
  awayName: string;
  homeId?: number | null;
  awayId?: number | null;
  vazio: string;
  /**
   * A escalação do ÚLTIMO jogo de cada time, para o jogo cuja escalação ainda
   * não saiu. Vem por lado porque os dois times jogaram partidas diferentes, e a
   * tela precisa nomear cada uma — mostrar o time de outro jogo sem dizer de
   * onde ele veio seria a tela mentindo com cara de dado.
   */
  referencia?: {
    home?: EscalacaoDeReferencia | null;
    away?: EscalacaoDeReferencia | null;
  };
}) {
  const noCelular = useIsMobile();
  const orientacao: OrientacaoDoCampo = noCelular ? 'em-pe' : 'deitado';

  // Os dois lados montados UMA vez, e não quatro funções paralelas chaveadas no
  // mesmo `lado` espalhadas pelo render. Cada bloco abaixo é um `map` sobre isto.
  const lados = (['home', 'away'] as const).map((lado) => {
    const id = lado === 'home' ? homeId : awayId;

    // A referência só entra onde não há escalação deste jogo, e por lado: um time
    // pode ter a sua publicada e o outro não. Assim que a de verdade chega, a
    // própria presença dela desliga a referência — sem estado, sem flag.
    const proprios = posicoesNoCampo(jogadores, lado);
    const ref = proprios.length ? null : (referencia?.[lado] ?? null);
    const fonte = ref ? ref.jogadores : jogadores;
    const time = times.find((t) => t.team_side === lado);

    return {
      lado,
      id,
      ref,
      nome: lado === 'home' ? homeName : awayName,
      formacao: ref ? ref.formacao : (time?.formation ?? null),
      tecnico: ref ? ref.tecnico : (time?.coach_name ?? null),
      emCampo: ref ? posicoesNoCampo(fonte, lado) : proprios,
      reservas: reservasDoLado(fonte, lado),
      // Desfalque é sempre DESTE jogo. Puxar o do jogo passado junto com a
      // escalação diria que fulano está fora hoje porque estava fora na rodada
      // anterior, que é exatamente o contrário do que o assinante precisa saber.
      desfalques: injuries.filter((x) => x.team_id === id),
    };
  });

  const temCampo = lados.some((l) => l.emCampo.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho do campo: quem, com que desenho tático. Cada time fica na
          ponta em que joga, para o cabeçalho não desmentir o campo logo abaixo. */}
      <div className="flex items-center gap-3">
        {lados.map(({ lado, nome, id, formacao, ref }, i) => (
          <div
            key={lado}
            className={`flex-1 min-w-0 flex items-center gap-2 ${i ? 'justify-end flex-row-reverse' : ''}`}
          >
            <Crest name={nome} id={id} size={22} />
            <div className={`min-w-0 ${i ? 'text-right' : ''}`}>
              <div className="text-[13px] font-semibold text-ink truncate">{nome}</div>
              {ref ? (
                // O jogo de origem vai junto, e não só "última escalação": sem o
                // adversário e a data, o assinante não tem como julgar se aquele
                // time ainda diz alguma coisa sobre hoje.
                <div className="text-[10.5px] text-ink-3 truncate">
                  Última escalação{formacao ? ` · ${formacao}` : ''} · {ref.adversario}
                  {ref.dia ? ` · ${ref.dia}` : ''}
                </div>
              ) : (
                formacao && <div className="text-[10.5px] tabular-nums text-ink-3">{formacao}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* O campo tem a proporção de um campo de verdade — 105m por 68m — e as
          marcações saem em metros, então cada número aqui se explica sozinho:
          16,5m de profundidade da grande área, 40,32m de largura dela, 9,15m de
          raio do círculo central. O `viewBox` é o gramado em metros.

          No CELULAR ele gira: mandante em cima, atacando para baixo. Vinte e dois
          jogadores num campo deitado de 340px dariam menos de 16px por coluna, e
          nome nenhum caberia.

          No DESKTOP tem teto de largura. Sem ele, o card ocupa os 1480px da aba e
          o campo passa de 900px de altura — uma tela inteira de gramado vazio
          para mostrar 22 bolinhas. */}
      <div
        className="relative rounded-rebrand-md overflow-hidden w-full mx-auto"
        style={{
          maxWidth: noCelular ? undefined : 820,
          aspectRatio: noCelular ? '68 / 105' : '105 / 68',
          background: 'linear-gradient(160deg, #0f5238, #0a3d2e)',
        }}
      >
        <svg
          viewBox={noCelular ? '0 0 68 105' : '0 0 105 68'}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.28 }}
        >
          {noCelular ? (
            <>
              <rect x="1" y="1" width="66" height="103" fill="none" stroke="#fff" strokeWidth="0.4" />
              <line x1="1" y1="52.5" x2="67" y2="52.5" stroke="#fff" strokeWidth="0.4" />
              <circle cx="34" cy="52.5" r="9.15" fill="none" stroke="#fff" strokeWidth="0.4" />
              <rect x="13.84" y="1" width="40.32" height="16.5" fill="none" stroke="#fff" strokeWidth="0.4" />
              <rect x="13.84" y="87.5" width="40.32" height="16.5" fill="none" stroke="#fff" strokeWidth="0.4" />
            </>
          ) : (
            <>
              <rect x="1" y="1" width="103" height="66" fill="none" stroke="#fff" strokeWidth="0.4" />
              <line x1="52.5" y1="1" x2="52.5" y2="67" stroke="#fff" strokeWidth="0.4" />
              <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="#fff" strokeWidth="0.4" />
              <rect x="1" y="13.84" width="16.5" height="40.32" fill="none" stroke="#fff" strokeWidth="0.4" />
              <rect x="87.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="#fff" strokeWidth="0.4" />
            </>
          )}
        </svg>

        {/* Sem escalação publicada o gramado fica vazio e diz por quê. O que NÃO
            pode é levar o resto junto: técnico, banco e desfalques não dependem
            da escalação, e a escalação confirmada só sai perto de uma hora antes
            do apito. Some ela e some o desfalque — bem no jogo que ainda vai
            acontecer, que é onde o desfalque decide aposta. */}
        {!temCampo && (
          <div className="absolute inset-0 grid place-items-center px-6">
            <p className="text-[12.5px] text-center text-white/70">{vazio}</p>
          </div>
        )}

        {lados.flatMap(({ lado, emCampo }) =>
          emCampo.map((pos, i) => {
            const p = pos.jogador;
            const { left, top } = paraTela(pos, orientacao);
            const numero = p.shirt_number != null ? String(p.shirt_number) : (p.position?.slice(0, 1) ?? '');
            const nome = p.player_name?.split(' ').slice(-1)[0] ?? '';
            return (
              <div
                key={`${lado}-${p.player_id ?? i}`}
                className="absolute flex flex-col items-center"
                style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)' }}
              >
                <div
                  className="rounded-full grid place-items-center font-bold tabular-nums"
                  style={{
                    width: noCelular ? 22 : 27,
                    height: noCelular ? 22 : 27,
                    fontSize: noCelular ? 8.5 : 10,
                    background: '#fff',
                    color: '#0a3d2e',
                    border: '1.5px solid rgba(255,255,255,.85)',
                  }}
                >
                  {numero}
                </div>
                <span
                  className="font-semibold mt-1 px-1 rounded whitespace-nowrap"
                  style={{
                    fontSize: noCelular ? 7.5 : 9.5,
                    color: '#fff',
                    background: 'rgba(0,0,0,.42)',
                  }}
                >
                  {nome}
                </span>
              </div>
            );
          }),
        )}
      </div>

      {/* Técnico, banco e desfalques: três blocos em duas colunas, um time de
          cada lado. Os dois primeiros são dado que já vinha no payload e não
          aparecia em tela nenhuma. */}

      {/* Com escalação de referência, esta coluna mistura duas épocas: técnico,
          banco e formação são do jogo passado, e o desfalque é de hoje. A
          diferença importa — desfalque do jogo passado diria que fulano está
          fora agora porque estava fora antes, que é o contrário do que se quer
          saber. Uma frase resolve os três blocos de uma vez, em vez de um selo
          em cada título. */}
      {lados.some((l) => l.ref) && (
        <p className="text-[11px] text-ink-3 -mb-1">
          Time, formação, técnico e banco são do último jogo. Os desfalques são deste.
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        {lados.map(({ lado, tecnico }) => (
          <Bloco key={`tec-${lado}`} titulo="Técnico">
            {tecnico ? (
              <div className="text-[12.5px] font-semibold text-ink truncate">{tecnico}</div>
            ) : (
              <Vazio>Não informado</Vazio>
            )}
          </Bloco>
        ))}

        {lados.map(({ lado, reservas }) => (
          <Bloco key={`banco-${lado}`} titulo={`Banco · ${reservas.length}`}>
            {reservas.length === 0 ? (
              <Vazio>Sem reservas listados</Vazio>
            ) : (
              <div className="flex flex-col gap-1">
                {reservas.map((p, i) => (
                  <div key={p.player_id ?? i} className="flex items-baseline gap-1.5 text-[12px]">
                    <span className="tabular-nums text-ink-3 w-5 shrink-0">{p.shirt_number ?? '—'}</span>
                    <span className="text-ink truncate">{p.player_name}</span>
                    {p.position && (
                      <span className="text-[9.5px] uppercase text-ink-3 ml-auto shrink-0">{p.position}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Bloco>
        ))}

        {lados.map(({ lado, desfalques }) => (
          <Bloco key={`desf-${lado}`} titulo="Desfalques">
            {desfalques.length === 0 ? (
              <Vazio>Sem desfalques</Vazio>
            ) : (
              desfalques.map((d, i) => {
                const duvida = /quest|doubt|dúvid/i.test(d.injury_type || '');
                return (
                  <div
                    key={d.player_id ?? i}
                    className={`flex items-center gap-2 py-1.5 text-[12px] ${i ? 'border-t border-line/60' : ''}`}
                  >
                    <span className="font-semibold tracking-tight text-ink truncate">{d.player_name}</span>
                    <span className="text-[10px] text-ink-3 truncate">{d.injury_reason || d.injury_type}</span>
                    <span
                      className="px-1.5 h-4 inline-flex items-center rounded text-[9px] font-bold ml-auto shrink-0"
                      style={duvida ? { background: '#fef7df', color: '#9a6c00' } : { background: '#fde2e7', color: '#9a1f2e' }}
                    >
                      {duvida ? 'Dúvida' : 'Fora'}
                    </span>
                  </div>
                );
              })
            )}
          </Bloco>
        ))}
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.16em] font-bold mb-1.5 text-ink-3">{titulo}</div>
      {children}
    </div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <div className="text-[11px] text-ink-3">{children}</div>;
}
