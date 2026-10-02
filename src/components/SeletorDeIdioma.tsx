import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { idiomaAtivo, trocarIdioma } from '@/i18n/init';
import { IDIOMAS, NOME_DO_IDIOMA, type Idioma } from '@/i18n/idiomas';

/**
 * O seletor de idioma.
 *
 * ⚠️ Ele vive em DOIS lugares, e isso não é duplicação por descuido. O menu da
 * conta é onde a preferência mora, e é o que estava pedido — mas esse menu só
 * renderiza para quem tem usuário. O escopo do #532 é tela PÚBLICA, e quem
 * mais precisa do espanhol chega deslogado e nunca abre aquele menu. Por isso
 * o cabeçalho deslogado tem o seu.
 *
 * A lista é montada a partir de `IDIOMAS`, então idioma novo aparece sozinho
 * nos dois lugares. O nome de cada um é escrito NA PRÓPRIA LÍNGUA dele, que é
 * a convenção de mercado: quem não lê a língua da tela precisa reconhecer a
 * dele na lista.
 */

/** Uma linha por idioma, para listas que já têm moldura — menu ou tela cheia. */
export function SeletorDeIdioma({
  className,
  aposTrocar,
}: {
  className?: string;
  aposTrocar?: () => void;
}) {
  // A assinatura do i18next é o que faz este componente repintar quando o
  // idioma muda. Ler `idiomaAtivo()` sem ela deixaria a marca de selecionado
  // parada no idioma antigo — a troca aconteceria e a tela não contaria.
  useTranslation();
  const atual = idiomaAtivo();

  const escolher = (idioma: Idioma) => {
    void trocarIdioma(idioma).then(() => aposTrocar?.());
  };

  return (
    <div className={className} role="group">
      {IDIOMAS.map((idioma) => (
        <button
          key={idioma}
          type="button"
          onClick={() => escolher(idioma)}
          aria-current={idioma === atual}
          lang={idioma}
          className="w-full h-[38px] px-2.5 rounded-[9px] flex items-center gap-2.5 text-[13px] font-medium text-sand-ink-strong hover:bg-sand-100 hover:text-forest transition-colors"
        >
          <Globe className="w-4 h-4 text-forest shrink-0" />
          <span className="flex-1 text-left">{NOME_DO_IDIOMA[idioma]}</span>
          {idioma === atual && <Check className="w-3.5 h-3.5 text-forest shrink-0" />}
        </button>
      ))}
    </div>
  );
}

/**
 * O seletor do cabeçalho deslogado: um botão de globo que abre a lista.
 *
 * Compacto de propósito — ali ele divide espaço com Assinar e Entrar, que são
 * as ações que o negócio quer em primeiro plano. O idioma precisa ser
 * encontrável, não chamativo.
 */
const TOM = {
  /** Cabeçalho verde: o da área logada e o da tela de entrar. */
  escuro: 'text-white/85 hover:bg-white/10',
  /** Cabeçalho claro: as landings, as LPs e os paywalls. */
  claro: 'text-ink border border-line-2 bg-white hover:border-forest/40',
} as const;

export function SeletorDeIdiomaCompacto({
  tom = 'escuro',
  className,
}: {
  /**
   * O fundo em que ele vai pousar.
   *
   * Existe como propriedade e não como classe passada de fora porque o seletor
   * mora em SETE cabeçalhos diferentes, uns verdes e uns claros, e deixar cada
   * chamador inventar a cor foi como o produto acabou com oito definições de
   * moeda. Duas opções nomeadas, e não uma fenda aberta.
   */
  tom?: keyof typeof TOM;
  className?: string;
}) {
  const { t } = useTranslation('comum');
  const atual = idiomaAtivo();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('idioma.escolher')}
          className={`h-9 px-2.5 inline-flex items-center gap-1.5 rounded-[10px] text-xs font-medium transition-colors ${TOM[tom]} ${className ?? ''}`}
        >
          <Globe className="w-4 h-4" />
          <span className="uppercase">{atual}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[184px] p-1.5 rounded-[12px] bg-white border-sand-line"
      >
        <SeletorDeIdioma />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
