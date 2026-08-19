/**
 * Executa um processo BPMN de ponta a ponta com o @bpmn-flow/core.
 *
 *   npm run build && node examples/quickstart.mjs
 *
 * Mostra os tres pontos centrais da biblioteca: um handler fazendo o trabalho
 * real por tras de uma serviceTask, um gateway exclusivo decidindo pelo valor
 * das variaveis e a execucao pausando numa userTask ate ser retomada.
 */
import { parseBpmn, WorkflowEngine } from '@bpmn-flow/core';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="t" id="d">
  <bpmn:process id="Pedido" isExecutable="true">
    <bpmn:startEvent id="Inicio" />
    <bpmn:serviceTask id="Reservar" name="Reservar estoque" />
    <bpmn:exclusiveGateway id="Gw" name="Valor > 100?" default="fAuto" />
    <bpmn:userTask id="AprovarManual" name="Aprovar manualmente" />
    <bpmn:endEvent id="FimManual" />
    <bpmn:endEvent id="FimAuto" />
    <bpmn:sequenceFlow id="f0" sourceRef="Inicio" targetRef="Reservar" />
    <bpmn:sequenceFlow id="f1" sourceRef="Reservar" targetRef="Gw" />
    <bpmn:sequenceFlow id="fMan" sourceRef="Gw" targetRef="AprovarManual">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">valor &gt; 100</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="fAuto" sourceRef="Gw" targetRef="FimAuto" />
    <bpmn:sequenceFlow id="fm2" sourceRef="AprovarManual" targetRef="FimManual" />
  </bpmn:process>
</bpmn:definitions>`;

const model = await parseBpmn(xml);
const [processo] = model.processes;

/** Roda o processo com um valor e devolve o snapshot final. */
async function executar(valor) {
  const engine = new WorkflowEngine(processo, { variables: { valor } });

  // O handler e a automacao de verdade por tras da atividade: o que ele
  // retorna e mesclado nas variaveis do processo.
  engine.registerHandler('Reservar', (ctx) => {
    console.log(`  [handler] reservando estoque para valor ${ctx.get('valor')}`);
    return { reservado: true };
  });

  let snapshot = await engine.start();

  // Acima de 100 o gateway manda para a userTask e a execucao para ali.
  const parado = snapshot.tokens.find((token) => token.waiting);
  if (parado) {
    console.log(`  aguardando: ${parado.nodeId} (${parado.waitReason})`);
    snapshot = await engine.completeTask(parado.id, { aprovadoPor: 'ana' });
  }

  return snapshot;
}

for (const valor of [50, 250]) {
  console.log(`\nvalor = ${valor}`);
  const snapshot = await executar(valor);
  console.log('  status:', snapshot.status);
  console.log('  caminho:', snapshot.completedNodes.join(' -> '));
  console.log('  variaveis:', JSON.stringify(snapshot.variables));
}
