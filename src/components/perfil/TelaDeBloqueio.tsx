import React from 'react';
import { EMAIL_DO_TIME, whatsappDoTime } from '@/config/contato';

/**
 * A tela que quem acessa do Brasil vê depois do corte.
 *
 * Spec na issue #548, ticket #551.
 *
 * Ela faz três trabalhos ao mesmo tempo, e é por isso que é uma página
 * explicando e não um erro seco:
 *
 *   • evita reclamação e chargeback de quem não entendeu o que aconteceu;
 *   • é a evidência de restrição documentada que o contador pediu por escrito;
 *   • é por onde o falso positivo pede socorro — e ele existe, porque
 *     geolocalização por IP erra em algumas pessoas a cada poucas centenas.
 *
 * Em português, e só em português: quem chega aqui está no Brasil, ou acha que
 * não está e precisa conseguir ler o pedido de ajuda.
 */

const MENSAGEM = 'Oi! Vi que o acesso está bloqueado no Brasil e acho que foi engano.';

export const TelaDeBloqueio: React.FC = () => (
  <div className="theme-bolao bg-canvas min-h-dvh flex items-center justify-center px-6 py-10">
    <main className="w-full max-w-md">
      <h1 className="font-display text-[22px] font-bold text-ink leading-tight">
        A Smart Betting não está mais disponível no Brasil
      </h1>

      <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink-2">
        <p>
          A nossa operação passou a atender apenas assinantes fora do Brasil, e o acesso a partir
          daqui foi encerrado.
        </p>
        <p>
          Se você tinha uma assinatura ativa, ela foi cancelada e o valor do período não usado está
          sendo devolvido. Você não precisa fazer nada.
        </p>
      </div>

      {/* A saída de emergência. Sem ela, quem foi classificado no país errado
          não tem para onde ir — e essa pessoa existe: por IP, a leitura de país
          erra em alguém a cada poucas centenas. */}
      <div className="mt-6 rounded-rebrand-xl border border-line p-4">
        <p className="text-[13px] font-bold text-ink">Está fora do Brasil e viu esta tela?</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
          Pode ser engano nosso na leitura da sua conexão. Fala com a gente que resolvemos.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <a
            href={whatsappDoTime(MENSAGEM)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 inline-flex items-center justify-center font-bold text-[13px] transition-colors"
          >
            Falar no WhatsApp
          </a>
          <a
            href={`mailto:${EMAIL_DO_TIME}`}
            className="w-full py-1 text-center text-[13px] text-ink-2 hover:text-ink transition-colors"
          >
            Ou escrever para {EMAIL_DO_TIME}
          </a>
        </div>
      </div>

      {/* Os dois documentos continuam abertos de propósito — quem foi barrado
          precisa poder ler o que mudou na relação dele com a empresa. */}
      <p className="mt-6 text-[12px] text-ink-2">
        <a href="/termos" className="underline hover:text-ink">
          Termos de Uso
        </a>
        {' · '}
        <a href="/privacidade" className="underline hover:text-ink">
          Política de Privacidade
        </a>
      </p>
    </main>
  </div>
);
