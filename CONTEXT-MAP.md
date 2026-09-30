# Mapa de contextos

O repositório tem mais de um vocabulário, e eles não se misturam. Uma palavra só
significa a mesma coisa dentro do seu contexto.

| Contexto | Glossário | Do que fala |
|---|---|---|
| Futebol — leitura de mercados | `CONTEXT.md` | Como linhas analisadas e preços viram oportunidades publicadas. |
| CRM dos sócios | `src/components/socios/CONTEXT.md` | Como um cadastro vira lead abordado, e o que os sócios registram sobre ele. |
| A pessoa — declarado e observado | `src/components/perfil/CONTEXT.md` | Quem é a pessoa, de onde ela acessa, e o que a plataforma decide sobre isso. |

Um aviso que vale para todos: **oportunidade** é palavra do futebol e não tem
sentido comercial nenhum. No CRM, quem está por abordar é **lead**.

E um que vale para os dois últimos: **origem** fala de onde a pessoa acessa, e
nunca de onde o cadastro veio. Campanha, indicação e canal de entrada são
assunto do CRM, e lá a palavra é **atribuição**.

A área de sócios abriga os dois contextos, um em cada andar: o CRM em
`/socios/crm` e o **placar da metodologia** em `/socios/metodologia`. Estar na
mesma área não junta os vocabulários — o placar fala futebol, e **sócio** é a
única palavra que os dois compartilham. Ela está definida no glossário do CRM.
