import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Infinity as SemFim } from 'lucide-react';
import { mensagemDeCobranca, prazoDe, type Prazo } from './crm-cobranca';
import { formatarDia } from './crm-lista';
import { ROTA_DO_CRM, ROTULO_DO_PLANO } from './crm-vocabulario';
import type { Assinatura } from './crm-assinatura';
import { emReais } from './crm-receita';
import { MensagemPronta } from './MensagemPronta';
import type { EstadoDasAssinaturas } from '@/hooks/use-assinaturas';

/** "vence em 8 dias", "vence hoje", "venceu faz 7 dias". */
function comoDizer(prazo: Prazo): string {
  if (prazo.tipo === 'hoje') return 'vence hoje';
  const dias = `${prazo.dias} ${prazo.dias === 1 ? 'dia' : 'dias'}`;
  return prazo.tipo === 'a_vencer' ? `vence em ${dias}` : `venceu faz ${dias}`;
}

/**
 * O selo de quem tem as duas origens.
 *
 * ⚠️ Mora num componente só porque aparece em DUAS listas — esta e a de
 * inadimplentes — e a frase precisa ser a mesma nas duas: o sócio compara os
 * dois lugares, e duas redações do mesmo aviso fariam ele achar que são
 * situações diferentes.
 */
export function SeloDoCartao() {
  return (
    <p className="mt-1 text-[12px] text-ink-2">
      <span className="font-bold">Também paga no cartão.</span> O acordo feito na mão continua
      aberto e parou de acumular mês. Se ele acabou, encerre na ficha.
    </p>
  );
}

/**
 * Uma cobrança, com a mensagem já escrita.
 *
 * A mensagem fica ABERTA, e não atrás de um botão "gerar": o trabalho aqui é
 * copiar e colar num WhatsApp, e cada clique a mais entre ver a pessoa e ter o
 * texto na mão é um motivo a mais para deixar para depois.
 *
 * ⚠️ A vitalícia aparece no recorte "Todas" e não tem mensagem. Não é
 * esquecimento: toda mensagem de cobrança fala de uma data que está chegando, e
 * para quem não tem data nenhuma dessas frases é verdade. Quem é vitalício e
 * paga por mês pode ficar devendo, e essa cobrança sai dos meses em aberto, que
 * é outra conversa e outro texto.
 */
function Cobranca({ assinatura, hoje }: { assinatura: Assinatura; hoje: string }) {
  const prazo = assinatura.venceEm === null ? null : prazoDe(assinatura.venceEm, hoje);
  const vencida = prazo?.tipo === 'vencida';

  return (
    <div className="border-t border-line-2 p-5 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          to={`${ROTA_DO_CRM}/${assinatura.userId}`}
          className="text-[15px] font-bold text-ink hover:text-forest"
        >
          {assinatura.pessoa}
        </Link>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
            vencida ? 'bg-amber-400/20 text-ink' : 'bg-canvas text-ink-2'
          }`}
        >
          {prazo === null ? (
            <SemFim aria-hidden className="h-3 w-3" />
          ) : vencida ? (
            <AlertTriangle aria-hidden className="h-3 w-3" />
          ) : (
            <Clock aria-hidden className="h-3 w-3" />
          )}
          {prazo === null ? 'não vence' : comoDizer(prazo)}
        </span>
      </div>

      <p className="mt-0.5 text-[13px] text-ink-2">
        {ROTULO_DO_PLANO[assinatura.plano]} na mão,{' '}
        {assinatura.venceEm === null ? 'vitalícia' : `até ${formatarDia(assinatura.venceEm)}`}
        {' · '}
        {assinatura.valorMensal === null
          ? 'sem cobrança'
          : `${emReais(assinatura.valorMensal)} por mês`}
      </p>

      {assinatura.pagaNoCartao ? <SeloDoCartao /> : null}

      {/* `assinatura.venceEm` está aqui em vez de `prazo`: o compilador sabe
          que ele não é nulo por causa da checagem do prazo, e repetir a
          condição faria a tela ter duas verdades sobre a mesma coisa. */}
      {prazo !== null && assinatura.venceEm !== null ? (
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
      ) : null}
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
  noCartao,
}: {
  estado: EstadoDasAssinaturas;
  hoje: string;
  vazio: string;
  /** Quantos venceriam na janela mas saíram da fila por pagar no cartão. */
  noCartao: number;
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

  /*
   * ⚠️ O rodapé sai FORA do desvio de lista vazia, e é o caso que mais importa.
   *
   * Fila vazia com gente escondida é a pior combinação possível: o sócio lê
   * "ninguém para cobrar", fecha a tela, e nunca fica sabendo que o sistema
   * tirou pessoas dali. Escrever o aviso só quando sobrou alguém faria o
   * silêncio acontecer justamente onde ele engana.
   */
  return (
    <div>
      {estado.assinaturas.length === 0 ? (
        <p className="px-5 py-8 text-[14px] text-ink-2">{vazio}</p>
      ) : (
        estado.assinaturas.map((a) => <Cobranca key={a.id} assinatura={a} hoje={hoje} />)
      )}

      {noCartao > 0 ? (
        <p className="border-t border-line-2 px-5 py-3 text-[12px] text-ink-2">
          {noCartao === 1
            ? '1 pessoa saiu desta fila por já pagar no cartão.'
            : `${noCartao} pessoas saíram desta fila por já pagarem no cartão.`}{' '}
          O gateway cobra sozinho, e pedir Pix a quem tem cartão passando é como se produz
          pagamento em dobro. O acordo na mão delas continua aberto, em "Todas".
        </p>
      ) : null}
    </div>
  );
}
