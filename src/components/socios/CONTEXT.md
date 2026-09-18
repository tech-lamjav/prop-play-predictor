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
A janela entre o começo e o fim do teste, gravados juntos. Dura 48 horas para
quem começa hoje; quem começou antes de 12/09/2026
ficou com os 7 dias que a página prometia. Por isso o acesso se decide pelo FIM
gravado, e nunca pelo início mais uma duração. Não é
status de assinatura, e tem controle próprio na ficha: tratá-lo como um quarto
produto convidaria a implementá-lo como `premium`, que dá acesso para sempre com
cara de teste. Tem três estados, e não dois — nunca usou, correndo, já usou —,
porque o terceiro é o que decide se dar outro faz sentido.
_Avoid_: Trial, free trial, degustação, período de teste

**Assinatura**:
Um plano de pé para uma pessoa, com a **origem da assinatura** dizendo de onde
ele veio. São duas: manual e Stripe.

Por muito tempo a única palavra definida aqui foi "assinatura manual", e
"assinatura" sozinha não queria dizer nada. Isso escondia que quem compra pelo
gateway também tem uma, e que o CRM não enxergava nenhuma delas.

⚠️ O guarda-chuva vale para o SUBSTANTIVO, e não para as contas. **Mês em
aberto**, **fila de inadimplentes** e **recebido na mão** são derivados do nosso
registro e continuam valendo só para origem manual. Calcular mês em aberto para
quem vem do Stripe inventaria dívida de alguém que está pagando em dia.
_Avoid_: Plano, contrato, adesão

**Origem da assinatura**:
Manual ou Stripe. Não é detalhe de procedência: é o que decide quem manda no
acesso, em que fila a pessoa entra e quais números a tela tem direito de
calcular. Por isso fica gravada, e nunca é adivinhada pela presença de um campo
preenchido.
_Avoid_: Tipo, fonte, canal

**Assinatura manual**:
Uma **assinatura** de origem manual: um plano inteiro concedido por um sócio,
fora do Stripe. Segue a escada
cumulativa: Entrada é o Betinho, Essencial é futebol mais Betinho, Completo é os
três. É coisa diferente de um acesso avulso, que liga UM produto sem plano nem
prazo. Trocar o plano, o prazo ou o valor é mudar os termos da MESMA assinatura,
e não dar outra: o histórico de pagamento pertence a ela.

Combina duas coisas INDEPENDENTES: até quando vale e quanto custa por mês. As
quatro combinações existem, e é por isso que são duas perguntas na tela e duas
colunas no banco — não um campo "tipo" com quatro opções, que esconderia que são
duas decisões.
_Avoid_: Cortesia paga, plano de teste, assinatura interna

**Vitalícia**:
Assinatura manual que não vence. Sócio, parceiro, quem ajudou a construir a
coisa. Não tem data de fim, e a ausência é a resposta certa: a alternativa era
digitar uma data de 2099, um número falso que o resto do sistema trataria como
verdade e que um dia chegaria.

Não entra na fila de vencimento, porque não tem o que vencer. ⚠️ Pode ter
cobrança mensal: quem é vitalício e paga todo mês fica devendo como qualquer
outro e entra na fila de inadimplentes. Vitalícia e sem cobrança são coisas
diferentes, e confundir as duas faz um cliente pagante desaparecer da conta de
receita.
_Avoid_: Permanente, eterna, para sempre, ilimitada, lifetime

**Fila de cobrança**:
Quem tem assinatura manual vencendo nos próximos sete dias, ou já vencida, na
ordem de quem vence primeiro. Existe porque assinatura manual não renova
sozinha: sem a fila, o acesso some um dia e a conversa acontece tarde, com a
pessoa já sem o produto. É a terceira seção do CRM, ao lado de Leads e
Feedbacks, e responde uma terceira pergunta: "quem eu preciso cobrar".

⚠️ Quem também paga no cartão sai dela na hora, e a tela DIZ quantos saíram.
Renovação é o assunto desta fila, e quem está no gateway já renova sozinho:
pedir Pix a quem tem cartão passando é como se produz pagamento em dobro. Sair
daqui não encerra o acordo na mão, que continua aberto em "Todas".
_Avoid_: Renovações, vencimentos, inadimplentes

**Fila de inadimplentes**:
Quem tem cobrança mensal combinada e está com mês em aberto, do que deve mais
para o que deve menos. É OUTRA fila, e não a de cobrança: a de cobrança sai da
data de vencimento, e esta sai do dinheiro que não entrou. Por isso a vitalícia
com cobrança entra aqui e nunca entra na outra. Ninguém sai dela encerrado
sozinho: ela é o lugar onde o sócio decide encerrar.

⚠️ Só origem manual. Quem assina pelo Stripe nunca entra aqui, mesmo com
fatura atrasada: lá o gateway cobra sozinho, e o que ele relata é **cobrança
falhando**. Quem está nesta fila está aqui porque o dinheiro depende de você ir
atrás dele.
_Avoid_: Devedores, calote, caloteiros, bloqueados

**Cobrança falhando**:
O que o Stripe relata quando tentou cobrar e não conseguiu. É fato do gateway,
RELATADO, e não conclusão nossa. Por isso nunca se soma com **mês em aberto** e
nunca entra na **fila de inadimplentes**: aquela fila é derivada do nosso
registro de pagamento e só vale para assinatura de origem manual.

