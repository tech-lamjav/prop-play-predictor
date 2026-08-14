import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { Crest } from './Crest';
import { ehMataMata, rodadaLonga } from '@/utils/futebol-rodadas';
import { isFinished } from '@/utils/futebol-datas';
import { competitionLabel } from '@/utils/futebol-competitions';
import type { FutebolFixture } from '@/services/futebol-data.service';

/**
 * O chaveamento da copa: uma coluna por fase, afunilando até a final.
 *
 * Mora na coluna da direita, na mesma largura da classificação e dos artilheiros,
 * e não na largura da tela: a chave inteira ali dentro fica pequena, então o card
 * se arrasta com o mouse e tem um "expandir" que abre num pop-up com zoom e
 * arrasto, já enquadrada. Foi a correção pedida depois das duas primeiras
 * versões (lista empilhada, depois chave ocupando a página inteira).
 *
 * De onde sai cada coisa (tudo de fact_fixtures, sem tabela nova):
 *  - Ida e volta viram UM confronto: os jogos da fase são agrupados pelo par de
 *    times. O número ao lado do time é o agregado dos jogos já encerrados.
 *  - Quem passou sai da FASE SEGUINTE: se o time aparece lá, ele passou. É o
 *    único jeito honesto, porque o placar do mart é o dos 90 minutos e não conta
 *    pênalti. Sem a fase seguinte coletada, o agregado decide, e agregado
 *    empatado fica sem vencedor em vez de chutar um.
 *  - As fases que ainda não aconteceram entram como "a definir", SEM ligar com
 *    quem vem de onde: quem enfrenta quem na fase seguinte depende de sorteio ou
 *    de regra da competição, e isso o dado não diz. Desenhar a linha seria
 *    inventar.
 */

/** O formato de cada competição, em uma linha. Só o que é estável e checável. */
const FORMATOS: Record<string, string> = {
  copa_do_brasil: 'mata-mata em ida e volta, com final em dois jogos',
  libertadores: '8 grupos, 2 passam por grupo, mata-mata em ida e volta e final única',
  sudamericana: '8 grupos, mata-mata em ida e volta e final única',
  champions_league: 'fase de liga, playoff, mata-mata em ida e volta e final única',
  copa_mundo: 'grupos e mata-mata em jogo único',
};

type Lado = { id: number; nome: string; gols: number };
type Confronto = {
  chave: string;
  a: Lado;
  b: Lado;
  jogos: FutebolFixture[];
  encerrado: boolean;
  classificado: number | null;
};
type Coluna = { chave: string; titulo: string; confrontos: Confronto[]; vagas: number };

/** Nome da fase pelo número de confrontos, pras fases que ainda não existem. */
function tituloPorVagas(n: number): string {
  if (n <= 1) return 'Final';
  if (n === 2) return 'Semifinal';
  if (n === 4) return 'Quartas de final';
  if (n === 8) return 'Oitavas de final';
  if (n === 16) return '16 avos de final';
  if (n === 32) return '32 avos de final';
  return `${n} confrontos`;
}

function montaConfrontos(jogos: FutebolFixture[], idsDaProxima: Set<number>): Confronto[] {
  const mapa = new Map<string, Confronto>();

  jogos.forEach((f) => {
    const chave = [f.home_team_id, f.away_team_id].sort((x, y) => x - y).join('-');
    let c = mapa.get(chave);
    if (!c) {
      c = {
        chave,
        a: { id: f.home_team_id, nome: f.home_team_name, gols: 0 },
        b: { id: f.away_team_id, nome: f.away_team_name, gols: 0 },
        jogos: [],
        encerrado: true,
        classificado: null,
      };
      mapa.set(chave, c);
    }
    c.jogos.push(f);
    const fim = isFinished(f.status_short);
    if (!fim) c.encerrado = false;
    if (fim && f.goals_home != null && f.goals_away != null) {
      const casaEhA = f.home_team_id === c.a.id;
      c.a.gols += casaEhA ? f.goals_home : f.goals_away;
      c.b.gols += casaEhA ? f.goals_away : f.goals_home;
    }
  });

  const lista = [...mapa.values()];
  lista.forEach((c) => {
    if (idsDaProxima.has(c.a.id)) c.classificado = c.a.id;
    else if (idsDaProxima.has(c.b.id)) c.classificado = c.b.id;
    else if (c.encerrado && c.a.gols !== c.b.gols) c.classificado = c.a.gols > c.b.gols ? c.a.id : c.b.id;
    c.jogos.sort((x, y) => (x.kickoff_utc ?? '').localeCompare(y.kickoff_utc ?? ''));
  });
  return lista.sort((x, y) => (x.jogos[0]?.kickoff_utc ?? '').localeCompare(y.jogos[0]?.kickoff_utc ?? ''));
}

