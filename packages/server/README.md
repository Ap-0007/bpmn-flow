# @bpmn-flow/server

Servidor HTTP embutível que expõe o `@bpmn-flow/core` por uma API REST e serve
uma interface interativa numa porta. Construído com Hono.

## Instalação

```bash
npm install @bpmn-flow/server
```

> Ainda não publicado no npm. Para usar hoje: `npm install github:Bappoz/bpmn-flow`.

## Uso programático

```ts
import { startServer } from '@bpmn-flow/server';

const server = startServer({
  port: 3000,
  samplesDir: './bpmn-files',
  staticDir: './apps/playground/dist',
});
// server.close() para encerrar
```

Também é possível obter apenas a aplicação Hono com `createApp(options)` e
montá-la em um servidor existente.

## CLI

```bash
bpmn-flow-serve --port 3000 --static ./dist --samples ./bpmn-files --data ./data
```

Variáveis de ambiente equivalentes: `PORT`, `STATIC_DIR`, `SAMPLES_DIR`,
`DATA_DIR`.

## Endpoints

| Método e rota                                       | Corpo                        | Descrição                             |
| --------------------------------------------------- | ---------------------------- | ------------------------------------- |
| `GET /api/health`                                   | -                            | Verificação de disponibilidade.       |
| `POST /api/parse`                                   | `{ xml }`                    | Modelo normalizado do diagrama.       |
| `POST /api/validate`                                | `{ xml }`                    | Valida a estrutura BPMN.              |
| `POST /api/sessions`                                | `{ xml, mode?, variables? }` | Cria e inicia uma execução.           |
| `GET /api/sessions`                                 | -                            | Resumo das sessões conhecidas.        |
| `GET /api/sessions/:id`                             | -                            | Snapshot atual da sessão.             |
| `POST /api/sessions/:id/complete`                   | `{ tokenId, output? }`       | Conclui uma tarefa de usuário.        |
| `POST /api/sessions/:id/signal`                     | `{ name, output? }`          | Entrega um sinal/evento.              |
| `POST /api/sessions/:id/tick`                       | `{ now? }`                   | Dispara os timers vencidos.           |
| `GET /api/sessions/:id/tasks`                       | -                            | Tarefas pendentes da sessão.          |
| `GET /api/tasks`                                    | -                            | Caixa de entrada de todas as sessões. |
| `GET /api/sessions/:id/incidents`                   | -                            | Atividades que falharam.              |
| `POST /api/sessions/:id/incidents/:tokenId/retry`   | -                            | Executa a atividade de novo.          |
| `POST /api/sessions/:id/incidents/:tokenId/resolve` | `{ output? }`                | Segue em frente sem ela.              |
| `DELETE /api/sessions/:id`                          | -                            | Remove a sessão.                      |
| `GET /api/samples`                                  | -                            | Lista os `.bpmn` do diretório.        |
| `GET /api/samples/:name`                            | -                            | Retorna o XML de um exemplo.          |
| `POST /api/samples`                                 | `{ name, xml }`              | Valida e salva um `.bpmn` no dir.     |

## Incidentes

`POST /api/sessions` aceita `onHandlerError: "incident"` e `retry`, de modo que
uma integração instável não derruba o processo: a atividade fica retida e
aparece em `GET /api/sessions/:id/incidents`, pronta para `retry` ou `resolve`.

## Caixa de entrada

`GET /api/tasks` percorre as sessões (inclusive as só existentes em disco) e
devolve o trabalho pendente com `sessionId`, raia, papéis e variáveis. Aceita
`?role=`, `?reason=` e `?nodeId=`; sessões concluídas são ignoradas sem
reconstruir o motor.

```bash
curl 'http://localhost:3000/api/tasks?role=gerentes'
```

## Timers

O servidor confere os timers vencidos de todas as sessões a cada
`timerIntervalMs` (padrão 1000 ms; `0` desliga). Sessões só existentes em disco
são reconstruídas apenas quando têm um timer realmente vencido.

```ts
startServer({ port: 3000, dataDir: './data', timerIntervalMs: 5000 });
```

## Persistência

As sessões ficam em memória por padrão. Com `dataDir` (ou `--data`), cada
mudança grava um JSON por sessão e uma sessão ausente do cache é reconstruída
com `WorkflowEngine.restore()` — reiniciar o servidor não perde execuções.

```ts
import { startServer } from '@bpmn-flow/server';

startServer({ port: 3000, dataDir: './data' });
```

Para outro backend (Redis, Postgres, S3), implemente `SessionStorage` e passe
para o `SessionStore`.

## Licença

MIT.
