# Futebol — leitura de mercados

Este contexto descreve como o produto transforma linhas de aposta analisadas e preços coletados em oportunidades publicadas.

## Language

**Linha analisada**:
Uma linha para a qual o modelo calcula premissas, mesmo quando nenhuma casa ofereceu cotação.
_Avoid_: Linha disponível, mercado aberto
_ES_: **Línea analizada**

**Linha cotada**:
Uma linha analisada que teve ao menos uma odd coletada.
_Avoid_: Linha com preço disponível, oportunidade
_ES_: **Línea cotizada**

**Candidata**:
Uma linha cotada que foi avaliada pelo funil, independentemente de ter sido aprovada ou rejeitada.
_Avoid_: Oportunidade rejeitada, aposta possível
_ES_: **Candidata**

**Oportunidade**:
Uma candidata aprovada pelas regras de publicação vigentes.
_Avoid_: Candidata, linha cotada
_ES_: **Oportunidad**

**Publicação no painel**:
O momento em que uma oportunidade passa a estar disponível no painel para o usuário. Não significa envio de notificação, e não garante exibição: uma oportunidade de mercado fora da **vitrine** é publicada e não aparece.
_Avoid_: Alerta, envio, publicação no Telegram
_ES_: **Publicación en el panel**

**Motivo**:
Uma premissa que o backend agrupou de um lado de uma saída publicada. O agrupamento é decisão do backend; a tela só traduz o slug para texto. Não existe motivo que a tela conclua sozinha.
_Avoid_: Razão, justificativa
_ES_: **Motivo**

**Contra**:
Uma **premissa do próprio lado da saída que não atingiu o corte**. Não é evidência apontando para o lado oposto: o modelo só sabe dizer "acendeu" e "não acendeu", e o segundo grupo é a ausência, não a oposição. Numa saída de Menos de 3,25 gols, uma premissa "contra" continua sendo uma premissa de Under.
_Avoid_: Evidência contrária, sinal para o outro lado, argumento contra a aposta
_ES_: **En contra**

**Porquê**:
O mesmo que **motivo a favor** — é o nome que a tela usa quando mostra só o lado positivo.
_Avoid_: Tratar como conceito separado de motivo
_ES_: **Porqué**

**O que o jogo mostra**:
As premissas acesas de uma **linha analisada** sem preço. Não é motivo, porque sem preço não há aposta a favor de quê. Tem nome próprio na tela justamente para não ser lido como razão de apostar.
_Avoid_: Motivo, porquê
_ES_: **Lo que muestra el partido**

**Evidência**:
O **insumo** de uma premissa, mostrado na tela. Ela acompanha a premissa e não a substitui — sem evidência a premissa continua verdadeira, só fica sem lastro na tela. Um número verdadeiro e relacionado que **não** seja o insumo não é evidência daquela premissa: ele ilustra sem explicar, e faz a tela discordar de si mesma.
_Avoid_: Motivo, prova, justificativa, qualquer número "que combina" com a frase
_ES_: **Evidencia**

**Critério**:
A comparação que decide se uma premissa acende: um **insumo**, um **corte** e um sentido. É definição do modelo, não da tela.
_Avoid_: Regra, fórmula, condição
_ES_: **Criterio**

**Insumo**:
O número que o **critério** compara. Média de gols sofridos somados, percentual de jogos sem sofrer gol de cada time, contagem de jogos abaixo da linha — cada premissa tem o seu, e ele é medido na **janela da premissa**.
_Avoid_: Evidência (é o insumo já na tela), estatística, dado
_ES_: **Insumo**

**Corte**:
O limiar contra o qual o **insumo** é comparado. Pode ser um número fixo, ou derivado da linha com uma margem — e nesse caso o corte **não** é a linha.
_Avoid_: Linha, limite, threshold
_ES_: **Corte**

**Linha de referência**:
O limiar que a aba de Estatísticas desenha sobre o jogo a jogo, e que quem olha arrasta. Serve para uma coisa só: repintar as barras. Não é **corte**, que é do modelo e decide se uma premissa acende; não é **linha cotada**, porque não vem de preço e nenhuma casa precisa oferecê-la; e não é **odd de referência**. Nada é liquidado contra ela, e mexer nela não muda valor nenhum — só a cor.
_Avoid_: Corte, linha, linha da aposta, odd de referência
_ES_: **Línea de referencia**