function LadoDoConfronto({ lado, c }: { lado: Lado; c: Confronto }) {
  const decidido = c.classificado != null;
  const passou = decidido && c.classificado === lado.id;
  const temPlacar = c.jogos.some((j) => isFinished(j.status_short));

  return (
    <div
      className="px-1.5 py-1 flex items-center gap-1.5 min-w-0"
      style={{ background: passou ? 'rgba(10,61,46,.07)' : undefined }}
    >
      <Crest name={lado.nome} id={lado.id} size={15} />
      <span
        className={`flex-1 min-w-0 truncate text-[11px] ${passou ? 'font-bold' : 'font-medium'}`}
        style={{ color: passou ? '#0a3d2e' : decidido ? '#a8a292' : '#1a1d1a' }}
      >
        {lado.nome}
      </span>
      {temPlacar && (
        <span
          className={`shrink-0 text-[11px] tabular-nums ${passou ? 'font-bold' : 'font-semibold'}`}
          style={{ color: passou ? '#0a3d2e' : decidido ? '#a8a292' : '#1a1d1a' }}
        >
          {lado.gols}
        </span>
      )}
    </div>
  );
}

function CardConfronto({ c, onJogo }: { c: Confronto; onJogo: (id: number) => void }) {
  const ultimo = c.jogos[c.jogos.length - 1];
  return (
    <button
      onClick={() => ultimo && onJogo(ultimo.fixture_id)}
      className="w-full text-left rounded-rebrand-sm overflow-hidden bg-white hover:shadow-sm transition"
      style={{ border: '1px solid #ded2b6' }}
      title={c.jogos.length > 1 ? 'ida e volta somadas' : undefined}
    >
      <LadoDoConfronto lado={c.a} c={c} />
      <div style={{ height: 1, background: '#f1e9d6' }} />
      <LadoDoConfronto lado={c.b} c={c} />
    </button>
  );
}

function CardVago() {
  return (
    <div className="rounded-rebrand-sm overflow-hidden" style={{ border: '1px dashed #e5d9bd', background: '#fdfbf6' }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="px-1.5 py-1 flex items-center gap-1.5"
          style={{ borderTop: i ? '1px solid #f1e9d6' : undefined }}
        >
          <span className="w-[15px] h-[15px] rounded-full shrink-0" style={{ background: '#f1e9d6' }} />
          <span className="text-[10.5px]" style={{ color: '#c4bda8' }}>
            a definir
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Arrastar o conteúdo com o mouse, como num mapa. A barra de rolagem continua
 * lá, mas ninguém procura barra de rolagem dentro de um card: a mão pega o
 * branco e puxa. O clique no confronto continua funcionando porque só vira
 * arrasto depois de 4px, e o clique seguinte a um arrasto é engolido.
 */
function useArrastarParaRolar() {
  const ref = useRef<HTMLDivElement | null>(null);
  const est = useRef({ ativo: false, x: 0, y: 0, sx: 0, sy: 0, moveu: false });

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    est.current = { ativo: true, x: e.clientX, y: e.clientY, sx: el.scrollLeft, sy: el.scrollTop, moveu: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    const s = est.current;
    if (!el || !s.ativo) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.moveu && Math.abs(dx) + Math.abs(dy) < 4) return;
    s.moveu = true;
    el.scrollLeft = s.sx - dx;
    el.scrollTop = s.sy - dy;
  };
  const encerrar = () => {
    est.current.ativo = false;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (est.current.moveu) {
      e.preventDefault();
      e.stopPropagation();
      est.current.moveu = false;
    }
  };

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: encerrar,
      onPointerLeave: encerrar,
      onClickCapture,
    },
  };
}

