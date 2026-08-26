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
O momento em que uma oportunidade passa a estar disponível no painel para o usuário. Não significa envio de notificação.
_Avoid_: Alerta, envio, publicação no Telegram

**Disponível desde**:
O início do período contínuo atual de publicação de uma oportunidade. Se ela deixa de ser oportunidade e depois volta, o horário reinicia na reativação.
_Avoid_: Primeira aparição histórica, última atualização da odd

**Odd de referência**:
A odd efetivamente coletada que ocupa a posição central entre as cotações de uma candidata que não virou oportunidade. Representa o mercado sem inventar uma cotação intermediária.
_Avoid_: Melhor odd, odd da oportunidade
