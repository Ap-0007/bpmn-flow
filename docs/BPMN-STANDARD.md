# 🎨 BPMN Visualization - Padrão Oficial

## ✨ Melhorias Implementadas

### 📋 **Baseado no repositório oficial:**

- **Repository**: [process-analytics/bpmn-visualization-js](https://github.com/process-analytics/bpmn-visualization-js)
- **Examples**: [process-analytics/bpmn-visualization-examples](https://github.com/process-analytics/bpmn-visualization-examples)

### 🎯 **Estilos Padrão BPMN Oficial:**

#### **Cores Padrão:**

- **Fill Color**: `#ffffff` (branco)
- **Stroke Color**: `#000000` (preto)
- **Font**: `Arial, Helvetica, sans-serif` (11px)

#### **Eventos:**

- **Start Events**: Borda verde (`#008000`), fundo branco
- **End Events**: Borda vermelha (`#cc0000`), borda espessa (3px)
- **Intermediate Events**: Padrão oficial

#### **Atividades (Tarefas):**

- **Cantos arredondados**: 8px (especificação BPMN)
- **Ícones padrão**: Baseados no repositório oficial
  - 👤 **User Task**: Ícone de pessoa
  - ⚙️ **Service Task**: Ícone de engrenagem
  - 📄 **Script Task**: Ícone de documento
  - 📊 **Business Rule Task**: Ícone de tabela
  - ✋ **Manual Task**: Ícone de mão
  - 📤 **Send Task**: Ícone de envio
  - 📥 **Receive Task**: Ícone de recebimento

#### **Gateways:**

- **Formato losango**: Conforme especificação BPMN
- **Símbolos padrão**:
  - ❌ **Exclusive**: X (exclusivo)
  - ➕ **Parallel**: + (paralelo)
  - ⭕ **Inclusive**: O (inclusivo)
  - 🎯 **Event-Based**: Círculos duplos
  - ✴️ **Complex**: Asterisco

#### **Containers:**

- **Pools**: Fundo azul claro (`#dbefff`)
- **Lanes**: Fundo cinza claro (`#edeef5`)
- **Grid sutil**: Padrão de fundo com linhas

### 🎨 **Recursos Visuais:**

#### **Efeitos Interativos:**

- **Hover**: Sombra suave nos elementos
- **Click**: Eventos customizados para integração
- **Cursor**: Pointer nos elementos clicáveis

#### **Grid e Layout:**

- **Grid de fundo**: Linhas sutis para orientação
- **Espaçamento**: Seguindo melhores práticas BPMN
- **Tipografia**: Fonte padrão oficial

### 📁 **Estrutura de Arquivos:**

```
src/lib/
├── bpmn-visualization-standard.js  ← Nova biblioteca padrão
├── bpmn-visualization-mock.js      ← Versão anterior
└── bpmn-visualization-real.js      ← Para biblioteca oficial
```

### 🔄 **Diagramas Implementados:**

#### **1. Processo Simples:**

- Evento inicial → Tarefa → Gateway → Dois fins
- Ícones de tarefa de usuário e serviço
- Gateway exclusivo com símbolos padrão

#### **2. Processo de Compras:**

- **Pools e Lanes**: Solicitante, Aprovador, Compras
- **Fluxo entre lanes**: Representação visual correta
- **Múltiplos tipos de tarefa**: User, Service, Send

#### **3. Gestão de Projeto:**

- **Gateway paralelo**: Execução simultânea
- **Sincronização**: Convergência de fluxos
- **Diversos tipos de evento**: Message, Error, Timer

### 🚀 **Como Usar:**

```javascript
// A biblioteca automaticamente detecta o tipo de processo
// e aplica o layout e estilos apropriados

const bpmnVisualization = new BpmnVisualization({
  container: "bpmn-container",
});

// Carrega arquivo BPMN com estilos padrão
await bpmnVisualization.load(bpmnContent);
```

### 📊 **Compatibilidade:**

- ✅ **API compatível** com bpmn-visualization-js oficial
- ✅ **Estilos padrão** BPMN 2.0
- ✅ **Ícones oficiais** baseados em especificação
- ✅ **Interatividade** completa
- ✅ **Responsivo** para diferentes tamanhos

### 🎯 **Próximas Melhorias:**

1. **Integração com biblioteca real** do bpmn-visualization-js
2. **Mais ícones de evento** (Timer, Signal, Message, etc.)
3. **Suporte a temas customizados**
4. **Exportação para SVG/PNG**
5. **Animações de fluxo** em tempo real

---

**Resultado**: Agora o visualizador BPMN segue **exatamente** os padrões visuais oficiais do [process-analytics/bpmn-visualization-js](https://github.com/process-analytics/bpmn-visualization-js)! 🎉
