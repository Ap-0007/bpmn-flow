# @bpmn-flow/viewer

Viewer BPMN interativo que sobrepõe o estado de execução do `@bpmn-flow/core`
num diagrama renderizado com `bpmn-visualization`. Para uso no navegador.

## Instalação

```bash
npm install @bpmn-flow/viewer @bpmn-flow/core bpmn-visualization
```

> Ainda não publicado no npm. Para usar hoje: `npm install github:Bappoz/bpmn-flow`.

## Uso

```ts
import { BpmnFlowViewer } from '@bpmn-flow/viewer';
import '@bpmn-flow/viewer/styles.css';

const viewer = new BpmnFlowViewer({ container: 'diagram' });
viewer.load(xml);
```

### API

- `load(xml)`: renderiza o diagrama e centraliza. Diagramas sem layout (sem DI)
  são posicionados automaticamente com `bpmn-auto-layout`.
- `fit()`: ajusta o diagrama ao viewport.
- `applySnapshot(snapshot)`: aplica um `ExecutionSnapshot` como fonte de verdade
  (nós concluídos, tokens ativos e atividades em espera).
- `bindEngine(engine)`: reflete o progresso ao vivo a partir dos eventos do
  motor e retorna uma função para desassociar.
- `markFlowTaken(flowId)`: destaca um fluxo de sequência percorrido.
- `clear()` / `dispose()`.
- `visualization`: acesso à instância `BpmnVisualization` subjacente.

### Estilos

O arquivo `@bpmn-flow/viewer/styles.css` define as classes aplicadas aos
elementos:

- `bpmn-flow-completed`: nó concluído
- `bpmn-flow-active`: token ativo
- `bpmn-flow-waiting`: atividade em espera
- `bpmn-flow-taken`: fluxo percorrido

Sobrescreva-as para personalizar as cores.

## Licença

MIT.
