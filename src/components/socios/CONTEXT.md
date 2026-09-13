# CRM dos sócios

Este contexto descreve como um cadastro vira um lead abordado, e o que os sócios
registram sobre cada pessoa durante a abordagem.

## Language

**Sócio**:
Quem enxerga o painel dos sócios. É uma marca no banco, ligada na mão, e não
tem nada a ver com plano assinado.
_Avoid_: Admin, administrador, usuário interno

**Cadastro**:
Uma linha na tabela de usuários, contada pelo dia em que nasceu. É o que a lista
mostra agrupado por data.
_Avoid_: Signup, conta, registro

**Lead**:
Um cadastro visto pela ótica da abordagem — alguém que pode virar assinante.
Todo cadastro é um lead; a palavra muda porque o assunto muda.
_Avoid_: Prospect, contato, usuário

**Etapa**:
Onde o lead está na CONVERSA. São seis, nesta ordem: novo, contatado,
nutrindo, boletada, interesse, sem resposta. `Nutrindo` é mandar conteúdo sem
pedir nada; `boletada` é ter mandado um bilhete para o lead. `Sem resposta` é o
fim da linha do outro lado, e não um degrau anterior ao fechamento.

A escada é: novo, primeiro contato, nutrindo, boletada, interesse, assinante,
com sem resposta como saída lateral. "Primeiro contato" e não "contatado":
"contatado" não diz se foi a primeira vez ou a quinta, e o funil precisa do
primeiro toque como marco.

Etapa é sempre MANUAL: alguém move. O que o banco responde sozinho não é etapa,
é **posição calculada**.
_Avoid_: Status, estágio, fase, coluna

**Gancho**:
O palpite sobre o que atraiu a pessoa, derivado do que o banco sabe — plano,
Telegram sincronizado, apostas registradas, alertas ligados. É palpite, e a tela
diz que é. Um sócio pode corrigir na mão.
_Avoid_: Interesse, motivo, origem, fonte

**Origem**:
De onde o lead veio — campanha, anúncio, indicação. **Não existe no banco**, só
no PostHog. Não use a palavra como se a tela soubesse: ela não sabe.
_Avoid_: Usar como sinônimo de gancho

**Posição**:
Onde o lead aparece no funil da tela. São oito: as seis etapas mais duas que o
banco responde sozinho — **em teste** (o teste gratuito ainda de pé) e
**assinante** (qualquer um dos três acessos em premium). A posição calculada
VENCE a etapa manual: quem já assina não está sentado em interesse, e mostrar
nos dois lugares faria o funil somar duas vezes a mesma pessoa.
_Avoid_: Coluna, estágio, degrau

**Toque**:
O último sinal de vida de uma conversa: a mudança de etapa mais recente ou a
anotação mais recente, o que for depois. Quem nunca recebeu nada não tem toque,
e aí o relógio conta desde o cadastro.
_Avoid_: Interação, contato, atividade

**Parado**:
Dias desde o último toque. A partir de sete, uma conversa já começada entra na
fila de retomada. Para quem nunca foi tocado, conta desde o cadastro — o
relógio do lead começa quando ele chega, não no primeiro contato que não houve.
_Avoid_: Inativo, frio, esquecido

**Recorte**:
Qual fatia da base a lista mostra. São dois: **precisa de atenção** e **todos**.
Agrupar por dia não é recorte — é chave à parte, que se combina com os dois.
_Avoid_: Aba, visão, filtro (filtro é o do funil e o da busca)

**Precisa de atenção**:
O recorte de quem espera alguma coisa: conversa começada e sem toque há sete
dias ou mais, e quem nunca saiu de "novo". Numa lista só, ordenada — a conversa
esfriando vem antes, porque já custou trabalho, e a coluna de etapa é o que
distingue as duas situações.
_Avoid_: Fila, pendências, to-do

**Anotação**:
Um registro livre na linha do tempo de uma pessoa. Tem três tipos que o sócio
escreve: anotação, feedback e objeção. Feedback não é uma tela separada, é um
tipo de anotação. O quarto tipo da linha do tempo, `acesso`, não se digita: quem
escreve é a função do banco quando alguém mexe no acesso de uma pessoa.
_Avoid_: Nota, comentário, observação

