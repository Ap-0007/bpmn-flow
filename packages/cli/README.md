# @bpmn-flow/cli

BPMN 2.0 no terminal: validar, inspecionar e executar um diagrama sem escrever
código.

## Instalação

```bash
npm install -g @bpmn-flow/cli
```

> Ainda não publicado no npm. Neste repositório: `node packages/cli/dist/bin.js`.

## Comandos

```bash
bpmn-flow validate processo.bpmn   # erros e avisos de estrutura; sai 1 se inválido
bpmn-flow inspect  processo.bpmn   # nós por tipo, raias, multi-instância, timers
bpmn-flow run      processo.bpmn   # executa e diz onde parou
```

### `run`

| Opção            | Efeito                                                       |
| ---------------- | ------------------------------------------------------------ |
| `--vars <json>`  | Variáveis iniciais, por exemplo `'{"valor":2500}'`.          |
| `--mode <modo>`  | `automation` (padrão, pausa em tarefa de usuário) ou `auto`. |
| `--save <file>`  | Grava o estado da execução quando ela pausa.                 |
| `--state <file>` | Continua a execução gravada por `--save`.                    |

```bash
$ bpmn-flow run bpmn-files/processo-compras.bpmn --vars '{"valor":2500,"aprovado":true}'
status: waiting
path:   StartEvent_1
vars:   {"valor":2500,"aprovado":true}
pending:
  [t1] Preencher Formulário (userTask)
```

Quando uma atividade falha e o motor está configurado para segurar incidentes,
`run` também lista os incidentes abertos com a mensagem e o número de
tentativas.

Sai com código 1 quando a execução falha, o que serve de porta de qualidade em
CI para diagramas versionados.

## Licença

MIT.
