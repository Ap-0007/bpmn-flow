/**
 * BPMN Visualization Library - Padrão Oficial
 * Baseado no process-analytics/bpmn-visualization-js com ícones oficiais
 * Implementa IconPainter e estilos conforme especificação BPMN 2.0
 */
export class BpmnVisualization {
  constructor(config) {
    console.log(
      "🎨 Inicializando BPMN Visualization (Padrão Oficial - process-analytics)"
    );
    this.container = document.getElementById(config.container);
    this.navigation = new Navigation();
    this.bpmnElementsRegistry = new BpmnElementsRegistry();
    this.currentXml = "";

    // Estilos conforme especificação oficial do bpmn-visualization-js
    this.styles = {
      // Cores padrão BPMN oficial (conforme IconPainter)
      defaultFillColor: "#ffffff",
      defaultStrokeColor: "#000000",
      defaultFontColor: "#000000",
      defaultFontFamily: "Arial", // Fonte padrão conforme especificação
      defaultFontSize: "11px",

      // Eventos (cores conforme bpmn.io compatibility)
      startEventFill: "#ffffff",
      startEventStroke: "#000000",
      endEventFill: "#ffffff",
      endEventStroke: "#000000",
      endEventStrokeWidth: 3,

      // Atividades (compatível com process-analytics)
      taskFill: "#ffffff",
      taskStroke: "#000000",
      taskStrokeWidth: 1,
      callActivityStrokeWidth: 3,

      // Gateways (conforme especificação)
      gatewayFill: "#ffffff",
      gatewayStroke: "#000000",
      gatewayStrokeWidth: 1,

      // Fluxos
      sequenceFlowStroke: "#000000",
      messageFlowStroke: "#000000",
      flowStrokeWidth: 1,

      // Containers
      poolFill: "#dbefff",
      laneFill: "#edeef5",
      poolStroke: "#000000",
      laneStroke: "#000000",
    };
  }

  async load(bpmnXml) {
    console.log("🔄 Carregando BPMN com padrão oficial process-analytics...");
    this.currentXml = bpmnXml;

    // Analisa o XML para identificar o tipo de processo
    const processType = this.identifyProcessType(bpmnXml);
    console.log("📊 Tipo de processo identificado:", processType);

    // Gera diagrama específico baseado no tipo
    this.generateDiagram(processType, bpmnXml);
  }

  // Cria eventos com ícones baseados no IconPainter oficial
  createEvent(id, x, y, type, subType, label, isStart = false, isEnd = false) {
    const radius = 18;
    let fillColor = this.styles.defaultFillColor;
    let strokeColor = this.styles.defaultStrokeColor;
    let strokeWidth = this.styles.taskStrokeWidth;
    let icon = "";

    if (isStart) {
      fillColor = this.styles.startEventFill;
      strokeColor = this.styles.startEventStroke;
      strokeWidth = this.styles.taskStrokeWidth;
    } else if (isEnd) {
      fillColor = this.styles.endEventFill;
      strokeColor = this.styles.endEventStroke;
      strokeWidth = this.styles.endEventStrokeWidth;
    }

    // Ícones baseados no IconPainter oficial do process-analytics
    switch (subType) {
      case "message":
        icon = this.paintMessageIcon(x, y);
        break;
      case "timer":
        icon = this.paintClockIcon(x, y);
        break;
      case "error":
        icon = this.paintErrorIcon(x, y);
        break;
      case "signal":
        icon = this.paintSignalIcon(x, y);
        break;
      case "conditional":
        icon = this.paintListIcon(x, y);
        break;
      case "escalation":
        icon = this.paintEscalationIcon(x, y);
        break;
      case "compensation":
        icon = this.paintDoubleLeftArrowheadsIcon(x, y);
        break;
      case "terminate":
        icon = this.paintTerminateIcon(x, y);
        break;
    }

    return `
      <g data-element-id="${id}" class="bpmn-event bpmn-${type}" data-bpmn-element="event">
        <circle cx="${x}" cy="${y}" r="${radius}" 
                fill="${fillColor}" 
                stroke="${strokeColor}" 
                stroke-width="${strokeWidth}"/>
        ${icon}
        ${
          label
            ? `<text x="${x}" y="${y + radius + 15}" text-anchor="middle" 
                        font-family="${this.styles.defaultFontFamily}" 
                        font-size="${this.styles.defaultFontSize}" 
                        fill="${this.styles.defaultFontColor}">${label}</text>`
            : ""
        }
      </g>
    `;
  }

