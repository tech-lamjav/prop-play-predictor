# Rótulos de triagem

As skills falam em cinco papéis canônicos de triagem. Esta tabela liga cada
papel ao nome de rótulo realmente usado no rastreador deste repositório.

| Rótulo nas skills  | Rótulo no nosso rastreador | Significado                                    |
| ------------------ | -------------------------- | ---------------------------------------------- |
| `needs-triage`     | `needs-triage`             | Precisa de avaliação de quem mantém            |
| `needs-info`       | `needs-info`               | Esperando mais informação de quem relatou      |
| `ready-for-agent`  | `ready-for-agent`          | Totalmente especificada, pronta para um agente |
| `ready-for-human`  | `ready-for-human`          | Precisa de implementação humana                |
| `wontfix`          | `wontfix`                  | Não será tratada                               |

Quando uma skill citar um papel (por exemplo "aplique o rótulo de pronto para
agente"), use o nome da coluna da direita.

Edite a coluna da direita se um dia o vocabulário mudar.

## O que já existe no GitHub

Conferido em 16/09/2026 com `gh label list`. Dois dos cinco já estão lá:

- `wontfix` — padrão do GitHub, descrição "This will not be worked on".
- `ready-for-agent` — já criado por alguém, descrição "Spec pronta para um agente implementar". Alguém já trabalhou com esse vocabulário antes desta configuração existir.

⚠️ Faltam três: `needs-triage`, `needs-info` e `ready-for-human`. Quem for
aplicar um deles primeiro precisa criá-lo antes, com
`gh label create <nome> --description "..."`. Aplicar rótulo inexistente
falha — não cria sozinho.