**Janela da premissa**:
O conjunto de partidas sobre o qual o **insumo** é medido: os últimos jogos do time em qualquer competição, contados antes do apito da partida analisada. Não é a temporada e não é uma competição só. O tamanho é da premissa — dez na maioria, cinco nas de contagem —, e algumas recortam por mando porque o mando é parte do **critério** delas. Recorte de mando embaixo de um critério que não olha mando é o gráfico desmentindo o número que ele deveria explicar.
_Avoid_: Temporada, forma recente, últimos jogos no campeonato
_ES_: **Ventana de la premisa**

**Confronto direto**:
Os jogos anteriores entre os dois times desta partida. Não é **janela da premissa** e não é **insumo** de premissa nenhuma: a janela são os últimos jogos de um time contra quem apareceu pela frente, e o confronto direto é uma série curta, espalhada por anos, às vezes com elenco e treinador trocados. Aparece na tela como contexto, sempre com o número de encontros à vista, e nunca como **evidência**.
_Avoid_: Histórico, retrospecto, forma recente, evidência
_ES_: **Historial (título) · Enfrentamientos directos (forma longa)**

**Estatística da partida**:
O que aconteceu em campo num jogo encerrado: finalizações, escanteios, posse, cartões, gols esperados. É **fato público de futebol**, e por isso pode ser mostrada a quem não assina. Não é **insumo**: só é insumo a estatística que algum **critério** compara contra um **corte**. Desenhá-la embaixo de uma premissa, como se explicasse o número dela, é fingir auditoria — foi exatamente por isso que a consulta do histórico por jogo deixou finalização, escanteio e posse de fora, de propósito (migration 095).
_Avoid_: Insumo, evidência, dado do modelo, estatística do modelo
_ES_: **Estadística del partido**

**Premissa acesa**:
Uma premissa cujo **insumo** cruzou o **corte**. É o que a tela conta em "3 premissas a favor".
_Avoid_: Premissa verdadeira, premissa ativa
_ES_: **Premisa encendida**

**Não atingiu o corte**:
Uma premissa avaliada, com **insumo** disponível, cujo número ficou aquém do **corte**. É diferente de não ter dado para avaliar, e diferente de não se aplicar àquele lado.
_Avoid_: Não aconteceu, premissa falsa, premissa contra
_ES_: **No alcanzó el corte**

**Board**:
O conjunto do que o backend publica — tudo que passou nas portas de qualidade de dado, gravado no funil e no histórico. É o universo, não o que está na tela.
_Avoid_: Painel, vitrine, lista
_ES_: **Board**

**Vitrine**:
O recorte do board que o assinante de fato vê, no painel e nas DMs. Um mercado pode sair da vitrine sem sair do board: ele continua publicado e medido, e só deixa de ser exibido e alertado. A lista mora no banco (`futebol_mercados_ocultos`), não em código, porque devolver um mercado à tela é um UPDATE e não um release.
_Avoid_: Gate, porta, filtro de faixa
_ES_: **Vitrina**

**Mercado oculto**:
Mercado retirado da vitrine por decisão de produto, com data e motivo registrados. Não é porta de publicação: nada muda no gate, no mart nem nas RPCs. O histórico de dias passados continua mostrando o mercado, porque é registro do que foi publicado e visto.
_Avoid_: Mercado desativado, mercado removido
_ES_: **Mercado oculto**

**Alerta de publicação**:
O aviso enviado no Telegram quando uma oportunidade é publicada no painel, para que o usuário possa vê-la antes do jogo.
_Avoid_: Oportunidade, publicação no painel
_ES_: **Alerta de publicación**

**Portão de acesso**:
A checagem única, no banco, de se quem chamou tem acesso vigente ao futebol — assinante ou teste correndo. Vive em `futebol_acesso_do_chamador()` e é chamada por toda RPC que devolve saída do modelo. Não confundir com **porta de publicação** (Mercado oculto) nem com as **portas** de qualidade de dado: aquelas decidem se uma linha *nasce*, esta decide se *sai* para quem pediu.
_Avoid_: Gate, porta de acesso, trava
_ES_: **Portón de acceso**

**Linha bloqueada**:
A linha que chegou ao navegador com a saída do modelo anulada pelo portão — mercado, aposta, odd, chance, valor e Score vêm nulos, e jogo, horário e times vêm preenchidos. Não é erro nem lista vazia: é a forma que a oportunidade tem para quem não assina.
_Avoid_: Linha borrada, linha travada, linha vazia
_ES_: **Línea bloqueada**