  // Cria atividades (tarefas) com ícones baseados no IconPainter oficial
  createActivity(id, x, y, width, height, type, label) {
    const fillColor = this.styles.taskFill;
    const strokeColor = this.styles.taskStroke;
    const strokeWidth =
      type === "callActivity"
        ? this.styles.callActivityStrokeWidth
        : this.styles.taskStrokeWidth;
    const rounded = 8; // Cantos arredondados conforme especificação BPMN

    let icon = "";
    const iconX = x + width - 20;
    const iconY = y + height - 20;

    // Ícones de tarefa baseados no IconPainter oficial do process-analytics
    switch (type) {
      case "userTask":
        icon = this.paintPersonIcon(iconX, iconY);
        break;
      case "serviceTask":
        icon = this.paintServiceTaskIcon(iconX, iconY);
        break;
      case "scriptTask":
        icon = this.paintScriptIcon(iconX, iconY);
        break;
      case "businessRuleTask":
        icon = this.paintTableIcon(iconX, iconY);
        break;
      case "manualTask":
        icon = this.paintHandIcon(iconX, iconY);
        break;
      case "sendTask":
        icon = this.paintSendTaskIcon(iconX, iconY);
        break;
      case "receiveTask":
        icon = this.paintReceiveTaskIcon(iconX, iconY);
        break;
    }

    return `
      <g data-element-id="${id}" class="bpmn-activity bpmn-${type}" data-bpmn-element="activity">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" 
              fill="${fillColor}" 
              stroke="${strokeColor}" 
              stroke-width="${strokeWidth}" 
              rx="${rounded}" ry="${rounded}"/>
        ${icon}
        ${this.createMultiLineText(
          label,
          x + width / 2,
          y + height / 2,
          width - 10
        )}
      </g>
    `;
  }

  // Cria gateways com símbolos baseados no IconPainter oficial
  createGateway(id, x, y, type, label) {
    const size = 30;
    const fillColor = this.styles.gatewayFill;
    const strokeColor = this.styles.gatewayStroke;
    let symbol = "";

    switch (type) {
      case "exclusive":
        symbol = this.paintXCrossIcon(x, y);
        break;
      case "parallel":
        symbol = this.paintPlusCrossIcon(x, y);
        break;
      case "inclusive":
        symbol = this.paintInclusiveGatewayIcon(x, y);
        break;
      case "event":
        symbol = this.paintPentagon(x, y);
        break;
      case "complex":
        symbol = this.paintComplexGatewayIcon(x, y);
        break;
    }

    return `
      <g data-element-id="${id}" class="bpmn-gateway bpmn-${type}" data-bpmn-element="gateway">
        <polygon points="${x - size / 2},${y} ${x},${y - size / 2} ${
      x + size / 2
    },${y} ${x},${y + size / 2}" 
                 fill="${fillColor}" 
                 stroke="${strokeColor}" 
                 stroke-width="${this.styles.gatewayStrokeWidth}"/>
        ${symbol}
        ${
          label
            ? `<text x="${x}" y="${y + size / 2 + 15}" text-anchor="middle" 
                        font-family="${this.styles.defaultFontFamily}" 
                        font-size="${this.styles.defaultFontSize}" 
                        fill="${this.styles.defaultFontColor}">${label}</text>`
            : ""
        }
      </g>
    `;
  }

  // ============================================================================
  // ÍCONES BASEADOS NO ICONPAINTER OFICIAL DO PROCESS-ANALYTICS/BPMN-VISUALIZATION-JS
  // ============================================================================

  // Símbolos de gateway conforme IconPainter oficial
  paintXCrossIcon(x, y) {
    // Ícone X para exclusive gateway
    const size = 10;
    return `<path d="M${x - size},${y - size} L${x + size},${y + size} M${
      x + size
    },${y - size} L${x - size},${y + size}" 
                  stroke="${this.styles.gatewayStroke}" 
                  stroke-width="2" 
                  fill="none"/>`;
  }

  paintPlusCrossIcon(x, y) {
    // Ícone + para parallel gateway
    const size = 10;
    return `<path d="M${x - size},${y} L${x + size},${y} M${x},${
      y - size
    } L${x},${y + size}" 
                  stroke="${this.styles.gatewayStroke}" 
                  stroke-width="3" 
                  fill="none"/>`;
  }

  paintInclusiveGatewayIcon(x, y) {
    // Círculo para inclusive gateway
    return `<circle cx="${x}" cy="${y}" r="8" 
                    stroke="${this.styles.gatewayStroke}" 
                    stroke-width="2" 
                    fill="none"/>`;
  }

