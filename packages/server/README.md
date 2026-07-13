# @bpmn-flow/server

Servidor HTTP embutivel que expoe o `@bpmn-flow/core` por uma API REST e serve
uma interface interativa numa porta. Construido com Hono.

## Instalacao

```bash
npm install @bpmn-flow/server
```

## Uso programatico

```ts
import { startServer } from '@bpmn-flow/server';

const server = startServer({
  port: 3000,
  samplesDir: './bpmn-files',
  staticDir: './apps/playground/dist',
});
// server.close() para encerrar
```

Tambem e possivel obter apenas a aplicacao Hono com `createApp(options)` e
monta-la em um servidor existente.

## CLI

```bash
bpmn-flow-serve --port 3000 --static ./dist --samples ./bpmn-files
```

Variaveis de ambiente equivalentes: `PORT`, `STATIC_DIR`, `SAMPLES_DIR`.

## Endpoints

| Metodo e rota                     | Corpo                          | Descricao                          |
| --------------------------------- | ------------------------------ | ---------------------------------- |
| `GET /api/health`                 | -                              | Verificacao de disponibilidade.    |
| `POST /api/parse`                 | `{ xml }`                      | Modelo normalizado do diagrama.    |
| `POST /api/sessions`              | `{ xml, mode?, variables? }`   | Cria e inicia uma execucao.        |
| `GET /api/sessions`               | -                              | Lista as sessoes ativas.           |
| `GET /api/sessions/:id`           | -                              | Snapshot atual da sessao.          |
| `POST /api/sessions/:id/complete` | `{ tokenId, output? }`         | Conclui uma tarefa de usuario.     |
| `POST /api/sessions/:id/signal`   | `{ name, output? }`            | Entrega um sinal/evento.           |
| `DELETE /api/sessions/:id`        | -                              | Remove a sessao.                   |
| `GET /api/samples`                | -                              | Lista os `.bpmn` do diretorio.     |
| `GET /api/samples/:name`          | -                              | Retorna o XML de um exemplo.       |

As sessoes mantem instancias do motor em memoria, permitindo executar um
processo passo a passo por HTTP.

## Licenca

MIT.
