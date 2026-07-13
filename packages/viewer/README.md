# @bpmn-flow/viewer

Viewer BPMN interativo que sobrepoe o estado de execucao do `@bpmn-flow/core`
num diagrama renderizado com `bpmn-visualization`. Para uso no navegador.

## Instalacao

```bash
npm install @bpmn-flow/viewer @bpmn-flow/core bpmn-visualization
```

## Uso

```ts
import { BpmnFlowViewer } from '@bpmn-flow/viewer';
import '@bpmn-flow/viewer/styles.css';

const viewer = new BpmnFlowViewer({ container: 'diagram' });
viewer.load(xml);
```

### API

- `load(xml)`: renderiza o diagrama e centraliza.
- `fit()`: ajusta o diagrama ao viewport.
- `applySnapshot(snapshot)`: aplica um `ExecutionSnapshot` como fonte de verdade
  (nos concluidos, tokens ativos e atividades em espera).
- `bindEngine(engine)`: reflete o progresso ao vivo a partir dos eventos do
  motor e retorna uma funcao para desassociar.
- `markFlowTaken(flowId)`: destaca um fluxo de sequencia percorrido.
- `clear()` / `dispose()`.
- `visualization`: acesso a instancia `BpmnVisualization` subjacente.

### Estilos

O arquivo `@bpmn-flow/viewer/styles.css` define as classes aplicadas aos
elementos:

- `bpmn-flow-completed`: no concluido
- `bpmn-flow-active`: token ativo
- `bpmn-flow-waiting`: atividade em espera
- `bpmn-flow-taken`: fluxo percorrido

Sobrescreva-as para personalizar as cores.

## Licenca

MIT.