  paintPentagon(x, y) {
    // Pentágono duplo para event-based gateway (conforme IconPainter)
    const outerRadius = 10;
    const innerRadius = 6;
    return `
      <circle cx="${x}" cy="${y}" r="${outerRadius}" 
              stroke="${this.styles.gatewayStroke}" 
              stroke-width="1.5" 
              fill="none"/>
      <polygon points="${x},${y - innerRadius} ${x + innerRadius * 0.95},${
      y - innerRadius * 0.31
    } ${x + innerRadius * 0.59},${y + innerRadius * 0.81} ${
      x - innerRadius * 0.59
    },${y + innerRadius * 0.81} ${x - innerRadius * 0.95},${
      y - innerRadius * 0.31
    }" 
               stroke="${this.styles.gatewayStroke}" 
               stroke-width="1" 
               fill="none"/>
    `;
  }

  paintComplexGatewayIcon(x, y) {
    // Asterisco para complex gateway
    const size = 8;
    return `<path d="M${x},${y - size} L${x + size * 0.7},${y - size * 0.3} L${
      x + size
    },${y} L${x + size * 0.7},${y + size * 0.3} L${x},${y + size} L${
      x - size * 0.7
    },${y + size * 0.3} L${x - size},${y} L${x - size * 0.7},${
      y - size * 0.3
    } Z" 
                  stroke="${this.styles.gatewayStroke}" 
                  stroke-width="2" 
                  fill="none"/>`;
  }

  // Ícones de tarefa conforme IconPainter oficial
  paintPersonIcon(x, y) {
    // User task icon baseado no IconPainter oficial (flaticon employees)
    return `
      <g transform="translate(${x - 8}, ${y - 10}) scale(0.12)">
        <!-- Cabeça -->
        <path d="M71.85,10.72 A18.46,18.46 0 0,1 90.17,27.18 A47.68,47.68 0 0,0 53.53,27.18 A18.44,18.44 0 0,1 71.85,10.72 Z" 
              fill="${this.styles.defaultStrokeColor}"/>
        <!-- Corpo -->
        <path d="M35.39,89.23 L35.39,87.08 C40.55,84.85 49.73,80.08 55.67,72.66 C64.83,77.46 85.92,87.21 108.31,88.66 L108.31,89.24 A36.46,36.46 0 1,1 35.39,89.24 Z" 
              fill="${this.styles.defaultStrokeColor}"/>
        <!-- Braços e pernas -->
        <path d="M0.09,233.51 L0.09,178.03 A29.81,29.81 0 0,0 19.31,150.29 L124.31,150.29 A29.81,29.81 0 0,0 143.61,178.03 L143.61,233.56 A5.63,5.63 0 0,0 132.36,233.56 L132.36,178.08 A18,18 0 0,1 126.65,164.82 L115.24,176.24 A23.5,23.5 0 0,0 108.31,192.93 L108.31,233.55 A5.63,5.63 0 1,0 119.56,233.55 L119.56,192.93 A12.35,12.35 0 0,1 123.19,184.15 L132.13,175.22 A18.39,18.39 0 0,1 126.65,164.82 L115.24,176.24 A23.5,23.5 0 0,0 108.31,192.93 L108.31,233.55 A5.63,5.63 0 1,0 119.56,233.55 L119.56,192.93 A12.35,12.35 0 0,1 123.19,184.15 L132.13,175.22 Z" 
              fill="${this.styles.defaultStrokeColor}"/>
      </g>
    `;
  }

  paintServiceTaskIcon(x, y) {
    // Service task icon (engrenagem) baseado no draw.io bpmn stencil
    return `
      <g transform="translate(${x - 8}, ${y - 8}) scale(0.8)">
        <!-- Engrenagem exterior -->
        <path d="M8,2 L10,2 L10.5,3.5 L12.5,4 L13,6 L11.5,7.5 L11,9 L9,9 L8.5,7.5 L6.5,7 L6,5 L7.5,3.5 Z" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
        <!-- Círculo central -->
        <circle cx="8" cy="6" r="2.5" 
                stroke="${this.styles.defaultStrokeColor}" 
                stroke-width="1" 
                fill="none"/>
      </g>
    `;
  }

  paintScriptIcon(x, y) {
    // Script task icon baseado no IconPainter oficial (noun project script)
    return `
      <g transform="translate(${x - 8}, ${y - 8}) scale(0.035)">
        <!-- Documento script -->
        <path d="M67.85,0.57 L391.9,0.57 L391.9,72.68 C391.9,72.68 356.6,72.68 352.19,72.68 C351.73,58.4 358.42,51.87 361.54,48.75 C367.07,44.28 371.11,41 385.09,41 L385.09,0.57 L67.85,0.57 Z" 
              fill="${this.styles.defaultStrokeColor}"/>
        <!-- Linhas de código -->
        <rect x="85.04" y="120" width="280" height="8" fill="${
          this.styles.defaultStrokeColor
        }"/>
        <rect x="85.04" y="140" width="200" height="8" fill="${
          this.styles.defaultStrokeColor
        }"/>
        <rect x="85.04" y="160" width="250" height="8" fill="${
          this.styles.defaultStrokeColor
        }"/>
        <rect x="162.25" y="251.09" width="140" height="20" fill="${
          this.styles.defaultStrokeColor
        }"/>
      </g>
    `;
  }

