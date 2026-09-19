import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import posthog from 'posthog-js'
import { analyticsLigado } from '@/lib/analytics'

/**
 * O `$pageview` de cada mudança real de rota.
 *
 * O PostHog é inicializado com `capture_pageview: false` (main.tsx) porque numa
 * SPA o pageview automático só dispara no primeiro carregamento — toda
 * navegação seguinte é troca de componente, não de documento. Quem conta é este
 * componente, montado uma única vez dentro do `<BrowserRouter>`.
 *
 * ── Por que a dependência não é mais o `location` inteiro ──────────────────
 *
 * Era `[location, posthog]`, e o `location` é um objeto NOVO a cada navegação —
 * inclusive nas que não mudam de página. Um `navigate(mesmaRota, { replace: true })`
 * produz outro objeto com o mesmo `pathname`, e a tela contava um pageview a
 * mais. A régua de dias do futebol faz exatamente isso: trocar o dia reescreve
 * a query string sem sair da rota.
 *
 * Contar por `pathname + search` resolve os dois lados: a troca de dia continua
 * sendo uma visualização diferente (a query faz parte do que a pessoa está
 * vendo), mas o mesmo endereço remontando não conta de novo. A `ref` com o
 * último endereço é o que sobrevive ao StrictMode, que monta o efeito duas
 * vezes em desenvolvimento — o mesmo cuidado que o `AuthCallback` já tomava.
 */
export const PostHogPageView = () => {
  const location = useLocation()
  const ultimoEndereco = useRef<string | null>(null)

  useEffect(() => {
    if (!analyticsLigado()) return

    const endereco = `${location.pathname}${location.search}`
    if (ultimoEndereco.current === endereco) return
    ultimoEndereco.current = endereco

    posthog.capture('$pageview', {
      $current_url: window.location.href,
      path: location.pathname,
    })
  }, [location.pathname, location.search])

  return null
}