**Valor fechado**:
O estado da tela quando há oportunidade no jogo e a leitura não pode ser mostrada. A tela diz que existe e quantas são; não diz qual nem a que preço.
_Avoid_: Sem valor, bloqueado, indisponível
_ES_: **Valor cerrado**

**Fato público de futebol**:
O que qualquer site entrega de graça: quem joga contra quem, quando, em que competição e como terminou. É a régua que decide se uma RPC fica aberta — fechá-la não protege receita e esvazia a página de quem ainda não assinou.
_Avoid_: Dado aberto, dado grátis
_ES_: **Hecho público del fútbol**

**Status de alertas**:
O estado persistente de alertas de publicação de quem já conectou o Telegram: ativo ou pausado. É uma informação discreta com acesso a gerenciamento, não um convite.
_Avoid_: CTA de conexão, aviso importante
_ES_: **Estado de alertas**

**Convite de conexão**:
A chamada para quem ainda não conectou o Telegram, explicando que a conexão permite receber alertas de publicação. É uma ação de entrada, não um status.
_Avoid_: Status de alertas
_ES_: **Invitación a conectar**

**Disponível desde**:
O início do período contínuo atual de publicação de uma oportunidade. Se ela deixa de ser oportunidade e depois volta, o horário reinicia na reativação.
_Avoid_: Primeira aparição histórica, última atualização da odd
_ES_: **Disponible desde**

**Odd de referência**:
A odd efetivamente coletada que ocupa a posição central entre as cotações de uma candidata que não virou oportunidade. Representa o mercado sem inventar uma cotação intermediária.
_Avoid_: Melhor odd, odd da oportunidade
_ES_: **Cuota de referencia**

### O placar da metodologia

**Placar da metodologia**:
O acompanhamento do resultado das oportunidades já publicadas, feito para os
sócios decidirem se o peso de uma premissa está bom, se a premissa faz sentido e
se falta premissa. Julga o método, não o apostador — a **performance semanal** é
do caderno de apostas do assinante e não tem relação com isto.
_Avoid_: Painel de performance, dashboard, ROI da banca, performance semanal
_ES_: **Marcador de la metodología**

**Unidade**:
A aposta com que o placar MEDE: toda oportunidade publicada vale uma, sempre a
mesma. É a medida da metodologia, e não depende de valor nem de nota, porque
tamanho de aposta é outra pergunta e misturar as duas faz o número responder as
duas pela metade.
_Avoid_: Stake, entrada, aposta do usuário, banca
_ES_: **Unidad**

**Simulação**:
A leitura do placar com um número de unidades diferente por faixa de Score — por
exemplo nenhuma na Baixa e meia na Média. Responde "como teria ido apostando
assim", e nunca é a medida da metodologia: quando ela está ligada, a tela diz.
_Avoid_: Stake, gestão de banca, placar real
_ES_: **Simulación**

**Foto de nascimento**:
A primeira versão **visível** de uma oportunidade no histórico — a odd, a nota e
a faixa com que ela apareceu para o assinante. É o que o placar mede, porque é
sobre essa régua que a decisão foi tomada. Diferente do estado dela no apito,
que é o que o assinante viu por último.

"Visível" é o que a separa do primeiro registro do snapshot, e os dois não são a
mesma coisa: o snapshot grava o **board**, que é o universo e inclui mercado
fora da **vitrine** e linha abaixo do limiar de valor. Uma oportunidade pode
existir no snapshot dias antes de ter aparecido para alguém, e aí a foto de
nascimento é a da estreia na tela, não a do registro mais antigo.

Nunca tendo aparecido, ela **não tem** foto de nascimento — e as duas telas
tratam isso de formas diferentes, de propósito. Nas telas do assinante a linha
some, porque ali a pergunta é "isto é uma aposta". No **placar da metodologia**
ela fica, com o preço do registro mais antigo, porque ali a pergunta é "como vai
o método" — e o placar mostra o board inteiro, mercado oculto incluído, já que é
com ele que se decide devolver um mercado à vitrine.
_Avoid_: PIT, snapshot, primeiro registro do histórico, estado no apito, última odd
_ES_: **Foto de nacimiento**

**Liquidado**:
A oportunidade cujo jogo terminou e recebeu veredito pela regra de liquidação:
green, meio green, anulada, meio red ou red. Enquanto o jogo não termina ela é
**pendente**, e pendente nunca entra em conta nenhuma.
_Avoid_: Resultado, fechado, settled, apurado
_ES_: **Liquidado**

