# A pessoa — o que ela declara e o que a gente observa

Este contexto descreve a **conta**: quem é a pessoa, de onde ela acessa, e o que
a plataforma decide sobre isso. Não fala de leitura de mercados e não fala de
trabalho comercial — para esses, veja o `CONTEXT-MAP.md` na raiz.

## A regra que vale para todos os termos daqui

Duas palavras se repetem, e nunca significam a mesma coisa:

**Declarado** é o que a pessoa disse. **Observado** é o que a plataforma viu.

Eles discordam com frequência, e discordam com razão: alguém viaja, alguém paga
com cartão de outro país, alguém responde uma pesquisa com o que gostaria de
ser. Guardar os dois separados é o que permite **notar** a diferença. Juntar num
campo só é o que a apaga — e apagada, ninguém descobre que ela existia.

## Language

**Origem observada**:
O país deduzido do IP que o nosso servidor viu naquele acesso. Não depende do
que a pessoa informa em lugar nenhum, e é por isso que ela serve de prova.
_Avoid_: localização, país do usuário, geolocalização

**Origem declarada**:
O país que a própria pessoa informou no endereço de cobrança, no checkout. Vem
do Stripe, o que a torna evidência de terceiro — vale mais que um registro que
nós mesmos escrevemos.
_Avoid_: país do usuário, endereço, país de cadastro

**Registro de presença**:
Uma linha por pessoa por dia, com o IP visto, o veredito e o momento. É um
diário de quem apareceu, e **não** um log de tráfego: abrir dez telas no mesmo
dia continua sendo uma linha só. O formato é o da frase que ele precisa
sustentar — "no dia tal, tantas pessoas ativas, e de onde".
_Avoid_: log de acesso, histórico de sessões, auditoria

**Porteiro**:
A decisão de deixar entrar ou barrar, tomada **uma vez por sessão** e do lado do
servidor. É o único lugar que decide: a tela e as regras de acesso do banco
apenas obedecem o que ele gravou, e nunca refazem a conta por conta própria.
Dois juízes de país que podem discordar são piores que nenhum.
_Avoid_: middleware, firewall, bloqueio, geo-block

**Veredito**:
O que o porteiro decidiu naquele acesso: entrou, foi barrado, ou não deu para
saber. "Não deu para saber" **deixa entrar** — e é contado, porque um fail-open
silencioso é como um país bloqueado deixa de ser bloqueado sem ninguém perceber.
_Avoid_: status, permissão, flag

**Perfil declarado**:
O que a pessoa respondeu nas duas perguntas da pesquisa de chegada: o que ela
busca na plataforma e com que frequência aposta. Uma vez na vida, e nunca
deduzido do comportamento — deduzir seria observado, e observado é outra coisa.
_Avoid_: segmento, persona, perfil do usuário

---

**Sócio** é palavra do glossário do CRM, e não se redefine aqui. Neste contexto
ela aparece com um papel só: passe livre do porteiro.
