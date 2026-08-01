# Testes de landing page: plano e estado

Branch `feat/lp-testes`, worktree `C:/Users/diody/smartbetting-lp-wt`, saiu de `origin/develop`.

Base: documento de copy do time. **Cada título do documento é uma LP diferente**, não uma seção
da mesma página. São quatro ganchos, e só o bloco de quebra de dúvida é compartilhado. A primeira
leitura deste plano tratou o documento como uma página só e estava errada.

## As 4 LPs

Cada título do documento é uma LP, e **o bloco de um título não aparece nas outras páginas**.
Dentro de cada LP, a copy segue a ordem do documento. As quatro fecham igual: "O que dizem nossos
usuários", "Ainda está em dúvida?", a oferta com o que inclui, o bônus, o preço e o CTA.

| Rota | Título | O que essa LP tem de próprio, na ordem |
| --- | --- | --- |
| `/lp/mais-razoes` | "Entre em cada aposta com mais razões para acreditar que está fazendo a escolha certa." | título, texto de apoio, prova social (números do mart), produto |
| `/lp/estatistica-sozinha` | "Uma boa estatística, sozinha, pode contar a história errada." | título, dado isolado, produto, o diagrama dos 10 filtros, "é exatamente o que fazem os nossos 10 filtros" |
| `/lp/sem-metodo` | "Analisar sem método resulta em RED. A Smart Betting dá método baseado em fato." | título, prova social (números), produto, "para analisar um jogo sozinho" com as abas, "A Smart Betting automatiza esse processo" com o na prática 1-2-3, prova social (bilhete real liquidado) |
| `/lp/mais-clareza` | "Mais clareza para analisar. Mais segurança para decidir." | título, não depender de palpite, produto, o "você consegue" com o board |

O bloco do título entra logo depois do hero só com o visual, pra não repetir o mesmo título duas
vezes na mesma página (campo `ganchoBloco` no registry).

Rota única `/lp/:slug`, resolvida pelo registry em `src/pages/lp/variants.ts`. Cada LP é um objeto
com a copy do hero e a lista de blocos. Criar a quinta é copiar um objeto e trocar texto.

Quando o bloco de abertura é o próprio gancho da página, ele entra sem cabeçalho: o hero já disse
aquele título e repetir soa como eco. Vale para o diagrama, o trabalho manual e os benefícios.

Todas com `noindex` via `<Seo>`. O sitemap é allowlist manual em `scripts/gen-sitemap.mjs`, então
nada vaza pra busca sem alguém adicionar na mão. `/` e `/futebol/comecar` seguem intocados.

## Decisões fechadas

| Tema | Decisão |
| --- | --- |
| Estrutura | 4 LPs, uma por gancho do documento de copy |
| CTA | Teste grátis de 7 dias ("Quero testar 7 dias grátis"), que é o que o produto entrega hoje. O documento fechava em pagamento, mas o gateway não existe, e prometer pagamento seria prometer o que a página não entrega |
| "10 filtros" | Só na LP e no guia bônus, sem painel no produto. A ponte com a tela é o Score |
| Prova social | Números reais do mart e uma oportunidade real já liquidada. Depoimento fabricado está fora |

## Biblioteca de seções (`src/components/lp/`)

Cabeçalho e rodapé são os da plataforma: `AnalyticsNav variant="rebrand" semTabBar semSecoes` no
topo e o `Footer` global do `App.tsx` embaixo.

As duas props são novas e opcionais, não mexem nos outros 35 call sites do header. `semSecoes` tira
Análises, Betinho e Bolão do centro do cabeçalho, porque numa página de tráfego pago cada um desses
links é uma porta de saída da oferta. Sobra logo à esquerda e Assinar mais Entrar à direita.

Fica um caminho de saída ainda: o botão "Assinar" leva pro `/planos`, que é outra página de preço,
com plano e valores diferentes dos que a LP anuncia. Apontar esse botão pro CTA da própria LP é uma
linha, e a recomendação é fazer isso antes de subir tráfego.

| Componente | Papel | Visual |
| --- | --- | --- |
| `LpHero` | Abertura de qualquer gancho | Copy do registry, faixa de números reais e, opcionalmente, o mock do produto vazando embaixo |
| `LpEstatisticaIsolada` | Bloco do problema | Uma estatística isolada convincente contra a grade dos 10 filtros, 3 a favor e 7 contra, fechando no Score 34 |
| `LpTrabalhoManual` | Bloco do método | Bloco escuro: as 8 abas que você abriria sozinho contra uma tela só |
| `LpComoFunciona` | Mecanismo | O 1-2-3: histórico entra, filtros rodam, leitura sai |
| `LpDemonstracao` | Prova de produto | O mock do produto isolado, pra quem não viu no hero |
| `LpBeneficios` | Bloco do benefício | O "você consegue" com o board de oportunidades do lado |
| `LpProvaSocial` | Prova | Números do mart, bilhete real liquidado e os 3 slots de depoimento reservados |
| `LpFaq` | Quebra de objeção | Padrão `<details>` da /futebol/comecar |
| `LpOferta` | Fecho | Assinatura, bônus, ancoragem, preço e CTA |
| `LpStickyCta` | Mobile | Barra fixa que aparece depois do hero |
| `Marcado` | Copy | `==assim==` sai com marca-texto âmbar, `!!assim!!` sai em vermelho (o RED da LP 3) |

