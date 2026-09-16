import { EXPLICACAO_DA_ETIQUETA, textoDaEtiqueta, type Etiqueta } from './crm-etiquetas';

/**
 * A etiqueta de teste de uma pessoa, onde a pessoa aparece.
 *
 * A etiqueta é da PESSOA, e não só um filtro. Enquanto ela existia apenas na
 * faixa do topo, dava para filtrar quem está em teste, mas olhando uma linha
 * qualquer da lista não dava para ver que aquela pessoa estava.
 *
 * ⚠️ Ela diz o PRAZO, e não só a situação. "Teste vencendo" respondia metade da
 * pergunta: o sócio ainda precisava abrir a ficha para saber se vence hoje ou
 * amanhã, e "teste vencido" não dizia se foi ontem ou em maio — que é o que
 * decide se a conversa é de retomada ou de recomeço.
 *
 * Só "vencendo" ganha cor. É a única com prazo correndo, e três etiquetas
 * coloridas numa lista brigariam com o âmbar que marca o que é urgente.
 */
export function EtiquetaDoLead({
  etiqueta,
  fimDoTeste,
  diasDeTeste,
}: {
  etiqueta: Etiqueta | null;
  /** `YYYY-MM-DD`, o último dia em que a pessoa ainda entra. */
  fimDoTeste: string | null;
  /** Dias até o fim, contando hoje. Zero acaba hoje, negativo já acabou. */
  diasDeTeste: number | null;
}) {
  if (!etiqueta) return null;
  const urgente = etiqueta === 'trial_vencendo';

  return (
    <span
      title={EXPLICACAO_DA_ETIQUETA[etiqueta]}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
        urgente ? 'bg-amber-400/25 text-ink' : 'bg-canvas text-ink-2'
      }`}
    >
      {textoDaEtiqueta(etiqueta, fimDoTeste, diasDeTeste)}
    </span>
  );
}
