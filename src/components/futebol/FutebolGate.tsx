import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { useFutebolAccess } from '@/hooks/use-futebol-data';
import type { FutebolAccess } from '@/services/futebol-data.service';
import { tempoDeTeste } from './tempo-de-teste';
import { faixaDeAcessoAparece } from '@/utils/futebol-bloqueio';

/**
 * Reverse trial do Futebol (48 horas, sem cartão).
 *
 * Quem está NO teste vê tudo — é o mecanismo inteiro: a pessoa ganha o produto
 * por 48 horas para sentir falta depois. Quem não tem acesso é o deslogado e o
 * expirado, e para esses nada que saia do modelo aparece: a aposta, o mercado,
 * a odd, a chance, a vantagem, o Score, a faixa e as premissas.
 *
 * O que continua aberto é fato público de futebol — quem joga, quando, como
 * terminou —, mais o passado já liquidado, que é registro do que foi publicado
 * e não aposta que alguém ainda possa fazer.
 *
 * ⚠️ A fechadura é do BANCO, não daqui. A guarda `futebol_acesso_do_chamador`
 * não devolve o campo, e esta camada só desenha o cadeado no lugar vazio. Antes
 * era o contrário — o dado vinha inteiro e a tela borrava —, e borrão não é
 * fechadura: o texto seguia no HTML e a força fixa em pixels deixava o número
 * grande legível.
 */

/**
 * O lugar de um número que quem não assinou não recebe.
 *
 * Substituiu o `Blur`, que era a fechadura errada por dois motivos. O texto
 * borrado continuava no HTML, legível no inspetor. E a força era fixa em pixels,
 * então protegia ao contrário: 6px escondiam um rótulo de 11px e deixavam o
 * Score de 44px perfeitamente legível — quanto maior e mais valioso o número,
 * mais exposto ele ficava.
 *
 * Agora o dado nem chega: a guarda `futebol_acesso_do_chamador` no banco não
 * devolve o campo. Aqui só sobra dizer que existe algo ali e que ele é pago.
 */
export function ValorBloqueado({ rotulo, className = '' }: { rotulo?: string; className?: string }) {
  return (
    <span
      title="Disponível para assinantes"
      className={`inline-flex items-center gap-1 align-middle text-ink-3 ${className}`}
    >
      <Lock className="w-3 h-3" aria-hidden />
      {/* Com rótulo visível o texto só para leitor de tela sai: os dois juntos
          fazem a mesma informação ser anunciada duas vezes. */}
      {rotulo ? <span>{rotulo}</span> : <span className="sr-only">Disponível para assinantes</span>}
    </span>
  );
}

/**
 * O lugar de uma oportunidade inteira que não é entregue.
 *
 * A home mostra um destes por linha que o board contou: o assinante em potencial
 * vê QUANTAS oportunidades existem hoje, e nenhuma delas. Some-las apagaria da
 * tela que existe produto ali dentro; mostrá-las é o vazamento que fechamos.
 */
export function CartaoBloqueado({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-rebrand-md border border-dashed border-line-2 bg-canvas-2/60 p-4 flex items-center gap-3 ${className}`}
    >
      <span className="w-8 h-8 rounded-full bg-forest/10 text-forest grid place-items-center shrink-0">
        <Lock className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink">Oportunidade bloqueada</div>
        <p className="text-[12px] text-ink-2 leading-snug">A aposta, a odd e o Score são de assinante.</p>
      </div>
    </div>
  );
}

/** Selo de cadeado pequeno, pra sinalizar o que está bloqueado. */
export function LockPill({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-forest/10 text-forest text-[10px] font-bold px-2 py-0.5 ${className}`}>
      <Lock className="w-2.5 h-2.5" /> Premium
    </span>
  );
}

/**
 * Chip discreto de status do trial pro cabeçalho (padrão de mercado).
 * Busca o acesso sozinho — só renderizar nas rotas de Futebol.
 * - trial: pílula neutra "Teste · 31h" (vira âmbar nas últimas 12 horas)
 * - expirado: "Assinar Futebol" (forest)
 * - deslogado: "48 horas grátis" (forest)
 * - assinante: nada
 */
export function FutebolTrialChip() {
  const navigate = useNavigate();
  const { data: access } = useFutebolAccess();
  if (!access || access.state === 'subscribed') return null;

  if (access.state === 'trial') {
    const tempo = tempoDeTeste(access);
    // Sem tempo não há pílula: uma pílula de teste sem número restante não
    // informa nada e ainda ocupa o lugar de quem informa.
    if (!tempo) return null;
    // A pílula aparece no celular também. Era `hidden sm:inline-flex`, e sumia
    // abaixo de 640px — o que significava nenhum contador no celular, porque
    // durante o teste ela é a ÚNICA superfície que mostra o tempo restante: a
    // faixa do gate não aparece no estado de teste, de propósito. Com 7 dias
    // isso passava; com 48 horas a urgência é o produto, e esconder o relógio
    // de quem está no celular é esconder a oferta de quase todo o tráfego.
    return (
      <button
        onClick={() => navigate('/futebol/assinar')}
        title={`Teste grátis · ${tempo.longo}`}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] font-semibold border transition ${
          tempo.acabando ? 'border-amber/50 bg-amber/15 text-amber-2 hover:bg-amber/25' : 'border-line bg-canvas-2 text-ink-2 hover:bg-canvas'
        }`}
      >
        <Sparkles className="w-3 h-3" /> Teste · {tempo.curto}
      </button>
    );
  }

  const expired = access.state === 'expired';
  return (
    <button
      onClick={() => navigate(expired ? '/futebol/assinar' : '/auth')}
      className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold bg-forest text-canvas hover:bg-forest-2 transition"
    >
      {expired ? <Lock className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
      {expired ? 'Assinar Futebol' : '48 horas grátis'}
    </button>
  );
}

/**
 * Faixa de estado do acesso, pra colocar no topo das telas de valor:
 * - trial: nada (o chip do cabeçalho é quem conta o tempo)
 * - expired: CTA pra assinar
 * - anon: CTA pra criar conta (libera 48 horas)
 * - subscribed: nada
 */
export function FutebolAccessBanner({ access, className = '' }: { access?: FutebolAccess; className?: string }) {
  const navigate = useNavigate();
  if (!access || !faixaDeAcessoAparece(access)) return null;

  const expired = access.state === 'expired';
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-rebrand-md border border-forest/30 bg-forest/[0.06] px-4 py-3 ${className}`}>
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <span className="w-8 h-8 rounded-full bg-forest text-canvas grid place-items-center shrink-0"><Lock className="w-4 h-4" /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-ink">{expired ? 'Seu teste grátis acabou' : 'Veja as oportunidades — 48 horas grátis'}</div>
          <p className="text-[12px] text-ink-2 leading-snug">
            {expired
              ? 'As oportunidades do dia estão bloqueadas. Assine o Futebol pra continuar vendo os picks.'
              : 'Crie sua conta e libere os picks do dia por 48 horas, sem cartão.'}
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate(expired ? '/futebol/assinar' : '/auth')}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-rebrand-sm bg-forest text-canvas text-[12px] font-bold px-4 h-9 hover:bg-forest-2 transition"
      >
        {expired ? 'Assinar Futebol' : 'Criar conta grátis'}
      </button>
    </div>
  );
}
