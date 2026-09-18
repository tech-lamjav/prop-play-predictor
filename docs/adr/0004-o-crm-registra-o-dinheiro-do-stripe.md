# O CRM registra o dinheiro do Stripe, e o dono de um pagamento passa a ser a pessoa

Até 16/09/2026 o CRM guardava de propósito só o dinheiro que entrava fora do
gateway, e o glossário dizia o porquê: duas fontes para o mesmo dinheiro
discordam. O Victor pediu o contrário, para poder somar receita de verdade e
construir em cima depois, e a discordância que se temia passa a ser resolvida
por idempotência — cada fatura do Stripe entra uma vez só, presa ao
identificador dela — em vez de ser resolvida por omissão.

A consequência estrutural é que o pai de um pagamento deixa de ser a assinatura
manual e passa a ser a PESSOA. Um pagamento do Stripe não tem assinatura
manual, e o Stripe pode cobrar duas vezes no mesmo mês numa troca de plano, o
que o índice de um pagamento por competência proibia.

## Opções consideradas

Generalizar a tabela de assinatura manual para servir às duas origens, e criar
uma tabela paralela para a assinatura do Stripe. As duas foram rejeitadas pelo
mesmo motivo: obrigariam o webhook a escrever tabela do CRM, e é aí que um erro
do gateway passa a corromper o registro comercial. Além disso, a assinatura do
Stripe já existe hoje nas colunas do usuário que o webhook mantém — criar
tabela para ela seria uma segunda cópia de um dado que já tem dono.

## Consequências

O índice de um pagamento por mês de competência passa a valer só para quem tem
assinatura manual. **Mês em aberto**, **fila de inadimplentes** e **recebido na
mão** continuam derivados só da origem manual: calculá-los para quem vem do
Stripe inventaria dívida de quem está pagando em dia. E a palavra inadimplente
não vale para o gateway — o que o Stripe relata é **cobrança falhando**, fato
relatado e não conclusão nossa.

A competência de um pagamento do Stripe sai do período que a própria fatura
declara, e nunca de "assumir mensal". Hoje todo preço cadastrado é mensal, mas
o código nunca leu o intervalo do preço: se alguém apontar uma variável de
preço para um preço anual, nada no sistema perceberia. Ler o período declarado
faz o caso anual aparecer como fato em vez de empilhar doze meses de dinheiro
num mês só.

O histórico precisa ser importado uma vez, contra a API do Stripe e escrevendo
em produção. Isso não é trabalho de agente: o script é escrito e testado aqui,
e rodado pelo Victor.
