import {
  parseBpmn,
  WorkflowEngine,
  type BpmnModel,
  type EngineMode,
  type ExecutionSnapshot,
  type FlowNode,
  type TokenSnapshot,
} from '@bpmn-flow/core';
import { BpmnFlowViewer } from '@bpmn-flow/viewer';
import '@bpmn-flow/viewer/styles.css';
import './style.css';

const SAMPLES = import.meta.glob('../../../bpmn-files/*.bpmn', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const els = {
  sample: $<HTMLSelectElement>('sample'),
  file: $<HTMLInputElement>('file'),
  start: $<HTMLButtonElement>('start'),
  autorun: $<HTMLButtonElement>('autorun'),
  reset: $<HTMLButtonElement>('reset'),
  fit: $<HTMLButtonElement>('fit'),
  status: $<HTMLParagraphElement>('status'),
  actions: $<HTMLDivElement>('actions'),
  variables: $<HTMLTextAreaElement>('variables'),
  variablesView: $<HTMLPreElement>('variables-view'),
  log: $<HTMLOListElement>('log'),
};

const viewer = new BpmnFlowViewer({ container: 'diagram' });

let currentXml = '';
let currentModel: BpmnModel | undefined;
let nodesById = new Map<string, FlowNode>();
let engine: WorkflowEngine | undefined;
let unbindViewer: (() => void) | undefined;

function flattenNodes(model: BpmnModel): Map<string, FlowNode> {
  const map = new Map<string, FlowNode>();
  const walk = (nodes: FlowNode[]): void => {
    for (const node of nodes) {
      map.set(node.id, node);
      if (node.process) walk(node.process.flowNodes);
    }
  };
  for (const process of model.processes) walk(process.flowNodes);
  return map;
}

function label(nodeId: string): string {
  const node = nodesById.get(nodeId);
  return node?.name ?? nodeId;
}

function log(message: string): void {
  const item = document.createElement('li');
  item.textContent = message;
  els.log.prepend(item);
}

function clearLog(): void {
  els.log.replaceChildren();
}

async function loadDiagram(xml: string): Promise<void> {
  currentXml = xml;
  currentModel = await parseBpmn(xml);
  nodesById = flattenNodes(currentModel);
  await viewer.load(xml);
  teardownEngine();
  clearLog();
  els.actions.replaceChildren();
  els.variablesView.textContent = '';
  els.status.textContent = `Diagrama carregado: ${currentModel.processes[0]?.name ?? currentModel.processes[0]?.id ?? 'processo'}.`;
}

function teardownEngine(): void {
  unbindViewer?.();
  unbindViewer = undefined;
  engine = undefined;
}

function readVariables(): Record<string, unknown> {
  const raw = els.variables.value.trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function newEngine(mode: EngineMode, variables: Record<string, unknown>): WorkflowEngine {
  const process = currentModel?.processes[0];
  if (!process) throw new Error('Nenhum processo executavel.');
  const created = new WorkflowEngine(process, { mode, variables });
  unbindViewer = viewer.bindEngine(created);
  created.on('node.enter', (e) => log(`Entrou: ${label(e.nodeId)}`));
  created.on('wait', (e) => log(`Aguardando: ${label(e.nodeId)} (${e.reason})`));
  created.on('process.end', (e) => log(`Processo ${e.status}.`));
  return created;
}

function render(snapshot: ExecutionSnapshot): void {
  viewer.applySnapshot(snapshot);
  els.status.textContent = `Status: ${snapshot.status} - ${snapshot.tokens.length} token(s) ativos, ${snapshot.completedNodes.length} no(s) concluidos.`;
  els.variablesView.textContent = JSON.stringify(snapshot.variables, null, 2);
  renderActions(snapshot.tokens);
}

function renderActions(tokens: TokenSnapshot[]): void {
  els.actions.replaceChildren();
  const waiting = tokens.filter((t) => t.waiting);
  if (waiting.length === 0) {
    const none = document.createElement('p');
    none.className = 'muted';
    none.textContent = 'Nenhuma acao pendente.';
    els.actions.append(none);
    return;
  }
  for (const token of waiting) addActionButtons(token);
}

function addActionButtons(token: TokenSnapshot): void {
  if (token.waitReason === 'eventBasedGateway') {
    const node = nodesById.get(token.nodeId);
    for (const flowId of node?.outgoing ?? []) {
      const target = currentModel?.processes[0]?.sequenceFlows.find((f) => f.id === flowId);
      if (target) actionButton(`Sinalizar ${label(target.targetRef)}`, () => signal(target.targetRef));
    }
    return;
  }
  if (token.waitReason === 'catchEvent') {
    actionButton(`Sinalizar ${label(token.nodeId)}`, () => signal(token.nodeId));
    return;
  }
  actionButton(`Concluir ${label(token.nodeId)}`, () => complete(token.id));
}

function actionButton(text: string, onClick: () => void): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  els.actions.append(button);
}

async function start(): Promise<void> {
  try {
    engine = newEngine('automation', readVariables());
    render(await engine.start());
  } catch (error) {
    fail(error);
  }
}

async function autorun(): Promise<void> {
  try {
    engine = newEngine('auto', readVariables());
    render(await engine.start());
  } catch (error) {
    fail(error);
  }
}

async function complete(tokenId: string): Promise<void> {
  if (!engine) return;
  try {
    render(await engine.completeTask(tokenId));
  } catch (error) {
    fail(error);
  }
}

async function signal(name: string): Promise<void> {
  if (!engine) return;
  try {
    render(await engine.signal(name));
  } catch (error) {
    fail(error);
  }
}

function fail(error: unknown): void {
  els.status.textContent = `Erro: ${error instanceof Error ? error.message : String(error)}`;
}

function populateSamples(): void {
  const entries = Object.entries(SAMPLES).sort(([a], [b]) => a.localeCompare(b));
  for (const [path, xml] of entries) {
    const name = path.split('/').pop()?.replace('.bpmn', '') ?? path;
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.dataset.xml = xml;
    els.sample.append(option);
  }
}

function selectedSampleXml(): string | undefined {
  const option = els.sample.selectedOptions[0];
  return option?.dataset.xml;
}

els.sample.addEventListener('change', () => {
  const xml = selectedSampleXml();
  if (xml) void loadDiagram(xml);
});
els.file.addEventListener('change', async () => {
  const file = els.file.files?.[0];
  if (file) await loadDiagram(await file.text());
});
els.start.addEventListener('click', () => void start());
els.autorun.addEventListener('click', () => void autorun());
els.reset.addEventListener('click', () => {
  if (currentXml) void loadDiagram(currentXml);
});
els.fit.addEventListener('click', () => viewer.fit());

populateSamples();
const first = selectedSampleXml();
if (first) void loadDiagram(first);
