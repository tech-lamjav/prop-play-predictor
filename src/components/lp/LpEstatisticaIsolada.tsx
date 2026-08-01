import { Check, X, Minus } from "lucide-react";
import { Marcado } from "./Marcado";

// ============================================================
// O visual principal da página: uma estatística sozinha contra os 10 filtros.
//
// À esquerda, o número que qualquer site entrega e que parece resolver a aposta.
// À direita, os mesmos 10 filtros rodando no mesmo jogo, e a conta de quantos
// apontam para o mesmo lado. Fecha no Score, que é o que o produto mostra de
// verdade: é a ponte entre a linguagem da página e a tela que o cara vai abrir.
//
// Os nomes dos filtros saem das premissas que SOBREVIVERAM à recalibragem
// (docs/premissas-recalibragem.md), traduzidas pra linguagem de apostador.
//
// Saíram daqui, e não podem voltar: histórico do confronto (h2h_favoravel foi a
// zero no Resultado), ritmo de jogo (ritmo_alto foi a zero no Gols) e movimento
// das odds (linha_subindo e linha_descendo foram a zero). A regra transversal
// do doc é que premissa de histórico do próprio mercado não gera valor, porque
// é o dado mais fácil de olhar e já está no preço. Vender esses três numa
// página que promete método seria vender o que a própria medição derrubou.
// ============================================================

type Sinal = "confirma" | "contra" | "neutro";

const FILTROS: { nome: string; sinal: Sinal; leitura: string }[] = [
  { nome: "Força dos ataques", sinal: "confirma", leitura: "Os dois somam muito gol na temporada" },
  { nome: "Defesa vazada do adversário", sinal: "confirma", leitura: "Tomou gol em 4 dos últimos 5" },
  { nome: "Chances criadas", sinal: "confirma", leitura: "Volume de finalização alto dos dois lados" },
  { nome: "Solidez das defesas", sinal: "contra", leitura: "O time da casa só tomou 1 gol nos últimos 4" },
  { nome: "Jogos sem sofrer gol", sinal: "contra", leitura: "Três seguidos sem levar gol em casa" },
  { nome: "Ataque fraco do adversário", sinal: "contra", leitura: "1 gol nos últimos 3 jogos fora" },
  { nome: "Desfalques e escalação", sinal: "contra", leitura: "Time da casa sem o artilheiro" },
  { nome: "Peso do mando", sinal: "neutro", leitura: "Pesa no vencedor, não no total de gols" },
  { nome: "Forma recente", sinal: "neutro", leitura: "Pesa no vencedor, não no total de gols" },
  { nome: "Posição na tabela", sinal: "neutro", leitura: "Diferença de nível não decide gol" },
];

const A_FAVOR = FILTROS.filter((f) => f.sinal === "confirma");
const O_RESTO = FILTROS.filter((f) => f.sinal !== "confirma");

const ESTILO: Record<Sinal, { icone: typeof Check; cor: string; fundo: string; rotulo: string }> = {
  confirma: { icone: Check, cor: "text-forest", fundo: "bg-forest/10", rotulo: "Aponta a favor" },
  contra: { icone: X, cor: "text-[var(--status-danger)]", fundo: "bg-[var(--status-danger)]/10", rotulo: "Aponta contra" },
  neutro: { icone: Minus, cor: "text-ink-3", fundo: "bg-canvas-2", rotulo: "Não diz nada" },
};

function LinhaFiltro({ filtro }: { filtro: (typeof FILTROS)[number] }) {
  const e = ESTILO[filtro.sinal];
  const Icone = e.icone;
  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0">
      <span className={`grid place-items-center w-5 h-5 rounded-full shrink-0 mt-0.5 ${e.fundo}`}>
        <Icone className={`w-3 h-3 ${e.cor}`} strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink leading-tight">{filtro.nome}</span>
        <span className="block text-[12.5px] text-ink-3 leading-snug mt-0.5">{filtro.leitura}</span>
      </span>
    </li>
  );
}

/**
 * `semCabecalho` = a LP já abriu com este gancho no hero, então o bloco entra
 * direto no visual, sem repetir título e lead.
 */
