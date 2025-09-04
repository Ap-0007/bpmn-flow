# Changelog - BPMN Visualizador

## [2.0.0] - 2025-09-04 - ÍCONES OFICIAIS PROCESS-ANALYTICS

### 🎨 MAJOR UPDATE: Implementação de Ícones Oficiais

#### ✨ Adicionado

- **Ícones oficiais baseados no process-analytics/bpmn-visualization-js IconPainter**
- **Compatibilidade total com bpmn.io** para visual profissional
- **15+ ícones BPMN implementados** conforme especificação oficial

#### 👤 Tarefas (Tasks)

- `paintPersonIcon()`: User Task com ícone de pessoa (flaticon employees)
- `paintServiceTaskIcon()`: Service Task com engrenagem (draw.io stencil)
- `paintScriptIcon()`: Script Task com documento de código (noun project)
- `paintTableIcon()`: Business Rule Task com tabela estruturada
- `paintHandIcon()`: Manual Task com mão estilizada (noun project)
- `paintSendTaskIcon()`: Send Task com envelope fechado
- `paintReceiveTaskIcon()`: Receive Task com envelope aberto

#### 🔵 Eventos (Events)

- `paintMessageIcon()`: Message Event (draw.io stencil)
- `paintClockIcon()`: Timer Event com relógio detalhado (flaticon)
- `paintErrorIcon()`: Error Event com triângulo de alerta
- `paintSignalIcon()`: Signal Event com triângulo (noun project)
- `paintListIcon()`: Conditional Event com documento
- `paintEscalationIcon()`: Escalation Event com seta
- `paintDoubleLeftArrowheadsIcon()`: Compensation Event com dupla seta
- `paintTerminateIcon()`: Terminate Event com círculo preenchido

#### 🔷 Gateways

- `paintXCrossIcon()`: Exclusive Gateway com X
- `paintPlusCrossIcon()`: Parallel Gateway com +
- `paintInclusiveGatewayIcon()`: Inclusive Gateway com círculo
- `paintPentagon()`: Event-Based Gateway com pentágono duplo
- `paintComplexGatewayIcon()`: Complex Gateway com asterisco

#### 🎨 Estilos Atualizados

- **Cores oficiais**: `#ffffff` fill, `#000000` stroke
- **Fonte padrão**: Arial conforme especificação BPMN
- **Espessuras**: 1px para elementos normais, 3px para End Events
- **Escalas apropriadas**: Ícones redimensionados para melhor visibilidade

#### 📚 Documentação

- `BPMN-ICONS-OFFICIAL.md`: Documentação completa dos ícones
- README atualizado com seção de ícones oficiais
- Referências para fontes originais dos ícones

### 🔧 Técnico

- Substituição completa dos ícones antigos pelos oficiais
- Implementação baseada no repositório process-analytics/bpmn-visualization-js
- Manutenção da compatibilidade com interface existente
- SVG paths otimizados para performance

### 🎯 Objetivo Alcançado

✅ **Visual profissional idêntico ao bpmn.io**  
✅ **Ícones reconhecíveis por usuários BPMN**  
✅ **Compatibilidade com ferramentas padrão**  
✅ **Especificação BPMN 2.0 atendida**

---

## [1.1.0] - 2025-09-04 - Correções e Melhorias

### 🐛 Corrigido

- Path de carregamento de arquivos BPMN (`"././bpmn-files/"` → `"./bpmn-files/"`)
- Dropdown de seleção agora lista arquivos corretamente
- Servidor HTTP funcionando em múltiplas portas

### ✨ Melhorado

- Estrutura de arquivos simplificada (sem pasta dist/)
- Compilação TypeScript direta para src/
- Logging melhorado para debug

---

## [1.0.0] - 2025-09-04 - Versão Inicial

### ✨ Funcionalidades Iniciais

- Visualizador BPMN básico
- Carregamento de arquivos .bpmn
- Interface com dropdown de seleção
- Componentes TypeScript modulares
- Sistema de navegação e zoom
- Estilos CSS profissionais

### 📁 Estrutura

- `src/main.ts`: Aplicação principal
- `src/components/`: Componentes BPMN
- `src/utils/`: Utilitários de arquivo
- `bpmn-files/`: Arquivos BPMN de exemplo
- Build system com TypeScript
