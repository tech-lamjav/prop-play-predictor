# Documentação de domínio

Como as skills de engenharia devem consumir a documentação de domínio deste
repositório ao explorar o código.

## Antes de explorar, leia

- **`CONTEXT-MAP.md`** na raiz: ele aponta para um `CONTEXT.md` por contexto. Leia cada um que for relevante ao assunto.
- **`docs/adr/`**: leia as ADRs que tocam a área onde você vai mexer.

Se algum desses arquivos não existir, **siga em silêncio**. Não sinalize a
ausência e não sugira criá-los de antemão. O `/domain-modeling` (alcançado pelo
`/grill-with-docs` e pelo `/improve-codebase-architecture`) cria cada um na hora
em que um termo ou uma decisão de fato se resolve.

## Estrutura real deste repositório

Multi-contexto, com os glossários fora de uma pasta por contexto — eles moram
junto do código de que falam:

```
/
├── CONTEXT-MAP.md                          ← o mapa: qual contexto mora onde
├── CONTEXT.md                              ← glossário: futebol, leitura de mercados
├── docs/adr/                               ← decisões, de todos os contextos
│   ├── 0001-o-crm-desce-um-andar.md
│   ├── 0002-liquidacao-continua-conta-de-tela.md
│   ├── 0003-o-placar-mede-a-foto-de-nascimento.md
│   └── 0004-o-crm-registra-o-dinheiro-do-stripe.md
└── src/
    └── components/socios/
        └── CONTEXT.md                      ← glossário: CRM dos sócios
```

⚠️ As ADRs são todas em `docs/adr/`, e não há `docs/adr/` por contexto. Uma ADR
de um contexto só mora lá junto com as dos outros — o número é sequencial no
repositório inteiro.

## Use o vocabulário do glossário

Quando a sua saída nomear um conceito de domínio (título de issue, proposta de
refatoração, hipótese, nome de teste), use o termo como o `CONTEXT.md` daquele
contexto define. Não escorregue para sinônimos que o glossário manda evitar — a
linha `_Avoid_` de cada entrada existe para isso.

⚠️ Uma palavra só significa a mesma coisa dentro do seu contexto. O mapa avisa,
por exemplo, que **oportunidade** é palavra do futebol e não tem sentido
comercial: no CRM, quem está por abordar é **lead**.

Se o conceito que você precisa ainda não está no glossário, isso é um sinal: ou
você está inventando linguagem que o projeto não usa (reconsidere), ou há uma
lacuna de verdade (anote para o `/domain-modeling`).

## Sinalize conflito com ADR

Se a sua saída contradiz uma ADR existente, diga isso em vez de atropelar em
silêncio:

> _Contradiz a ADR-0004 (o CRM registra o dinheiro do Stripe), mas vale reabrir
> porque…_
