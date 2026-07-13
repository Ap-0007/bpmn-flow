# @bpmn-flow/core

Parser BPMN 2.0 e motor de execucao por tokens. Isomorfico (Node e navegador),
sem dependencias de UI.

## Instalacao

```bash
npm install @bpmn-flow/core
```

## API

### `parseBpmn(xml): Promise<BpmnModel>`

Converte XML BPMN 2.0 em um modelo normalizado e serializavel. Reconhece todos
os tipos de no (eventos e suas definicoes, tarefas, gateways e subprocessos),
fluxos de sequencia com condicoes e colaboracao. A interchange de diagrama (DI)
e ignorada; o `@bpmn-flow/viewer` renderiza a partir do XML.

Lanca `BpmnParseError` para XML invalido ou sem processo.

### `new WorkflowEngine(process, options?)`

Executa um `ProcessModel` movimentando tokens pelo grafo.

Opcoes:

- `mode`: `"automation"` (padrao) pausa em tarefas de usuario/captura;
  `"auto"` resolve todas as esperas para simular uma execucao completa.
- `variables`: variaveis iniciais do processo.
- `maxSteps`: limite de transicoes (protecao contra loops infinitos).

Metodos:

- `registerHandler(selector, handler)`: registra automacao por id do no, tipo
  de elemento ou `*`.
- `start(): Promise<ExecutionSnapshot>`: inicia e roda ate concluir ou bloquear.
- `completeTask(tokenId, output?)`: conclui uma tarefa parada e prossegue.
- `signal(nameOrId, output?)`: entrega um gatilho (catch event, gateway baseado
  em evento ou boundary event).
- `on(event, listener)`: observa `node.enter`, `node.leave`, `activity.start`,
  `activity.end`, `flow.take`, `wait`, `process.start`, `process.end`, `error`.
- `snapshot()`: estado atual (status, variaveis, tokens, nos concluidos,
  historico).

### Handlers

```ts
import { BpmnError } from '@bpmn-flow/core';

engine.registerHandler('serviceTask', async (ctx) => {
  ctx.set('resultado', await fazerTrabalho(ctx.get('entrada')));
  return { concluido: true };
});
```

Retornar um objeto mescla valores nas variaveis. Lancar `BpmnError(code)`
dispara um error boundary event correspondente.

## Padroes suportados

Eventos (start/end/intermediate/boundary), definicoes message/timer/error/
signal/escalation, todas as tarefas, subprocessos, call activities e gateways
exclusivo/paralelo/inclusivo/baseado em evento/complexo. Detalhes no
[README raiz](../../README.md#padroes-bpmn-suportados).

## Licenca

MIT.
