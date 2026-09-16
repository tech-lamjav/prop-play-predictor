# O placar mede a foto de nascimento, não o estado no apito

O histórico de oportunidades guarda vários registros da mesma linha ao longo do
tempo, e há duas leituras possíveis. A RPC `get_futebol_value_history`, que
alimenta o histórico do assinante, devolve o registro que estava vivo no apito —
a última coisa que o assinante viu. O script `scripts/futebol-roi.mjs` toma o
primeiro registro de cada oportunidade, a **foto de nascimento**. O placar da
metodologia segue o script, e por isso ganha uma RPC própria em vez de reusar a
do assinante.

O motivo é o que o placar julga: a régua que decidiu publicar. A odd, a nota e a
faixa que sustentaram a decisão são as do nascimento; medir o estado no apito
responde a outra pergunta, e responder as duas com o mesmo número é como duas
pessoas chegam a taxas diferentes para a mesma semana — o defeito que o script
foi escrito para matar.

## A foto de nascimento tem duas fontes (revisto em 16/09/2026, #436)

A regra acima valia enquanto "primeiro registro" era uma coisa só. Não é: a nota
mudou de escala entre `legacy` e `contexto_v1`, e o script e o placar filtravam a
versão ANTES de pegar o primeiro registro — o que dava, para a linha nascida
antes do cutover e reavaliada depois, uma foto diferente da que o histórico do
assinante mostra.

Passa a valer, nos dois lados:

- **o preço** (odd e vantagem) vem da **primeira versão de todas**. "Apareceu na
  tela" não tem versão de metodologia, e preço não mudou de escala;
- **a nota e a data** vêm da **primeira `contexto_v1`**. A escala da nota mudou, e
  somar as duas inventa uma série que nunca existiu. A data acompanha a nota
  porque é ela que diz em que escala a nota foi calculada.

A linha resultante vem de dois registros do snapshot, e isso é a decisão: preço e
nota respondem perguntas diferentes, e só a nota tem problema de escala.

`scripts/futebol-roi.mjs` e `get_futebol_oportunidades_publicadas` implementam a
MESMA regra, e é por isso que ela está escrita aqui: mudar um lado sem o outro
faz a tela e o terminal darem números diferentes de novo.

## Consequências

Existem duas séries legítimas e diferentes sobre os mesmos jogos, e cada tela diz
qual delas mostra. A RPC do placar é restrita a sócio pelo mesmo porteiro do CRM,
`public.eh_socio()`, porque ela devolve o board inteiro, inclusive mercado fora
da vitrine.
