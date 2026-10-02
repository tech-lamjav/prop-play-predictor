import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { Inadimplente } from './crm-assinatura';
import { formatarDia } from './crm-lista';
import { emReais, textoDosMesesEmAberto } from './crm-receita';
import { SeloDoCartao } from './ListaDeCobranca';
import { ROTA_DO_CRM, ROTULO_DO_PLANO } from './crm-vocabulario';

export type EstadoDosInadimplentes =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; inadimplentes: Inadimplente[] };

/** Uma pessoa devendo: quanto, desde quando, e em que acordo. */
function Linha({ item }: { item: Inadimplente }) {
  const { t } = useTranslation('socios');
  const { assinatura, meses, total } = item;

  return (
    <div className="border-t border-line-2 p-5 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          to={`${ROTA_DO_CRM}/${assinatura.userId}`}
          className="text-[15px] font-bold text-ink hover:text-forest"
        >
          {assinatura.pessoa}
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[12px] font-bold text-ink">
          <AlertTriangle aria-hidden className="h-3 w-3" />
          {t('dinheiro.comum.devendo', { count: meses.length, total: emReais(total) })}
        </span>
      </div>

      {/* ⚠️ `ROTULO_DO_PLANO` entra INTERPOLADO e continua em português de
          propósito (#558): o mesmo rótulo vai dentro da mensagem de cobrança que
          o sócio cola no WhatsApp de um lead brasileiro. */}
      <p className="mt-0.5 text-[13px] text-ink-2">
        {assinatura.venceEm === null
          ? t('dinheiro.comum.planoVitalicia', { plano: ROTULO_DO_PLANO[assinatura.plano] })
          : t('dinheiro.comum.planoAte', {
              plano: ROTULO_DO_PLANO[assinatura.plano],
              dia: formatarDia(assinatura.venceEm),
            })}
        {assinatura.valorMensal !== null
          ? ` · ${t('dinheiro.comum.porMes', { valor: emReais(assinatura.valorMensal) })}`
          : ''}
      </p>

      {/* ⚠️ `textoDosMesesEmAberto` continua em PORTUGUÊS (`crm-receita.ts`). */}
      <p className="mt-1 text-[12px] text-ink-2">
        {t('dinheiro.inadimplentes.emAberto', { meses: textoDosMesesEmAberto(meses) })}
      </p>

      {assinatura.pagaNoCartao ? <SeloDoCartao /> : null}
    </div>
  );
}

/**
 * A fila de inadimplentes.
 *
 * Existe porque o Pix não passa pelo Stripe, e quem paga por fora pode
 * simplesmente parar de pagar sem nada acontecer. Sem uma lista que junte quem
 * está devendo, achar quem cancelar exigia abrir ficha por ficha.
 *
 * Não tem botão de encerrar, e é de propósito: encerrar corta o acesso de um
 * cliente, e a decisão precisa ser tomada olhando a ficha inteira, com o
 * histórico de pagamento na frente. A linha leva até lá.
 */
export function ListaDeInadimplentes({ estado }: { estado: EstadoDosInadimplentes }) {
  const { t } = useTranslation('socios');

  if (estado.tipo === 'carregando') {
    return (
      <p className="px-5 py-8 text-[14px] text-ink-2">{t('dinheiro.inadimplentes.carregando')}</p>
    );
  }

  if (estado.tipo === 'erro') {
    return <p className="px-5 py-8 text-[14px] text-ink-2">{t('dinheiro.inadimplentes.erro')}</p>;
  }

  if (estado.inadimplentes.length === 0) {
    return <p className="px-5 py-8 text-[14px] text-ink-2">{t('dinheiro.inadimplentes.vazio')}</p>;
  }

  return (
    <div>
      {estado.inadimplentes.map((item) => (
        <Linha key={item.assinatura.id} item={item} />
      ))}
      <p className="border-t border-line-2 px-5 py-3 text-[12px] text-ink-2">
        {t('dinheiro.inadimplentes.rodape')}
      </p>
    </div>
  );
}