Regra de imagem: nada de banco de imagem nem foto de jogador. Mock em código para tudo que precisa
de estado controlado. O board segue como mock em vez de print real: print de tela envelhece, no dia
fraco aparece vazio e não responsiviza no mobile. A prova real da página é o bilhete liquidado.

## Mobile

É de onde vem a maioria dos leads, então a régua é o celular. O que a revisão em 390px e 360px
corrigiu:

- **Duas barras fixas brigando.** O `AnalyticsNav` tem tab bar fixa no rodapé do mobile, e ela
  disputava o espaço do polegar com o CTA da LP. Entrou a prop `semTabBar` no `AnalyticsNav`
  (opcional, não muda os outros 35 call sites) e as LPs mantêm só o cabeçalho.
- **CTA fixo cobrindo o fim do rodapé.** O `pb` estava no bloco da LP, mas o rodapé é global e fica
  fora dele, então a linha do +18 e dos termos sumia. Agora o `LpStickyCta` põe `has-lp-cta` no
  body e o CSS reserva o espaço, mesmo mecanismo que a tab bar já usava.
- **Capa do bônus gigante.** Em coluna única ela esticava pra largura inteira. Virou grid de duas
  colunas também no mobile, com a capa em 92px.
- **Preço quebrando em duas linhas.** "R$ 39,90" partia o "R$" numa linha e o valor na outra.
  Agora é `flex-wrap` com `whitespace-nowrap` e corpo menor no mobile.
- **Alvo de toque da FAQ.** O padding estava no `<details>` e só o `<summary>` alterna, então a
  área clicável tinha 23px de altura. O padding foi pro summary, que agora tem 56px.

Checado também: zero estouro horizontal nas quatro rotas, em 360px e 390px.

## Design

Mantém os tokens do rebrand (forest, amber, canvas, ink, raios, Inter) e troca o layout: coluna
única de 720px, corpo em 17px, marca-texto com lavagem âmbar em vez de amarelo puro, "RED" no
vermelho de status, bloco escuro quebrando a rolagem.

Higiene de copy: marca sempre "Smart Betting" (o documento oscila entre três formas), sem travessão
em texto visível, linguagem simples sem palavra em inglês. "Convergência" saiu e virou "quantos
dados apontam para o mesmo lado".

## Tracking (PostHog)

`lp_view` com `{slug, gancho}`, `lp_cta_click` com a posição do botão (nav, hero, oferta, sticky) e
`lp_scroll_depth` em 25/50/75/100. Sem feature flag: uma URL por gancho e o anúncio manda pra ela.

## Estado

Pronto: as 4 LPs, os 11 componentes, o tracking, o noindex, os números reais no hero e na prova, o
bilhete real liquidado (Espanha 2 x 1 Bélgica, Copa, Score 80 na época) e o guia bônus em PDF
(`docs/bonus/guia-10-filtros.pdf`, fonte HTML ao lado).

## Bloqueio: quem paga não destrava o Futebol

Investigado no banco de produção.

`get_futebol_access` libera o módulo olhando `users.futebol_subscription_status = 'premium'`. O
webhook do Stripe (`supabase/functions/stripe-webhook/index.ts`, `getSubscriptionField`) só escreve
em `betinho_subscription_status` ou `analytics_subscription_status`. E **nenhum ponto do código
escreve `futebol_subscription_status`**: ele só aparece sendo lido, na RPC e nos filtros de
`081_notify_opportunities.sql` e `090_opportunity_reactivation_cap.sql`.

Antes disso, `/futebol/assinar` mostra o botão "Pagamento via PIX em breve" desabilitado, então
hoje o cara não consegue pagar nem se quiser.

Por isso o CTA das quatro LPs virou o teste grátis de 7 dias, que funciona ponta a ponta: cadastro,
o reverse trial libera tudo e o destino é `/futebol`, o produto em si. O preço aparece como o que
vem depois do teste, não como cobrança imediata. Quando o gateway entrar, é trocar o objeto `CTA`
em `variants.ts` e o fecho da oferta.

Duas saídas quando o gateway for plugado, e a escolha é de produto:

```sql
-- Opção A (recomendada): o plano da plataforma passa a valer pro Futebol.
-- Uma função só, sem mexer em webhook nem em Stripe, e casa com o /planos,
-- onde o Essencial já inclui futebol.
-- Em get_futebol_access, trocar a checagem por:
--   if v_status = 'premium'
--      or coalesce(u.analytics_subscription_status,'free') = 'premium' then

-- Opção B: o webhook passa a escrever futebol_subscription_status quando
-- productType = 'futebol', e o checkout manda esse productType.
```

