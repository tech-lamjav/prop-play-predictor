import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

/**
 * Campo de senha com o olho que revela o que foi digitado.
 *
 * Existe como componente porque a tela de entrar tem TRÊS campos de senha —
 * entrar, criar e confirmar — e um olho copiado três vezes diverge na quarta.
 *
 * ⚠️ O BOTÃO FICA FORA DA ORDEM DE TABULAÇÃO (`tabIndex={-1}`). Quem navega
 * por teclado digita a senha e segue para o próximo campo; um botão no meio
 * faria parar num controle que não é parte do preenchimento. Quem precisa dele
 * alcança pelo mouse ou pelo toque, e quem usa leitor de tela ouve o rótulo.
 *
 * ⚠️ NASCE ESCONDIDO, SEMPRE. Revelar é ação consciente de quem está na frente
 * da tela, e o estado não sobrevive a nada — sem memória, sem preferência.
 */
export function CampoDeSenha({
  id,
  value,
  onChange,
  required,
  autoComplete,
  className,
}: {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}) {
  const { t } = useTranslation('auth');
  const [revelada, setRevelada] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={revelada ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        // O espaço à direita é do botão: sem ele o texto passa por baixo do olho.
        className={`pr-10 ${className ?? ''}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setRevelada((v) => !v)}
        aria-label={revelada ? t('senha.esconder') : t('senha.revelar')}
        aria-pressed={revelada}
        className="absolute right-0 top-0 h-full px-3 flex items-center text-ink-3 hover:text-ink transition-colors"
      >
        {revelada ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
