# Mapa de contextos

O repositório tem mais de um vocabulário, e eles não se misturam. Uma palavra só
significa a mesma coisa dentro do seu contexto.

| Contexto | Glossário | Do que fala |
|---|---|---|
| Futebol — leitura de mercados | `CONTEXT.md` | Como linhas analisadas e preços viram oportunidades publicadas. |
| CRM dos sócios | `src/components/socios/CONTEXT.md` | Como um cadastro vira lead abordado, e o que os sócios registram sobre ele. |
| Bolão | `src/components/bolao/CONTEXT.md` | Grupo apostando palpites numa competição, com prazo, pontuação e ranking. |
| NBA — oportunidades e análise | `src/components/nba/CONTEXT.md` | Como um desfalque abre janela na linha de um jogador. |

Um aviso que vale para todos: **oportunidade** é palavra do futebol e não tem
sentido comercial nenhum. No CRM, quem está por abordar é **lead**.

A área de sócios abriga os dois contextos, um em cada andar: o CRM em
`/socios/crm` e o **placar da metodologia** em `/socios/metodologia`. Estar na
mesma área não junta os vocabulários — o placar fala futebol, e **sócio** é a
única palavra que os dois compartilham. Ela está definida no glossário do CRM.

⚠️ **"Oportunidade" colide entre o futebol e a NBA**, e é a colisão mais fácil de
cometer: no futebol ela nasce de preço contra linha analisada, e na NBA nasce de
um GATILHO, que é o titular desfalcado. No bolão a palavra não existe — lá o que
a pessoa registra é **palpite**.