/** A chave em si. Mesma marcação no card e na tela cheia; muda só a largura. */
function Chave({
  colunas,
  onJogo,
  largura,
}: {
  colunas: Coluna[];
  onJogo: (id: number) => void;
  largura: number;
}) {
  return (
    <div className="flex gap-2.5 min-w-max items-stretch">
      {colunas.map((col) => {
        const vagos = col.confrontos.length ? 0 : col.vagas;
        return (
          <div key={col.chave} className="shrink-0 flex flex-col" style={{ width: largura }}>
            <div
              className="text-[9px] uppercase tracking-[0.12em] font-bold text-center pb-1.5"
              style={{ color: col.confrontos.length ? '#0a3d2e' : '#c4bda8' }}
            >
              {col.titulo}
            </div>
            <div className="flex-1 flex flex-col justify-around gap-1.5">
              {col.confrontos.map((c) => (
                <CardConfronto key={c.chave} c={c} onJogo={onJogo} />
              ))}
              {Array.from({ length: vagos }).map((_, i) => (
                <CardVago key={i} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MIN_ESCALA = 0.5;
const MAX_ESCALA = 2.2;

/** Pop-up com zoom e arrasto, pra chave grande caber no olho. */
function ChaveExpandida({
  colunas,
  onJogo,
  onFechar,
  titulo,
}: {
  colunas: Coluna[];
  onJogo: (id: number) => void;
  onFechar: () => void;
  titulo: string;
}) {
  const [escala, setEscala] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; px: number; py: number; moveu: boolean } | null>(null);
  const palco = useRef<HTMLDivElement | null>(null);
  const conteudo = useRef<HTMLDivElement | null>(null);
  // Dedos na tela: com dois, o gesto vira pinça (o celular não tem roda do mouse).
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ dist: number; escala: number; px: number; py: number; cx: number; cy: number } | null>(null);

  /** Abre com a chave inteira enquadrada e centrada, em vez de 100% no canto. */
  const enquadrar = useCallback(() => {
    const p = palco.current;
    const c = conteudo.current;
    if (!p || !c) return;
    const cw = c.scrollWidth;
    const ch = c.scrollHeight;
    if (!cw || !ch) return;
    const porLargura = p.clientWidth / cw;
    const porAltura = p.clientHeight / ch;
    // Em tela larga cabe a chave inteira. Em celular, caber tudo na largura
    // deixaria o nome dos times com 4px: aí vale mais enquadrar pela ALTURA, num
    // tamanho legível, e a pessoa arrasta para o lado (ou dá pinça).
    const nova =
      porLargura < 0.7
        ? Math.min(1, Math.max(0.75, porAltura))
        : Math.min(MAX_ESCALA, Math.max(MIN_ESCALA, Math.min(porLargura, porAltura)));
    setEscala(nova);
    // Centraliza no eixo em que sobra espaço e encosta no canto no eixo em que
    // falta: no celular a chave não cabe nem no zoom mínimo, e centrar cortava o
    // começo dela (o nome do primeiro time saía da tela).
    setPos({
      x: cw * nova <= p.clientWidth ? (p.clientWidth - cw * nova) / 2 : 0,
      y: ch * nova <= p.clientHeight ? (p.clientHeight - ch * nova) / 2 : 0,
    });
  }, []);

  useEffect(() => {
    // rAF pra medir depois que o pop-up já tem tamanho.
    const id = requestAnimationFrame(enquadrar);
    return () => cancelAnimationFrame(id);
  }, [enquadrar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === '+' || e.key === '=') setEscala((s) => Math.min(MAX_ESCALA, s + 0.15));
      if (e.key === '-') setEscala((s) => Math.max(MIN_ESCALA, s - 0.15));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  // Roda do mouse dá zoom, e o ponto embaixo do cursor fica parado: sem isso a
  // chave foge da tela ao aproximar. O listener é nativo com passive:false
  // porque o onWheel do React não deixa cancelar a rolagem da página.
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const caixa = el.getBoundingClientRect();
      const cx = e.clientX - caixa.left;
      const cy = e.clientY - caixa.top;
      setEscala((atual) => {
        const nova = Math.min(MAX_ESCALA, Math.max(MIN_ESCALA, atual * (1 - e.deltaY * 0.0015)));
        setPos((p) => ({
          x: cx - ((cx - p.x) * nova) / atual,
          y: cy - ((cy - p.y) * nova) / atual,
        }));
        return nova;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = (delta: number) => setEscala((s) => Math.min(MAX_ESCALA, Math.max(MIN_ESCALA, s + delta)));

  return (
    // `theme-bolao` fica no PAINEL, não aqui: a classe pinta fundo (`--canvas`) no
    // próprio elemento, e no container de tela cheia isso virava uma parede areia
    // que escondia o site inteiro em vez de deixá-lo aparecer atrás.
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      {/* Escurece de leve e desfoca: o fundo continua sendo o site, não uma parede cinza. */}
      <div className="absolute inset-0" style={{ background: 'rgba(26,29,26,.14)', backdropFilter: 'blur(2px)' }} />

      <div
        className="theme-bolao relative flex flex-col rounded-rebrand-lg overflow-hidden shadow-xl"
        style={{
          background: '#f8f4ea',
          border: '1px solid #ded2b6',
          width: 'min(1080px, 94vw)',
          height: 'min(720px, 86vh)',
        }}
      >
      <div
        className="shrink-0 px-4 py-2.5 flex items-center gap-3"
        style={{ background: '#f4eddc', borderBottom: '1px solid #ded2b6' }}
      >
        <span className="text-[12.5px] font-bold text-ink truncate">{titulo}</span>
        <span className="hidden md:block text-[11px]" style={{ color: '#8d8672' }}>
          arraste para mover, role para aproximar
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => zoom(-0.15)}
            className="w-8 h-8 grid place-items-center rounded-rebrand-sm bg-white"
            style={{ border: '1px solid #ded2b6', color: '#6b6350' }}
            aria-label="Afastar"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-12 text-center text-[11.5px] tabular-nums" style={{ color: '#6b6350' }}>
            {Math.round(escala * 100)}%
          </span>
          <button
            onClick={() => zoom(0.15)}
            className="w-8 h-8 grid place-items-center rounded-rebrand-sm bg-white"
            style={{ border: '1px solid #ded2b6', color: '#6b6350' }}
            aria-label="Aproximar"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={enquadrar}
            className="w-8 h-8 grid place-items-center rounded-rebrand-sm bg-white"
            style={{ border: '1px solid #ded2b6', color: '#6b6350' }}
            aria-label="Enquadrar a chave inteira"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onFechar}
            className="h-8 px-3 rounded-rebrand-sm bg-forest text-canvas text-[12px] font-semibold inline-flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Fechar
          </button>
        </div>
      </div>

      <div
        ref={palco}
        data-chave-palco
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (dedos.current.size === 2) {
            // Começou uma pinça: guarda a distância e o meio dos dois dedos.
            const [d1, d2] = [...dedos.current.values()];
            pinca.current = {
              dist: Math.hypot(d1.x - d2.x, d1.y - d2.y),
              escala,
              px: pos.x,
              py: pos.y,
              cx: (d1.x + d2.x) / 2,
              cy: (d1.y + d2.y) / 2,
            };
            arrasto.current = null;
          } else if (dedos.current.size === 1) {
            arrasto.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moveu: false };
          }
        }}
        onPointerMove={(e) => {
          if (dedos.current.has(e.pointerId)) dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          const p = pinca.current;
          if (p && dedos.current.size >= 2) {
            const [d1, d2] = [...dedos.current.values()];
            const dist = Math.hypot(d1.x - d2.x, d1.y - d2.y);
            if (!dist || !p.dist) return;
            const nova = Math.min(MAX_ESCALA, Math.max(MIN_ESCALA, (p.escala * dist) / p.dist));
            const caixa = palco.current?.getBoundingClientRect();
            const cx = p.cx - (caixa?.left ?? 0);
            const cy = p.cy - (caixa?.top ?? 0);
            setEscala(nova);
            setPos({
              x: cx - ((cx - p.px) * nova) / p.escala,
              y: cy - ((cy - p.py) * nova) / p.escala,
            });
            return;
          }

          const a = arrasto.current;
          if (!a) return;
          const dx = e.clientX - a.x;
          const dy = e.clientY - a.y;
          if (!a.moveu && Math.abs(dx) + Math.abs(dy) < 4) return;
          a.moveu = true;
          setPos({ x: a.px + dx, y: a.py + dy });
        }}
        onPointerUp={(e) => {
          dedos.current.delete(e.pointerId);
          if (dedos.current.size < 2) pinca.current = null;
          if (dedos.current.size === 0) arrasto.current = null;
        }}
        onPointerCancel={(e) => {
          dedos.current.delete(e.pointerId);
          pinca.current = null;
          arrasto.current = null;
        }}
        onPointerLeave={(e) => {
          dedos.current.delete(e.pointerId);
          if (dedos.current.size < 2) pinca.current = null;
          if (dedos.current.size === 0) arrasto.current = null;
        }}
        // Sem isto o navegador rouba o gesto: no celular, arrastar dentro do
        // pop-up rolava a página atrás dele.
        style={{ touchAction: 'none' }}
        // Arrastar não pode virar clique no confronto embaixo do cursor.
        onClickCapture={(e) => {
          if (arrasto.current?.moveu) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div
          ref={conteudo}
          className="p-6 origin-top-left w-max"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})` }}
        >
          <Chave colunas={colunas} onJogo={onJogo} largura={190} />
        </div>
      </div>
      </div>
    </div>
  );
}

export function ChaveamentoBracket({
  fixtures,
  rounds,
  idxSelecionado,
  competition,
  onJogo,
}: {
  fixtures: FutebolFixture[];
  rounds: string[];
  idxSelecionado: number;
  competition: string;
  onJogo: (fixtureId: number) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const puxar = useArrastarParaRolar();

  const colunas = useMemo<Coluna[]>(() => {
    const mata = rounds.map((r, i) => ({ round: r, i })).filter((x) => ehMataMata(x.round));
    if (!mata.length) return [];

    const coluna = ({ round, i }: { round: string; i: number }): Coluna => {
      const jogos = fixtures.filter((f) => f.round === round);
      const proxima = rounds[i + 1];
      const idsDaProxima = new Set<number>();
      if (proxima) {
        fixtures
          .filter((f) => f.round === proxima)
          .forEach((f) => {
            idsDaProxima.add(f.home_team_id);
            idsDaProxima.add(f.away_team_id);
          });
      }
      const confrontos = montaConfrontos(jogos, idsDaProxima);
      return { chave: round, titulo: rodadaLonga(round), confrontos, vagas: confrontos.length };
    };

    // Da fase aberta pra frente; na fase de grupos, o mata-mata inteiro.
    const posicao = mata.findIndex((x) => x.i >= idxSelecionado);
    const daqui = posicao < 0 ? mata : mata.slice(posicao);
    const reais: Coluna[] = daqui.map(coluna);

    // Uma fase antes, mas só quando ela REALMENTE alimenta esta: quem está nas
    // quartas quer ver de onde veio cada classificado. Na Libertadores a fase
    // anterior às oitavas na lista é a pré-fase, que desemboca nos grupos e tem
    // 4 confrontos contra 8 das oitavas: encaixar ali inverteria o funil.
    if (posicao > 0 && reais[0]?.confrontos.length) {
      const anterior = coluna(mata[posicao - 1]);
      if (anterior.confrontos.length === reais[0].confrontos.length * 2) reais.unshift(anterior);
    }

    // O caminho até a final, mesmo antes do sorteio: cada fase seguinte tem
    // metade dos confrontos da anterior.
    const ultima = reais[reais.length - 1];
    const futuras: Coluna[] = [];
    let vagas = ultima ? Math.floor(ultima.vagas / 2) : 0;
    while (vagas >= 1) {
      futuras.push({ chave: `vagas-${vagas}`, titulo: tituloPorVagas(vagas), confrontos: [], vagas });
      if (vagas === 1) break;
      vagas = Math.floor(vagas / 2);
    }

    return [...reais, ...futuras];
  }, [fixtures, rounds, idxSelecionado]);

  if (!colunas.length) return null;

  const temConfronto = colunas.some((c) => c.confrontos.length);
  const titulo = `Chaveamento · ${competitionLabel(competition)}`;
  const formato = FORMATOS[competition];

  return (
    <>
      <div className="bg-white rounded-rebrand-lg overflow-hidden" style={{ border: '1px solid #ded2b6' }}>
        <div
          className="px-4 py-2.5 flex items-center justify-between gap-2"
          style={{ background: '#f4eddc', borderBottom: '1px solid #ded2b6' }}
        >
          <span className="text-[10.5px] uppercase tracking-[0.16em] font-bold" style={{ color: '#6b6350' }}>
            Chaveamento
          </span>
          {temConfronto && (
            <button
              onClick={() => setExpandido(true)}
              className="text-[11px] font-semibold text-forest inline-flex items-center gap-1"
            >
              expandir
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {!temConfronto ? (
          <div className="px-6 py-9 text-center">
            <div className="text-[14px] font-semibold text-ink">Chaveamento ainda não definido</div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: '#8d8672' }}>
              Os confrontos aparecem quando o sorteio das fases entrar na coleta.
            </div>
          </div>
        ) : (
          <>
            <div
              ref={puxar.ref}
              {...puxar.handlers}
              className="p-3 overflow-auto minimal-scrollbar max-h-[460px] cursor-grab active:cursor-grabbing select-none"
            >
              <Chave colunas={colunas} onJogo={onJogo} largura={158} />
            </div>
            <div
              className="px-4 py-2 text-[10.5px] leading-relaxed"
              style={{ borderTop: '1px solid #f1e9d6', background: '#fdfbf6', color: '#8d8672' }}
            >
              O número é o agregado de ida e volta.{formato ? ` Formato: ${formato}.` : ''} Quem enfrenta quem nas
              fases seguintes depende do sorteio, então elas ficam como "a definir" até sair.
            </div>
          </>
        )}
      </div>

      {expandido && (
        <ChaveExpandida colunas={colunas} onJogo={onJogo} onFechar={() => setExpandido(false)} titulo={titulo} />
      )}
    </>
  );
}
