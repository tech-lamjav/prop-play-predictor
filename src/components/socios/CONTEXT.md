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
Um registro livre na linha do tempo de uma pessoa. Tem três tipos: anotação,
feedback e objeção. Feedback não é uma tela separada, é um tipo de anotação.
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
