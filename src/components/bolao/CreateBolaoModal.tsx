import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Trophy,
  Users,
  Target,
  Check,
  Zap,
  Sparkles,
  Palette,
  Flag,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const schema = z.object({
  name: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(50, 'Máximo 50 caracteres'),
  description: z.string().max(200, 'Máximo 200 caracteres').optional(),
});

type FormData = z.infer<typeof schema>;
type Plan = 'free' | 'pro';

interface CreateBolaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData & { plan: Plan }) => void;
  isLoading?: boolean;
}

const FREE_FEATURES = [
  { icon: Users, text: 'Até 20 participantes' },
  { icon: Target, text: 'Pontuação 100% customizável' },
  { icon: Sparkles, text: 'Palpites especiais (campeão, semis, quartas)' },
  { icon: Zap, text: 'Multiplicador por fase (final vale 5× mais)' },
  { icon: Palette, text: 'Logo e identidade do bolão' },
  { icon: Flag, text: 'Ranking por fase + destaques' },
];

const PREMIUM_FEATURES = [
  { icon: Users, text: 'Participantes ilimitados (20+)', highlight: true },
  { icon: Sparkles, text: 'Tudo do Free incluído', highlight: true },
];

const WHATSAPP_PIX_URL =
  'https://wa.me/5511952136845?text=Ol%C3%A1!%20Quero%20pagar%20o%20Bol%C3%A3o%20Premium%20via%20PIX';

