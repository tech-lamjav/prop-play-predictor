import type { TooltipRenderProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';

// Tooltip do onboarding guiado. O Joyride renderiza num portal no <body>, fora
// da árvore .theme-bolao — então a classe vai no próprio container pra que as
// variáveis do design system (forest/ink/etc.) resolvam nos filhos.
//
// O título e o corpo do passo chegam JÁ TRADUZIDOS (o OnboardingTourJoyride
// resolve as chaves antes de entregar os passos ao Joyride); o que este arquivo
// traduz é só a moldura — a contagem de passos e os botões.
export default function OnboardingTooltip({
  index,
  size,
  step,
  isLastStep,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  const { t } = useTranslation('tour');
  const isFirst = index === 0;
  const single = size === 1;

  return (
    <div
      {...tooltipProps}
      className="theme-bolao w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-white p-5 shadow-[0_18px_50px_-12px_rgba(10,31,24,0.35)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest">
          {single
            ? t('tooltip.dicaRapida')
            : t('tooltip.passo', { atual: index + 1, total: size })}
        </span>
        {!single && (
          <button
            {...skipProps}
            className="text-[12px] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            {t('tooltip.pular')}
          </button>
        )}
      </div>

      {step.title && (
        <h3 className="font-display text-[18px] font-extrabold leading-tight text-ink">
          {step.title}
        </h3>
      )}
      <div className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{step.content}</div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {!single ? (
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: size }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-4 bg-forest' : 'w-1.5 bg-ink-3/30'
                }`}
              />
            ))}
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          {!isFirst && (
            <button
              {...backProps}
              className="rounded-rebrand-sm px-3 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              {t('tooltip.voltar')}
            </button>
          )}
          <button
            {...primaryProps}
            className="rounded-rebrand-sm bg-forest px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-forest-2"
          >
            {isLastStep ? t('tooltip.entendi') : t('tooltip.proximo')}
          </button>
        </div>
      </div>
    </div>
  );
}
