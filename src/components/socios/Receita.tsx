import { useState } from 'react';
import {
  emReais,
  formatarMes,
  lerValorDigitado,
  mesesEmAberto,
  receitaRecebida,
  rotuloDaOrigem,
  situacaoDaReceita,
  valorComoTexto,
  ORIGENS_PARA_LANCAR,
  ROTULO_DA_ORIGEM,
  type OrigemParaLancar,
  type Pagamento,
} from './crm-receita';
import type { EstadoDosPagamentos, PagamentoALancar } from '@/hooks/use-pagamentos';
import { formatarDia } from './crm-lista';

// ============================================================================
// Quanto essa pessoa paga, e o que ela está devendo
// ============================================================================
// O Stripe não vende por Pix e boa parte dos clientes paga por Pix. Essa
// receita acontece fora do gateway e não tinha registro em lugar nenhum: o
// sócio recebia o Pix de um mês e no seguinte não sabia se aquela pessoa tinha
// pagado.
//
// A tela responde três perguntas, nessa ordem: quanto essa pessoa já gerou, o
// que ela está devendo, e o que foi pago mês a mês. A ordem é a da conversa —
// antes de cobrar alguém, o sócio quer saber se vale a pena insistir.
//
// ⚠️ Só o dinheiro de FORA do Stripe. Quem paga por lá já tem registro lá, e
// duas fontes para o mesmo dinheiro discordam. A tela diz isso com essas
// palavras: "recebido na mão".
// ============================================================================

export type EstadoDaReceita =
  { tipo: 'parado' } | { tipo: 'salvando' } | { tipo: 'erro'; recado: string };

/** A assinatura a que os pagamentos pertencem. */
export interface AssinaturaDaReceita {
  /** `YYYY-MM-DD`, o dia em que a assinatura foi dada. */
  comecouEm: string;
  /** Nulo é SEM COBRANÇA: não se combinou valor. */
  valorMensal: number | null;
}

const CAMPO =
  'mt-1 h-9 w-full rounded-rebrand-sm border border-line-2 bg-white px-2 text-[13px] text-ink disabled:opacity-60';
const ROTULO = 'block text-[11px] text-ink-2';

/**
 * Uma linha do histórico, com o estorno escondido até alguém pedir.
 *
 * O motivo é obrigatório e o banco recusa sem ele. Pedir num campo que só
 * aparece ao clicar mantém a lista legível: o histórico é lido muitas vezes e
 * estornado quase nunca.
 */
