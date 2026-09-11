import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import { mensagemDeCobranca, prazoDe, type Prazo } from './crm-cobranca';
import { formatarDia } from './crm-lista';
import { ROTA_DOS_SOCIOS, ROTULO_DO_PLANO } from './crm-vocabulario';
import type { Assinatura } from './crm-assinatura';
import { MensagemPronta } from './MensagemPronta';
import type { EstadoDasAssinaturas } from '@/hooks/use-assinaturas';

/** "vence em 8 dias", "vence hoje", "venceu faz 7 dias". */
function comoDizer(prazo: Prazo): string {
  if (prazo.tipo === 'hoje') return 'vence hoje';
  const dias = `${prazo.dias} ${prazo.dias === 1 ? 'dia' : 'dias'}`;
  return prazo.tipo === 'a_vencer' ? `vence em ${dias}` : `venceu faz ${dias}`;
}

/**
 * Uma cobrança, com a mensagem já escrita.
 *
 * A mensagem fica ABERTA, e não atrás de um botão "gerar": o trabalho aqui é
 * copiar e colar num WhatsApp, e cada clique a mais entre ver a pessoa e ter o
 * texto na mão é um motivo a mais para deixar para depois.
 */
function Cobranca({ assinatura, hoje }: { assinatura: Assinatura; hoje: string }) {
  const prazo = prazoDe(assinatura.venceEm, hoje);
  const vencida = prazo.tipo === 'vencida';

  return (
    <div className="border-t border-line-2 p-5 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          to={`${ROTA_DOS_SOCIOS}/${assinatura.userId}`}
          className="text-[15px] font-bold text-ink hover:text-forest"
        >
          {assinatura.pessoa}
        </Link>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
            vencida ? 'bg-amber-400/20 text-ink' : 'bg-canvas text-ink-2'
          }`}
        >
          {vencida ? (
            <AlertTriangle aria-hidden className="h-3 w-3" />
          ) : (
            <Clock aria-hidden className="h-3 w-3" />
          )}
          {comoDizer(prazo)}
        </span>
      </div>

      <p className="mt-0.5 text-[13px] text-ink-2">
        {ROTULO_DO_PLANO[assinatura.plano]} na mão, até {formatarDia(assinatura.venceEm)}
      </p>

      <div className="mt-3">
        <MensagemPronta
          modelo={mensagemDeCobranca(
            assinatura.pessoa,
            ROTULO_DO_PLANO[assinatura.plano],
            assinatura.venceEm,
            prazo,
          )}
          numero={assinatura.whatsapp}
        />
      </div>
    </div>
  );
}

/**
 * A fila de cobrança.
 *
 * Existe porque uma assinatura dada na mão não renova sozinha: ela vence, e sem
 * um lugar que junte quem está vencendo, a conversa acontece tarde — quando a
 * pessoa já está sem o produto e sem motivo nenhum para voltar.
 *
 * A ordem é por quem vence primeiro, com quem já venceu no topo. Lida de cima
 * para baixo, ela é a lista de quem chamar hoje.
 */
export function ListaDeCobranca({
  estado,
  hoje,
  vazio,
}: {
  estado: EstadoDasAssinaturas;
  hoje: string;
  vazio: string;
}) {
  if (estado.tipo === 'carregando') {
    return <p className="px-5 py-8 text-[14px] text-ink-2">Carregando as assinaturas…</p>;
  }

  if (estado.tipo === 'erro') {
    return (
      <p className="px-5 py-8 text-[14px] text-ink-2">
        Não deu para carregar as assinaturas dadas na mão agora.
      </p>
    );
  }

  if (estado.assinaturas.length === 0) {
    return <p className="px-5 py-8 text-[14px] text-ink-2">{vazio}</p>;
  }

  return (
    <div>
      {estado.assinaturas.map((a) => (
        <Cobranca key={a.id} assinatura={a} hoje={hoje} />
      ))}
    </div>
  );
}