Também não existe `VITE_STRIPE_PRICE_ID_PLATFORM` configurado localmente, só o nome no
`.env.example`. O valor de produção precisa ser conferido na Vercel.

## Os 10 filtros seguem a recalibragem

A lista de filtros da LP saía do `metodologia-score-futebol.md`, que é a régua antiga. Com o
`premissas-recalibragem.md` três deles morreram e saíram da página, do mock e do guia:

| Filtro que saiu | Por quê |
| --- | --- |
| Histórico do confronto | `h2h_favoravel` foi de 4 pontos a **0** no Resultado: −11,9 contra o preço |
| Ritmo de jogo | `ritmo_alto` foi de 8 a **0** no Gols, atrapalha nos dois testes |
| Movimento das odds | `linha_subindo` e `linha_descendo` foram a **0**, e a corroboração do modelo da API saiu |

A regra transversal do doc é a razão: **premissa de histórico do próprio mercado não gera valor**,
porque é o dado mais fácil de olhar e já está no preço. Vender isso numa página que promete método
seria vender justamente o que a medição derrubou.

Entraram no lugar, todas com ganho medido positivo: **jogos sem sofrer gol**
(`clean_sheets_altos`), **ataque fraco do adversário** (`ataques_fracos`, `adversario_limitado`) e
**defesa vazada do adversário** (`defesas_vazaveis`, +15,7 no BTTS). Os dez agora são: força dos
ataques, solidez das defesas, defesa vazada do adversário, chances criadas, jogos sem sofrer gol,
ataque fraco do adversário, desfalques e escalação, peso do mando, forma recente e posição na
tabela.

Ganho de narrativa: no exemplo do diagrama, a estatística solta que "prova" o Over é justamente uma
de histórico, e o rodapé do card agora diz "1 de 10, e é o que todo mundo já olhou". Isso é a
descoberta da recalibragem virando argumento de venda.

Dois números da página dependem da metodologia e continuam verdadeiros porque são históricos, mas
vale saber: as **1.347 oportunidades publicadas** foram geradas pela régua antiga (a simulação do
doc corta pela metade o que passa), e o **Score 80** do bilhete real está marcado como "na época",
que é o que o torna correto depois da virada.

## Prova social: o que existe e o que falta

Existe e já está na página: os números do mart (5.949 jogos, 22 campeonatos, 1.347 oportunidades) e
uma oportunidade real já liquidada, com o Score que o sistema deu na época.

A faixa de tração da plataforma (605 contas, 1.978 apostas registradas) chegou a entrar embaixo dos
depoimentos e saiu a pedido. Os números são reais e as queries ficaram anotadas em `lp-provas.ts`
se um dia voltarem.

Não existe em lugar nenhum: fala de cliente. A planilha `docs/Mensagens_usuário_Betinho.xlsx` não é
depoimento, é a matriz de mensagens do bot (bloco, gatilho, objetivo, canal, tom, CTA, KPI).

**Os três depoimentos no ar hoje são fictícios**, colocados a pedido pra aprovar o layout com o
bloco cheio (`src/components/lp/lp-depoimentos-ficticios.ts`). Antes de qualquer anúncio apontar
pra cá, eles têm que ser trocados por depoimento real com autorização, ou o bloco sai. Nenhum deles
promete lucro nem cita valor ganho, pra reduzir o estrago se escaparem por descuido.

**Painel de últimos resultados não entra por enquanto.** Testei: nas últimas 10 oportunidades
liquidadas com Score 50 ou mais, foram 4 acertos e 6 erros. Publicar isso hoje derruba a conversão,
e maquiar a amostra seria propaganda enganosa. É o mesmo problema que o
`docs/metodologia-score-futebol.md` já tinha diagnosticado na régua do Score.

Para coletar depoimento de verdade, os 109 usuários que já registraram aposta são o público certo.
Mensagem sugerida, com o consentimento no próprio texto:

> Oi, aqui é da Smart Betting. Você usa a plataforma há um tempo e queria te pedir um favor rápido:
> me conta em uma ou duas frases o que mudou na sua forma de apostar depois que começou a usar?
> Pode ser sincero, inclusive se for crítica. Se você deixar, a gente publica sua frase no site com
> o seu primeiro nome. Se preferir, publica sem nome nenhum. Responde aqui mesmo.

Três respostas boas já preenchem os três espaços.

## Pendências

- **Trocar os três depoimentos fictícios por reais antes de subir tráfego.**
- Confirmar que o plano vendido é o Essencial (R$ 39,90 com riscado de R$ 49,90, valores do
  `/planos`).
- A FAQ diz Brasileirão e Copa, mas a prova diz 22 campeonatos, que é o que tem no mart. Abrir a
  lista na FAQ ou baixar o número da prova.
- Depoimento de cliente com autorização, pros três slots reservados.
- Atualizar os números quando o mart crescer. As queries de origem estão comentadas em
  `src/components/lp/lp-provas.ts`.
