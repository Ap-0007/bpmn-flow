// Simulação aprimorada da biblioteca bpmn-visualization para desenvolvimento
// Esta versão analisa o XML BPMN e gera diagramas diferentes baseados no conteúdo

export class BpmnVisualization {
  constructor(config) {
    this.container = document.getElementById(config.container);
    this.navigation = new Navigation();
    this.bpmnElementsRegistry = new BpmnElementsRegistry();
    this.currentXml = "";
  }

  async load(bpmnXml) {
    console.log("🔄 Carregando BPMN diferenciado...");
    this.currentXml = bpmnXml;

    // Analisa o XML para identificar o tipo de processo
    const processType = this.identifyProcessType(bpmnXml);
    console.log("📊 Tipo de processo identificado:", processType);

    // Gera diagrama específico baseado no tipo
    this.generateDiagram(processType, bpmnXml);
  }

  identifyProcessType(xml) {
    if (xml.includes("processo-simples") || xml.includes("Process_Simple")) {
      return "simple";
    } else if (
      xml.includes("processo-compras") ||
      xml.includes("Process_Compras")
    ) {
      return "compras";
    } else if (
      xml.includes("processo-gestao-projeto") ||
      xml.includes("GestaoProjetoProcess")
    ) {
      return "gestao";
    }
    return "default";
  }

  generateDiagram(type, xml) {
    let diagramSvg = "";

    switch (type) {
      case "simple":
        diagramSvg = this.generateSimpleDiagram();
        break;
      case "compras":
        diagramSvg = this.generateComprasDiagram();
        break;
      case "gestao":
        diagramSvg = this.generateGestaoDiagram();
        break;
      default:
        diagramSvg = this.generateDefaultDiagram();
    }

    this.container.innerHTML = diagramSvg;
    this.addInteractivity();
  }

  generateSimpleDiagram() {
    return `
      <svg width="600" height="300" viewBox="0 0 600 300">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
          </marker>
        </defs>
        
        <!-- Início -->
        <g data-element-id="StartEvent_1">
          <circle cx="50" cy="150" r="20" fill="#c8e6c9" stroke="#4caf50" stroke-width="3"/>
          <text x="50" y="190" text-anchor="middle" font-size="12" font-weight="bold">Início</text>
        </g>

        <!-- Processar Solicitação -->
        <g data-element-id="Task_1">
          <rect x="120" y="120" width="120" height="60" fill="#e3f2fd" stroke="#2196f3" stroke-width="2" rx="8"/>
          <text x="180" y="145" text-anchor="middle" font-size="11" font-weight="bold">Processar</text>
          <text x="180" y="160" text-anchor="middle" font-size="11" font-weight="bold">Solicitação</text>
        </g>

        <!-- Gateway de Decisão -->
        <g data-element-id="Gateway_1">
          <polygon points="300,130 330,150 300,170 270,150" fill="#fff3e0" stroke="#ff9800" stroke-width="3"/>
          <text x="300" y="125" text-anchor="middle" font-size="10" font-weight="bold">Aprovado?</text>
          <text x="300" y="195" text-anchor="middle" font-size="12">?</text>
        </g>

        <!-- Aprovar -->
        <g data-element-id="Task_2">
          <rect x="380" y="80" width="100" height="50" fill="#e8f5e8" stroke="#4caf50" stroke-width="2" rx="8"/>
          <text x="430" y="110" text-anchor="middle" font-size="12" font-weight="bold">Aprovar</text>
        </g>

        <!-- Rejeitar -->
        <g data-element-id="Task_3">
          <rect x="380" y="170" width="100" height="50" fill="#ffebee" stroke="#f44336" stroke-width="2" rx="8"/>
          <text x="430" y="200" text-anchor="middle" font-size="12" font-weight="bold">Rejeitar</text>
        </g>

        <!-- Fim Aprovado -->
        <g data-element-id="EndEvent_1">
          <circle cx="550" cy="105" r="20" fill="#ffcdd2" stroke="#f44336" stroke-width="4"/>
          <text x="550" y="80" text-anchor="middle" font-size="11" font-weight="bold">Aprovado</text>
        </g>

        <!-- Fim Rejeitado -->
        <g data-element-id="EndEvent_2">
          <circle cx="550" cy="195" r="20" fill="#ffcdd2" stroke="#f44336" stroke-width="4"/>
          <text x="550" y="220" text-anchor="middle" font-size="11" font-weight="bold">Rejeitado</text>
        </g>

        <!-- Fluxos -->
        <g data-element-id="SequenceFlow_1">
          <line x1="70" y1="150" x2="120" y2="150" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_2">
          <line x1="240" y1="150" x2="270" y2="150" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_3">
          <line x1="330" y1="140" x2="380" y2="115" stroke="#4caf50" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="355" y="125" text-anchor="middle" font-size="10" fill="#4caf50" font-weight="bold">Sim</text>
        </g>
        <g data-element-id="SequenceFlow_4">
          <line x1="330" y1="160" x2="380" y2="185" stroke="#f44336" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="355" y="180" text-anchor="middle" font-size="10" fill="#f44336" font-weight="bold">Não</text>
        </g>
        <g data-element-id="SequenceFlow_5">
          <line x1="480" y1="105" x2="530" y2="105" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_6">
          <line x1="480" y1="195" x2="530" y2="195" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
      </svg>
    `;
  }

