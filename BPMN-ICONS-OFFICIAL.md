# BPMN Icons - Padrão Oficial

Este documento descreve a implementação dos ícones BPMN baseados no padrão oficial do process-analytics/bpmn-visualization-js.

## 🎯 Objetivo

Implementar ícones BPMN que seguem rigorosamente os padrões visuais utilizados pelo bpmn.io e pelo repositório oficial process-analytics/bpmn-visualization-js, proporcionando uma experiência visual profissional e reconhecível.

## 📋 Ícones Implementados

### Tarefas (Tasks)

#### 👤 User Task (`paintPersonIcon`)

- **Baseado em**: flaticon 'employees' icon (#554768)
- **Descrição**: Ícone de pessoa para representar tarefas executadas por usuários
- **Fonte**: IconPainter oficial do process-analytics
- **Características**: Cabeça circular e corpo estilizado

#### ⚙️ Service Task (`paintServiceTaskIcon`)

- **Baseado em**: draw.io bpmn mxgraph stencil
- **Descrição**: Ícone de engrenagem para tarefas de serviço automatizadas
- **Fonte**: draw.io stencils oficiais
- **Características**: Engrenagem com dentes e círculo central

#### 📝 Script Task (`paintScriptIcon`)

- **Baseado em**: noun project 'script' icon (#2331578)
- **Descrição**: Documento com linhas de código para tarefas de script
- **Fonte**: IconPainter oficial do process-analytics
- **Características**: Documento com linhas representando código

#### 📊 Business Rule Task (`paintTableIcon`)

- **Baseado em**: IconPainter oficial
- **Descrição**: Tabela com grade para regras de negócio
- **Fonte**: process-analytics/bpmn-visualization-js
- **Características**: Tabela com linhas e colunas bem definidas

#### ✋ Manual Task (`paintHandIcon`)

- **Baseado em**: noun project 'hand' icon (#7660)
- **Descrição**: Ícone de mão para tarefas manuais
- **Fonte**: IconPainter oficial do process-analytics
- **Características**: Silhueta de mão estilizada

#### 📤 Send Task (`paintSendTaskIcon`)

- **Descrição**: Envelope com triângulo preenchido para envio
- **Características**: Envelope com seta indicando envio

#### 📥 Receive Task (`paintReceiveTaskIcon`)

- **Descrição**: Envelope aberto para recebimento
- **Características**: Envelope com linha de abertura

### Eventos (Events)

#### 💬 Message Event (`paintMessageIcon`)

- **Baseado em**: draw.io bpmn mxgraph stencil
- **Descrição**: Envelope para eventos de mensagem
- **Características**: Envelope com linha de dobra

#### ⏰ Timer Event (`paintClockIcon`)

- **Baseado em**: flaticon clock icon (#223404)
- **Descrição**: Relógio para eventos temporizados
- **Fonte**: IconPainter oficial do process-analytics
- **Características**: Círculo com ponteiros e marcações

#### ⚠️ Error Event (`paintErrorIcon`)

- **Descrição**: Triângulo com ponto de exclamação
- **Características**: Símbolo padrão de erro

#### 📶 Signal Event (`paintSignalIcon`)

- **Baseado em**: noun project triangle (#2452089)
- **Descrição**: Triângulo para eventos de sinal
- **Características**: Triângulo simples apontando para cima

#### 📄 Conditional Event (`paintListIcon`)

- **Descrição**: Documento com linhas para eventos condicionais
- **Características**: Retângulo com linhas horizontais

#### ⬆️ Escalation Event (`paintEscalationIcon`)

- **Descrição**: Seta para cima para escalação
- **Características**: Seta apontando para cima

#### ⏪ Compensation Event (`paintDoubleLeftArrowheadsIcon`)

- **Fonte**: IconPainter oficial do process-analytics
- **Descrição**: Dupla seta para compensação
- **Características**: Duas setas apontando para a esquerda

#### ⚫ Terminate Event (`paintTerminateIcon`)

- **Descrição**: Círculo preenchido para terminação
- **Características**: Círculo sólido preto

### Gateways

#### ❌ Exclusive Gateway (`paintXCrossIcon`)

- **Descrição**: X para gateway exclusivo
- **Características**: Duas linhas cruzadas formando X

#### ➕ Parallel Gateway (`paintPlusCrossIcon`)

- **Descrição**: + para gateway paralelo
- **Características**: Cruz com linhas perpendiculares

#### ⭕ Inclusive Gateway (`paintInclusiveGatewayIcon`)

- **Descrição**: Círculo para gateway inclusivo
- **Características**: Círculo simples

#### ⭐ Event-Based Gateway (`paintPentagon`)

- **Descrição**: Pentágono duplo para gateway baseado em evento
- **Fonte**: IconPainter oficial do process-analytics
- **Características**: Círculo exterior com pentágono interior

#### ✨ Complex Gateway (`paintComplexGatewayIcon`)

- **Descrição**: Asterisco para gateway complexo
- **Características**: Forma estrelada de 8 pontas

## 🎨 Especificações Visuais

### Cores Padrão

- **Fill Color**: `#ffffff` (branco)
- **Stroke Color**: `#000000` (preto)
- **Font Family**: `Arial` (conforme especificação)
- **Font Size**: `11px`

### Espessuras de Linha

- **Tasks**: 1px
- **Events Start**: 1px
- **Events End**: 3px
- **Call Activities**: 3px
- **Gateways**: 1px

### Compatibilidade

- ✅ Compatível com bpmn.io
- ✅ Baseado em process-analytics/bpmn-visualization-js
- ✅ Segue especificação BPMN 2.0
- ✅ Ícones profissionais e reconhecíveis

## 🔗 Referências

1. **process-analytics/bpmn-visualization-js**: [IconPainter](https://github.com/process-analytics/bpmn-visualization-js/tree/master/src/component/mxgraph/shape/render/icon-painter.ts)
2. **BPMN 2.0 Specification**: Especificação oficial do Object Management Group
3. **draw.io BPMN Stencils**: [Stencils oficiais](https://github.com/jgraph/drawio/blob/master/src/main/webapp/stencils/bpmn.xml)
4. **Flaticon Icons**: Ícones licenciados para uso
5. **Noun Project**: Ícones sob licença Creative Commons

## 📝 Implementação

Os ícones são implementados como métodos SVG no arquivo `src/lib/bpmn-visualization-standard.js`, seguindo o padrão:

```javascript
paintIconName(x, y) {
  return `<g transform="translate(${x - 8}, ${y - 8})">
    <!-- SVG path data baseado no IconPainter oficial -->
  </g>`;
}
```

Cada ícone é escalado e posicionado apropriadamente dentro dos elementos BPMN correspondentes.
