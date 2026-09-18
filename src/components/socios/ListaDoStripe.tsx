import { Link } from 'react-router-dom';
import { CreditCard, HelpCircle } from 'lucide-react';
import type { AssinaturaDoStripe } from './crm-assinatura-do-stripe';
import { formatarDia } from './crm-lista';
import { ROTA_DO_CRM } from './crm-vocabulario';

export type EstadoDoStripe =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; assinaturas: AssinaturaDoStripe[] };

/**
 * Uma assinatura do gateway.
 *
 * ⚠️ NÃO tem mensagem pronta, ao contrário da fila de cobrança. Toda mensagem
 * de cobrança fala de uma data que está chegando e de um acesso que vai cair, e
 * nenhuma das duas coisas é verdade aqui: o gateway cobra sozinho e renova
 * sozinho. Oferecer o texto convidaria o sócio a pedir Pix a quem já tem cartão
 * passando, que é como se produz pagamento em dobro.
 */
function LinhaDoStripe({ assinatura }: { assinatura: AssinaturaDoStripe }) {
  const { userId, pessoa, produto, renovaEm } = assinatura;

  return (
    <div className="border-t border-line-2 p-5 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          to={`${ROTA_DO_CRM}/${userId}`}
          className="text-[15px] font-bold text-ink hover:text-forest"
        >
          {pessoa}
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[12px] font-bold text-ink-2">
          {renovaEm === null ? (
            <HelpCircle aria-hidden className="h-3 w-3" />
          ) : (
            <CreditCard aria-hidden className="h-3 w-3" />
          )}
          {/* ⚠️ "Não sabemos", e nunca um traço ou um vazio. Quem assina só o
              futebol não tem coluna de prazo, e uma tela calada aqui seria lida
              como "renova hoje" ou como defeito. */}
          {renovaEm === null ? 'renovação: não sabemos' : `renova em ${formatarDia(renovaEm)}`}
        </span>
      </div>

      <p className="mt-0.5 text-[13px] text-ink-2">
        {/* O produto sai como o gateway gravou. Traduzir para a escada de venda
            inventaria um plano que a pessoa não contratou. */}
        {produto === null ? 'produto não gravado' : produto} no cartão
      </p>
    </div>
  );
}

/**
 * Quem paga pelo gateway.
 *
 * Recorte próprio, e não misturado em "Todas": aquele recorte promete
 * assinaturas dadas na mão, e juntar as duas origens num número só faria a tela
 * se desmentir.
 *
 * ⚠️ Esta lista NUNCA alimenta a fila de cobrança nem a de inadimplentes, e o
 * desenho é o que garante isso: aquelas duas recebem o tipo da assinatura
 * manual, então pôr alguém do gateway nelas não é um engano possível de
 * cometer — é código que não compila.
 */
export function ListaDoStripe({ estado }: { estado: EstadoDoStripe }) {
  if (estado.tipo === 'carregando') {
    return <p className="px-5 py-8 text-[14px] text-ink-2">Carregando quem paga no cartão…</p>;
  }

  if (estado.tipo === 'erro') {
    return (
      <p className="px-5 py-8 text-[14px] text-ink-2">
        Não deu para carregar a base, então não dá para saber quem paga no cartão.
      </p>
    );
  }

  if (estado.assinaturas.length === 0) {
    return <p className="px-5 py-8 text-[14px] text-ink-2">Ninguém assinando pelo cartão ainda.</p>;
  }

  return (
    <div>
      {estado.assinaturas.map((a) => (
        <LinhaDoStripe key={a.userId} assinatura={a} />
      ))}
    </div>
  );
}
