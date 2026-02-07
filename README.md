# BPMN Visualizador - TypeScript

Um visualizador BPMN avançado construído em TypeScript com funcionalidades de visualização, navegação e simulação de processos.

##  **NOVO: Padrão Oficial BPMN com Ícones process-analytics**

 **Agora com ícones e estilos oficiais do [process-analytics/bpmn-visualization-js](https://github.com/process-analytics/bpmn-visualization-js)**

###  Ícones Oficiais Implementados

- ** User Task**: Baseado no flaticon 'employees' icon
- ** Service Task**: Engrenagem conforme draw.io stencils
- ** Script Task**: Documento com código (noun project)
- ** Business Rule Task**: Tabela com grade
- ** Manual Task**: Ícone de mão (noun project)
- ** Send/Receive Tasks**: Envelopes estilizados
- ** Events**: Timer, Message, Error com ícones padrão
- ** Gateways**: Símbolos X, +, círculo conforme especificação

###  Características Visuais

- Cores e tipografia da especificação BPMN 2.0
- Layout profissional similar ao bpmn.io
- Interatividade completa com elementos
- Compatibilidade total com process-analytics

 **Documentação completa**: [BPMN-ICONS-OFFICIAL.md](BPMN-ICONS-OFFICIAL.md)  
 **Padrões BPMN**: [BPMN-STANDARD.md](BPMN-STANDARD.md)

##  Estrutura Simplificada

O projeto agora usa uma estrutura simplificada **sem pasta `dist/`**:

- Arquivos TypeScript (`.ts`) e JavaScript (`.js`) ficam na mesma pasta `src/`
- Não é necessário compilar para uma pasta separada
- Desenvolvimento mais direto e simples

##  Funcionalidades

###  Visualização BPMN

- **Carregamento de arquivos**: Suporte para arquivos `.bpmn` e `.xml`
- **Seletor de arquivos**: Dropdown com arquivos BPMN pré-carregados
- **Estilos padrão**: Baseado no repositório oficial bpmn-visualization-js
- **Ícones oficiais**: User Task, Service Task, Gateways com símbolos padrão
- **Zoom e navegação**: Controles de zoom e ajuste automático

###  Desenho de Caminhos

- **Caminho principal**: Destaque do fluxo principal (aprovação)
- **Caminho alternativo**: Destaque de fluxos alternativos (rejeição)
- **Múltiplos estilos**: Diferentes cores e animações para cada caminho
- **Animação de fluxo**: Efeitos visuais de movimento nos caminhos

###  Simulação de Processos

- **Execução animada**: Simula a execução do processo passo a passo
- **Controles de simulação**: Iniciar, parar e reiniciar simulação
- **Destaque de elementos**: Elementos ativos são destacados durante a simulação
- **Tempo configurável**: Velocidade de simulação ajustável

###  Interface Moderna

- **Design responsivo**: Funciona em diferentes tamanhos de tela
- **Padrão BPMN oficial**: Cores, fontes e ícones da especificação
- **Pools e Lanes**: Visualização profissional de containers
- **Interatividade**: Hover, click e eventos customizados
- **Sidebar funcional**: Controles organizados por categorias
- **Notificações**: Feedback visual para ações do usuário

##  Como Usar

### Pré-requisitos

- Node.js e npm (para dependências do frontend)
- Python 3.8+ e Poetry (para gerenciamento do projeto)
- TypeScript (instalado automaticamente)

###  Execução Rápida

**Opção 1 - Script automatizado:**

```bash
./start-dev.sh
```

**Opção 2 - Manual:**

```bash
# 1. Inicie um servidor local
python -m http.server 8000

# 2. Acesse no navegador
# http://localhost:8000
```

###  Pré-requisitos

- **Python 3.x** (para servidor HTTP)
- **Navegador moderno** (Chrome, Firefox, Safari, Edge)
- **TypeScript** (opcional, para desenvolvimento)

### Instalação Completa (Desenvolvimento)

1. **Clone ou baixe o projeto**
2. **Instale TypeScript** (opcional):

   ```bash
   npm install -g typescript
   ```

3. **Verifique os tipos** (opcional):

   ```bash
   npx tsc --noEmit
   ```

4. **Inicie o servidor**:

   ```bash
   python -m http.server 8000
   ```

5. **Acesse no navegador**: `http://localhost:8000`

### Usando Poetry (Gerenciamento do Projeto)

```bash
# Instalar Poetry (se não tiver)
pip install poetry

# Ativar ambiente virtual
poetry shell

# Instalar dependências
poetry install

# Compilar e servir
poetry run build  # Compila TypeScript
poetry run serve  # Inicia servidor
```

##  Estrutura do Projeto

```
src/
├── components/
│   └── BpmnViewer.ts       # Classe principal do visualizador
├── utils/
│   └── BpmnUtils.ts        # Utilitários para BPMN
├── lib/
│   └── bpmn-visualization-mock.js  # Mock para desenvolvimento
├── styles/
│   └── main.css            # Estilos da interface
├── index.html              # Interface principal
└── main.ts                 # Ponto de entrada da aplicação

feats-bpmn-visualization/   # Funcionalidades JS existentes
├── draw-path/              # Desenho de caminhos
├── monitoring-*/           # Monitoramento de processos
└── ...                     # Outras funcionalidades
```

##  Como Usar a Interface

1. **Carregar Diagrama**:

   - Clique em "Carregar Exemplo" para um diagrama de teste
   - Use "Escolher arquivo" para carregar seu próprio .bpmn
   - Ou arraste um arquivo diretamente para a área do diagrama

2. **Visualização**:

   - "Ajustar Diagrama": Ajusta o zoom para mostrar todo o diagrama
   - "Zoom In/Out": Controles de zoom manual
   - Clique em elementos para destacá-los e ver informações

3. **Caminhos**:

   - "Caminho Principal": Destaca o fluxo de aprovação
   - "Caminho Alternativo": Destaca o fluxo de rejeição
   - "Limpar Caminhos": Remove todos os destaques

4. **Simulação**:
   - "Simular Processo": Inicia animação de execução
   - "Parar Simulação": Interrompe a animação
   - Os elementos ficam destacados conforme a simulação avança

##  Desenvolvimento

### Tecnologias Utilizadas

- **TypeScript**: Linguagem principal
- **bpmn-visualization**: Biblioteca de visualização BPMN
- **CSS3**: Estilização moderna com animações
- **HTML5**: Interface responsiva
- **Poetry**: Gerenciamento de projeto Python

### Arquitetura

- **BpmnViewer**: Classe principal que gerencia a visualização
- **PathDrawer**: Responsável pelo desenho de caminhos
- **ProcessSimulator**: Simula execução de processos
- **BpmnUtils**: Utilitários para manipulação de arquivos BPMN


## Licença

Este projeto está sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.


