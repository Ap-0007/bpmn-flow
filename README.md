# BPMN Flow

Biblioteca modular para transformar diagramas BPMN 2.0 em automacao de
processos. Faz o parsing do BPMN para um modelo normalizado, executa o processo
com um motor baseado em tokens e permite visualizar a execucao de forma
interativa no navegador. Cada camada e um pacote independente e reutilizavel em
qualquer projeto.

## Indice

- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Instalacao](#instalacao)
- [Inicio rapido: usar como biblioteca](#inicio-rapido-usar-como-biblioteca)
- [Automacao com handlers](#automacao-com-handlers)
- [Visualizacao interativa](#visualizacao-interativa)
- [Servidor HTTP e API REST](#servidor-http-e-api-rest)
- [Padroes BPMN suportados](#padroes-bpmn-suportados)
- [Desenvolvimento](#desenvolvimento)
- [Estrutura do repositorio](#estrutura-do-repositorio)
- [Licenca](#licenca)

## Arquitetura

O repositorio e um monorepo (npm workspaces) com quatro modulos:

| Pacote                  | Responsabilidade                                                              | Ambiente      |
| ----------------------- | ---------------------------------------------------------------------------- | ------------- |
| `@bpmn-flow/core`       | Parser BPMN 2.0, modelo normalizado e motor de execucao por tokens.          | Node e browser |
| `@bpmn-flow/viewer`     | Renderizacao interativa sobre `bpmn-visualization` com overlays de execucao. | Browser       |
| `@bpmn-flow/server`     | API REST sobre o `core` e host estatico para servir uma UI numa porta.       | Node          |
| `@bpmn-flow/playground` | Aplicacao Vite para carregar, visualizar e executar processos no navegador.  | Browser       |

Fluxo de dados: `XML BPMN -> parseBpmn -> ProcessModel -> WorkflowEngine ->
ExecutionSnapshot -> BpmnFlowViewer`.

O `core` nao depende de nenhuma biblioteca de UI, o que permite executar
processos tanto no backend quanto no frontend com o mesmo codigo.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Instalacao

Para desenvolver neste repositorio:

```bash
npm install
npm run build
```

Para consumir os pacotes em outro projeto (apos publicacao):

```bash
npm install @bpmn-flow/core
npm install @bpmn-flow/viewer   # apenas no frontend
```

## Inicio rapido: usar como biblioteca

```ts
import { parseBpmn, WorkflowEngine } from '@bpmn-flow/core';

const model = await parseBpmn(xml);
const [process] = model.processes;

const engine = new WorkflowEngine(process, {
  variables: { amount: 150 },
});

const snapshot = await engine.start();
console.log(snapshot.status); // "completed" | "waiting" | "terminated" | ...
console.log(snapshot.completedNodes);
console.log(snapshot.variables);
```

Se o processo tiver uma tarefa de usuario ou um evento de captura, a execucao
pausa (`status: "waiting"`) e informa os tokens parados. Retome-a assim:

```ts
const waiting = snapshot.tokens.find((t) => t.waiting);
if (waiting?.waitReason === 'userTask') {
  await engine.completeTask(waiting.id, { approved: true });
} else if (waiting?.waitReason === 'catchEvent') {
  await engine.signal(waiting.nodeId);
}
```

## Automacao com handlers

Um handler executa o trabalho real por tras de uma atividade. Registre-o por id
do elemento, por tipo de elemento ou com o coringa `*`. A resolucao segue da
regra mais especifica para a mais generica.

```ts
engine.registerHandler('serviceTask', async (ctx) => {
  const total = await cobrarCartao(ctx.get('amount'));
  ctx.set('total', total);
  return { pago: true }; // valores retornados sao mesclados nas variaveis
});

engine.registerHandler('reservarEstoque', (ctx) => {
  if (!temEstoque()) throw new BpmnError('SEM_ESTOQUE');
});
```

Lancar `BpmnError` dispara um evento de borda de erro (error boundary event)
correspondente, se existir. Erros comuns falham a execucao.

## Visualizacao interativa

No navegador, combine o motor com o viewer para acompanhar a execucao:

```ts
import { WorkflowEngine } from '@bpmn-flow/core';
import { BpmnFlowViewer } from '@bpmn-flow/viewer';
import '@bpmn-flow/viewer/styles.css';

const viewer = new BpmnFlowViewer({ container: 'diagram' });
viewer.load(xml);

const engine = new WorkflowEngine(process, { mode: 'automation' });
viewer.bindEngine(engine); // anima a execucao ao vivo
viewer.applySnapshot(await engine.start()); // aplica o estado autoritativo
```

Estilos aplicados: nos concluidos, tokens ativos, atividades em espera e fluxos
percorridos.

## Servidor HTTP e API REST

O `@bpmn-flow/server` expoe a execucao por HTTP e pode servir a interface numa
porta.

```bash
npm run build
node packages/server/dist/bin.js --static apps/playground/dist --samples bpmn-files --port 3000
```

Acesse `http://localhost:3000`. Variaveis de ambiente equivalentes: `PORT`,
`STATIC_DIR`, `SAMPLES_DIR`.

Endpoints principais:

| Metodo e rota                     | Descricao                                        |
| --------------------------------- | ------------------------------------------------ |
| `POST /api/parse`                 | Recebe `{ xml }` e retorna o modelo normalizado. |
| `POST /api/sessions`              | Cria uma sessao de execucao e a inicia.          |
| `GET /api/sessions/:id`           | Retorna o snapshot atual da sessao.              |
| `POST /api/sessions/:id/complete` | Conclui uma tarefa de usuario (`{ tokenId }`).   |
| `POST /api/sessions/:id/signal`   | Entrega um sinal/evento (`{ name }`).            |
| `GET /api/samples`                | Lista os arquivos `.bpmn` disponiveis.           |

## Padroes BPMN suportados

- Eventos: inicio, fim (none, terminate, error), intermediarios de lancamento e
  de captura, e eventos de borda (interrompentes e nao interrompentes).
- Definicoes de evento: message, timer, error, signal, escalation.
- Atividades: task, userTask, serviceTask, scriptTask, businessRuleTask,
  sendTask, receiveTask, manualTask, callActivity e subprocessos embutidos.
- Gateways: exclusivo (com fluxo default), paralelo (juncao sincronizada),
  inclusivo (juncao por alcancabilidade), baseado em evento e complexo.
- Fluxos de sequencia com condicoes e colaboracao (pools e message flows).

## Desenvolvimento

```bash
npm run build       # compila todos os pacotes
npm test            # executa a suite Vitest
npm run typecheck   # checagem de tipos em todo o monorepo
npm run lint        # ESLint
npm run format      # Prettier
npm run dev         # sobe o playground em modo de desenvolvimento
```

## Estrutura do repositorio

```
packages/
  core/        modelo, parser e motor de execucao
  viewer/      renderizacao interativa com overlays
  server/      API REST e host estatico
apps/
  playground/  aplicacao interativa (Vite)
bpmn-files/    diagramas .bpmn de exemplo
docs/          documentacao complementar
```

## Licenca

MIT. Veja [LICENSE](LICENSE).
