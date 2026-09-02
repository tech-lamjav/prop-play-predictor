# Futebol — leitura de mercados

Este contexto descreve como o produto transforma linhas de aposta analisadas e preços coletados em oportunidades publicadas.

## Language

**Linha analisada**:
Uma linha para a qual o modelo calcula premissas, mesmo quando nenhuma casa ofereceu cotação.
_Avoid_: Linha disponível, mercado aberto

**Linha cotada**:
Uma linha analisada que teve ao menos uma odd coletada.
_Avoid_: Linha com preço disponível, oportunidade

**Candidata**:
Uma linha cotada que foi avaliada pelo funil, independentemente de ter sido aprovada ou rejeitada.
_Avoid_: Oportunidade rejeitada, aposta possível

**Oportunidade**:
Uma candidata aprovada pelas regras de publicação vigentes.
_Avoid_: Candidata, linha cotada

**Publicação no painel**:
O momento em que uma oportunidade passa a estar disponível no painel para o usuário. Não significa envio de notificação, e não garante exibição: uma oportunidade de mercado fora da **vitrine** é publicada e não aparece.
_Avoid_: Alerta, envio, publicação no Telegram

**Motivo**:
Uma premissa que o backend agrupou como **A favor** ou **Contra** de uma saída publicada. O agrupamento é decisão do backend; a tela só traduz o slug para texto. Não existe motivo que a tela conclua sozinha.
_Avoid_: Razão, justificativa

**Porquê**:
O mesmo que **motivo a favor** — é o nome que a tela usa quando mostra só o lado positivo.
_Avoid_: Tratar como conceito separado de motivo

**O que o jogo mostra**:
As premissas acesas de uma **linha analisada** sem preço. Não é motivo, porque sem preço não há aposta a favor de quê. Tem nome próprio na tela justamente para não ser lido como razão de apostar.
_Avoid_: Motivo, porquê

**Evidência**:
O número que embasa uma premissa: a média, o histórico, o placar que sustenta a frase. Ela acompanha a premissa e não a substitui — sem evidência a premissa continua verdadeira, só fica sem lastro na tela.
_Avoid_: Motivo, prova, justificativa

**Board**:
O conjunto do que o backend publica — tudo que passou nas portas de qualidade de dado, gravado no funil e no histórico. É o universo, não o que está na tela.
_Avoid_: Painel, vitrine, lista

**Vitrine**:
O recorte do board que o assinante de fato vê, no painel e nas DMs. Um mercado pode sair da vitrine sem sair do board: ele continua publicado e medido, e só deixa de ser exibido e alertado. A lista mora no banco (`futebol_mercados_ocultos`), não em código, porque devolver um mercado à tela é um UPDATE e não um release.
_Avoid_: Gate, porta, filtro de faixa

**Mercado oculto**:
Mercado retirado da vitrine por decisão de produto, com data e motivo registrados. Não é porta de publicação: nada muda no gate, no mart nem nas RPCs. O histórico de dias passados continua mostrando o mercado, porque é registro do que foi publicado e visto.
_Avoid_: Mercado desativado, mercado removido

**Alerta de publicação**:
O aviso enviado no Telegram quando uma oportunidade é publicada no painel, para que o usuário possa vê-la antes do jogo.
_Avoid_: Oportunidade, publicação no painel

**Status de alertas**:
O estado persistente de alertas de publicação de quem já conectou o Telegram: ativo ou pausado. É uma informação discreta com acesso a gerenciamento, não um convite.
_Avoid_: CTA de conexão, aviso importante

**Convite de conexão**:
A chamada para quem ainda não conectou o Telegram, explicando que a conexão permite receber alertas de publicação. É uma ação de entrada, não um status.
_Avoid_: Status de alertas

**Disponível desde**:
O início do período contínuo atual de publicação de uma oportunidade. Se ela deixa de ser oportunidade e depois volta, o horário reinicia na reativação.
_Avoid_: Primeira aparição histórica, última atualização da odd

**Odd de referência**:
A odd efetivamente coletada que ocupa a posição central entre as cotações de uma candidata que não virou oportunidade. Representa o mercado sem inventar uma cotação intermediária.
_Avoid_: Melhor odd, odd da oportunidade
