import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import {
  TIPOS_DE_CAMPANHA,
  chegadaAReportar,
  chegadaDoTelegram,
  encerrarAtribuicao,
  tempoDesdeOEnvioMs,
  valorControlado,
} from '@/lib/analytics';

/**
 * O site foi aberto por um link de oportunidade do Telegram.
 *
 * Fecha a terceira perna do funil do bot. As duas primeiras já existiam — o
 * envio (`*_opportunities_sent`) e o clique (`*_opportunities_click`, registrado
 * pelo redirecionador `go`) —, mas ninguém media a CHEGADA. E a diferença entre
 * clicar e chegar não é detalhe: o `go` responde um 302 e conta o clique antes
 * de o navegador pedir a página, então todo abandono no meio do caminho (rede
 * caindo, app do Telegram fechando o webview, redirect perdido) estava sendo
 * contado como visita.
 *
 * ── Uma vez por abertura ──────────────────────────────────────────────────
 *
 * Dois guardas, porque são dois problemas diferentes. A `ref` protege desta
 * montagem: o StrictMode roda o efeito duas vezes em desenvolvimento, e a
 * navegação interna remonta o efeito a cada rota. O `chegada_disparada` do
 * sessionStorage protege da VIAGEM do login: quem chega deslogado numa rota
 * protegida vai para `/auth`, sai para o Google e volta em `/auth/callback` —
 * três rotas, a mesma chegada, e sem a marca persistida cada uma contaria de
 * novo.
 *
 * ── Por que espera a sessão resolver ──────────────────────────────────────
 *
 * `is_authenticated` é uma das respostas que este evento existe para dar. Com a
 * sessão ainda em voo, `user` é nulo por desconhecimento e não por ausência, e
 * o evento sairia dizendo "anônimo" para gente logada. O custo de esperar é uns
 * instantes; o custo de não esperar é um campo que mente sempre.
 *
 * O `$pageview` normal continua acontecendo à parte, no PostHogPageView — este
 * evento acrescenta a atribuição, não substitui a contagem de página.
 */
export const ChegadaDoTelegram = () => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const jaDisparou = useRef(false);

  useEffect(() => {
    if (isLoading || jaDisparou.current) return;

    const a = chegadaAReportar(location.search);
    if (!a) return;

    jaDisparou.current = true;
    // Encerra ANTES de capturar: o conteúdo da atribuição já está no objeto
    // `a`, e apagá-lo do armazenamento aqui é o que garante que ele não
    // sobreviva ao seu propósito nem que uma falha na captura deixe a
    // atribuição viva para contaminar a visita seguinte.
    encerrarAtribuicao();

    chegadaDoTelegram({
      delivery_id: a.delivery_id,
      batch_id: a.batch_id,
      link_id: a.link_id,
      campaign_id: a.campaign_id,
      campaign_type: valorControlado(a.campaign_type, TIPOS_DE_CAMPANHA, 'other'),
      opportunity_id: a.opportunity_id,
      landing_path: location.pathname,
      segment: a.segment,
      time_since_sent_ms: tempoDesdeOEnvioMs(a.sent_at),
      is_authenticated: !!user?.id,
    });
    // `location.search` e `location.pathname` e não o objeto inteiro: o mesmo
    // motivo do PostHogPageView — o objeto nasce novo a cada navegação.
  }, [location.pathname, location.search, isLoading, user?.id]);

  return null;
};
