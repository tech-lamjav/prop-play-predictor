import { useState } from 'react';
import { PLANOS_A_VENDER, ROTULO_DO_PLANO, type PlanoAVender } from './crm-vocabulario';
import { formatarDia } from './crm-lista';

/**
 * O que cada plano libera, em palavras.
 *
 * A escada é cumulativa e está escrita por extenso porque o sócio precisa saber
 * o que está dando ANTES de dar. "Essencial" não diz nada sobre o Betinho ir
 * junto, e ir junto é justamente o que surpreende quem só olhou o nome.
 *
 * ⚠️ Isto é rótulo, não regra. Quem concede é a migration 131, que segue a
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

/**
 * Dar uma assinatura inteira na mão.
 *
 * O plano e o prazo juntos, num lugar só, porque é assim que a venda acontece:
 * ninguém combina "te dou o futebol" e depois lembra de combinar até quando. Os
 * interruptores por produto continuam existindo logo abaixo, e servem a outra
 * coisa — consertar UM acesso, ou dar os Relatórios, que não pertencem a plano
 * nenhum.
 *
 * A data é obrigatória, e é o ponto de tudo isto: é ela que coloca a pessoa na
 * fila de cobrança. Uma assinatura manual sem data nunca é cobrada, porque ninguém sabe
 * quando ela deveria acabar.
 */
export function DarAssinatura({
  hoje,
  atual,
  estado,
  aoConceder,
  aoEncerrar,
}: {
  hoje: string;
  /** A assinatura manual aberta desta pessoa, se houver. */
  atual: { id: string; plano: PlanoAVender; venceEm: string } | null;
  estado: EstadoDaConcessao;
  aoConceder: (plano: PlanoAVender, venceEm: string) => void;
  aoEncerrar: (id: string) => void;
}) {
  const [plano, setPlano] = useState<PlanoAVender>(atual?.plano ?? 'essencial');
  const [venceEm, setVenceEm] = useState(atual?.venceEm ?? daquiUmMes(hoje));

  const salvando = estado.tipo === 'salvando';

  return (
    <div className="rounded-rebrand-sm border border-line-2 bg-canvas p-3">
      {atual ? (
        <div className="mb-3">
          <p className="text-[13px] text-ink">
            <span className="font-bold">{ROTULO_DO_PLANO[atual.plano]}</span> na mão, até{' '}
            {formatarDia(atual.venceEm)}.
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
          className="mt-1 h-10 w-full rounded-rebrand-sm border border-line-2 bg-white px-2 text-[14px] text-ink disabled:opacity-60"
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

      <label className="mt-3 block text-[12px] text-ink-2">
        Vai até
        <input
          type="date"
          value={venceEm}
          min={hoje}
          disabled={salvando}
          onChange={(e) => setVenceEm(e.target.value)}
          aria-label="Assinatura manual vai até"
          className="mt-1 h-10 w-full rounded-rebrand-sm border border-line-2 bg-white px-2 text-[14px] text-ink disabled:opacity-60"
        />
      </label>

      {estado.tipo === 'erro' && (
        <p className="mt-2 text-[13px] font-bold text-ink">{estado.recado}</p>
      )}

      <button
        type="button"
        // Sem data não há fila de cobrança, e é a fila que faz esta tela existir.
        disabled={salvando || !venceEm}
        onClick={() => aoConceder(plano, venceEm)}
        className="mt-3 h-10 w-full rounded-rebrand-sm bg-forest px-3 text-[13px] font-bold text-white disabled:opacity-40"
      >
        {salvando ? 'Gravando…' : atual ? 'Trocar o plano ou o prazo' : 'Dar esta assinatura'}
      </button>

      <p className="mt-2 text-[11px] text-ink-2">
        Entra na fila de cobrança sete dias antes de vencer.
      </p>
    </div>
  );
}
