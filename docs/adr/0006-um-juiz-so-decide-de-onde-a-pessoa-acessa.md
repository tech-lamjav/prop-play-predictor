# Um juiz só decide de onde a pessoa acessa, e ele fica no servidor

Em 30/09/2026 a Smart Betting passou a precisar saber de onde cada pessoa
acessa. O motivo não é de produto: é fiscal. A operação brasileira é encerrada
em 5 de outubro, e para que o serviço vendido lá fora seja **exportação** — com
DAS de 3,05% em vez de 6% — é preciso sustentar duas coisas diante da Receita. O
ingresso de divisas, que não passa por código nenhum daqui. E o resultado no
exterior, que exige duas provas nossas: que o acesso a partir do Brasil está
restrito, e um registro de onde as pessoas ativas estavam.

A decisão registrada aqui é **onde essa conta é feita**: num único lugar, do
lado do servidor, que decide uma vez por sessão, grava, e é obedecido por todo o
resto. Nada na borda da CDN.

## A troca

A resposta óbvia, e a que a literatura recomenda, é bloquear na borda. É mais
rápido, custa menos banda, e o pedido nem chega ao servidor. Tem duas vantagens
reais e nós abrimos mão das duas.

O que ganhamos em troca é que **existe uma verdade só**. Na borda, quem decide o
país é a CDN, pelo IP que ela vê. No servidor, quem decide é a nossa função,
pelo IP que ela vê. Os dois discordam mais do que parece — caminhos diferentes,
bases diferentes, momentos diferentes — e no dia em que discordassem o bloqueio
teria saído por um critério enquanto a prova teria saído por outro. Alguém
barrado apareceria no registro como estrangeiro, ou o contrário. E não haveria
como saber qual dos dois estava certo, porque os dois estariam fazendo o que
foram programados para fazer.

Para um bloqueio comum isso seria um detalhe. Para um bloqueio cuja razão de
existir é **virar prova**, é o defeito que anula o trabalho inteiro.

Há um segundo motivo, menor e específico nosso: o produto é uma página estática
que conversa direto com o banco pelo navegador. Bloquear o documento HTML na
borda não protege dado nenhum — o dado não passa por lá. A borda economizaria
banda e nada mais.

## O que isso custou

**Uma chamada de rede por sessão** que não existiria com bloqueio na borda. Ela
não segura a tela: enquanto a resposta não chega, o produto aparece
normalmente, e só o veredito `barrado` tira alguém dele. Foi assim depois de uma
primeira versão que segurava — com a chave do bloqueio desligada ninguém nunca
é barrado, e aquela espera cobrava de todo mundo para comprar nada.

**O bloqueio não é instantâneo nem hermético.** Quem é barrado tem a sessão
revogada, o que mata a renovação; o token que a pessoa já tem na mão vale até
expirar, porque quem o valida confere só a assinatura. Fechar essa janela
exigiria verificação nas regras de acesso de dezenas de tabelas, o que foi
descartado por ser muito risco de quebrar acesso legítimo por pouco retorno. E
qualquer VPN derruba qualquer geo-bloqueio, aqui ou na borda. O que sustenta o
enquadramento é uma restrição real, documentada e aplicada de boa-fé — não um
cofre.

**Não saber deixa entrar, em todo lugar.** Endereço que não dá para ler, lista
que não responde, função que falhou: entra. Trancar todo mundo por causa de um
defeito nosso é pior do que deixar passar alguém que será verificado na sessão
seguinte. O que torna isso seguro é o vigia contar os "não sei" e reclamar —
fail-open silencioso é como um bloqueio morre sem ninguém ver.

## O que decorre disso

A pergunta em tempo real virou binária: **este IP é do Brasil?**, e não "de que
país é". A primeira tem resposta local, num arquivo gerado da publicação do
LACNIC; a segunda precisaria consultar alguém, e consultar alguém no caminho de
quem chega é exatamente o custo que este desenho não quis pagar. O país completo
é resolvido depois, em lote.

O arquivo em vez de uma API de terceiro tem um motivo a mais do que velocidade:
ele é **mostrável**. Numa fiscalização, "bloqueamos estas faixas, aqui estão
elas" se defende; "um serviço que assinamos disse que era do Brasil" não.

E o registro guarda duas colunas onde uma pareceria bastar: a **origem**, que é
o que o endereço disse, e o **veredito**, que é o que aconteceu com a pessoa.
Enquanto a chave estiver desligada todo veredito é "entrou", e um registro só de
vereditos não provaria nada sobre esse período — que é justamente o que começa
agora. Observação envelhece melhor que decisão: se a política mudar, os
vereditos antigos passam a significar outra coisa, e as origens antigas não.

## Quando revisitar

Se a operação passar a vender fora da América Latina, o arquivo de países
precisa das publicações dos outros registros regionais — hoje um endereço da
Europa prova que a pessoa não estava no Brasil, mas não diz onde estava.

E se um dia alguém precisar de bloqueio hermético, e não de restrição de boa-fé,
a conversa volta para as regras de acesso do banco — que é o caminho que foi
descartado aqui, e não um caminho que não existe.
