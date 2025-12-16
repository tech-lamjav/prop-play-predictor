# Enviando o código de indicação para o PostHog

## O que foi implementado
- Ao concluir o signup, quando o usuário informa um código de indicação, o código é normalizado (trim + uppercase) e enviado como propriedade para o PostHog.
- A propriedade foi adicionada tanto no `identify` quanto no `capture` do evento `signed_up`.
- O código de normalização é único e reutilizado em todo o fluxo de criação do usuário.

## Onde está o código
- Arquivo: `src/pages/Auth.tsx`
- Trechos relevantes:
  - Normalização e reuso do código: `normalizedReferralCode`
  - Propriedade enviada ao PostHog: `referred_by_code`
  - Chamadas:
    - `posthog.identify(user.id, { ..., referred_by_code })`
    - `posthog.capture('signed_up', { ..., referred_by_code })`

## Como funciona o fluxo
1) Usuário envia o formulário de cadastro com o campo “Código do amigo (opcional)”.
2) O código é normalizado (`toUpperCase().trim()`), armazenado em `normalizedReferralCode` e salvo no registro do usuário (coluna `referred_by`).
3) Se existir código, cria-se também o vínculo na tabela `referrals`.
4) PostHog:
   - `identify`: atribui `referred_by_code` ao perfil do usuário.
   - `capture('signed_up')`: registra o evento de signup com a mesma propriedade, garantindo consistência entre pessoa e evento.

## Como verificar rapidamente
1) Criar um usuário novo usando um código de indicação válido (ex.: `ABC123`).
2) Confirmar no PostHog:
   - Perfil do usuário deve conter a propriedade `referred_by_code` = `ABC123`.
   - Evento `signed_up` deve ter a propriedade `referred_by_code` = `ABC123`.

## Observações
- A propriedade é enviada apenas quando há código informado.
- O valor enviado ao PostHog é sempre em maiúsculas e sem espaços nas pontas.