function Lancamento({
  pagamento,
  salvando,
  aoEstornar,
}: {
  pagamento: Pagamento;
  salvando: boolean;
  aoEstornar: (id: string, motivo: string) => void;
}) {
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState('');

  return (
    <li className="border-t border-line-2 py-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className={`text-[13px] ${pagamento.estornado ? 'text-ink-dim' : 'text-ink'}`}>
          <span className="font-bold">{formatarMes(pagamento.mes)}</span>{' '}
          {rotuloDaOrigem(pagamento.origem)} {emReais(pagamento.valor)}
        </span>

        {pagamento.estornado ? (
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-dim">
            estornado
          </span>
        ) : (
          <button
            type="button"
            disabled={salvando}
            onClick={() => setPedindoMotivo(true)}
            className="text-[11px] font-bold text-ink-2 underline hover:text-ink disabled:opacity-40"
          >
            Estornar
          </button>
        )}
      </div>

      <p className="text-[11px] text-ink-dim">
        {pagamento.estornado
          ? `Motivo: ${pagamento.motivoDoEstorno ?? 'não registrado'}. O acesso não foi recuado.`
          : `Caiu em ${formatarDia(pagamento.pagoEm)}`}
      </p>

      {pedindoMotivo && !pagamento.estornado ? (
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="text"
            value={motivo}
            placeholder="Por que está estornando?"
            disabled={salvando}
            aria-label={`Motivo do estorno de ${formatarMes(pagamento.mes)}`}
            onChange={(e) => setMotivo(e.target.value)}
            className="h-8 flex-1 rounded-rebrand-sm border border-line-2 bg-white px-2 text-[12px] text-ink"
          />
          <button
            type="button"
            // Sem motivo o banco recusa, e o sócio veria um erro de função em
            // vez de saber que faltou escrever.
            disabled={salvando || motivo.trim() === ''}
            onClick={() => aoEstornar(pagamento.id, motivo.trim())}
            className="h-8 rounded-rebrand-sm bg-ink px-2.5 text-[12px] font-bold text-white disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * A receita de uma pessoa, e o que ela deve.
 *
 * Os meses em aberto são DERIVADOS: todo mês desde o começo da assinatura,
 * menos os que têm pagamento. A alternativa seria gerar uma linha de cobrança
 * por mês, e ela exige um cron que roda todo dia 1º — cron que falha em
 * silêncio deixa de gerar a cobrança, e o sistema esquece de cobrar sem ninguém
 * descobrir.
 */
export function Receita({
  hoje,
  assinatura,
  estado,
  escrita,
  aoLancar,
  aoEstornar,
}: {
  hoje: string;
  assinatura: AssinaturaDaReceita | null;
  estado: EstadoDosPagamentos;
  escrita: EstadoDaReceita;
  aoLancar: (pagamento: PagamentoALancar) => void;
  aoEstornar: (id: string, motivo: string) => void;
}) {
  /*
   * Os campos guardam NULO enquanto ninguém mexeu, e o valor de verdade sai do
   * que chegou do banco na hora de desenhar.
   *
   * ⚠️ O padrão existe por causa da ordem das coisas: o modal monta antes de os
   * pagamentos chegarem, então um `useState` com o mês em aberto como valor
   * inicial nasceria com a lista vazia e ficaria preso no mês errado. Assim o
   * campo acompanha o que chega, e para de acompanhar assim que alguém digita.
   */
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);
  const [valorDigitado, setValorDigitado] = useState<string | null>(null);
  const [origem, setOrigem] = useState<OrigemParaLancar>('pix');
  const [pagoEm, setPagoEm] = useState(hoje);

  // Sem assinatura manual não há pagamento: eles penduram nela. Um formulário
  // aqui não teria onde gravar.
  if (!assinatura) {
    return (
      <p className="text-[13px] text-ink-2">
        Sem assinatura dada na mão. O histórico de pagamento nasce junto com ela.
      </p>
    );
  }

  if (estado.tipo === 'carregando') {
    return <p className="text-[13px] text-ink-2">Carregando os pagamentos…</p>;
  }

  if (estado.tipo === 'erro') {
    return (
      <p className="text-[13px] text-ink-2">
        Não deu para carregar os pagamentos agora. Sem eles, cobrar seria chute.
      </p>
    );
  }

  const { pagamentos } = estado;
  const recebido = receitaRecebida(pagamentos);
  const abertos = mesesEmAberto(assinatura.comecouEm, assinatura.valorMensal, pagamentos, hoje);
  const situacao = situacaoDaReceita(assinatura.comecouEm, assinatura.valorMensal, pagamentos, hoje);

  const mes = mesEscolhido ?? abertos[0] ?? hoje.slice(0, 7);
  const valor = valorDigitado ?? valorComoTexto(assinatura.valorMensal);
  const valorLido = lerValorDigitado(valor);
  const salvando = escrita.tipo === 'salvando';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[13px] text-ink">
          Recebido na mão: <span className="font-bold">{emReais(recebido)}</span>
        </p>

        {situacao.tipo === 'devendo' ? (
          <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[12px] font-bold text-ink">
            devendo {situacao.meses} {situacao.meses === 1 ? 'mês' : 'meses'},{' '}
            {emReais(situacao.total)}
          </span>
        ) : situacao.tipo === 'em_dia' ? (
          <span className="rounded-full bg-canvas px-2.5 py-1 text-[12px] font-bold text-ink-2">
            em dia
          </span>
        ) : (
          <span className="rounded-full bg-canvas px-2.5 py-1 text-[12px] font-bold text-ink-2">
            sem cobrança
          </span>
        )}
      </div>

      {abertos.length > 0 ? (
        <p className="text-[12px] text-ink-2">
          Em aberto: {abertos.map(formatarMes).join(', ')}. A assinatura não encerra sozinha: se
          for para cortar o acesso, encerre na assinatura acima.
        </p>
      ) : null}

      {/* Só o que entra fora do Stripe. Escrito na tela porque um total que
          parece ser "tudo que a pessoa pagou" leva a conclusão errada. */}
      <p className="text-[11px] text-ink-dim">
        Só o que entrou fora do Stripe. O que passa pelo gateway tem registro lá.
      </p>

      <div className="rounded-rebrand-sm border border-line-2 bg-canvas p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <label className={ROTULO}>
            Mês pago
            <input
              type="month"
              value={mes}
              disabled={salvando}
              aria-label="Mês de competência do pagamento"
              onChange={(e) => setMesEscolhido(e.target.value)}
              className={CAMPO}
            />
          </label>

          <label className={ROTULO}>
            Valor
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              placeholder="R$"
              disabled={salvando}
              aria-label="Valor recebido"
              onChange={(e) => setValorDigitado(e.target.value)}
              className={CAMPO}
            />
          </label>

          <label className={ROTULO}>
            Como caiu
            <select
              value={origem}
              disabled={salvando}
              aria-label="Origem do pagamento"
              onChange={(e) => setOrigem(e.target.value as OrigemParaLancar)}
              className={CAMPO}
            >
              {ORIGENS_PARA_LANCAR.map((o) => (
                <option key={o} value={o}>
                  {ROTULO_DA_ORIGEM[o]}
                </option>
              ))}
            </select>
          </label>

          <label className={ROTULO}>
            Dia em que caiu
            <input
              type="date"
              value={pagoEm}
              max={hoje}
              disabled={salvando}
              aria-label="Dia em que o dinheiro caiu"
              onChange={(e) => setPagoEm(e.target.value)}
              className={CAMPO}
            />
          </label>
        </div>

        {escrita.tipo === 'erro' && (
          <p className="mt-2 text-[12px] font-bold text-ink">{escrita.recado}</p>
        )}

        <button
          type="button"
          // Valor ilegível trava aqui. Deixar passar gravaria outro número, e um
          // número errado de dinheiro é pior que número nenhum: o sócio age em
          // cima dele.
          disabled={salvando || typeof valorLido !== 'number' || !mes || !pagoEm}
          onClick={() => {
            if (typeof valorLido !== 'number') return;
            aoLancar({ mes, valor: valorLido, origem, pagoEm });
            // Só o que é de UM lançamento volta ao padrão. A origem e o dia
            // costumam se repetir quando se lança dois meses seguidos.
            setMesEscolhido(null);
            setValorDigitado(null);
          }}
          className="mt-2 h-9 w-full rounded-rebrand-sm bg-forest px-3 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {salvando ? 'Gravando…' : 'Registrar pagamento'}
        </button>

        {valorLido === 'invalido' ? (
          <p className="mt-1 text-[11px] text-ink-2">
            Esse valor não dá para ler. Escreva só o número, como 39,90.
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-ink-dim">
            Registrar empurra o acesso até o fim do mês pago.
          </p>
        )}
      </div>

      {pagamentos.length > 0 ? (
        <ul>
          {pagamentos.map((p) => (
            <Lancamento key={p.id} pagamento={p} salvando={salvando} aoEstornar={aoEstornar} />
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-2">Nenhum pagamento registrado ainda.</p>
      )}
    </div>
  );
}
