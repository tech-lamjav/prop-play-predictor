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

## Consequências

Existem duas séries legítimas e diferentes sobre os mesmos jogos, e cada tela diz
qual delas mostra. A RPC do placar é restrita a sócio pelo mesmo porteiro do CRM,
`public.eh_socio()`, porque ela devolve o board inteiro, inclusive mercado fora
da vitrine.