export const CreateBolaoModal: React.FC<CreateBolaoModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}) => {
  const [plan, setPlan] = useState<Plan>('pro');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleFormSubmit = (data: FormData) => {
    onSubmit({ ...data, plan });
    reset();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setPlan('pro');
      reset();
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="theme-bolao bg-canvas border border-line max-w-[640px] p-0 overflow-hidden rounded-rebrand-xl"
        // O tema-bolao precisa estar aplicado aqui também (modais do shadcn
        // são portados pra fora do DOM tree do BolaoLayout via Radix Portal,
        // então as CSS vars escopadas não chegam sem reaplicar.)
      >
        {/* Header — pr-12 reserva espaco pro X built-in do DialogContent (top-right) */}
        <div className="flex items-center gap-2.5 px-6 pt-5 pb-4 pr-12 border-b border-line">
          <div className="w-9 h-9 rounded-rebrand-md bg-forest flex items-center justify-center text-amber">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-ink leading-tight">Criar bolão</h2>
            <p className="text-[12px] text-ink-2 leading-tight mt-0.5">
              Você é o dono — convida quem quiser depois
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-5 max-h-[70vh] overflow-y-auto">
          <p className="text-[12px] text-ink-2 mb-3 leading-snug">
            Mesmas features nos dois planos. A única diferença é o tamanho do grupo:{' '}
            <span className="text-ink font-semibold">até 20 pessoas no Free, ilimitado no Premium</span>.
          </p>

          {/* Plan picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {/* Free */}
            <button
              type="button"
              onClick={() => setPlan('free')}
              className={`relative text-left rounded-rebrand-lg border p-5 transition-all flex flex-col ${
                plan === 'free'
                  ? 'border-forest bg-forest/[0.06] ring-2 ring-forest/15'
                  : 'border-line bg-white hover:border-line-2'
              }`}
            >
              <div className="flex items-center justify-between gap-2 min-h-[3.25rem] pb-3 mb-3 border-b border-line/60">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2 leading-tight">
                  Free
                </p>
                <div className="text-right flex items-start gap-2">
                  <div>
                    <p className="text-[15px] font-bold text-ink leading-tight">Grátis</p>
                    <p className="text-[10px] text-ink-2 mt-0.5 whitespace-nowrap">pra sempre</p>
                  </div>
                  {plan === 'free' && (
                    <span className="w-5 h-5 rounded-full bg-forest flex items-center justify-center text-white shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => (
                  <li
                    key={f.text}
                    className="flex items-start gap-2 text-[13px] leading-snug text-ink-2"
                  >
                    <f.icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-3" />
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            </button>

            {/* Premium */}
            <button
              type="button"
              onClick={() => setPlan('pro')}
              className={`relative text-left rounded-rebrand-lg border p-5 transition-all flex flex-col ${
                plan === 'pro'
                  ? 'border-amber bg-amber/[0.06] ring-2 ring-amber/25'
                  : 'border-line bg-white hover:border-line-2'
              }`}
            >
              {/* Selo Recomendado */}
              <span className="absolute -top-2.5 left-5 text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 bg-amber text-white rounded-full">
                Recomendado
              </span>
              <div className="flex items-center justify-between gap-2 min-h-[3.25rem] pb-3 mb-3 border-b border-line/60">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-2 leading-tight">
                  Premium
                </p>
                <div className="text-right flex items-start gap-2">
                  <div>
                    <p className="text-[15px] font-bold text-ink leading-tight">R$ 19,90</p>
                    <p className="text-[10px] text-ink-2 mt-0.5 whitespace-nowrap">único · sem mensalidade</p>
                  </div>
                  {plan === 'pro' && (
                    <span className="w-5 h-5 rounded-full bg-amber flex items-center justify-center text-white shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {PREMIUM_FEATURES.map((f) => (
                  <li
                    key={f.text}
                    className={`flex items-start gap-2 text-[13px] leading-snug ${
                      f.highlight ? 'text-amber-2 font-medium' : 'text-ink-2'
                    }`}
                  >
                    <f.icon
                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                        f.highlight ? 'text-amber' : 'text-ink-3'
                      }`}
                    />
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            </button>
          </div>

          {/* PIX inline (só Premium) */}
          {plan === 'pro' && (
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-rebrand-md border border-amber/40 bg-amber/[0.08] mb-4">
              <div className="w-7 h-7 rounded-rebrand-sm bg-amber text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                PIX
              </div>
              <p className="text-[12px] text-ink leading-tight flex-1">
                Prefere PIX? <span className="font-semibold">Fale no WhatsApp</span>
              </p>
              <a
                href={WHATSAPP_PIX_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-forest hover:underline shrink-0"
              >
                Abrir WhatsApp →
              </a>
            </div>
          )}

          {/* Form */}
          <form id="create-bolao-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3.5">
            <div>
              <label
                htmlFor="name"
                className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-2 mb-1.5 block"
              >
                Nome do bolão
              </label>
              <input
                id="name"
                placeholder="Ex.: Bolão da Firma"
                className="w-full h-11 px-3.5 rounded-rebrand-md border border-line bg-white text-[14px] text-ink placeholder:text-ink-3 focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-[11px] text-status-danger mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="description"
                className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-2 mb-1.5 block"
              >
                Descrição{' '}
                <span className="opacity-60 normal-case font-normal">(opcional)</span>
              </label>
              <textarea
                id="description"
                rows={2}
                placeholder="Quem ganhar paga o churrasco. Sem desculpa."
                className="w-full px-3.5 py-2.5 rounded-rebrand-md border border-line bg-white text-[14px] text-ink placeholder:text-ink-3 focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none resize-none"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-[11px] text-status-danger mt-1">{errors.description.message}</p>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-ink-2 leading-tight text-center sm:text-left">
            Você poderá <span className="text-ink font-medium">trocar pontuação e regras</span>{' '}
            depois — antes do 1º jogo.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="h-10 px-4 rounded-rebrand-md text-[13px] font-medium text-ink-2 hover:bg-canvas-2 transition-colors"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="create-bolao-form"
              disabled={isLoading}
              variant={plan === 'pro' ? 'amber' : 'forest'}
              className="rounded-rebrand-md h-10 px-5 gap-2"
            >
              {plan === 'pro' && <Trophy className="w-4 h-4" />}
              {isLoading
                ? 'Criando...'
                : plan === 'pro'
                  ? 'Criar e pagar R$ 19,90'
                  : 'Criar bolão grátis'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