⚠️ Quem está aqui não precisa de cobrança na mão. O Stripe segue tentando
sozinho, e pedir Pix a quem tem cartão em nova tentativa é como se produz o
pagamento em dobro. Precisa de acompanhamento, que é outra conversa.
_Avoid_: Inadimplente, devendo, atrasado, em aberto

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
Dinheiro recebido de uma **assinatura**, referente a um mês de competência.
Guarda a origem — Pix, dinheiro, transferência, Stripe — porque o Stripe não
vende por Pix e boa parte dos clientes paga assim: essa receita acontece fora
do gateway e não tinha registro em lugar nenhum.

Cobre as DUAS origens. Até 16/09/2026 era só o que entrava fora do Stripe, e o
motivo escrito era que duas fontes para o mesmo dinheiro discordam. O Victor
pediu o contrário, por um motivo melhor: uma fonte só, com a origem gravada em
cada linha, é o que permite somar receita de verdade e construir em cima depois.
A discordância que se temia vira problema de idempotência — cada fatura do
Stripe entra uma vez só, presa ao identificador dela — e não de vocabulário.

⚠️ Pagamento de origem Stripe é REGISTRO, nunca lançamento: ninguém digita, o
webhook grava. A tela de lançar na mão continua oferecendo só as origens que
entram na mão, porque digitar um pagamento que o gateway também vai gravar é
exatamente a linha duplicada que se quer evitar.

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
O total de pagamentos não estornados de uma pessoa **de origem manual**. É o
que ela já gerou FORA do Stripe, e a tela diz isso com essas palavras.

Convive com o **recebido total**, que soma as duas origens, e os dois ficam na
tela porque respondem perguntas diferentes: este é o dinheiro que depende de
alguém ir atrás, e o total é quanto a pessoa vale. Trocar um pelo outro tiraria
do sócio um número que ele já usa para trabalhar.
_Avoid_: Receita total, faturamento, LTV, valor do cliente

**Recebido total**:
Tudo que a pessoa já pagou, das duas origens, sem os estornados. Só passou a
existir quando o **pagamento** deixou de ser só o de fora do gateway; antes
disso um número com esse nome seria mentira.

⚠️ É a soma do que entrou por UMA pessoa, e não receita da empresa. Chamar de
LTV convidaria a projetar futuro em cima de um número que só olha para trás.
_Avoid_: LTV, faturamento, receita da empresa, valor do cliente

**Mês de competência**:
O mês a que um pagamento se refere, e não o dia em que o dinheiro caiu. Um Pix
que chega em 2 de outubro pagando setembro tem competência em setembro. Os dois
são campos diferentes porque é a competência que responde qual mês está em
aberto.

No Stripe a competência é o mês de Brasília em que COMEÇA o período que a
própria fatura declara: uma renovação em 28/09 cobrindo 28/09 a 28/10 é
competência de setembro. ⚠️ Sai do período declarado, e nunca de assumir que
todo plano é mensal — hoje todos são, mas o código nunca leu o intervalo do
preço, e um preço anual cadastrado passaria despercebido.
_Avoid_: Mês de referência, período, data do pagamento

**Mês em aberto**:
Mês de competência que já começou e não tem pagamento. É DERIVADO, e não uma
linha criada de antemão: todo mês desde o começo da assinatura, menos os que têm
pagamento. Gerar linha por mês exigiria um cron, e cron que falha em silêncio
deixa de gerar a cobrança — o sistema esqueceria de cobrar sem ninguém
descobrir.

O mês corrente conta como em aberto, porque a cobrança é no começo dele.

⚠️ Só de assinatura de origem manual, e só quando há valor mensal combinado.
Quem paga pelo Stripe nunca tem mês em aberto: o gateway cobra sozinho, e
derivar dívida de quem está em dia seria inventar dinheiro que ninguém deve.

⚠️ Para quem tem as DUAS origens, a conta para na **virada para o cartão**: os
meses anteriores continuam em aberto, e nenhum mês novo acumula a partir dela.
_Avoid_: Pendência, atraso, débito, inadimplência (essa é a situação, não o mês)

**Virada para o cartão**:
O mês em que o gateway assumiu o pagamento de alguém que já tinha um acordo
feito na mão. É onde o **mês em aberto** daquele acordo para de acumular.

É DERIVADA do dinheiro: o pagamento mais antigo que o Stripe nos mandou daquela
pessoa. Não existe data de início de assinatura no gateway em lugar nenhum do
nosso banco — as colunas de prazo são de renovação.

Sem nenhum pagamento do gateway, a virada é o MÊS CORRENTE. É o ponto mais
conservador: nada do passado é perdoado sem prova, e o número para de crescer a
partir de hoje. E ela melhora sozinha — quando a primeira fatura entra, a virada
recua para o mês dela sem ninguém mexer.

⚠️ Virar NÃO encerra o acordo na mão. O acordo continua aberto, sai da **fila de
cobrança** e aparece em "Todas" com o selo. Encerrar segue sendo decisão do
sócio, como tudo que mexe no que foi combinado com uma pessoa.
_Avoid_: Migração, upgrade, troca de plano, conversão

**Sem cobrança**:
Assinatura manual sem valor mensal combinado. Não é inadimplência e não entra em
nenhuma fila: quem não combinou pagar não deve nada. É o estado das assinaturas
que existiam antes de o valor existir.

⚠️ Não é o mesmo que vitalícia. Sem cobrança responde "quanto custa"; vitalícia
responde "até quando vale". Zero também não é sem cobrança: sem cobrança é nulo,
e um zero gravado viraria receita de R$ 0,00 num total e dívida de nada numa
fila.
_Avoid_: Cortesia, grátis, brinde, interna
