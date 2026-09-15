import { useEffect, useState } from 'react';
import { parseNumero } from './placar-formato';

/**
 * Um número digitado por uma pessoa.
 *
 * ⚠️ Existe por causa de um defeito real: os campos eram `<input type="number">`
 * controlados direto pelo número, e a cada tecla o valor voltava convertido. Ao
 * digitar "0,5", o estado intermediário "0," não é número — virava 0 e apagava a
 * vírgula, então NÃO DAVA para digitar fração nenhuma. O mesmo valia para o
 * campo de valor mínimo com "−2,5".
 *
 * O conserto é guardar o TEXTO enquanto a pessoa digita e comitar o número
 * apenas quando ele existe. Vírgula é aceita porque o produto é em português e
 * o teclado numérico do celular manda vírgula.
 *
 * No blur o campo se normaliza: texto inválido volta para o último número bom,
 * em vez de ficar um campo vazio que parece um zero.
 */
export function CampoNumerico({
  valor,
  aoMudar,
  aria,
  sufixo,
  minimo,
  maximo,
  className = 'w-16',
}: {
  valor: number | null;
  aoMudar: (n: number | null) => void;
  aria: string;
  sufixo?: string;
  minimo?: number;
  maximo?: number;
  className?: string;
}) {
  const comoTexto = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));
  const [texto, setTexto] = useState(() => comoTexto(valor));
  const [digitando, setDigitando] = useState(false);

  // Enquanto a pessoa digita, o texto é dela. Fora disso ele segue o número —
  // senão um preset clicado ao lado não se refletiria no campo.
  useEffect(() => {
    if (!digitando) setTexto(comoTexto(valor));
  }, [valor, digitando]);

  const limitar = (n: number) => {
    if (minimo != null && n < minimo) return minimo;
    if (maximo != null && n > maximo) return maximo;
    return n;
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        // `text` e não `number`: o campo numérico do navegador rejeita a vírgula
        // em parte das localidades, e é ela que o teclado do celular manda.
        type="text"
        inputMode="decimal"
        aria-label={aria}
        value={texto}
        onFocus={() => setDigitando(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = parseNumero(e.target.value);
          if (n != null) aoMudar(limitar(n));
          else if (e.target.value.trim() === '') aoMudar(null);
        }}
        onBlur={() => {
          setDigitando(false);
          const n = parseNumero(texto);
          setTexto(comoTexto(n == null ? valor : limitar(n)));
        }}
        className={`rounded-rebrand-sm border border-line-2 px-2 py-1 text-right tabular-nums ${className}`}
      />
      {sufixo && <span className="text-[12px] text-ink-2">{sufixo}</span>}
    </span>
  );
}
