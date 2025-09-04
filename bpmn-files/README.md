# 📋 Lista de Arquivos BPMN Disponíveis

Este diretório contém arquivos BPMN de exemplo que podem ser carregados no visualizador.

## 📁 Arquivos Disponíveis

### 1. `processo-simples.bpmn`

- **Nome**: Processo Simples
- **Descrição**: Um processo básico com gateway de decisão
- **Complexidade**: Simples
- **Elementos**: StartEvent, Task, Gateway, EndEvent

**Fluxo**:

1. Início → Processar Solicitação
2. Decisão: Aprovado?
   - ✅ Sim → Aprovar → Fim (Aprovado)
   - ❌ Não → Rejeitar → Fim (Rejeitado)

### 2. `processo-compras.bpmn`

- **Nome**: Processo de Compras
- **Descrição**: Fluxo completo de aprovação de compras com validação de orçamento
- **Complexidade**: Intermediário
- **Elementos**: StartEvent, UserTask, ServiceTask, Gateway, EndEvent

**Fluxo**:

1. Solicitação de Compra → Preencher Formulário
2. Validar Orçamento (automático)
3. Decisão: Valor > R$ 1000?
   - ✅ Sim → Aprovação Gerencial
   - ❌ Não → Pular para decisão final
4. Decisão: Aprovado?
   - ✅ Sim → Processar Compra → Compra Realizada
   - ❌ Não → Compra Rejeitada

## 🎨 Caminhos Predefinidos

Cada arquivo tem caminhos predefinidos que podem ser destacados no visualizador:

### Processo Simples

- **Caminho Principal**: Aprovação (verde)
- **Caminho Alternativo**: Rejeição (laranja)

### Processo de Compras

- **Caminho Principal**: Compra sem aprovação gerencial → Aprovada
- **Caminho Alternativo**: Compra com aprovação gerencial → Rejeitada

## 🔧 Como Adicionar Novos Arquivos

1. Adicione seu arquivo `.bpmn` nesta pasta
2. Atualize o arquivo `src/utils/BpmnFileManager.ts`:
   - Adicione o nome do arquivo na lista `getAvailableFiles()`
   - Adicione informações em `getBpmnFileInfo()`
   - Opcionalmente, adicione caminhos em `getPredefinedPaths()`
3. Recompile o projeto: `npx tsc`

## 📝 Formato dos Arquivos

Os arquivos devem estar no formato BPMN 2.0 padrão (XML) com:

- Elementos `<bpmn:process>`
- IDs únicos para cada elemento
- Diagramas de visualização `<bpmndi:BPMNDiagram>`

Exemplo de estrutura mínima:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_ID" isExecutable="true" name="Nome do Processo">
    <!-- Elementos do processo aqui -->
  </bpmn:process>
  <!-- Diagramas de visualização aqui -->
</bpmn:definitions>
```
