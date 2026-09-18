# Rastreador de issues: GitHub

Issues e specs deste repositório vivem como issues do GitHub, em
tech-lamjav/prop-play-predictor. Use o `gh` para tudo.

## Convenções

- **Criar issue**: `gh issue create --title "..." --body "..."`. Use heredoc para corpo de várias linhas.
- **Ler issue**: `gh issue view <number> --comments`, filtrando comentários com `jq` e buscando também os rótulos.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, com os filtros `--label` e `--state` que couberem.
- **Comentar**: `gh issue comment <number> --body "..."`
- **Aplicar / remover rótulo**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Fechar**: `gh issue close <number> --comment "..."`

O repositório é inferido de `git remote -v`; o `gh` faz isso sozinho dentro de um clone.

## ⚠️ PR abre contra `develop`

O fluxo desta casa é feature → develop → main. Existe um guarda no CI
(`guard-main-source.yml`) que só aceita `develop`, `hotfix/*` e `release/*` como
origem de PR para `main`. Abrir PR de uma branch de trabalho direto contra
`main` bate nesse guarda e não passa.

Os releases são squash. Por isso `Closes #<n>` num commit de feature **não**
fecha a issue quando o release entra, e contagem de commit e diff de três
pontos enganam entre `develop` e `main`.

## Pull requests como superfície de triagem

**PRs como superfície de pedido: não.** _(Mude para `sim` se este repositório
tratar PR externo como pedido de feature; o `/triage` lê esta chave.)_

Quando estiver em `sim`, PRs passam pelos mesmos rótulos e estados das issues,
com os equivalentes `gh pr`:

- **Ler PR**: `gh pr view <number> --comments` e `gh pr diff <number>`.
- **Listar PR externo para triagem**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` e ficar só com `authorAssociation` igual a `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` ou `NONE` (descartar `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comentar / rotular / fechar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

O GitHub usa um espaço de numeração só para issue e PR, então um `#42` solto
pode ser qualquer um dos dois: resolva com `gh pr view 42` e caia para
`gh issue view 42`.

## Quando uma skill disser "publique no rastreador"

Crie uma issue no GitHub.

## Quando uma skill disser "busque o ticket"

Rode `gh issue view <number> --comments`.

## Operações de wayfinding

Usadas pelo `/wayfinder`. O **mapa** é uma issue única, com issues **filhas**
como tickets.

- **Mapa**: issue com o rótulo `wayfinder:map`, contendo o corpo de Notas / Decisões até aqui / Névoa. `gh issue create --label wayfinder:map`.
- **Ticket filho**: issue ligada ao mapa como sub-issue do GitHub (`gh api` no endpoint de sub-issues). Onde sub-issue não estiver ligado, ponha a filha numa lista de tarefas no corpo do mapa e um `Part of #<map>` no topo do corpo dela. Rótulos: `wayfinder:<tipo>` (`research`/`prototype`/`grilling`/`task`). Depois de assumida, a issue é atribuída a quem está tocando.
- **Bloqueio**: use as **dependências nativas** do GitHub, que é a representação canônica e visível na interface. `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, onde `<blocker-db-id>` é o **id numérico de banco** do bloqueador (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, e **não** o `#number` nem o `node_id`). O GitHub responde `issue_dependencies_summary.blocked_by` (só bloqueadores abertos). Onde dependência não existir, caia para uma linha `Blocked by: #<n>, #<n>` no topo do corpo. Um ticket está livre quando todo bloqueador está fechado.
- **Fronteira**: liste as filhas abertas do mapa (`gh issue list --state open`), descarte as com bloqueador aberto ou com responsável; a primeira na ordem do mapa ganha.
- **Assumir**: `gh issue edit <n> --add-assignee @me`, a primeira escrita da sessão.
- **Resolver**: `gh issue comment <n> --body "<resposta>"`, depois `gh issue close <n>`, depois anexe um ponteiro de contexto nas Decisões até aqui do mapa.