export function LpEstatisticaIsolada({ semCabecalho = false }: { semCabecalho?: boolean }) {
  return (
    <section className={`px-4 sm:px-6 ${semCabecalho ? "pt-10 pb-16 sm:pt-12 sm:pb-24" : "py-16 sm:py-24"}`}>
      {!semCabecalho && (
        <div className="max-w-[720px] mx-auto text-center">
          <h2 className="font-display text-[28px] sm:text-[40px] font-black leading-[1.1] tracking-tight text-forest text-balance">
            Uma boa estatística, sozinha, pode contar a história errada.
          </h2>
          <p className="text-[16px] text-ink-2 leading-relaxed mt-5">
            Dado isolado pode justificar quase qualquer aposta.
          </p>
          <p className="text-[17px] text-ink-2 leading-relaxed mt-2">
            <Marcado texto="Uma oportunidade só ganha força quando ==diferentes sinais apontam para o mesmo lado==." />
          </p>
        </div>
      )}

      {/* O par: o número solto x os 10 filtros no mesmo jogo */}
      <div
        className={`max-w-[900px] mx-auto grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 lg:gap-5 items-start ${semCabecalho ? "" : "mt-10 sm:mt-14"}`}
      >
        {/* Lado 1: a estatística que convence */}
        <div className="rounded-rebrand-lg border border-line bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-canvas-2 border-b border-line">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">
              O número que você acha em qualquer site
            </p>
          </div>
          <div className="p-5">
            <div className="text-[13px] text-ink-3">Flamengo x Palmeiras · Brasileirão</div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-[52px] font-black leading-none tabular-nums text-ink">8</span>
              <span className="text-[15px] text-ink-3">de 10 jogos</span>
            </div>
            <p className="text-[13.5px] text-ink-2 leading-snug mt-2">
              com 3 gols ou mais nos últimos jogos do time da casa.
            </p>
            <div className="mt-5 pt-4 border-t border-line">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-3 mb-1.5">
                A conclusão fácil
              </p>
              <p className="text-[14px] font-semibold text-ink leading-snug">
                "Mais de 2,5 gols é dinheiro na mão."
              </p>
            </div>
          </div>
          {/* Fecha simétrico ao rodapé do card dos filtros, pra comparação bater */}
          <div className="px-5 py-4 bg-canvas-2 border-t border-line">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-3">
              Quantos filtros isso responde
            </p>
            <p className="text-[15px] font-bold text-ink mt-1">
              1 de 10.{" "}
              <span className="text-ink-2 font-semibold">E é o que todo mundo já olhou.</span>
            </p>
          </div>
        </div>

        {/* Lado 2: os 10 filtros no mesmo jogo */}
        <div className="rounded-rebrand-lg border border-line-2 bg-white overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-2.5 bg-forest text-white flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold">
              Os 10 filtros no mesmo jogo
            </p>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber bg-amber/15 border border-amber/40 rounded-full px-2 py-0.5 whitespace-nowrap">
              exemplo
            </span>
          </div>
          {/* Agrupado por sinal: o "3 contra 7" tem que bater na hora */}
          <div className="grid sm:grid-cols-2">
            <div className="px-4 sm:px-5 py-3 sm:border-r sm:border-line">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-forest mb-1">
                Apontam a favor · {A_FAVOR.length}
              </p>
              <ul>
                {A_FAVOR.map((f) => (
                  <LinhaFiltro key={f.nome} filtro={f} />
                ))}
              </ul>
            </div>
            <div className="px-4 sm:px-5 py-3 border-t border-line sm:border-t-0">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-3 mb-1">
                Apontam contra ou não dizem nada · {O_RESTO.length}
              </p>
              <ul>
                {O_RESTO.map((f) => (
                  <LinhaFiltro key={f.nome} filtro={f} />
                ))}
              </ul>
            </div>
          </div>
          <div className="px-4 sm:px-5 py-4 bg-canvas-2 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-3">
                Quantos apontam para o mesmo lado
              </p>
              <p className="text-[15px] font-bold text-ink mt-1">
                {A_FAVOR.length} de 10. <span className="text-ink-2 font-semibold">Poucos.</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-ink-3">Score</span>
              <span className="inline-flex items-center justify-center h-10 px-3 rounded-rebrand-md bg-canvas border border-line-2 font-bold tabular-nums text-[20px] text-ink">
                34
              </span>
              <span className="text-[13px] font-semibold text-[var(--status-danger)]">
                fica de fora
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto mt-10 sm:mt-12 text-center">
        <p className="text-[18px] font-semibold text-ink leading-snug">
          É exatamente o que fazem os nossos 10 filtros.
        </p>
        <p className="text-[16px] text-ink-2 leading-relaxed mt-3">
          <Marcado texto="A Inteligência Artificial testa cada cenário, cruza o histórico esportivo e mede quantos dados apontam para o mesmo lado. ==Essa conta vira uma nota de 0 a 100==, que é a que aparece na sua tela." />
        </p>
      </div>
    </section>
  );
}