**Linha do tempo**:
Anotações e mudanças de etapa de uma pessoa, na mesma ordem cronológica. As duas
coisas dividem a mesma lista de propósito: a mudança de etapa quase sempre é
consequência do que foi anotado logo antes.
_Avoid_: Histórico, log, atividades

**Ficha**:
A tela de uma pessoa: contatos, plano, acessos, gancho, etapa, linha do tempo e
mensagem pronta. Abre em modal por cima da lista, e não numa página separada —
o trabalho é abrir, registrar, fechar, abrir o próximo.
_Avoid_: Perfil, detalhe, página do usuário

**Acesso dado na mão**:
Um sócio libera ou tira um produto de alguém pela ficha, sem passar pelo Stripe.
Vale até o Stripe falar sobre aquela pessoa, e aí ele vence — o CRM nunca ganha
do webhook, senão um clique errado viraria assinatura eterna de graça. Cada
mudança deixa um registro do tipo `acesso` na linha do tempo, que ninguém digita
à mão.
_Avoid_: Cortesia, comp, override, liberar acesso manual

**Teste do futebol**:
A janela de sete dias contada a partir de `futebol_trial_started_at`. Não é
status de assinatura, e tem controle próprio na ficha: tratá-lo como um quarto
produto convidaria a implementá-lo como `premium`, que dá acesso para sempre com
cara de teste. Tem três estados, e não dois — nunca usou, correndo, já usou —,
porque o terceiro é o que decide se dar outro faz sentido.
_Avoid_: Trial, free trial, degustação, período de teste

**Assinatura manual**:
Um plano inteiro concedido por um sócio, fora do Stripe. Segue a escada
cumulativa: Entrada é o Betinho, Essencial é futebol mais Betinho, Completo é os
três. É coisa diferente de um acesso avulso, que liga UM produto sem plano nem
prazo. Toda concessão vira linha em `crm_assinatura_manual`, e é dessa tabela que
sai a fila de cobrança.

Combina duas coisas INDEPENDENTES: até quando vale e quanto custa por mês. As
quatro combinações existem, e é por isso que são duas perguntas na tela e duas
colunas no banco — não um campo "tipo" com quatro opções, que esconderia que são
duas decisões.
_Avoid_: Cortesia paga, plano de teste, assinatura interna

**Vitalícia**:
Assinatura manual que não vence. Sócio, parceiro, quem ajudou a construir a
coisa. No banco é `vence_em` nulo, e nulo é a resposta certa: a alternativa era
digitar uma data de 2099, um número falso que o resto do sistema trataria como
verdade e que um dia chegaria.

Não entra na fila de vencimento, porque não tem o que vencer. ⚠️ Pode ter
cobrança mensal: quem é vitalício e paga todo mês fica devendo como qualquer
outro, só não perde o acesso por atraso. Vitalícia e sem cobrança são coisas
diferentes, e confundir as duas faz um cliente pagante desaparecer da conta de
receita.
_Avoid_: Permanente, eterna, para sempre, ilimitada, lifetime

**Fila de cobrança**:
Quem tem assinatura manual vencendo nos próximos sete dias, ou já vencida, na
ordem de quem vence primeiro. Existe porque assinatura manual não renova
sozinha: sem a fila, o acesso some um dia e a conversa acontece tarde, com a
pessoa já sem o produto. É a terceira seção do CRM, ao lado de Leads e
Feedbacks, e responde uma terceira pergunta: "quem eu preciso cobrar".
_Avoid_: Renovações, vencimentos, inadimplentes

**Etiqueta**:
O que o produto diz sobre a pessoa, num eixo SEPARADO da etapa. Hoje só existem
as três do teste gratuito do futebol: teste vencendo, em teste, teste vencido.
As duas coisas valem ao mesmo tempo — alguém pode estar em teste E em nutrição,
e são informações diferentes sobre a mesma pessoa.

Quem nunca testou não tem etiqueta, e não existe etiqueta "nunca testou": seria
a maior de todas e não distinguiria nada. Quem já assina também não tem: a
pessoa converteu, e lembrar que ela um dia testou não muda conversa nenhuma.

⚠️ "Em teste" já foi POSIÇÃO do funil, e era errado. Como posição calculada ela
vencia a etapa manual na tela, então quem estava em teste aparecia como "Em
teste" e a etapa ficava invisível. Em produção isso escondia a conversa de 59
pessoas de uma vez, justamente as mais quentes. O Victor apontou olhando a
tela: "não me parece que são as mesmas coisas ou estamos misturando duas coisas
diferentes".
_Avoid_: Tag, status, situação, estágio

