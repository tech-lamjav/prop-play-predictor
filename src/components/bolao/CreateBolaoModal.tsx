import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Trophy,
  Crown,
  Users,
  Target,
  BarChart3,
  Check,
  Zap,
  Star,
  Palette,
  ChevronRight,
  CreditCard,
  MessageCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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
  { icon: Users,    text: 'Até 10 participantes' },
  { icon: Target,   text: '1pt resultado · 3pts placar' },
  { icon: Trophy,   text: 'Palpite de campeão' },
  { icon: BarChart3,text: 'Ranking geral' },
];

const PREMIUM_FEATURES = [
  { icon: Users,    text: 'Participantes ilimitados',       highlight: true  },
  { icon: Target,   text: 'Pontuação customizável',         highlight: false },
  { icon: Star,     text: 'Palpites especiais (semis, quartas...)', highlight: true },
  { icon: BarChart3,text: 'Ranking por fase + destaques',   highlight: false },
  { icon: Zap,      text: 'Fases finais valem mais (até 5×)', highlight: true },
  { icon: Palette,  text: 'Logo e cor personalizados',      highlight: false },
];

export const CreateBolaoModal: React.FC<CreateBolaoModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}) => {
  const [plan, setPlan] = useState<Plan>('free');

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
      setPlan('free');
      reset();
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-terminal-bg border-terminal-border max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-terminal-text">
            <Trophy className="w-5 h-5 text-terminal-blue" />
            Criar Bolão
          </DialogTitle>
        </DialogHeader>

        {/* Plan selector */}
        <div className="grid grid-cols-2 gap-3 px-5 pt-6 items-stretch">

          {/* Free */}
          <button
            type="button"
            onClick={() => setPlan('free')}
            className={`relative rounded-lg border p-3 text-left transition-all flex flex-col justify-start ${
              plan === 'free'
                ? 'border-terminal-blue bg-terminal-blue/10 ring-1 ring-terminal-blue/30'
                : 'border-terminal-border hover:border-terminal-border-subtle'
            }`}
          >
            {plan === 'free' && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-terminal-blue flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-terminal-bg" />
              </div>
            )}
            <p className="text-xs font-bold uppercase tracking-wider mb-3">Free</p>
            <ul className="space-y-1.5">
              {FREE_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-1.5 text-[10px] opacity-50">
                  <f.icon className="w-3 h-3 shrink-0" />
                  {f.text}
                </li>
              ))}
            </ul>
          </button>

          {/* Premium */}
          <button
            type="button"
            onClick={() => setPlan('pro')}
            className={`relative rounded-lg border p-3 text-left transition-all ${
              plan === 'pro'
                ? 'border-yellow-400/70 bg-yellow-500/8 ring-1 ring-yellow-500/20'
                : 'border-yellow-500/30 bg-yellow-500/3 hover:border-yellow-400/50'
            }`}
          >
            {/* Recommended badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="text-[9px] px-2 py-0.5 bg-yellow-500 text-terminal-bg rounded-full font-bold uppercase tracking-wide whitespace-nowrap">
                Recomendado
              </span>
            </div>

            {plan === 'pro' ? (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-terminal-bg" />
              </div>
            ) : (
              <ChevronRight className="absolute top-2 right-2 w-3.5 h-3.5 text-yellow-500/50" />
            )}

            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Premium</p>
              <span className="text-[10px] font-bold text-yellow-300">R$ 19,90</span>
            </div>

            {/* Features */}
            <ul className="space-y-1.5">
              {PREMIUM_FEATURES.map((f) => (
                <li
                  key={f.text}
                  className={`flex items-center gap-1.5 text-[10px] ${
                    f.highlight ? 'text-yellow-300 opacity-90' : 'text-terminal-text opacity-60'
                  }`}
                >
                  <f.icon className={`w-3 h-3 shrink-0 ${f.highlight ? 'text-yellow-400' : ''}`} />
                  {f.text}
                </li>
              ))}
            </ul>

            {/* Price footnote */}
            <p className="text-[9px] opacity-30 mt-2">pagamento único · sem mensalidade</p>
          </button>
        </div>

        {/* Premium payment options — below cards */}
        {plan === 'pro' && (
          <div className="mx-5 mt-3 rounded border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <p className="text-[10px] text-yellow-400/80">
                Pagamento de <span className="font-bold text-yellow-300">R$ 19,90</span> via cartão de crédito
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <p className="text-[10px] text-terminal-text/60">
                Quer pagar via PIX?{' '}
                <a
                  href="https://wa.me/5511952136845?text=Ol%C3%A1!%20Quero%20pagar%20o%20Bol%C3%A3o%20Premium%20via%20PIX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 underline underline-offset-2 font-medium"
                >
                  Fale conosco no WhatsApp
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="px-5 pb-5 pt-4 space-y-4"
        >
          <div>
            <Label
              htmlFor="name"
              className="text-terminal-text text-xs uppercase opacity-70"
            >
              Nome do Bolão
            </Label>
            <Input
              id="name"
              placeholder="Ex: Bolão da Firma"
              className="mt-1 bg-terminal-dark-gray border-terminal-border text-terminal-text"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-terminal-red mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label
              htmlFor="description"
              className="text-terminal-text text-xs uppercase opacity-70"
            >
              Descrição (opcional)
            </Label>
            <Textarea
              id="description"
              placeholder="Descreva seu bolão..."
              rows={2}
              className="mt-1 bg-terminal-dark-gray border-terminal-border text-terminal-text resize-none"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-terminal-red mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="text-terminal-text"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className={
                plan === 'pro'
                  ? 'bg-yellow-500 text-terminal-bg hover:bg-yellow-500/90 gap-1.5 font-bold'
                  : 'bg-terminal-blue text-terminal-bg hover:bg-terminal-blue/90 gap-1.5'
              }
            >
              {isLoading ? (
                'Criando...'
              ) : plan === 'pro' ? (
                <>
                  <Crown className="w-3.5 h-3.5" /> Criar Bolão Premium
                </>
              ) : (
                'Criar Bolão'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
