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
