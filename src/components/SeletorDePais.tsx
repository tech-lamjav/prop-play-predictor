import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { BandeiraDoPais } from '@/components/BandeiraDoPais';
import { PAISES, nomeDoPais, paisPorCodigo } from '@/config/paises';
import { LOCALE_DO_IDIOMA } from '@/i18n/idiomas';
import { idiomaAtivo } from '@/i18n/init';

/**
 * O seletor de país do cadastro, com busca.
 *
 * ⚠️ TEM BUSCA PORQUE A LISTA TEM 27 PAÍSES. Um seletor simples obriga a
 * rolar, e rolar numa lista cuja ordem NÃO é alfabética — os cinco primeiros
 * são a operação, de propósito — é pior ainda: quem procura "Uruguai" no U não
 * acha, porque ele não está onde o alfabeto manda. A busca resolve as duas
 * coisas de uma vez.
 *
 * ⚠️ AS CORES DO REALCE SÃO DECLARADAS AQUI. O tema tem `--accent` azul-escuro,
 * e os primitivos do shadcn realçam o item com ele. Numa lista de fundo claro
 * isso pintava uma faixa escura que não é da paleta do produto — o mesmo
 * defeito que o botão do Google teve com a letra branca. Quem sobrescreve o
 * fundo precisa sobrescrever o realce junto.
 */
export function SeletorDePais({
  valor,
  aoEscolher,
  id,
}: {
  valor: string;
  aoEscolher: (codigo: string) => void;
  id?: string;
}) {
  const { t } = useTranslation('auth');
  const [aberto, setAberto] = useState(false);
  const escolhido = paisPorCodigo(valor);
  // O nome do país segue o idioma da TELA. `useTranslation` acima já assina a
  // troca, então a lista repinta no idioma novo sem recarregar.
  const locale = LOCALE_DO_IDIOMA[idiomaAtivo()];
  const nome = (codigo: string) => nomeDoPais(codigo, locale);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={aberto}
          className="w-full h-11 px-3 flex items-center gap-2 rounded-rebrand-md bg-canvas border border-line text-ink text-sm focus-visible:outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20"
        >
          {escolhido && <BandeiraDoPais codigo={escolhido.codigo} nome={nome(escolhido.codigo)} />}
          <span className="flex-1 text-left">
            {escolhido ? nome(escolhido.codigo) : t('campos.paisEscolha')}
          </span>
          <ChevronsUpDown className="w-4 h-4 text-ink-3 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0 bg-white border-sand-line"
      >
        <Command
          // ⚠️ O FUNDO E O TEXTO SÃO DECLARADOS AQUI. O componente de comando
          // traz `bg-popover text-popover-foreground`, e neste tema `--popover`
          // tem 11% de luminosidade — quase preto. Pintar só o invólucro de
          // branco deixava o painel escuro por dentro, com os nomes dos países
          // ilegíveis. Terceira vez que esta mesma causa aparece: o primitivo
          // assume tema escuro, a superfície do produto é clara, e quem
          // sobrescreve o fundo precisa sobrescrever o conteúdo junto.
          className="bg-white text-ink"
          // A busca ignora acento: quem digita "mexico" acha "México", e quem
          // escreve "colombia" acha "Colômbia". Sem isto, metade da lista fica
          // inalcançável para quem não põe acento — que é quase todo mundo.
          filter={(valorDoItem, busca) => {
            const limpar = (s: string) =>
              s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
            return limpar(valorDoItem).includes(limpar(busca)) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={t('campos.paisBusca')}
            className="h-10 text-ink placeholder:text-ink-3"
          />
          <CommandList className="max-h-[260px] bg-white">
            <CommandEmpty className="py-6 text-center text-sm text-ink-3">
              {t('campos.paisVazio')}
            </CommandEmpty>
            <CommandGroup>
              {PAISES.map((p) => (
                <CommandItem
                  key={p.codigo}
                  // O valor é o nome TRADUZIDO porque é por ele que a busca
                  // filtra: quem lê em espanhol digita "Alemania", não
                  // "Alemanha". Filtrar pelo nome em português deixaria a
                  // lista inalcançável para quem está na tela em espanhol.
                  value={nome(p.codigo)}
                  onSelect={() => {
                    aoEscolher(p.codigo);
                    setAberto(false);
                  }}
                  // ⚠️ `data-[selected=true]` e não `aria-selected`. O cmdk
                  // marca o item destacado com o atributo de DADO, e é por ele
                  // que o primitivo pinta o realce escuro — uma regra escrita
                  // com `aria-selected` não disputa com ele e simplesmente não
                  // vale. A primeira versão desta linha não fazia nada.
                  className="gap-2 text-ink data-[selected=true]:bg-sand-100 data-[selected=true]:text-forest cursor-pointer"
                >
                  <BandeiraDoPais codigo={p.codigo} nome={nome(p.codigo)} />
                  <span className="flex-1">{nome(p.codigo)}</span>
                  <span className="text-[11px] text-ink-3 tabular-nums">{p.ddi}</span>
                  {p.codigo === valor && <Check className="w-4 h-4 text-forest" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
