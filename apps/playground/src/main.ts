import {
  parseBpmn,
  WorkflowEngine,
  type BpmnModel,
  type EngineMode,
  type ExecutionSnapshot,
  type FlowNode,
  type TokenSnapshot,
  type ValidationResult,
} from '@bpmn-flow/core';
import { BpmnFlowViewer } from '@bpmn-flow/viewer';
import '@bpmn-flow/viewer/styles.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import './style.css';
import { fetchSampleNames, fetchSampleXml, saveSample } from './api.js';
import { BpmnEditor } from './editor.js';

const BUNDLED = import.meta.glob('../../../bpmn-files/*.bpmn', {
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
  modeRun: $<HTMLButtonElement>('mode-run'),
  modeEdit: $<HTMLButtonElement>('mode-edit'),
  runToolbar: $<HTMLDivElement>('run-toolbar'),
  editToolbar: $<HTMLDivElement>('edit-toolbar'),
  diagram: $<HTMLElement>('diagram'),
  editorEl: $<HTMLElement>('editor'),
  sample: $<HTMLSelectElement>('sample'),
  file: $<HTMLInputElement>('file'),
  start: $<HTMLButtonElement>('start'),
  autorun: $<HTMLButtonElement>('autorun'),
  reset: $<HTMLButtonElement>('reset'),
  fit: $<HTMLButtonElement>('fit'),
  newDiagram: $<HTMLButtonElement>('new-diagram'),
  editFile: $<HTMLInputElement>('edit-file'),
  saveName: $<HTMLInputElement>('save-name'),
  validate: $<HTMLButtonElement>('validate'),
  save: $<HTMLButtonElement>('save'),
  editFit: $<HTMLButtonElement>('edit-fit'),
  validation: $<HTMLDivElement>('validation'),
  status: $<HTMLParagraphElement>('status'),
  actions: $<HTMLDivElement>('actions'),
  variables: $<HTMLTextAreaElement>('variables'),
  variablesView: $<HTMLPreElement>('variables-view'),
  log: $<HTMLOListElement>('log'),
};

const viewer = new BpmnFlowViewer({ container: els.diagram });

let currentXml = '';
let currentModel: BpmnModel | undefined;
let nodesById = new Map<string, FlowNode>();
let engine: WorkflowEngine | undefined;
let unbindViewer: (() => void) | undefined;
let editor: BpmnEditor | undefined;
let remoteSamples = false;

// --- Sample loading ----------------------------------------------------

async function populateSamples(): Promise<void> {
  els.sample.replaceChildren();
  const names = await fetchSampleNames();
  if (names) {
    remoteSamples = true;
    for (const name of names.sort((a, b) => a.localeCompare(b))) {
      els.sample.append(new Option(name, name));
    }
    return;
  }
  remoteSamples = false;
  for (const [path, xml] of Object.entries(BUNDLED).sort(([a], [b]) => a.localeCompare(b))) {
    const name = path.split('/').pop()?.replace('.bpmn', '') ?? path;
    const option = new Option(name, name);
    option.dataset.xml = xml;
    els.sample.append(option);
  }
}

async function loadSelectedSample(): Promise<void> {
  const name = els.sample.value;
  if (!name) return;
  const xml = remoteSamples
    ? await fetchSampleXml(name)
    : els.sample.selectedOptions[0]?.dataset.xml;
  if (xml) await loadDiagram(xml);
}

// --- Execution (run mode) ---------------------------------------------

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

const label = (nodeId: string): string => nodesById.get(nodeId)?.name ?? nodeId;

function log(message: string): void {
  const item = document.createElement('li');
  item.textContent = message;
  els.log.prepend(item);
}

async function loadDiagram(xml: string): Promise<void> {
  currentXml = xml;
  currentModel = await parseBpmn(xml);
  nodesById = flattenNodes(currentModel);
  await viewer.load(xml);
  teardownEngine();
  els.log.replaceChildren();
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
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
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
      const flow = currentModel?.processes[0]?.sequenceFlows.find((f) => f.id === flowId);
      if (flow) actionButton(`Sinalizar ${label(flow.targetRef)}`, () => signal(flow.targetRef));
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

// --- Editor (edit mode) ------------------------------------------------

async function ensureEditor(): Promise<BpmnEditor> {
  if (!editor) {
    editor = new BpmnEditor(els.editorEl);
    if (currentXml) await editor.open(currentXml).catch(() => editor?.newDiagram());
    else await editor.newDiagram();
  }
  return editor;
}

function renderValidation(result: ValidationResult, extra?: string): void {
  els.validation.replaceChildren();
  const header = document.createElement('p');
  header.className = result.valid ? 'valid-ok' : 'valid-err';
  header.textContent = result.valid ? 'Diagrama valido.' : 'Diagrama invalido.';
  els.validation.append(header);
  for (const issue of result.issues) {
    const item = document.createElement('p');
    item.className = `issue issue-${issue.severity}`;
    item.textContent = `${issue.severity === 'error' ? 'Erro' : 'Aviso'}: ${issue.message}`;
    els.validation.append(item);
  }
  if (extra) {
    const note = document.createElement('p');
    note.className = 'valid-ok';
    note.textContent = extra;
    els.validation.append(note);
  }
}

function validationMessage(message: string, ok = false): void {
  els.validation.replaceChildren();
  const p = document.createElement('p');
  p.className = ok ? 'valid-ok' : 'valid-err';
  p.textContent = message;
  els.validation.append(p);
}

async function validate(): Promise<void> {
  const result = await (await ensureEditor()).validate();
  renderValidation(result);
}

async function save(): Promise<void> {
  const name = els.saveName.value.trim();
  if (!name) {
    validationMessage('Informe um nome para o arquivo.');
    return;
  }
  const active = await ensureEditor();
  const result = await active.validate();
  renderValidation(result);
  if (!result.valid) return;
  try {
    const saved = await saveSample(name, await active.getXml());
    await populateSamples();
    els.sample.value = saved.name;
    renderValidation(result, `Salvo como ${saved.name}.bpmn no repositorio.`);
  } catch (error) {
    validationMessage(error instanceof Error ? error.message : String(error));
  }
}

// --- Mode switching ----------------------------------------------------

async function setMode(mode: 'run' | 'edit'): Promise<void> {
  const editing = mode === 'edit';
  els.modeEdit.classList.toggle('active', editing);
  els.modeRun.classList.toggle('active', !editing);
  els.runToolbar.classList.toggle('hidden', editing);
  els.editToolbar.classList.toggle('hidden', !editing);
  els.diagram.classList.toggle('hidden', editing);
  els.editorEl.classList.toggle('hidden', !editing);
  for (const block of document.querySelectorAll<HTMLElement>('[data-mode]')) {
    block.hidden = block.dataset.mode !== mode;
  }
  if (editing) {
    const active = await ensureEditor();
    active.fit();
  }
}

// --- Wiring ------------------------------------------------------------

els.sample.addEventListener('change', () => void loadSelectedSample());
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

els.modeRun.addEventListener('click', () => void setMode('run'));
els.modeEdit.addEventListener('click', () => void setMode('edit'));
els.newDiagram.addEventListener('click', async () => {
  await (await ensureEditor()).newDiagram();
  validationMessage('Novo diagrama criado.', true);
});
els.editFile.addEventListener('change', async () => {
  const file = els.editFile.files?.[0];
  if (file) await (await ensureEditor()).open(await file.text());
});
els.validate.addEventListener('click', () => void validate());
els.save.addEventListener('click', () => void save());
els.editFit.addEventListener('click', () => void ensureEditor().then((e) => e.fit()));

async function init(): Promise<void> {
  await populateSamples();
  await loadSelectedSample();
}

void init();
