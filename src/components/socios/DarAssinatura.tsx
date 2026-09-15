import { useState } from 'react';
import { PLANOS_A_VENDER, ROTULO_DO_PLANO, type PlanoAVender } from './crm-vocabulario';
import { formatarDia } from './crm-lista';
import { emReais, lerValorDigitado, valorComoTexto } from './crm-receita';

/**
 * O que cada plano libera, em palavras.
 *
 * A escada é cumulativa e está escrita por extenso porque o sócio precisa saber
 * o que está dando ANTES de dar. "Essencial" não diz nada sobre o Betinho ir
 * junto, e ir junto é justamente o que surpreende quem só olhou o nome.
 *
 * ⚠️ Isto é rótulo, não regra. Quem concede é a migration 142, que segue a
 * mesma escada de `shared/concessoes.ts`, e há um teste cobrando que as duas
 * não divirjam.
 */
const O_QUE_LIBERA: Record<PlanoAVender, string> = {
  entrada: 'Betinho ilimitado',
  essencial: 'futebol completo e Betinho ilimitado',
  completo: 'futebol, Betinho e as análises de NBA',
};

/** `2026-10-31`, daqui a um mês. O prazo mais comum, já preenchido. */
function daquiUmMes(hoje: string): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export type EstadoDaConcessao =
  { tipo: 'parado' } | { tipo: 'salvando' } | { tipo: 'erro'; recado: string };

/** A assinatura manual aberta desta pessoa. */
export interface AssinaturaAtual {
  id: string;
  plano: PlanoAVender;
  /** Nulo é VITALÍCIA: não vence. */
  venceEm: string | null;
  /** Nulo é SEM COBRANÇA: não se combinou valor. */
  valorMensal: number | null;
}

const CAMPO =
  'mt-1 h-10 w-full rounded-rebrand-sm border border-line-2 bg-white px-2 text-[14px] text-ink disabled:opacity-60';

/**
 * Dar uma assinatura inteira na mão.
 *
 * O plano, o prazo e o VALOR juntos, num lugar só, porque é assim que a venda
 * acontece: ninguém combina "te dou o futebol" e depois lembra de combinar até
 * quando e por quanto. Os interruptores por produto continuam existindo logo ao
 * lado, e servem a outra coisa — consertar UM acesso, ou dar os Relatórios, que
 * não pertencem a plano nenhum.
 *
 * ## As duas perguntas que parecem uma
 *
 * ⚠️ "Até quando vale" e "quanto custa por mês" são independentes, e a tela
 * pergunta as duas separadas porque as quatro combinações existem:
 *
 * - data e valor: a venda normal, que é cobrada todo mês e vence se não pagar.
 * - vitalícia com valor: paga por mês e nunca perde o acesso por atraso.
 * - data sem valor: acesso dado na mão por um tempo.
 * - vitalícia sem valor: acesso para sempre, de graça.
 *
 * Juntar as duas num campo "tipo" com quatro opções esconderia que são duas
 * decisões, e a segunda é a que faz o dinheiro aparecer no lugar certo.
 */
