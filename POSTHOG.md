# Guia de PostHog na aplicação

## Visão geral
- O PostHog é inicializado no front-end em `src/main.tsx` usando `posthog-js` e é fornecido para o app via `PostHogProvider`.
- Pageviews são capturados manualmente pelo componente `PostHogPageView` para registrar mudanças de rota.
- Eventos de autenticação (`signed_up`, `signed_in`) e identificação do usuário são disparados no fluxo de Auth.
- A propriedade de indicação (`referred_by_code`) é enviada ao perfil e aos eventos quando um código é informado no signup.

## Configuração de ambiente
- Variáveis:
  - `VITE_PUBLIC_POSTHOG_KEY` – chave do projeto.
  - `VITE_PUBLIC_POSTHOG_HOST` – host do PostHog (padrão `https://app.posthog.com`).
- Inicialização (se a chave existir):
  - `person_profiles: 'identified_only'` (cria perfis apenas para usuários identificados).
  - `capture_pageview: false` (pageviews manuais via componente).
  - `capture_pageleave: true`.
- Local do init: `src/main.tsx`.

## Pageviews
- Componente: `src/components/PostHogPageView.tsx`.
- Uso: deve ficar dentro do Router para capturar mudanças de rota.
- Envia `$pageview` com `$current_url` e `path`.

## Eventos e identificação de usuário (Auth)
- Local: `src/pages/Auth.tsx`.
- Sign in:
  - `posthog.identify(user.id, { email, name })`
  - `posthog.capture('signed_in', { email, method: 'email' })`
- Sign up:
  - `posthog.identify(user.id, { email, name, referred_by_code? })`
  - `posthog.capture('signed_up', { email, name, method: 'email', referred_by_code? })`
- O código de indicação é normalizado (trim + uppercase) antes de ser enviado e salvo.

## Boas práticas para novos eventos
- Sempre inclua `distinct_id` via `identify` antes de eventos que precisem ser ligados a um usuário.
- Reutilize propriedades de contexto (ex.: `referred_by_code`, `plan`, `channel`) para manter consistência.
- Evite enviar dados sensíveis ou PII além do necessário.
- Prefira nomes de evento em inglês, snake_case ou lowerCamelCase (ex.: `bets_viewed`, `bet_created`).

## Checklist rápido de verificação
1) Confirmar `.env` tem `VITE_PUBLIC_POSTHOG_KEY` e host correto.
2) Garantir que `PostHogPageView` está montado dentro do Router.
3) Fazer signup com código de indicação e checar no PostHog:
   - Perfil tem `referred_by_code`.
   - Evento `signed_up` tem `referred_by_code`.
4) Fazer login e checar evento `signed_in`.