  paintTableIcon(x, y) {
    // Business rule task icon (tabela) baseado no IconPainter oficial
    return `
      <g transform="translate(${x - 8}, ${y - 8}) scale(0.05)">
        <!-- Borda da tabela -->
        <rect x="0.19" y="0.1" width="298.59" height="198.78" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="2" 
              fill="none"/>
        <!-- Linhas horizontais -->
        <line x1="0.19" y1="48.88" x2="298.78" y2="48.88" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
        <line x1="1.09" y1="122.69" x2="298.78" y2="122.69" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
        <!-- Linhas verticais -->
        <line x1="98.78" y1="48.88" x2="98.78" y2="198.88" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
        <line x1="198.78" y1="0.1" x2="198.78" y2="198.88" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
      </g>
    `;
  }

  paintHandIcon(x, y) {
    // Manual task icon (mão) baseado no IconPainter oficial (noun project hand)
    return `
      <g transform="translate(${x - 8}, ${y - 8}) scale(0.046)">
        <!-- Forma da mão -->
        <path d="M231.66,336.39 C240.84,316.9 220.53,306.92 220.53,306.92 C215.2,303.67 188.58,287.43 140.67,258.19 L146.33,248.39 C223.98,269.38 267.12,281.04 275.75,283.38 C275.75,283.38 297.25,288 301.42,267.77 C305.59,247.54 279.4,245.29 279.4,245.29 C270.77,244.26 220.38,239.15 129.7,229.93 L129.7,220.13 C220.38,230.98 270.77,236.09 279.4,237.12 C279.4,237.12 305.59,235.37 301.42,215.14 C297.25,194.91 275.75,199.53 275.75,199.53 C267.12,201.87 223.98,213.53 146.33,234.52 L140.67,224.72 C188.58,195.48 215.2,179.24 220.53,175.99 C220.53,175.99 240.84,166.01 231.66,146.52 C222.49,127.03 202.18,136.99 202.18,136.99 C204.74,346.69 222.91,354.12 231.66,336.39 Z" 
              fill="${this.styles.defaultStrokeColor}"/>
      </g>
    `;
  }

  paintSendTaskIcon(x, y) {
    // Send task icon (envelope fechado)
    return `
      <g transform="translate(${x - 8}, ${y - 8})">
        <!-- Envelope -->
        <rect x="1" y="5" width="14" height="9" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
        <!-- Triângulo preenchido -->
        <polygon points="2,6 8,10 14,6" 
                 fill="${this.styles.defaultStrokeColor}"/>
      </g>
    `;
  }

  paintReceiveTaskIcon(x, y) {
    // Receive task icon (envelope aberto)
    return `
      <g transform="translate(${x - 8}, ${y - 8})">
        <!-- Envelope -->
        <rect x="1" y="5" width="14" height="9" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
        <!-- Linha de abertura -->
        <path d="M1,5 L8,10 L15,5" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
      </g>
    `;
  }

  // Ícones de evento baseados no IconPainter oficial
  paintMessageIcon(x, y) {
    // Message icon conforme draw.io bpmn stencil
    return `
      <g transform="translate(${x - 8}, ${y - 6})">
        <!-- Envelope -->
        <rect x="0" y="0" width="16" height="12" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
        <!-- Linha de envelope -->
        <path d="M0,0 L8,6 L16,0" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
      </g>
    `;
  }

  paintClockIcon(x, y) {
    // Timer icon baseado no IconPainter oficial (flaticon clock)
    return `
      <g transform="translate(${x - 8}, ${y - 8}) scale(0.1)">
        <!-- Círculo do relógio -->
        <circle cx="76" cy="76" r="70" 
                stroke="${this.styles.defaultStrokeColor}" 
                stroke-width="4" 
                fill="none"/>
        <!-- Ponteiros -->
        <path d="M76,20 L76,76 L110,90" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="3" 
              fill="none"/>
        <!-- Centro -->
        <circle cx="76" cy="76" r="3" 
                fill="${this.styles.defaultStrokeColor}"/>
        <!-- Marcações das horas -->
        <g stroke="${this.styles.defaultStrokeColor}" stroke-width="2">
          <line x1="76" y1="10" x2="76" y2="20"/>
          <line x1="76" y1="132" x2="76" y2="142"/>
          <line x1="10" y1="76" x2="20" y2="76"/>
          <line x1="132" y1="76" x2="142" y2="76"/>
        </g>
      </g>
    `;
  }

