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
import { MOEDAS, casaBusca, moedaPorCodigo, nomeDaMoeda, textoDeBusca } from '@/config/moedas';
import { nomeDoPais } from '@/config/paises';
import { LOCALE_DO_IDIOMA } from '@/i18n/idiomas';
import { idiomaAtivo } from '@/i18n/init';

/**
 * O seletor de moeda, com busca — irmão do `SeletorDePais`, e pelo mesmo motivo.
 *
 * A primeira versão era um `<select>` com "R$ · BRL" em cada linha: código ISO
 * para quem não é contador, e 22 opções para rolar sem busca. Agora a linha diz
 * "Sol peruano", com a bandeira e o símbolo, e a busca acha a moeda por TRÊS
 * caminhos: o nome, o código e o país que a usa.
 *
 * ⚠️ O PAÍS NA BUSCA É O QUE A PESSOA SABE DIGITAR. Quem é de Portugal digita
 * "portugal", não "euro"; quem está no Equador digita "ecuador" e precisa achar
 * o dólar, que é a moeda de lá. Por isso o valor de cada item carrega também o
 * nome de todos os países que usam aquela moeda.
 *
 * Os cuidados de cor são os mesmos do seletor de país, e estão explicados lá:
 * o primitivo de comando assume tema escuro, e o realce do item é marcado por
 * `data-selected`, não por `aria-selected`.
 */
export function SeletorDeMoeda({
  valor,
  aoEscolher,
  id,
}: {
  valor: string;
  aoEscolher: (codigo: string) => void;
  id?: string;
}) {
  const { t } = useTranslation('apostas');
  const [aberto, setAberto] = useState(false);
  const locale = LOCALE_DO_IDIOMA[idiomaAtivo()];
  const escolhida = moedaPorCodigo(valor);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={aberto}
          className="w-full h-11 px-3 flex items-center gap-2.5 rounded-rebrand-md bg-canvas border border-line text-ink text-sm focus-visible:outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20"
        >
          {escolhida && (
            <BandeiraDoPais codigo={escolhida.bandeira} nome={nomeDaMoeda(escolhida.codigo, locale)} />
          )}
          <span className="flex-1 text-left font-medium">
            {escolhida ? nomeDaMoeda(escolhida.codigo, locale) : valor}
          </span>
          {escolhida && <span className="text-ink-2 tabular-nums">{escolhida.simbolo}</span>}
          <ChevronsUpDown className="w-4 h-4 text-ink-2 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0 bg-white border-sand-line">
        <Command
          className="bg-white text-ink"
          // Busca sem acento, como no seletor de país: "dolar" acha "Dólar".
          filter={(valorDoItem, busca) => (casaBusca(valorDoItem, busca) ? 1 : 0)}
        >
          <CommandInput placeholder={t('unidade.moedaBusca')} className="h-10 text-ink placeholder:text-ink-2" />
          <CommandList className="max-h-[280px] bg-white">
            <CommandEmpty className="py-6 text-center text-sm text-ink-2">{t('unidade.moedaVazio')}</CommandEmpty>
            <CommandGroup>
              {MOEDAS.map((m) => {
                const nome = nomeDaMoeda(m.codigo, locale);
                return (
                  <CommandItem
                    key={m.codigo}
                    // Tudo pelo que a pessoa pode procurar, numa string só.
                    value={textoDeBusca(m, locale, (p) => nomeDoPais(p, locale))}
                    onSelect={() => {
                      aoEscolher(m.codigo);
                      setAberto(false);
                    }}
                    className="gap-2.5 py-2 text-ink data-[selected=true]:bg-sand-100 data-[selected=true]:text-forest cursor-pointer"
                  >
                    <BandeiraDoPais codigo={m.bandeira} nome={nome} />
                    <span className="flex-1">{nome}</span>
                    <span className="text-[12px] text-ink-2 tabular-nums">{m.simbolo}</span>
                    <span className="w-9 text-right text-[10px] text-ink-2 tracking-wide">{m.codigo}</span>
                    <Check className={`w-4 h-4 text-forest ${m.codigo === valor ? '' : 'invisible'}`} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
