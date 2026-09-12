# O CRM desce um andar e /socios vira casca

A área de sócios nasceu como uma tela só — a lista de leads na raiz `/socios`, com
`/socios/assinaturas`, `/socios/feedbacks` ao lado e `/socios/:id` abrindo a ficha
do lead em modal. Ao acrescentar o **placar da metodologia**, escolhemos descer o
CRM inteiro para `/socios/crm` e deixar `/socios` como a casca que decide para
onde mandar, em vez de pendurar uma quarta aba na barra do CRM.

Duas razões. A primeira é de vocabulário: o mapa de contextos deste repositório
diz que os dois vocabulários não se misturam, e uma barra única com "Leads" ao
lado de "Oportunidades" é exatamente o convite para a confusão que o mapa foi
escrito para evitar. A segunda é a ficha do lead: enquanto ela mora em
`/socios/:id`, esse segmento é um coringa, e toda tela nova criada em sócios
precisa ser declarada antes dele — uma armadilha que cresce a cada tela. Descer
um andar tira o coringa da raiz de uma vez.

## Consequências

O endereço antigo não morre: `/socios` redireciona para `/socios/crm`, e
`/socios/:id` redireciona para `/socios/crm/:id` enquanto os links salvos
circularem. Os testes que escrevem o caminho na mão e as guardas estruturais da
rota do CRM passam a valer sobre o endereço novo.