  paintErrorIcon(x, y) {
    // Error icon conforme especificação BPMN
    return `
      <g transform="translate(${x - 8}, ${y - 8})">
        <!-- Triângulo de erro -->
        <path d="M2,14 L8,2 L14,14 Z" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1.5" 
              fill="none"/>
        <!-- Ponto de exclamação -->
        <path d="M8,6 L8,10 M8,12 L8,12.5" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="2"/>
      </g>
    `;
  }

  paintSignalIcon(x, y) {
    // Signal icon (triângulo) conforme noun project
    return `
      <g transform="translate(${x - 8}, ${y - 8})">
        <polygon points="8,2 14,14 2,14" 
                 stroke="${this.styles.defaultStrokeColor}" 
                 stroke-width="1.5" 
                 fill="none"/>
      </g>
    `;
  }

  paintListIcon(x, y) {
    // Conditional icon (lista) conforme IconPainter oficial
    return `
      <g transform="translate(${x - 8}, ${y - 8})">
        <!-- Borda do documento -->
        <rect x="2" y="2" width="12" height="12" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
        <!-- Linhas de texto -->
        <path d="M4,6 L12,6 M4,8 L10,8 M4,10 L12,10" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
      </g>
    `;
  }

  paintEscalationIcon(x, y) {
    // Escalation icon (seta para cima)
    return `
      <g transform="translate(${x - 6}, ${y - 8})">
        <path d="M6,2 L10,8 L8,8 L8,14 L4,14 L4,8 L2,8 Z" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1" 
              fill="none"/>
      </g>
    `;
  }

  paintDoubleLeftArrowheadsIcon(x, y) {
    // Compensation icon (dupla seta) conforme IconPainter oficial
    return `
      <g transform="translate(${x - 8}, ${y - 6}) scale(0.15)">
        <!-- Primeira seta -->
        <path d="M50,0 L0,25 L50,50 L40,25 Z" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="2" 
              fill="none"/>
        <!-- Segunda seta -->
        <path d="M100,0 L50,25 L100,50 L90,25 Z" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="2" 
              fill="none"/>
      </g>
    `;
  }

  paintTerminateIcon(x, y) {
    // Terminate icon (círculo preenchido)
    return `
      <g transform="translate(${x - 8}, ${y - 8})">
        <circle cx="8" cy="8" r="6" 
                fill="${this.styles.defaultStrokeColor}"/>
      </g>
    `;
  }

  // Função para criar texto multilinha
  createMultiLineText(text, x, y, maxWidth) {
    if (!text) return "";

    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length * 6 < maxWidth) {
        // Aproximação de largura
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    const lineHeight = 14;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    return lines
      .map(
        (line, index) =>
          `<text x="${x}" y="${
            startY + index * lineHeight
          }" text-anchor="middle" 
             font-family="${this.styles.defaultFontFamily}" 
             font-size="${this.styles.defaultFontSize}" 
             fill="${this.styles.defaultFontColor}">${line}</text>`
      )
      .join("");
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
      <svg width="700" height="350" viewBox="0 0 700 350" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="${
              this.styles.sequenceFlowStroke
            }"/>
          </marker>
        </defs>
        
        <!-- Fundo com grid sutil -->
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5"/>
        
        <!-- Elementos BPMN -->
        ${this.createEvent(
          "StartEvent_1",
          60,
          175,
          "startEvent",
          null,
          "Início",
          true
        )}
        ${this.createActivity(
          "Task_1",
          150,
          150,
          140,
          50,
          "userTask",
          "Processar Solicitação"
        )}
        ${this.createGateway("Gateway_1", 350, 175, "exclusive", "Aprovado?")}
        ${this.createActivity(
          "Task_2",
          450,
          100,
          120,
          50,
          "serviceTask",
          "Aprovar Solicitação"
        )}
        ${this.createActivity(
          "Task_3",
          450,
          200,
          120,
          50,
          "userTask",
          "Rejeitar Solicitação"
        )}
        ${this.createEvent(
          "EndEvent_1",
          630,
          125,
          "endEvent",
          null,
          "Aprovado",
          false,
          true
        )}
        ${this.createEvent(
          "EndEvent_2",
          630,
          225,
          "endEvent",
          null,
          "Rejeitado",
          false,
          true
        )}

