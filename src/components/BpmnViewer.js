// Importação da biblioteca padrão bpmn-visualization-js melhorada
import { BpmnVisualization } from "../lib/bpmn-visualization-standard.js";
/**
 * Enums para estilos de caminho
 */
export var PathStyle;
(function (PathStyle) {
  PathStyle["PRIMARY"] = "main";
  PathStyle["ALTERNATIVE"] = "alternative";
  PathStyle["ACTIVE"] = "active";
  PathStyle["ERROR"] = "error";
  PathStyle["SUCCESS"] = "success";
})(PathStyle || (PathStyle = {}));
/**
 * Classe principal do visualizador BPMN
 * Gerencia a visualização de diagramas BPMN com funcionalidades avançadas
 */
export class BpmnViewer {
  constructor(containerId) {
    this.currentDiagram = "";
    this.currentZoom = 1;
    this.container = document.getElementById(containerId);
    this.bpmnVisualization = new BpmnVisualization({
      container: containerId,
      navigation: {
        enabled: true,
      },
    });
    this.pathDrawer = new PathDrawer(this.bpmnVisualization);
    this.processSimulator = new ProcessSimulator(this.bpmnVisualization);
    this.setupEventListeners();
    this.addStyleSheet();
  }
  /**
   * Adiciona estilos CSS para animações
   */
  addStyleSheet() {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
      
      .visual-feedback {
        border-radius: 0.5rem;
        font-size: 0.9rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
      }
    `;
    document.head.appendChild(style);
  }
  /**
   * Carrega um diagrama BPMN a partir de XML
   */
  async loadBpmn(bpmnXml) {
    try {
      this.showLoading();
      this.currentDiagram = bpmnXml;
      await this.bpmnVisualization.load(bpmnXml);
      // Verificar se é um diagrama grande e ajustar zoom
      this.smartFitDiagram(bpmnXml);
      this.addVisualFeedback("Diagrama BPMN carregado com sucesso", "success");
      this.enhanceBpmnElements();
    } catch (error) {
      console.error("Erro ao carregar BPMN:", error);
      this.addVisualFeedback("Erro ao carregar diagrama BPMN", "error");
    } finally {
      this.hideLoading();
    }
  }
  /**
   * Ajusta o diagrama inteligentemente baseado no tamanho
   */
  smartFitDiagram(bpmnXml) {
    // Contar elementos para determinar complexidade
    const elementCount = (bpmnXml.match(/<bpmn:/g) || []).length;
    const isLargeDiagram = elementCount > 15; // Mais de 15 elementos
    if (isLargeDiagram) {
      // Para diagramas grandes, começar com zoom menor
      this.fitDiagram();
      setTimeout(() => {
        this.currentZoom = 0.7; // Zoom out para 70%
        this.bpmnVisualization.navigation.zoom(this.currentZoom);
        this.addVisualFeedback(
          `Diagrama grande detectado - Zoom ajustado para ${Math.round(
            this.currentZoom * 100
          )}%`,
          "info"
        );
      }, 300);
    } else {
      // Para diagramas pequenos, usar fit normal
      this.fitDiagram();
    }
  }
  /**
   * Melhora os elementos BPMN com classes CSS - versão profissional simplificada
   */
  enhanceBpmnElements() {
    setTimeout(() => {
      const svg = this.container.querySelector("svg");
      if (!svg) return;
      // Apenas adicionar classes básicas para identificação, sem animações excessivas
      svg
        .querySelectorAll(
          '[data-element-id*="start"], [data-element-id*="Start"], [data-element-id*="Inicio"]'
        )
        .forEach((element) => element.classList.add("bpmn-element-start"));
      svg
        .querySelectorAll(
          '[data-element-id*="end"], [data-element-id*="End"], [data-element-id*="Fim"]'
        )
        .forEach((element) => element.classList.add("bpmn-element-end"));
      svg
        .querySelectorAll(
          '[data-element-id*="gateway"], [data-element-id*="Gateway"]'
        )
        .forEach((element) => element.classList.add("bpmn-element-gateway"));
      svg
        .querySelectorAll(
          '[data-element-id*="task"], [data-element-id*="Task"]'
        )
        .forEach((element) => element.classList.add("bpmn-element-task"));
      svg
        .querySelectorAll(
          '[data-element-id*="subprocess"], [data-element-id*="SubProcess"], [data-element-id*="Execucao"]'
        )
        .forEach((element) => element.classList.add("bpmn-element-subprocess"));
    }, 300);
  }
  /**
   * Ajusta o diagrama para caber no container
   */
  fitDiagram() {
    this.bpmnVisualization.navigation.fit();
    this.currentZoom = 1;
    this.addVisualFeedback("Diagrama ajustado", "info");
  }
  /**
   * Zoom in no diagrama com efeito visual
   */
  zoomIn() {
    const newZoom = this.bpmnVisualization.navigation.zoomIn();
    this.currentZoom = newZoom;
    this.addVisualFeedback(`Zoom: ${Math.round(newZoom * 100)}%`, "info");
  }
  /**
   * Zoom out no diagrama com efeito visual
   */
  zoomOut() {
    const newZoom = this.bpmnVisualization.navigation.zoomOut();
    this.currentZoom = newZoom;
    this.addVisualFeedback(`Zoom: ${Math.round(newZoom * 100)}%`, "info");
  }
  /**
   * Reset da visualização
   */
  reset() {
    this.pathDrawer.clearAllPaths();
    this.processSimulator.stop();
    this.fitDiagram();
    this.addVisualFeedback("Visualização resetada", "info");
  }
  /**
   * Desenha um caminho no diagrama
   */
  drawPath(pathElements, pathStyle = PathStyle.PRIMARY) {
    this.pathDrawer.drawPath(pathElements, pathStyle);
    this.addVisualFeedback(
      `Caminho ${pathStyle} desenhado com ${pathElements.length} elementos`,
      "success"
    );
  }
  /**
   * Inicia simulação de processo
   */
  simulateProcess() {
    this.processSimulator.start();
    this.addVisualFeedback("Simulação de processo iniciada", "info");
  }
  /**
   * Para simulação de processo
   */
  stopSimulation() {
    this.processSimulator.stop();
    this.addVisualFeedback("Simulação parada", "warning");
  }
  /**
   * Adiciona feedback visual profissional e discreto
   */
  addVisualFeedback(message, type = "info") {
    // Remover feedback anterior se existir
    const existingFeedback = document.querySelector(".visual-feedback");
    if (existingFeedback) {
      existingFeedback.remove();
    }
    const feedback = document.createElement("div");
    feedback.className = `visual-feedback ${type}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    // Remover após 3 segundos
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 3000);
  }
  /**
   * Mostra indicador de carregamento
   */
  showLoading() {
    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    this.container.appendChild(overlay);
  }
  /**
   * Oculta indicador de carregamento
   */
  hideLoading() {
    const overlay = this.container.querySelector(".loading-overlay");
    if (overlay) {
      overlay.remove();
    }
  }
  /**
   * Configura event listeners
   */
  setupEventListeners() {
    // Listeners para hover nos elementos BPMN
    this.container.addEventListener("mouseover", (event) => {
      const target = event.target;
      if (target.closest("[data-element-id]")) {
        this.showTooltip(target, event);
      }
    });
    this.container.addEventListener("mouseout", (event) => {
      this.hideTooltip();
    });
  }
  /**
   * Mostra tooltip ao fazer hover
   */
  showTooltip(element, event) {
    const elementId = element
      .closest("[data-element-id]")
      ?.getAttribute("data-element-id");
    if (!elementId) return;
    const tooltip = document.createElement("div");
    tooltip.className = "bpmn-tooltip show";
    tooltip.textContent = `Elemento: ${elementId}`;
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 10}px`;
    document.body.appendChild(tooltip);
  }
  /**
   * Oculta tooltip
   */
  hideTooltip() {
    const tooltip = document.querySelector(".bpmn-tooltip");
    if (tooltip) {
      tooltip.remove();
    }
  }
}
/**
 * Classe para desenhar caminhos no diagrama BPMN
 */
export class PathDrawer {
  constructor(bpmnVisualization) {
    this.drawnPaths = new Set();
    this.bpmnVisualization = bpmnVisualization;
  }
  /**
   * Desenha um caminho com estilo profissional
   */
  drawPath(pathElements, style) {
    const pathId = `path-${Date.now()}`;
    this.drawnPaths.add(pathId);
    // Desenho sequencial mais rápido e profissional
    pathElements.forEach((elementId, index) => {
      setTimeout(() => {
        this.highlightElement(elementId, style);
      }, index * 150); // Mais rápido que antes
    });
  }
  /**
   * Destaca um elemento específico usando classes CSS profissionais
   */
  highlightElement(elementId, style) {
    try {
      // Verificar se o elemento existe na biblioteca real
      const element =
        this.bpmnVisualization.bpmnElementsRegistry.getElementById(elementId);
      if (element) {
        // A biblioteca real gerencia os elementos BPMN
        // Adicionar classes via DOM para manter a funcionalidade atual
        const domElement =
          document.querySelector(`[data-element-id="${elementId}"]`) ||
          document.querySelector(`#${elementId}`);
        if (domElement) {
          domElement.classList.add(`bpmn-path-${style}`);
          if (style === PathStyle.ACTIVE) {
            domElement.classList.add("bpmn-element-highlighted");
          }
        }
      }
    } catch (error) {
      // Fallback mais robusto para diferentes seletores possíveis
      console.warn("Using fallback element highlighting method");
      const selectors = [
        `[data-element-id="${elementId}"]`,
        `#${elementId}`,
        `[data-bpmn-id="${elementId}"]`,
        `.bpmn-element[id*="${elementId}"]`,
      ];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          element.classList.add(`bpmn-path-${style}`);
          if (style === PathStyle.ACTIVE) {
            element.classList.add("bpmn-element-highlighted");
          }
          break;
        }
      }
    }
  }
  /**
   * Limpa todos os caminhos desenhados usando métodos robustos
   */
  clearAllPaths() {
    // Múltiplos seletores para garantir que todos os elementos sejam limpos
    const selectors = [
      "[data-element-id]",
      "[data-bpmn-id]",
      ".bpmn-element",
      ".bpmn-shape",
      ".bpmn-connection",
    ];
    selectors.forEach((selector) => {
      const allElements = document.querySelectorAll(selector);
      allElements.forEach((element) => {
        element.classList.remove(
          "bpmn-path-main",
          "bpmn-path-alternative",
          "bpmn-path-active",
          "bpmn-path-error",
          "bpmn-path-success",
          "bpmn-element-highlighted"
        );
      });
    });
    this.drawnPaths.clear();
  }
  /**
   * Destaca elementos de forma animada
   */
  animatePathSequence(pathElements, style) {
    pathElements.forEach((elementId, index) => {
      setTimeout(() => {
        const element = document.querySelector(
          `[data-element-id="${elementId}"]`
        );
        if (element) {
          element.classList.add(`bpmn-path-${style}`);
          element.style.animationDelay = `${index * 0.2}s`;
        }
      }, index * 200);
    });
  }
}
/**
 * Classe para simular execução de processo
 */
export class ProcessSimulator {
  constructor(bpmnVisualization) {
    this.isRunning = false;
    this.currentStep = 0;
    this.bpmnVisualization = bpmnVisualization;
  }
  /**
   * Inicia a simulação
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.runSimulation();
  }
  /**
   * Para a simulação
   */
  stop() {
    this.isRunning = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    this.clearSimulationEffects();
  }
  /**
   * Executa a simulação passo a passo
   */
  runSimulation() {
    const elements = document.querySelectorAll("[data-element-id]");
    this.simulationInterval = window.setInterval(() => {
      if (!this.isRunning || this.currentStep >= elements.length) {
        this.stop();
        return;
      }
      const element = elements[this.currentStep];
      element.classList.add("bpmn-path-active");
      // Remove destaque anterior
      if (this.currentStep > 0) {
        elements[this.currentStep - 1].classList.remove("bpmn-path-active");
      }
      this.currentStep++;
    }, 1000);
  }
  /**
   * Limpa efeitos da simulação
   */
  clearSimulationEffects() {
    const elements = document.querySelectorAll("[data-element-id]");
    elements.forEach((element) => {
      element.classList.remove("bpmn-path-active");
    });
  }
}
//# sourceMappingURL=BpmnViewer.js.map
