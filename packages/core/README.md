# @bpmn-flow/core

Parser BPMN 2.0 e motor de execução por tokens. Isomórfico (Node e navegador),
sem dependências de UI.

## Instalação

```bash
npm install @bpmn-flow/core
```

> Ainda não publicado no npm. Para usar hoje: `npm install github:Bappoz/bpmn-flow`.

## API

### `parseBpmn(xml): Promise<BpmnModel>`

Converte XML BPMN 2.0 em um modelo normalizado e serializável. Reconhece todos
os tipos de nó (eventos e suas definições, tarefas, gateways e subprocessos),
fluxos de sequência com condições e colaboração. A interchange de diagrama (DI)
é ignorada; o `@bpmn-flow/viewer` renderiza a partir do XML.

Lança `BpmnParseError` para XML inválido ou sem processo.

### `validateBpmn(xml): Promise<ValidationResult>`

Valida a estrutura do diagrama (processo sem evento de início ou de fim, nós
desconectados, fluxos órfãos) e devolve erros e avisos.

### `new WorkflowEngine(process, options?)`

Executa um `ProcessModel` movimentando tokens pelo grafo.

Opções:

- `mode`: `"automation"` (padrão) pausa em tarefas de usuário/captura;
  `"auto"` resolve todas as esperas para simular uma execução completa.
- `processes`: demais processos do arquivo, para `callActivity` executar o
  processo referenciado (normalmente `model.processes`).
- `onHandlerError`: `"fail"` (padrão) derruba a execução; `"incident"` segura o
  token para alguém retomar.
- `retry`: `{ attempts, delay? }` — tentativas automáticas antes do incidente.
- `now`: relógio usado para agendar timers (padrão `Date.now`); injete um falso
  para testar sem esperar.
- `variables`: variáveis iniciais do processo.
- `maxSteps`: limite de transições (proteção contra loops infinitos).

Métodos:

- `registerHandler(selector, handler)`: registra automação por id do nó, tipo
  de elemento ou `*`.
- `start(): Promise<ExecutionSnapshot>`: inicia e roda até concluir ou bloquear.
- `completeTask(tokenId, output?)`: conclui uma tarefa parada e prossegue.
- `signal(nameOrId, output?)`: entrega um gatilho (catch event, gateway baseado
  em evento ou boundary event).
- `on(event, listener)`: observa `node.enter`, `node.leave`, `activity.start`,
  `activity.end`, `flow.take`, `wait`, `process.start`, `process.end`, `error`.
- `snapshot()`: estado atual (status, variáveis, tokens, nós concluídos,
  histórico) — read model para UI.
- `getState()`: estado completo e serializável da execução, incluindo buffers de
  junção, escopos e eventos armados.
- `resume()`: continua uma execução restaurada até concluir ou bloquear.
- `tasks(filter?)`: trabalho pendente (tarefa de usuário, receive task, evento
  de captura, incidente) com raia, papéis e variáveis visíveis; filtra por
  `role`, `reason` e `nodeId`.
- `incidentList()`: atividades cujo handler falhou, com mensagem e tentativas.
- `retryTask(tokenId)` / `resolveIncident(tokenId, output?)`: roda de novo ou
  segue em frente.
- `metrics()`: tempo total/médio/máximo por atividade, do mais lento para o mais
  rápido.
- `tick(now?)`: dispara os timers vencidos e continua a execução.
- `dueTimers()` / `nextTimerAt()`: timers pendentes e o próximo vencimento.

### `WorkflowEngine.restore(process, state, options?)`

Reconstrói um motor a partir de um `EngineState` produzido por `getState()`,
para retomar depois de um restart. O modelo do processo precisa ser o mesmo;
handlers e listeners não são serializados e devem ser registrados de novo.

```ts
const state = engine.getState();
const retomado = WorkflowEngine.restore(process, JSON.parse(JSON.stringify(state)));
```

### Repetição e escopo de variáveis

Uma atividade com `multiInstanceLoopCharacteristics` ou
`standardLoopCharacteristics` é expandida em instâncias pelo motor. Cada
instância roda num escopo próprio com `loopCounter` e o item da coleção, e a
coleção de saída é montada a partir da variável de saída de cada instância.

```ts
engine.registerHandler('SepararItem', (ctx) => ({
  separado: `${ctx.get('item')} separado`,
}));
```

No `HandlerContext`, `set()` escreve onde a variável já existe (caindo no escopo
do processo) e `setLocal()` mantém o valor apenas no escopo atual.

### Handlers

```ts
import { BpmnError } from '@bpmn-flow/core';

engine.registerHandler('serviceTask', async (ctx) => {
  ctx.set('resultado', await fazerTrabalho(ctx.get('entrada')));
  return { concluido: true };
});
```

Retornar um objeto mescla valores nas variáveis. Lançar `BpmnError(code)`
dispara um error boundary event correspondente.

## Padrões suportados

Eventos (start/end/intermediate/boundary), definições message/timer/error/
signal/escalation, todas as tarefas, subprocessos, call activities e gateways
exclusivo/paralelo/inclusivo/baseado em evento/complexo. A semântica de cada um
e as divergências assumidas estão em
[`docs/BPMN-STANDARD.md`](../../docs/BPMN-STANDARD.md).

## Licença

MIT.
