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
Onde o lead está no funil de abordagem. São seis, nesta ordem: novo, contatado,
conversando, proposta, assinou, sem resposta. "Sem resposta" é o fim da linha,
não um degrau anterior a "assinou".
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
A tela de uma pessoa: contatos, plano, acessos, gancho, etapa e linha do tempo.
_Avoid_: Perfil, detalhe, página do usuário