**Teste vencendo**:
A etiqueta de quem perde o acesso hoje ou amanhã. Um dia de antecedência, a
pedido: a conversa acontece na véspera, com o acesso ainda de pé. Dois dias
antes a pessoa esquece; no dia seguinte ela já perdeu o acesso, e aí a conversa
é de retomada, bem mais difícil.
_Avoid_: Expirando, a expirar, trial ending

**Pagamento**:
Dinheiro recebido de uma assinatura manual, referente a um mês de competência.
Guarda a origem — Pix, dinheiro, transferência — porque o Stripe não vende por
Pix e boa parte dos clientes paga assim: essa receita acontece fora do gateway
e não tinha registro em lugar nenhum.

Só o que entra FORA do Stripe. Quem paga por lá já tem registro lá, e duas
fontes para o mesmo dinheiro discordam. A tela diz isso com essas palavras:
"recebido na mão".

Estorna, nunca apaga: um registro de dinheiro que alguém apaga é um registro
que ninguém consegue auditar. Estornar exige motivo e não recua o acesso — a
pessoa já usou, e tirar por erro de lançamento castiga quem não errou.
_Avoid_: Cobrança, fatura, recebimento, entrada

**ROI dele**:
O retorno das apostas DA PESSOA, e não nosso. Lucro sobre o que ela apostou,
contando só o que já liquidou. Nas palavras do Victor: "não temos culpa da
performance dele, na verdade é até uma forma de a gente abordar o cara" — quem
está perdendo é uma conversa sobre gestão de banca, não um problema.

Por isso a tela não pinta verde e vermelho: prejuízo colorido na ficha de um
cliente vira julgamento, e quem abre a ficha está prestes a falar com essa
pessoa. Nulo quando nada liquidou, porque zero por cento é uma afirmação que
quem só tem aposta em aberto não fez.
_Avoid_: Nosso ROI, performance, resultado da conta, retorno

**Recorte de aposta**:
Como as apostas de uma pessoa se distribuem por mercado, esporte ou faixa de
odd. Todo recorte anda com o N junto: "aposta mais em Over/Under" é uma frase
que mente quando a pessoa tem três apostas, e "2 de 3" se explica sozinho.
Abaixo de cinco apostas a tela mostra o número mas não chama de perfil.
_Avoid_: Segmento, cluster, padrão, comportamento de aposta

**Recebido na mão**:
O total de pagamentos não estornados de uma pessoa. É o que ela já gerou FORA
do Stripe, e a tela diz isso com essas palavras: quem paga pelo gateway já tem
registro lá, e um total que parece ser "tudo que a pessoa pagou" leva a
conclusão errada sobre quanto ela vale.
_Avoid_: Receita total, faturamento, LTV, valor do cliente

**Mês de competência**:
O mês a que um pagamento se refere, e não o dia em que o dinheiro caiu. Um Pix
que chega em 2 de outubro pagando setembro tem competência em setembro. Os dois
são campos diferentes porque é a competência que responde qual mês está em
aberto.
_Avoid_: Mês de referência, período, data do pagamento

**Mês em aberto**:
Mês de competência que já começou e não tem pagamento. É DERIVADO, e não uma
linha criada de antemão: todo mês desde o começo da assinatura, menos os que têm
pagamento. Gerar linha por mês exigiria um cron, e cron que falha em silêncio
deixa de gerar a cobrança — o sistema esqueceria de cobrar sem ninguém
descobrir.

O mês corrente conta como em aberto, porque a cobrança é no começo dele.
_Avoid_: Pendência, atraso, débito, inadimplência (essa é a situação, não o mês)

**Sem cobrança**:
Assinatura manual sem valor mensal combinado. Não é inadimplência e não entra em
nenhuma fila: quem não combinou pagar não deve nada. É o estado das assinaturas
que existiam antes de o valor existir.

⚠️ Não é o mesmo que vitalícia. Sem cobrança responde "quanto custa"; vitalícia
responde "até quando vale". Zero também não é sem cobrança: sem cobrança é nulo,
e um zero gravado viraria receita de R$ 0,00 num total e dívida de nada numa
fila.
_Avoid_: Cortesia, grátis, brinde, interna
