# A liquidação continua sendo conta de tela, não fato gravado

Não existe, em nenhuma tabela, o registro de que uma oportunidade bateu ou não. O
banco guarda a oportunidade; o green e o red são calculados no navegador pela
regra em `src/utils/futebol-settlement.ts` e jogados fora quando a aba fecha. O
placar da metodologia nasce reusando essa mesma regra, em vez de esperar a
liquidação virar coluna no Postgres ou no mart.

A razão é que a regra já existe, já cobre os cinco mercados, já trata o quarto de
gol do handicap asiático e já tem teste de paridade caso a caso contra o script
`scripts/futebol-roi.mjs`. Reusá-la não cria dívida, cria uma fonte só. Gravar a
liquidação é a coisa certa a fazer, e ela se paga quando alguém de fora do
navegador precisar do número — o Telegram, um resumo semanal, o Mateus. Hoje
ninguém de fora precisa.

## Consequências

O placar não responde por SQL a "qual foi o ROI do mês passado": ele busca as
linhas publicadas, liquida e agrega no cliente. Isso põe um teto de tamanho na
janela consultada, e o dia em que esse teto incomodar é o dia de gravar a
liquidação. Enquanto isso, qualquer segundo lugar que precise do número tem de
chamar a mesma regra, nunca reimplementá-la.