  generateComprasDiagram() {
    return `
      <svg width="900" height="400" viewBox="0 0 900 400">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
          </marker>
        </defs>

        <!-- Início -->
        <g data-element-id="StartEvent_1">
          <circle cx="50" cy="200" r="20" fill="#c8e6c9" stroke="#4caf50" stroke-width="3"/>
          <text x="50" y="235" text-anchor="middle" font-size="10" font-weight="bold">Solicitação</text>
          <text x="50" y="248" text-anchor="middle" font-size="10" font-weight="bold">de Compra</text>
        </g>

        <!-- Preencher Formulário -->
        <g data-element-id="UserTask_1">
          <rect x="120" y="170" width="110" height="60" fill="#e3f2fd" stroke="#2196f3" stroke-width="2" rx="8"/>
          <text x="175" y="195" text-anchor="middle" font-size="11" font-weight="bold">Preencher</text>
          <text x="175" y="210" text-anchor="middle" font-size="11" font-weight="bold">Formulário</text>
        </g>

        <!-- Validar Orçamento -->
        <g data-element-id="ServiceTask_1">
          <rect x="280" y="170" width="110" height="60" fill="#fff3e0" stroke="#ff9800" stroke-width="2" rx="8"/>
          <text x="335" y="195" text-anchor="middle" font-size="11" font-weight="bold">Validar</text>
          <text x="335" y="210" text-anchor="middle" font-size="11" font-weight="bold">Orçamento</text>
        </g>

        <!-- Gateway Valor -->
        <g data-element-id="Gateway_1">
          <polygon points="440,180 470,200 440,220 410,200" fill="#fff3e0" stroke="#ff9800" stroke-width="3"/>
          <text x="440" y="250" text-anchor="middle" font-size="10" font-weight="bold">Valor > R$ 1000?</text>
        </g>

        <!-- Aprovação Gerencial -->
        <g data-element-id="UserTask_2">
          <rect x="520" y="120" width="110" height="60" fill="#fff8e1" stroke="#ffc107" stroke-width="2" rx="8"/>
          <text x="575" y="145" text-anchor="middle" font-size="11" font-weight="bold">Aprovação</text>
          <text x="575" y="160" text-anchor="middle" font-size="11" font-weight="bold">Gerencial</text>
        </g>

        <!-- Gateway Final -->
        <g data-element-id="Gateway_2">
          <polygon points="690,180 720,200 690,220 660,200" fill="#e8f5e8" stroke="#4caf50" stroke-width="3"/>
          <text x="690" y="250" text-anchor="middle" font-size="10" font-weight="bold">Aprovado?</text>
        </g>

        <!-- Processar Compra -->
        <g data-element-id="ServiceTask_2">
          <rect x="520" y="220" width="110" height="60" fill="#e8f5e8" stroke="#4caf50" stroke-width="2" rx="8"/>
          <text x="575" y="245" text-anchor="middle" font-size="11" font-weight="bold">Processar</text>
          <text x="575" y="260" text-anchor="middle" font-size="11" font-weight="bold">Compra</text>
        </g>

        <!-- Fim Sucesso -->
        <g data-element-id="EndEvent_1">
          <circle cx="800" cy="150" r="20" fill="#c8e6c9" stroke="#4caf50" stroke-width="4"/>
          <text x="800" y="130" text-anchor="middle" font-size="10" font-weight="bold">Compra</text>
          <text x="800" y="185" text-anchor="middle" font-size="10" font-weight="bold">Aprovada</text>
        </g>

        <!-- Fim Rejeitado -->
        <g data-element-id="EndEvent_2">
          <circle cx="800" cy="250" r="20" fill="#ffcdd2" stroke="#f44336" stroke-width="4"/>
          <text x="800" y="285" text-anchor="middle" font-size="10" font-weight="bold">Rejeitado</text>
        </g>

        <!-- Fluxos -->
        <g data-element-id="SequenceFlow_1">
          <line x1="70" y1="200" x2="120" y2="200" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_2">
          <line x1="230" y1="200" x2="280" y2="200" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_3">
          <line x1="390" y1="200" x2="410" y2="200" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_4">
          <line x1="450" y1="180" x2="520" y2="150" stroke="#ffc107" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="485" y="160" text-anchor="middle" font-size="10" fill="#ffc107" font-weight="bold">Sim</text>
        </g>
        <g data-element-id="SequenceFlow_5">
          <line x1="470" y1="200" x2="520" y2="250" stroke="#4caf50" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="495" y="230" text-anchor="middle" font-size="10" fill="#4caf50" font-weight="bold">Não</text>
        </g>
        <g data-element-id="SequenceFlow_6">
          <line x1="630" y1="150" x2="660" y2="190" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_7">
          <line x1="720" y1="190" x2="750" y2="150" stroke="#4caf50" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="735" y="165" text-anchor="middle" font-size="10" fill="#4caf50" font-weight="bold">Sim</text>
        </g>
        <g data-element-id="SequenceFlow_8">
          <line x1="720" y1="210" x2="780" y2="250" stroke="#f44336" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="750" y="235" text-anchor="middle" font-size="10" fill="#f44336" font-weight="bold">Não</text>
        </g>
        <g data-element-id="SequenceFlow_9">
          <line x1="630" y1="250" x2="660" y2="210" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
      </svg>
    `;
  }