**Quebra**:
A dimensão pela qual o placar agrupa as oportunidades liquidadas: mercado, faixa
de Score, faixa de odd e campeonato. Nunca chame isso de **corte**: corte é o
limiar de uma premissa, e a palavra já está ocupada.
_Avoid_: Corte, recorte, dimensão, filtro
_ES_: **Desglose**

**Taxa de acerto**:
Quantas oportunidades bateram, sobre as liquidadas que valeram aposta. Anulada
sai do denominador, porque ninguém ganha nem perde nela.
_Avoid_: Win rate, aproveitamento, assertividade
_ES_: **Tasa de acierto**

**ROI**:
O lucro somado em **unidades** dividido pelo número de unidades apostadas.
Anulada fica no denominador com lucro zero, porque a aposta existiu e devolveu o
valor. É por isso que ROI e **taxa de acerto** têm denominadores diferentes.
_Avoid_: Lucro, retorno, rendimento
_ES_: **ROI**

**Série comparável**:
O trecho do histórico em que a nota está na mesma escala. Começa em 04/09/2026,
quando o denominador do Score trocou do p95 para o teto de pontos: linha
anterior a essa data tem Score em outra escala e somar as duas inventa uma série
que nunca existiu.
_Avoid_: Histórico completo, desde o início, base inteira
_ES_: **Serie comparable**

## Vocabulario en español

O par em espanhol de cada verbete está na linha `_ES_` do próprio verbete, ao
lado do termo e do que evitar. Aqui ficam só as decisões que **não** se leem no
dicionário: as que vieram de como o mercado hispano escreve de fato, medidas em
central de ajuda de operador e em imprensa esportiva de Peru, Argentina, México
e Chile.

**A regra geral é o espanhol pan-hispânico.** Onde os quatro países divergem, o
produto escolhe o termo que serve aos quatro, mesmo quando não é o mais
idiomático em nenhum deles. Um vocabulário por país exige saber o país, e
detecção por país está fora do escopo.

**Cuota, e não momio.** "Cuota" é o termo nos quatro países. "Momio" é
dominante no México, mas soa estrangeiro em Lima, Buenos Aires e Santiago — e
as próprias casas mexicanas escrevem "cuota" no texto de regras. Nota para o
dia em que houver vocabulário por país: "momio" nomeia o conceito de cotação e
não o formato dela, então existe "momio decimal" tanto quanto "momio
americano".

**Fecha, e não jornada.** Peru, Argentina e Chile escrevem "fecha"; só o México
escreve "jornada". Três contra um, e a escolha é "Fecha" ciente de que soa
levemente estrangeiro para o mexicano.

**Ambos equipos marcan, e não anotan.** O verbo diverge de verdade: "marcar" no
eixo sul-americano, "anotar" no México e em parte das casas peruanas.

**Local e Visitante, e não localía.** "Localía" é americanismo corrente em
Argentina, Chile e Peru, e raro no México. Os rótulos "Local" e "Visitante"
funcionam nos quatro sem exceção.

**Bankroll, e não banca.** "Banca" em espanhol também designa a CASA de
apostas, e num produto que fala do dinheiro do apostador essa ambiguidade é
cara.

**Não importar green e red.** O par não aparece em nenhum glossário hispano
consultado; o mercado escreve "ganada" e "perdida". _Avoid_: verde, rojo.

**A cotação e a linha usam PONTO, em qualquer país.** Confirmado em fonte de
operador: a central de ajuda da Betano **Argentina** — país que escreve dinheiro
com vírgula — publica "Más 2.5 goles" com ponto. O mesmo vale para linha de
córner, hándicap e métricas como xG e posse. Dinheiro segue o país; cotação
segue o setor. A régua está em `src/utils/formato.ts`.

### O que ficou sem fonte

Sete itens da pesquisa não têm fonte estática e estão decididos por uso, não
por documento. Valem revisão de falante nativo antes do lançamento: os rótulos
de meia ganha e meia perdida; a ausência de green e red; o rótulo de confronto
direto; a distinção entre alineación e formación; o termo de finalizações
(remates, tiros ou disparos); o separador decimal do Peru, onde a norma da RAE
diz vírgula e a prática bancária usa ponto; e a própria convenção do ponto na
cotação, que é consistente em quatro fontes de três países mas por uso, e não
por guia de estilo declarado.
