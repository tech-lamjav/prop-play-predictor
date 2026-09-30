# A pesquisa de perfil pergunta à base inteira e insiste até ser respondida

Até 25/09/2026 o produto sabia se a pessoa conectou o Telegram, se assina e
quanto aposta depois — mas não sabia o que ela veio buscar nem em que ponto da
jornada ela está. Sem isso não dá para responder se uma campanha traz iniciante
ou apostador que valoriza análise, nem se algum desses perfis ativa e retém
pior. O Victor pediu duas perguntas na chegada, e escolheu que elas sejam feitas
a **todo usuário logado**, base antiga incluída, e que voltem **a cada sessão
até serem respondidas**.

Isso é adiável e não dispensável: existe um botão Pular, mas ele adia em vez de
encerrar. Clicar fora e o Esc não fecham, e não há X no canto — as únicas duas
saídas são responder ou pular, porque adiar é um ato deliberado e um clique por
acidente não pode custar a pergunta.

## A troca

O atrito é real e não é o mesmo para os dois grupos. Para quem acabou de se
cadastrar são dez segundos, praxe de mercado. Para quem assina há meses é uma
porta nova toda vez que entra, no lugar mais caro do produto para gastar boa
vontade.

O risco maior, porém, não é o atrito: é **a qualidade da resposta**. Pergunta
que insiste até ser respondida não devolve a verdade, devolve o primeiro botão.
Aceitamos esse risco em troca de cobertura — uma pesquisa opcional responde a
quem tem paciência, e paciência correlaciona com engajamento, então o número
descreveria justamente o grupo que menos precisa ser descoberto.

A defesa contra o risco aceito está no desenho e não na esperança: a contagem de
adiamentos fica gravada por pessoa, e os eventos permitem ler tempo até
responder e distribuição das escolhas. Se a maioria responder em poucos segundos
concentrando na primeira opção, o número não presta — e isso aparece no painel
antes de aparecer no cancelamento.

## Opções consideradas

**Perguntar só a quem se cadastrar de agora em diante** foi a primeira proposta,
e teria evitado todo o atrito sobre a base pagante. Rejeitada porque levaria
meses até haver volume, e porque a comparação mais útil — quem assina se parece
com qual perfil — precisa de gente que já assinou.

**Deixar opcional, perguntando uma vez e desistindo**, foi rejeitada pelo viés
de resposta acima.

**Bloquear a entrada até responder** foi rejeitada por prender na porta quem
acabou de chegar, antes de ver qualquer valor.

## Consequências

O estado "já respondeu" precisa viver no **banco**, e não no `localStorage` dos
dezessete tours: com memória por navegador, quem trocasse de celular ou limpasse
o navegador seria perguntado para sempre. Esta é a primeira memória de usuário da
casa que não cabe no navegador.

Os **oito códigos de opção nunca se renomeiam**. Eles são o valor do `check` no
banco e o valor da propriedade de pessoa no PostHog ao mesmo tempo; renomear um
parte a série em duas sem ninguém perceber. O texto que aparece na tela é outra
coisa e pode ser reescrito à vontade.

O cruzamento com campanha **só pode acontecer no PostHog**. O banco não guarda
origem, UTM nem referência de entrada — é decisão registrada em
`docs/crm-socios.md` e trancada por teste do CRM —, então a resposta precisa
viajar para lá como propriedade de pessoa além de ficar gravada aqui.

⚠️ **Essa metade ainda não existe.** O ticket #523 entregou a pesquisa
funcionando e sem nenhuma telemetria; os três eventos e a propriedade de pessoa
são o ticket #524. Até ele entrar, a resposta está gravada e não é medida — e a
defesa contra o risco aceito acima, que depende dos eventos, não está de pé.

**Quem acabou de chegar** é quem se cadastrou nas últimas 24 horas. A alternativa
era uma data fixa de lançamento, rejeitada porque envelhece: quem esquecesse de
trocá-la deixaria todo mundo com o texto de quem já está dentro, ou pior, todo
mundo com o de quem acabou de chegar.

E a pesquisa passa a ter **prioridade sobre todo tour**. O bloqueio mora dentro
do hook de tour, num lugar só, porque espalhá-lo pelos dezessete pontos de
chamada garantiria uma décima oitava tela esquecida. Quem responde vê o tour em
seguida; **quem pula também vê** — o tour não pode ficar refém de uma resposta
que talvez nunca venha.
