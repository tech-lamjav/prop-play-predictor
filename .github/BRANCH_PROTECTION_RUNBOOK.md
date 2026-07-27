# Branch protection da `main` — runbook

Objetivo: garantir o fluxo **feature → develop → main** e impedir que código vá
para produção (push na `main` dispara `deploy-production.yml`) sem passar por
staging (push na `develop` dispara `deploy-staging.yml`) e sem review/CI.

Estado em 2026-06-30: `main` **sem nenhuma branch protection** (qualquer um pode
dar push/merge direto). CI roda o job **`validate`** (`.github/workflows/ci.yml`)
em PRs para `develop` e `main`.

A regra "só `develop`/`hotfix/*`/`release/*` podem ir para main" **não existe** de
forma nativa no GitHub (nem branch protection clássica nem rulesets restringem a
branch de origem de um PR). Por isso ela é aplicada pelo workflow
`guard-main-source.yml` (job `guard`), registrado como required status check.

---

## Fase 1 — Colocar o guard na `main`

O workflow `guard-main-source.yml` precisa existir **na `main`** para rodar nos
PRs que miram a `main`. Leve-o pela própria esteira (dogfood):

```bash
# a partir da develop, com o arquivo já commitado nela:
#   feature/ci-guard -> develop -> main  (ou inclua na próxima promoção develop→main)
```

Confirme que o check `guard` aparece em um PR para `main` antes da Fase 2b.

---

## Fase 2 — Ativar a branch protection (precisa de admin)

### 2a) Baseline seguro — pode rodar AGORA (sem depender do guard)

Exige PR + 1 review + CI `validate` verde, bloqueia push direto e force-push:

```bash
gh api -X PUT repos/tech-lamjav/prop-play-predictor/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["validate"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

### 2b) Completo — rodar DEPOIS que o guard estiver na `main`

Igual ao 2a, porém adicionando `guard` aos checks obrigatórios (esta é a linha que
de fato bloqueia `feature → main`):

```bash
gh api -X PUT repos/tech-lamjav/prop-play-predictor/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["validate", "guard"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

> Opcional: proteger a `develop` também com `{"contexts":["validate"]}` + 1 review,
> trocando `branches/main/protection` por `branches/develop/protection`.

---

## Decisões embutidas (ajuste se quiser)

- `enforce_admins: false` → admins têm "break-glass" para emergências. Mude para
  `true` para aplicar a regra inclusive a admins.
- `strict: true` → a branch precisa estar atualizada com a `main` antes do merge.
- `required_approving_review_count: 1` → suba para 2 se quiser dois revisores.
- `guard` permite `develop`, `hotfix/*`, `release/*`. Edite o `case` em
  `guard-main-source.yml` para mudar as exceções.

## Conferir / reverter

```bash
# ver estado atual
gh api repos/tech-lamjav/prop-play-predictor/branches/main/protection

# remover toda a proteção (reverter)
gh api -X DELETE repos/tech-lamjav/prop-play-predictor/branches/main/protection
```
