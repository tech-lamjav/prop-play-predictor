import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Marcação de "dados de exemplo" mostrada quando a tela é preenchida com
// conteúdo fictício: durante o tour guiado (variant 'tour') ou quando a NBA
// está de férias e não há nada real pra mostrar (variant 'offseason'). Usa
// ambers default do Tailwind (não tokens de tema) pra funcionar igual em
// theme-bolao e theme-rebrand.
//
// O texto vem do catálogo do tour (#532): esta faixa é a moldura da experiência
// guiada, e aparece por cima de telas que já falam espanhol.

export function DemoRibbon({
  show,
  variant = 'tour',
}: {
  show: boolean;
  variant?: 'tour' | 'offseason';
}) {
  // ⚠️ O `useTranslation` mora no componente de DENTRO, e não aqui, de propósito:
  // várias telas montam esta faixa com `show={false}` (a home do Futebol é uma), e
  // hook aqui pediria o catálogo do tour em TODA visita — texto que aquela tela não
  // vai mostrar. Regra de hook impede o `return null` antes da chamada; um segundo
  // componente resolve sem burlá-la.
  if (!show) return null;
  return <FaixaDeExemplo variant={variant} />;
}

function FaixaDeExemplo({ variant }: { variant: 'tour' | 'offseason' }) {
  const { t } = useTranslation('tour');
  return (
    <div className="bg-amber-100 border border-amber-300 text-amber-800 rounded-md">
      <div className="px-4 py-2 flex items-center justify-center gap-2 text-center text-[12.5px] font-medium">
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        {/* A variante escolhe a CHAVE pelo identificador que a tela passou, e não
            por comparação de frase: em espanhol a frase é outra, o identificador
            é o mesmo. */}
        {variant === 'offseason' ? (
          <span>
            <b className="font-semibold">{t('demo.ferias.titulo')}</b> · {t('demo.ferias.texto')}
          </span>
        ) : (
          <span>
            <b className="font-semibold">{t('demo.exemplo.titulo')}</b> · {t('demo.exemplo.texto')}
          </span>
        )}
      </div>
    </div>
  );
}

/** Selo curto "exemplo" pra marcar cards/itens fictícios individualmente. */
export function DemoBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation('tour');
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 ${className}`}
    >
      {t('demo.selo')}
    </span>
  );
}
