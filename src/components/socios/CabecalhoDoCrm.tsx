import type { EstadoDoPainel } from './PainelCrm';

/**
 * A faixa de identidade do painel.
 *
 * Entra logo abaixo do header do site, que continua sendo o mesmo do resto do
 * produto — o painel não é um lugar à parte, é uma tela interna dele. O que
 * esta faixa faz é deixar claro que daqui para baixo o assunto é operação, e
 * não o que o assinante vê.
 *
 * Ela NÃO esconde nada: quem protege o painel é a política de linha do banco.
 */
export function CabecalhoDoCrm({ estado }: { estado: EstadoDoPainel }) {
  const resumo =
    estado.tipo === 'pronto'
      ? `${estado.totalNaBase} ${estado.totalNaBase === 1 ? 'cadastro' : 'cadastros'} na base`
      : estado.tipo === 'erro'
        ? 'base indisponível'
        : 'carregando…';

  return (
    <div className="border-b border-line-2 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4">
        <h1 className="font-display text-2xl font-black text-ink">CRM</h1>
        <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
          Uso interno
        </span>
        <p className="text-[13px] text-ink-2">{resumo}</p>
      </div>
    </div>
  );
}