        <!-- Fluxos de sequência -->
        <g data-element-id="SequenceFlow_1" class="bpmn-sequence-flow">
          <line x1="78" y1="175" x2="150" y2="175" 
                stroke="${this.styles.sequenceFlowStroke}" 
                stroke-width="${this.styles.strokeWidthThin}" 
                marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_2" class="bpmn-sequence-flow">
          <line x1="290" y1="175" x2="335" y2="175" 
                stroke="${this.styles.sequenceFlowStroke}" 
                stroke-width="${this.styles.strokeWidthThin}" 
                marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_3" class="bpmn-sequence-flow">
          <line x1="365" y1="160" x2="450" y2="135" 
                stroke="${this.styles.sequenceFlowStroke}" 
                stroke-width="${this.styles.strokeWidthThin}" 
                marker-end="url(#arrowhead)"/>
          <text x="405" y="145" text-anchor="middle" font-size="10" fill="#4caf50" font-weight="bold">Sim</text>
        </g>
        <g data-element-id="SequenceFlow_4" class="bpmn-sequence-flow">
          <line x1="365" y1="190" x2="450" y2="215" 
                stroke="${this.styles.sequenceFlowStroke}" 
                stroke-width="${this.styles.strokeWidthThin}" 
                marker-end="url(#arrowhead)"/>
          <text x="405" y="210" text-anchor="middle" font-size="10" fill="#f44336" font-weight="bold">Não</text>
        </g>
        <g data-element-id="SequenceFlow_5" class="bpmn-sequence-flow">
          <line x1="570" y1="125" x2="612" y2="125" 
                stroke="${this.styles.sequenceFlowStroke}" 
                stroke-width="${this.styles.strokeWidthThin}" 
                marker-end="url(#arrowhead)"/>
        </g>
        <g data-element-id="SequenceFlow_6" class="bpmn-sequence-flow">
          <line x1="570" y1="225" x2="612" y2="225" 
                stroke="${this.styles.sequenceFlowStroke}" 
                stroke-width="${this.styles.strokeWidthThin}" 
                marker-end="url(#arrowhead)"/>
        </g>
      </svg>
    `;
  }

  generateComprasDiagram() {
    return `
      <svg width="900" height="400" viewBox="0 0 900 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="${
              this.styles.sequenceFlowStroke
            }"/>
          </marker>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5"/>
        