  generateGestaoDiagram() {
    return `
      <svg width="1200" height="600" viewBox="0 0 1200 600">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
          </marker>
        </defs>

        <!-- Início -->
        <g data-element-id="InicioProcesso">
          <circle cx="50" cy="300" r="25" fill="#c8e6c9" stroke="#4caf50" stroke-width="3"/>
          <text x="50" y="340" text-anchor="middle" font-size="10" font-weight="bold">Solicitação</text>
          <text x="50" y="353" text-anchor="middle" font-size="10" font-weight="bold">Recebida</text>
        </g>

        <!-- Análise Inicial -->
        <g data-element-id="AnaliseInicial">
          <rect x="130" y="270" width="100" height="60" fill="#e3f2fd" stroke="#2196f3" stroke-width="2" rx="8"/>
          <text x="180" y="295" text-anchor="middle" font-size="11" font-weight="bold">Análise</text>
          <text x="180" y="310" text-anchor="middle" font-size="11" font-weight="bold">Inicial</text>
        </g>

        <!-- Gateway Viabilidade -->
        <g data-element-id="GatewayViabilidade">
          <polygon points="280,280 310,300 280,320 250,300" fill="#fff3e0" stroke="#ff9800" stroke-width="3"/>
          <text x="280" y="345" text-anchor="middle" font-size="9" font-weight="bold">Viável?</text>
        </g>

        <!-- Rejeitar -->
        <g data-element-id="RejeitarProjeto">
          <rect x="320" y="380" width="100" height="50" fill="#ffebee" stroke="#f44336" stroke-width="2" rx="8"/>
          <text x="370" y="405" text-anchor="middle" font-size="11" font-weight="bold">Rejeitar</text>
          <text x="370" y="420" text-anchor="middle" font-size="11" font-weight="bold">Projeto</text>
        </g>

        <!-- Planejamento -->
        <g data-element-id="PlanejamentoProjeto">
          <rect x="360" y="200" width="100" height="60" fill="#e8f5e8" stroke="#4caf50" stroke-width="2" rx="8"/>
          <text x="410" y="225" text-anchor="middle" font-size="11" font-weight="bold">Planejar</text>
          <text x="410" y="240" text-anchor="middle" font-size="11" font-weight="bold">Projeto</text>
        </g>

        <!-- Gateway Paralelo -->
        <g data-element-id="GatewayParalelo1">
          <polygon points="520,210 550,230 520,250 490,230" fill="#e1f5fe" stroke="#03a9f4" stroke-width="3"/>
          <text x="520" y="275" text-anchor="middle" font-size="9" font-weight="bold">Dividir</text>
          <text x="520" y="287" text-anchor="middle" font-size="9" font-weight="bold">Tarefas</text>
        </g>

        <!-- Formar Equipe -->
        <g data-element-id="FormarEquipe">
          <rect x="580" y="120" width="100" height="50" fill="#f3e5f5" stroke="#9c27b0" stroke-width="2" rx="8"/>
          <text x="630" y="145" text-anchor="middle" font-size="11" font-weight="bold">Formar</text>
          <text x="630" y="158" text-anchor="middle" font-size="11" font-weight="bold">Equipe</text>
        </g>

        <!-- Alocar Recursos -->
        <g data-element-id="AlocarRecursos">
          <rect x="580" y="200" width="100" height="50" fill="#e8f5e8" stroke="#4caf50" stroke-width="2" rx="8"/>
          <text x="630" y="225" text-anchor="middle" font-size="11" font-weight="bold">Alocar</text>
          <text x="630" y="238" text-anchor="middle" font-size="11" font-weight="bold">Recursos</text>
        </g>

        <!-- Definir Cronograma -->
        <g data-element-id="DefinirCronograma">
          <rect x="580" y="280" width="100" height="50" fill="#fff3e0" stroke="#ff9800" stroke-width="2" rx="8"/>
          <text x="630" y="305" text-anchor="middle" font-size="11" font-weight="bold">Definir</text>
          <text x="630" y="318" text-anchor="middle" font-size="11" font-weight="bold">Cronograma</text>
        </g>

        <!-- Gateway Paralelo 2 -->
        <g data-element-id="GatewayParalelo2">
          <polygon points="740,210 770,230 740,250 710,230" fill="#e1f5fe" stroke="#03a9f4" stroke-width="3"/>
          <text x="740" y="275" text-anchor="middle" font-size="9" font-weight="bold">Reunir</text>
        </g>

        <!-- Execução (Subprocesso) -->
        <g data-element-id="ExecucaoProjeto">
          <rect x="820" y="200" width="120" height="60" fill="#e0f2f1" stroke="#00695c" stroke-width="3" rx="8" stroke-dasharray="5,5"/>
          <text x="880" y="225" text-anchor="middle" font-size="11" font-weight="bold">Execução</text>
          <text x="880" y="240" text-anchor="middle" font-size="11" font-weight="bold">do Projeto</text>
          <text x="880" y="255" text-anchor="middle" font-size="9">+</text>
        </g>

        <!-- Fim Sucesso -->
        <g data-element-id="FimSucesso">
          <circle cx="1050" cy="230" r="25" fill="#c8e6c9" stroke="#4caf50" stroke-width="4"/>
          <text x="1050" y="265" text-anchor="middle" font-size="10" font-weight="bold">Sucesso</text>
        </g>

        <!-- Fim Rejeição -->
        <g data-element-id="FimRejeicao">
          <circle cx="480" cy="405" r="20" fill="#ffcdd2" stroke="#f44336" stroke-width="4"/>
          <text x="480" y="435" text-anchor="middle" font-size="10" font-weight="bold">Rejeitado</text>
        </g>

        <!-- Fluxos principais -->
        <g data-element-id="SequenceFlow_1">
          <line x1="75" y1="300" x2="130" y2="300" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_2">
          <line x1="230" y1="300" x2="250" y2="300" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_Viavel">
          <line x1="290" y1="280" x2="360" y2="240" stroke="#4caf50" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="325" y="255" text-anchor="middle" font-size="10" fill="#4caf50" font-weight="bold">Sim</text>
        </g>
        <g data-element-id="SequenceFlow_Inviavel">
          <line x1="290" y1="320" x2="360" y2="390" stroke="#f44336" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="325" y="360" text-anchor="middle" font-size="10" fill="#f44336" font-weight="bold">Não</text>
        </g>
        <g data-element-id="SequenceFlow_3">
          <line x1="460" y1="230" x2="490" y2="230" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_Equipe">
          <line x1="530" y1="210" x2="580" y2="155" stroke="#9c27b0" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_Recursos">
          <line x1="550" y1="230" x2="580" y2="225" stroke="#4caf50" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_Cronograma">
          <line x1="530" y1="250" x2="580" y2="295" stroke="#ff9800" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_EquipeFormada">
          <line x1="680" y1="155" x2="720" y2="210" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_RecursosAlocados">
          <line x1="680" y1="225" x2="710" y2="230" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_CronogramaPronto">
          <line x1="680" y1="295" x2="720" y2="250" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_6">
          <line x1="770" y1="230" x2="820" y2="230" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_8">
          <line x1="940" y1="230" x2="1025" y2="230" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_FimRejeicao">
          <line x1="420" y1="405" x2="460" y2="405" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
      </svg>
    `;
  }

  generateDefaultDiagram() {
    return this.generateSimpleDiagram();
  }

  addInteractivity() {
    // Adiciona interatividade aos elementos
    const elements = this.container.querySelectorAll("[data-element-id]");
    elements.forEach((element) => {
      element.style.cursor = "pointer";
      element.addEventListener("mouseenter", () => {
        element.style.opacity = "0.8";
        element.style.transform = "scale(1.05)";
        element.style.transition = "all 0.2s ease";
      });
      element.addEventListener("mouseleave", () => {
        element.style.opacity = "1";
        element.style.transform = "scale(1)";
      });
    });
  }
}

// Classes auxiliares
export class Navigation {
  fit() {
    console.log("🎯 Ajustando visualização ao container");
  }
}

export class BpmnElementsRegistry {
  getElementsByIds(ids) {
    return ids
      .map((id) => document.querySelector(`[data-element-id="${id}"]`))
      .filter(Boolean);
  }
}
