import { Check, ArrowRight, Gift } from "lucide-react";
import type { LpVariant } from "@/pages/lp/variants";

// ============================================================
// Oferta, bônus, ancoragem e preço. Fecha a página.
//
// O bloco muda com o eixo de oferta da variação: trial mostra "7 dias grátis,
// depois R$ X", pagamento mostra o preço direto com o valor cheio riscado.
//
// PENDENTE: o "Guia Prático dos 10 Filtros" não existe ainda. A página não pode
// ir pra tráfego prometendo um bônus que não está pronto pra entregar.
// ============================================================

const INCLUI = [
  "Análise dos jogos disponíveis",
  "Os 10 filtros aplicados automaticamente",
  "Quantos filtros apontam para o mesmo lado, em cada aposta",
  "Informação organizada em um só lugar",
  "Acesso pelo celular, computador ou tablet",
  "Atualização durante todo o período da assinatura",
];

export function LpOferta({ variant, onCta }: { variant: LpVariant; onCta: () => void }) {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-[680px] mx-auto">
        <div className="text-center">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-forest mb-4">
            A oferta
          </p>
          <h2 className="font-display text-[28px] sm:text-[38px] font-black leading-[1.1] tracking-tight text-ink text-balance">
            Teste 7 dias grátis. Depois, a Smart Betting trabalha em cada análise por{" "}
            <span className="text-forest">R$ {variant.preco.valor}</span> por mês.
          </h2>
          <p className="text-[17px] text-ink-2 leading-relaxed mt-5">
            Você entra sem cartão e usa a plataforma completa por 7 dias, consultando as
            oportunidades já analisadas pela Inteligência Artificial nos 10 filtros. Só paga se
            quiser continuar.
          </p>
        </div>

        {/* O que inclui */}
        <div className="mt-10 rounded-rebrand-lg border border-line bg-white overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-line bg-canvas-2">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">
              Sua assinatura inclui
            </p>
          </div>
          <ul className="px-5 sm:px-6 py-2">
            {INCLUI.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 py-3.5 border-b border-line last:border-b-0 text-[15.5px] text-ink leading-snug"
              >
                <span className="grid place-items-center w-5 h-5 rounded-full bg-amber/20 shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-amber-2" strokeWidth={3.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Bônus. A capa fica ao lado do texto também no mobile: em coluna
            única ela esticava pra largura inteira e virava um bloco verde
            gigante antes do conteúdo. */}
        <div className="mt-4 rounded-rebrand-lg border border-line bg-white p-5 sm:p-6 grid grid-cols-[92px_1fr] sm:grid-cols-[132px_1fr] gap-4 sm:gap-5 items-start">
          {/* Capa do guia */}
          <div
            className="rounded-rebrand-md aspect-[3/4] p-2.5 sm:p-4 flex flex-col justify-between text-white shadow-md"
            style={{ background: "linear-gradient(150deg, #0f5238, #072a1c)" }}
          >
            <span className="font-mono text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-amber">
              Guia prático
            </span>
            <span className="font-display text-[14px] sm:text-[19px] font-black leading-[1.05]">
              Os 10 filtros
            </span>
            <span className="font-mono text-[7px] sm:text-[8px] uppercase tracking-[0.12em] sm:tracking-[0.14em] text-white/45">
              Smart Betting
            </span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 border border-amber/40 px-2.5 py-1 mb-3">
              <Gift className="w-3.5 h-3.5 text-amber-2" />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-amber-2">
                Bônus incluído
              </span>
            </div>
            <h3 className="text-[19px] font-bold text-ink leading-tight">
              Guia Prático dos 10 Filtros
            </h3>
            <p className="text-[14.5px] text-ink-2 leading-relaxed mt-2">
              O que cada filtro analisa, como ler o resultado e qual sinal observar antes de decidir.
              Sozinho, você perderia horas procurando informação e tentando entender qual dado
              importa. Aqui já vem organizado.
            </p>
          </div>
        </div>

        {/* Preço e fechamento */}
        <div className="mt-8 text-center">
          {/* baseline + nowrap: em 390px o preço grande quebrava o "R$" numa
              linha e o valor na outra */}
          <div className="flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1">
            <span className="text-[15px] sm:text-[17px] text-ink-3 line-through whitespace-nowrap">
              R$ {variant.preco.de}
            </span>
            <span className="font-display text-[40px] sm:text-[56px] font-black leading-none tracking-tight text-ink tabular-nums whitespace-nowrap">
              R$ {variant.preco.valor}
            </span>
            <span className="text-[15px] sm:text-[16px] text-ink-2 whitespace-nowrap">por mês</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-2 mt-2.5">
            Preço de lançamento · só depois dos 7 dias
          </p>
          <p className="text-[16px] text-ink-2 leading-relaxed mt-5 max-w-[52ch] mx-auto">
            Sem precisar contratar ferramenta diferente para cada coisa, nem depender de palpite sem
            explicação.
          </p>

          <button
            type="button"
            onClick={onCta}
            className="mt-7 inline-flex items-center justify-center gap-2 h-[56px] px-9 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[17px] shadow-lg transition-colors"
          >
            {variant.cta.label}
            <ArrowRight className="h-5 w-5 shrink-0" />
          </button>
          <p className="text-[13px] text-ink-3 mt-3.5 leading-snug max-w-[46ch] mx-auto">
            Acesso liberado na hora, sem cartão. Passados os 7 dias, a assinatura é mensal, com
            renovação automática e cancelamento quando quiser.
          </p>
          <p className="text-[12px] text-ink-3 mt-5 leading-snug">
            Conteúdo analítico. Não é recomendação de aposta, e a decisão é sempre sua.
          </p>
        </div>
      </div>
    </section>
  );
}
