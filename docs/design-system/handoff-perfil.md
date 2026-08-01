# Handoff: botão Perfil — estados (desktop e mobile)

Origem: `Perfil - estados.dc.html` no projeto do Claude Design
`https://claude.ai/design/p/ff7f7a0a-ac3e-4f16-bf47-0f3b390409f9`.

Complementa [handoff-header-footer.md](handoff-header-footer.md). A regra do
desenho: **mesmo conteúdo nas duas plataformas, formato diferente** — no
desktop é um dropdown ancorado no pill, no mobile é uma tela cheia. E
"Configurações" deixa de ser navegação global pra ser sempre o primeiro item
de Perfil.

## Desktop — pill + dropdown

Pill na faixa 1 (inalterado em tamanho). Ganhou o estado **aberto**
(`data-[state=open]`): fundo `white/10` e borda `white/45`, pra amarrar o
botão ao painel.

Painel de 296px, `rounded-[14px]`, borda `sand-line`, sombra
`0 10px 30px -10px rgba(10,61,46,.22)` — o único uso de elevação; o resto do
sistema é hairline. Quatro blocos:

1. **Identidade** — fundo `sand-50`, avatar 40px forest, nome 13.5/600, e-mail
   11.5px `sand-ink-2`.
2. **Assinatura** — badge PREMIUM (forest, raio âmbar) + "renova DD/MM".
3. **Itens** — 38px, ícone forest 16px, rótulo 13px `sand-ink-strong`, chevron
   `sand-chevron`. Hover `sand-100` + texto forest.
4. **Sair da conta** — `sand-danger` sobre hover `sand-danger-bg`.

## Mobile — tela `/perfil`

O avatar do topo e o quarto item da tab bar **navegam** pra `/perfil`; não
abrem dropdown. Na própria `/perfil` o header troca logo+avatar por
**título "Perfil" + engrenagem** (props `mobileTitle` / `mobileAction` do
`AnalyticsNav`).

Conteúdo: card de identidade (avatar 52px, nome, e-mail, badge PREMIUM), três
KPIs (Apostas · Acerto · ROI) e a lista de ações em linhas de 52px.

## Dados reais, não mockados

- KPIs: `useBets(user.id).stats` → `totalBets`, `winRate`, `roi`.
- Nome: `user_metadata.name` com fallback pra `profile.name` (`useSettingsData`)
  — quem entrou por e-mail não tem nome no metadata. O `UserNav` usa a mesma
  ordem, senão o pill mostrava "Usuário" e a tela mostrava o nome real.
- Renovação: `subscription.*.periodEnd`. **Sem data no banco, o texto some** —
  não inventamos "renova 12/07".
- Iniciais: `src/lib/user-display.ts`, compartilhado pelos dois.

Percentuais saem com **uma casa decimal** (47,2% · -0,6%), não inteiros como no
mock: a tela de Apostas mostra assim, e arredondar faria a mesma métrica
aparecer como -1% aqui e -0,6% lá.

## Desvios do desenho

**1. "Notificações" ficou de fora da lista.**
O mock lista o item, mas não existe tela nem preferência de notificação no
app — `Settings.tsx` só tem Perfil e Assinatura. Link morto não entra.

**2. O ponto amarelo de "com aviso" não foi implementado.**
O desenho prevê um dot âmbar no avatar. Não existe sistema de notificação pra
alimentar esse estado; entra junto com ele.

**3. O mock é da variante bege; as cores do pill foram traduzidas pro forest.**
O painel do dropdown é branco/areia nos dois casos, então esse não mudou.

**4. `/perfil` funciona em qualquer largura.**
No desktop o caminho normal é o dropdown, mas a rota renderiza igual (coluna
centralizada) — quem chega por link direto vê uma tela válida, não um 404.

## Pendências

- Sistema de notificações → destrava o item da lista e o dot do avatar.
- `UserNav` e `Perfil` chamam `useSettingsData()` cada um. Hoje só um dos dois
  monta por vez, mas se virarem irmãos na mesma tela vale mover pra um provider.
