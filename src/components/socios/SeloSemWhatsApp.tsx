/**
 * O selo de quem não dá para abordar por WhatsApp.
 *
 * Fica ao lado do nome, como a etiqueta do teste, e pelo mesmo motivo: é um
 * fato da PESSOA, e não só um filtro no topo. Sem ele, o sócio só descobria o
 * problema depois de abrir a ficha e não achar botão nenhum.
 *
 * ⚠️ Não é etapa. A etapa diz até onde a conversa chegou; não ter número é fato
 * do cadastro, e as duas coisas valem ao mesmo tempo — a mesma separação que
 * tirou "em teste" do funil. E não é a etiqueta do teste: aquela é um eixo de
 * valor único, e alguém pode estar em teste E sem WhatsApp.
 *
 * Diz de onde veio, porque as duas origens pedem reações diferentes: sem número
 * usável é um cadastro a completar; marcado na mão é uma decisão que outro
 * sócio tomou, e que dá para desfazer na ficha.
 */
export function SeloSemWhatsApp({ marcado }: { marcado: boolean }) {
  return (
    <span
      title={
        marcado
          ? 'Marcado na mão: o número está no cadastro, mas não leva à pessoa.'
          : 'Sem número que abra conversa. Só dá para chegar por e-mail.'
      }
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-canvas px-2 py-0.5 text-[10.5px] font-bold text-ink-2"
    >
      {marcado ? 'Sem WhatsApp · marcado' : 'Sem WhatsApp'}
    </span>
  );
}