export function DarAssinatura({
  hoje,
  atual,
  estado,
  aoConceder,
  aoEncerrar,
}: {
  hoje: string;
  atual: AssinaturaAtual | null;
  estado: EstadoDaConcessao;
  aoConceder: (plano: PlanoAVender, venceEm: string | null, valorMensal: number | null) => void;
  aoEncerrar: (id: string) => void;
}) {
  const [plano, setPlano] = useState<PlanoAVender>(atual?.plano ?? 'essencial');
  const [vitalicia, setVitalicia] = useState(atual ? atual.venceEm === null : false);
  // A data continua guardada enquanto "vitalícia" está marcada. Desmarcar
  // devolve o que estava digitado, em vez de um campo vazio que obriga a
  // digitar de novo quem só queria ver a outra opção.
  const [venceEm, setVenceEm] = useState(atual?.venceEm ?? daquiUmMes(hoje));
  const [valor, setValor] = useState(valorComoTexto(atual?.valorMensal ?? null));

  const salvando = estado.tipo === 'salvando';
  const valorLido = lerValorDigitado(valor);
  const valorInvalido = valorLido === 'invalido';

  return (
    <div className="rounded-rebrand-sm border border-line-2 bg-canvas p-3">
      {atual ? (
        <div className="mb-3">
          <p className="text-[13px] text-ink">
            <span className="font-bold">{ROTULO_DO_PLANO[atual.plano]}</span> na mão,{' '}
            {atual.venceEm === null ? 'vitalícia' : <>válida até {formatarDia(atual.venceEm)}</>}.
          </p>
          <p className="text-[13px] text-ink-2">
            {atual.valorMensal === null
              ? 'Sem cobrança combinada.'
              : `${emReais(atual.valorMensal)} por mês.`}
          </p>
          <button
            type="button"
            disabled={salvando}
            onClick={() => aoEncerrar(atual.id)}
            className="mt-1 text-[12px] font-bold text-ink-2 underline hover:text-ink disabled:opacity-40"
          >
            Encerrar a assinatura
          </button>
        </div>
      ) : null}

      <label className="block text-[12px] text-ink-2">
        Plano
        <select
          value={plano}
          disabled={salvando}
          onChange={(e) => setPlano(e.target.value as PlanoAVender)}
          aria-label="Plano da assinatura manual"
          className={CAMPO}
        >
          {PLANOS_A_VENDER.map((p) => (
            <option key={p} value={p}>
              {ROTULO_DO_PLANO[p]}
            </option>
          ))}
        </select>
      </label>

      {/* O que o plano libera, à vista. "Essencial" não diz nada sobre o
          Betinho ir junto, e ir junto é o que surpreende quem só leu o nome. */}
      <p className="mt-1 text-[12px] text-ink-2">Libera {O_QUE_LIBERA[plano]}.</p>

      {/* As duas perguntas lado a lado em tela larga: são do mesmo tamanho e
          são lidas juntas, porque juntas descrevem o acordo. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[12px] text-ink-2">
            Válido até
            <input
              type="date"
              value={vitalicia ? '' : venceEm}
              min={hoje}
              disabled={salvando || vitalicia}
              onChange={(e) => setVenceEm(e.target.value)}
              aria-label="Assinatura manual válida até"
              className={CAMPO}
            />
          </label>

          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={vitalicia}
              disabled={salvando}
              onChange={(e) => setVitalicia(e.target.checked)}
              aria-label="Assinatura vitalícia"
              className="h-4 w-4 rounded border-line-2 accent-forest"
            />
            Vitalícia, não vence
          </label>
        </div>

        <label className="block text-[12px] text-ink-2">
          Cobrança mensal
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            placeholder="R$ por mês"
            disabled={salvando}
            onChange={(e) => setValor(e.target.value)}
            aria-label="Valor cobrado por mês"
            className={CAMPO}
          />
          <span className="mt-1 block text-[11px] text-ink-2">
            {valorInvalido
              ? 'Esse valor não dá para ler. Escreva só o número, como 39,90.'
              : valorLido === null
                ? 'Em branco quer dizer sem cobrança.'
                : `${emReais(valorLido)} todo mês, recorrente.`}
          </span>
        </label>
      </div>

      {estado.tipo === 'erro' && (
        <p className="mt-2 text-[13px] font-bold text-ink">{estado.recado}</p>
      )}

      <button
        type="button"
        // Sem data e sem vitalícia não há como saber quando isto acaba, e é
        // essa resposta que coloca a pessoa na fila de vencimento.
        disabled={salvando || valorInvalido || (!vitalicia && !venceEm)}
        onClick={() =>
          aoConceder(plano, vitalicia ? null : venceEm, valorInvalido ? null : valorLido)
        }
        className="mt-3 h-10 w-full rounded-rebrand-sm bg-forest px-3 text-[13px] font-bold text-white disabled:opacity-40"
      >
        {salvando ? 'Gravando…' : atual ? 'Trocar o plano ou o prazo' : 'Dar esta assinatura'}
      </button>

      <p className="mt-2 text-[11px] text-ink-2">
        {/* O aviso de que nada encerra sozinho fica aqui, onde se decide o
            acordo, porque é a pergunta que surge ao dar uma assinatura: e se a
            pessoa parar de pagar? */}
        {vitalicia
          ? 'Vitalícia não entra na fila de vencimento. Se tiver cobrança mensal e deixar de pagar, entra na fila de inadimplentes.'
          : 'Entra na fila de cobrança sete dias antes de vencer. Não encerra sozinha: parar de pagar só coloca a pessoa na fila de inadimplentes, e quem encerra é você.'}
      </p>
    </div>
  );
}