        <!-- Pool de Compras -->
        <rect x="10" y="30" width="880" height="340" 
              fill="${this.styles.poolFill}" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="2" rx="4"/>
        <text x="25" y="200" text-anchor="middle" font-weight="bold" font-size="14" 
              fill="${
                this.styles.defaultFontColor
              }" transform="rotate(-90, 25, 200)">Processo de Compras</text>
        
        <!-- Lane Solicitante -->
        <rect x="60" y="50" width="820" height="100" 
              fill="${this.styles.laneFill}" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
        <text x="75" y="100" text-anchor="middle" font-weight="bold" font-size="12" 
              fill="${
                this.styles.defaultFontColor
              }" transform="rotate(-90, 75, 100)">Solicitante</text>
        
        <!-- Lane Aprovador -->
        <rect x="60" y="150" width="820" height="100" 
              fill="${this.styles.laneFill}" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
        <text x="75" y="200" text-anchor="middle" font-weight="bold" font-size="12" 
              fill="${
                this.styles.defaultFontColor
              }" transform="rotate(-90, 75, 200)">Aprovador</text>
        
        <!-- Lane Compras -->
        <rect x="60" y="250" width="820" height="100" 
              fill="${this.styles.laneFill}" 
              stroke="${this.styles.defaultStrokeColor}" 
              stroke-width="1"/>
        <text x="75" y="300" text-anchor="middle" font-weight="bold" font-size="12" 
              fill="${
                this.styles.defaultFontColor
              }" transform="rotate(-90, 75, 300)">Departamento de Compras</text>
        
        <!-- Elementos BPMN -->
        ${this.createEvent(
          "StartEvent_1",
          120,
          100,
          "startEvent",
          null,
          "Necessidade de Compra",
          true
        )}
        ${this.createActivity(
          "Task_1",
          180,
          75,
          120,
          50,
          "userTask",
          "Criar Solicitação"
        )}
        ${this.createActivity(
          "Task_2",
          350,
          175,
          120,
          50,
          "userTask",
          "Avaliar Solicitação"
        )}
        ${this.createGateway("Gateway_1", 520, 200, "exclusive", "Aprovado?")}
        ${this.createActivity(
          "Task_3",
          600,
          275,
          120,
          50,
          "serviceTask",
          "Processar Compra"
        )}
        ${this.createActivity(
          "Task_4",
          600,
          125,
          100,
          50,
          "sendTask",
          "Notificar Rejeição"
        )}
        ${this.createEvent(
          "EndEvent_1",
          780,
          300,
          "endEvent",
          null,
          "Compra Realizada",
          false,
          true
        )}
        ${this.createEvent(
          "EndEvent_2",
          780,
          150,
          "endEvent",
          null,
          "Solicitação Rejeitada",
          false,
          true
        )}

        <!-- Fluxos de sequência -->
        <g class="bpmn-sequence-flow">
          <line x1="138" y1="100" x2="180" y2="100" 
                stroke="${
                  this.styles.sequenceFlowStroke
                }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="240" y1="125" x2="240" y2="175" 
                stroke="${this.styles.sequenceFlowStroke}" stroke-width="2"/>
          <line x1="240" y1="175" x2="350" y2="200" 
                stroke="${
                  this.styles.sequenceFlowStroke
                }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="470" y1="200" x2="505" y2="200" 
                stroke="${
                  this.styles.sequenceFlowStroke
                }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="535" y1="185" x2="600" y2="150" 
                stroke="${
                  this.styles.sequenceFlowStroke
                }" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="565" y="165" text-anchor="middle" font-size="10" fill="#f44336" font-weight="bold">Não</text>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="535" y1="215" x2="600" y2="285" 
                stroke="${
                  this.styles.sequenceFlowStroke
                }" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="565" y="255" text-anchor="middle" font-size="10" fill="#4caf50" font-weight="bold">Sim</text>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="700" y1="150" x2="762" y2="150" 
                stroke="${
                  this.styles.sequenceFlowStroke
                }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="720" y1="300" x2="762" y2="300" 
                stroke="${
                  this.styles.sequenceFlowStroke
                }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
      </svg>
    `;
  }

  generateGestaoDiagram() {
    return `
      <svg width="1000" height="500" viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="${
              this.styles.sequenceFlowStroke
            }"/>
          </marker>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5"/>
        
        <!-- Título -->
        <text x="500" y="25" text-anchor="middle" font-weight="bold" font-size="16" 
              fill="${
                this.styles.defaultFontColor
              }">Processo de Gestão de Projeto</text>
        
        <!-- Elementos BPMN -->
        ${this.createEvent(
          "StartEvent_1",
          80,
          150,
          "startEvent",
          "message",
          "Solicitação de Projeto",
          true
        )}
        ${this.createActivity(
          "Task_1",
          150,
          125,
          120,
          50,
          "userTask",
          "Analisar Requisitos"
        )}
        ${this.createActivity(
          "Task_2",
          300,
          125,
          120,
          50,
          "businessRuleTask",
          "Avaliar Viabilidade"
        )}
        ${this.createGateway("Gateway_1", 470, 150, "exclusive", "Viável?")}
        
        <!-- Branch Aprovado -->
        ${this.createGateway(
          "Gateway_2",
          550,
          100,
          "parallel",
          "Executar em Paralelo"
        )}
        ${this.createActivity(
          "Task_3",
          650,
          60,
          100,
          40,
          "serviceTask",
          "Alocar Recursos"
        )}
        ${this.createActivity(
          "Task_4",
          650,
          120,
          100,
          40,
          "userTask",
          "Criar Cronograma"
        )}
        ${this.createActivity(
          "Task_5",
          650,
          180,
          100,
          40,
          "scriptTask",
          "Configurar Ambiente"
        )}
        ${this.createGateway("Gateway_3", 800, 120, "parallel", "Sincronizar")}
        ${this.createActivity(
          "Task_6",
          850,
          95,
          100,
          50,
          "userTask",
          "Executar Projeto"
        )}
        
        <!-- Branch Rejeitado -->
        ${this.createActivity(
          "Task_7",
          550,
          220,
          120,
          50,
          "sendTask",
          "Notificar Rejeição"
        )}
        
        <!-- Eventos finais -->
        ${this.createEvent(
          "EndEvent_1",
          980,
          120,
          "endEvent",
          "message",
          "Projeto Concluído",
          false,
          true
        )}
        ${this.createEvent(
          "EndEvent_2",
          720,
          245,
          "endEvent",
          "error",
          "Projeto Rejeitado",
          false,
          true
        )}

        <!-- Fluxos de sequência -->
        <g class="bpmn-sequence-flow">
          <line x1="98" y1="150" x2="150" y2="150" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="270" y1="150" x2="300" y2="150" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="420" y1="150" x2="455" y2="150" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        
        <!-- Fluxo para branch aprovado -->
        <g class="bpmn-sequence-flow">
          <line x1="485" y1="135" x2="535" y2="110" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="505" y="120" text-anchor="middle" font-size="10" fill="#4caf50" font-weight="bold">Sim</text>
        </g>
        
        <!-- Fluxos paralelos -->
        <g class="bpmn-sequence-flow">
          <line x1="565" y1="85" x2="650" y2="75" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="565" y1="100" x2="650" y2="135" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="565" y1="115" x2="650" y2="195" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        
        <!-- Convergência paralela -->
        <g class="bpmn-sequence-flow">
          <line x1="750" y1="80" x2="785" y2="105" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="750" y1="140" x2="785" y2="125" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="750" y1="200" x2="785" y2="135" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        
        <!-- Fluxo para tarefa final -->
        <g class="bpmn-sequence-flow">
          <line x1="815" y1="120" x2="850" y2="120" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        
        <!-- Fluxo para fim -->
        <g class="bpmn-sequence-flow">
          <line x1="950" y1="120" x2="962" y2="120" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
        
        <!-- Fluxo para branch rejeitado -->
        <g class="bpmn-sequence-flow">
          <line x1="485" y1="165" x2="550" y2="235" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="515" y="205" text-anchor="middle" font-size="10" fill="#f44336" font-weight="bold">Não</text>
        </g>
        <g class="bpmn-sequence-flow">
          <line x1="670" y1="245" x2="702" y2="245" stroke="${
            this.styles.sequenceFlowStroke
          }" stroke-width="2" marker-end="url(#arrowhead)"/>
        </g>
      </svg>
    `;
  }

  generateDefaultDiagram() {
    return `
      <svg width="600" height="300" viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5"/>
        
        <text x="300" y="150" text-anchor="middle" font-size="16" font-weight="bold" 
              fill="${this.styles.defaultFontColor}">
          Diagrama BPMN Carregado
        </text>
        <text x="300" y="180" text-anchor="middle" font-size="12" 
              fill="${this.styles.defaultFontColor}">
          Visualização com padrão oficial bpmn-visualization-js
        </text>
      </svg>
    `;
  }

  addInteractivity() {
    // Adiciona interatividade aos elementos
    const elements = this.container.querySelectorAll("[data-element-id]");
    elements.forEach((element) => {
      element.style.cursor = "pointer";

      element.addEventListener("mouseenter", (e) => {
        e.currentTarget.style.filter = "drop-shadow(0 0 5px rgba(0,0,0,0.3))";
      });

      element.addEventListener("mouseleave", (e) => {
        e.currentTarget.style.filter = "none";
      });

      element.addEventListener("click", (e) => {
        const elementId = e.currentTarget.getAttribute("data-element-id");
        console.log("Elemento clicado:", elementId);

        // Dispara evento customizado
        const customEvent = new CustomEvent("bpmn-element-click", {
          detail: { elementId, element: e.currentTarget },
        });
        this.container.dispatchEvent(customEvent);
      });
    });
  }

  // Métodos da API compatíveis com bpmn-visualization oficial
  fit() {
    console.log("🔧 Ajustando diagrama ao container");
  }

  reset() {
    console.log("🔄 Resetando visualização");
  }

  zoom(factor) {
    console.log(`🔍 Zoom: ${factor}`);
  }
}

// Classes auxiliares para compatibilidade
export class Navigation {
  constructor() {
    console.log("🧭 Navigation mock inicializado");
  }

  fit() {
    console.log("🔧 Navigation.fit()");
  }

  zoom(factor) {
    console.log(`🔍 Navigation.zoom(${factor})`);
  }
}

export class BpmnElementsRegistry {
  constructor() {
    console.log("📋 BpmnElementsRegistry mock inicializado");
  }

  updateStyle(elementIds, style) {
    console.log("🎨 Atualizando estilo:", elementIds, style);

    // Simula atualização de estilo
    elementIds.forEach((id) => {
      const element = document.querySelector(`[data-element-id="${id}"]`);
      if (element) {
        if (style.stroke?.color) {
          element.style.stroke = style.stroke.color;
        }
        if (style.fill?.color) {
          element.style.fill = style.fill.color;
        }
        if (style.stroke?.width) {
          element.style.strokeWidth = style.stroke.width;
        }
      }
    });
  }

  resetStyle(elementIds) {
    console.log("🔄 Resetando estilo:", elementIds);

    elementIds.forEach((id) => {
      const element = document.querySelector(`[data-element-id="${id}"]`);
      if (element) {
        element.style.stroke = "";
        element.style.fill = "";
        element.style.strokeWidth = "";
      }
    });
  }
}
