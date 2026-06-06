# Rebrand Bolão — Pendências de ilustração

Este documento lista as áreas do redesign que dependem de ilustrações para serem
finalizadas. Como ainda não temos as ilustrações prontas, marcamos os pontos
no código com `data-empty-state="true"` (que renderiza um placeholder visual
em DEV) e listamos aqui pra acompanhar.

## Convenção

No JSX:

```tsx
<div
  data-empty-state="true"
  data-rebrand-todo="campo de futebol vazio (estado inicial sem membros)"
  className="..."
>
  {/* TODO(rebrand): ilustração aqui */}
</div>
```

- `data-empty-state="true"` ativa o placeholder visual amber em desenvolvimento
- `data-rebrand-todo` descreve o que falta (lido aqui na lista)
- Comentário `TODO(rebrand)` ajuda quem revisar grep

## Pendências por tela (alimentada na Fase 4)

### Home — Lista de bolões (`screen-home.jsx`)
_(será preenchido quando migrarmos a tela)_

### Bolão vazio (`screen-vazio.jsx`)
- [ ] Ilustração de "campo de futebol vazio" — convite vira hero quando faltam membros
  - Spec (do designer): tom monocromático verde-mata com elementos sutis (linhas do campo, gol)
  - Tamanho: ~300×240px

### Estado vazio em listas
- [ ] Ilustração genérica para listas vazias (sem palpites, sem ranking, etc.)

### Outras telas
_(adicionar conforme migrarmos cada tela)_

## Como remover um item desta lista

Quando a ilustração chegar:

1. Importa o asset (preferência SVG inline ou react-component)
2. Substitui o `data-empty-state="true"` pelo render real
3. Risca o item desta lista (use `[x]`)

## Status do rebrand (alto nível)

- [x] **Fase 1 — Foundation** (CSS vars + utilities + fontes + BolaoLayout)
- [ ] **Fase 2 — Tipografia** (aplicar Fraunces nos heros, Inter nos UI elements)
- [ ] **Fase 3 — Variantes shadcn** (Button forest/amber, Card rebrand, etc.)
- [ ] **Fase 4 — Migração tela-por-tela** (Home → Criar → Join → Vazio → Share → Hub → Modal Palpites → Especiais → Admin)
- [ ] **Fase 5 — Polish + extensão pra outras features**
