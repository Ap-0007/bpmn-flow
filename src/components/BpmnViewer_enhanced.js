// Importação mock para desenvolvimento
import { BpmnVisualization } from "../lib/bpmn-visualization-mock.js";
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
            this.fitDiagram();
            this.addVisualFeedback("Diagrama BPMN carregado com sucesso", "success");
            this.enhanceBpmnElements();
        }
        catch (error) {
            console.error("Erro ao carregar BPMN:", error);
            this.addVisualFeedback("Erro ao carregar diagrama BPMN", "error");
        }
        finally {
            this.hideLoading();
        }
    }
    /**
     * Melhora os elementos BPMN com classes CSS
     */
    enhanceBpmnElements() {
        setTimeout(() => {
            const svg = this.container.querySelector("svg");
            if (!svg)
                return;
            // Melhorar eventos de início
            svg
                .querySelectorAll('[data-element-id*="start"], [data-element-id*="Start"], [data-element-id*="Inicio"]')
                .forEach((element) => element.classList.add("bpmn-element-start"));
            // Melhorar eventos de fim
            svg
                .querySelectorAll('[data-element-id*="end"], [data-element-id*="End"], [data-element-id*="Fim"]')
                .forEach((element) => element.classList.add("bpmn-element-end"));
            // Melhorar gateways
            svg
                .querySelectorAll('[data-element-id*="gateway"], [data-element-id*="Gateway"]')
                .forEach((element) => element.classList.add("bpmn-element-gateway"));
            // Melhorar tarefas
            svg
                .querySelectorAll('[data-element-id*="task"], [data-element-id*="Task"]')
                .forEach((element) => element.classList.add("bpmn-element-task"));
            // Melhorar subprocessos
            svg
                .querySelectorAll('[data-element-id*="subprocess"], [data-element-id*="SubProcess"], [data-element-id*="Execucao"]')
                .forEach((element) => element.classList.add("bpmn-element-subprocess"));
        }, 500);
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
        this.currentZoom = Math.min(this.currentZoom * 1.2, 3);
        const svg = this.container.querySelector("svg");
        if (svg) {
            this.setScale(svg, this.currentZoom);
            this.addVisualFeedback(`Zoom: ${Math.round(this.currentZoom * 100)}%`, "info");
        }
    }
    /**
     * Zoom out no diagrama com efeito visual
     */
    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom * 0.8, 0.3);
        const svg = this.container.querySelector("svg");
        if (svg) {
            this.setScale(svg, this.currentZoom);
            this.addVisualFeedback(`Zoom: ${Math.round(this.currentZoom * 100)}%`, "info");
        }
    }
    /**
     * Define a escala do SVG
     */
    setScale(svg, scale) {
        const viewBox = svg.viewBox.baseVal;
        const centerX = viewBox.x + viewBox.width / 2;
        const centerY = svg.viewBox.baseVal.y + viewBox.height / 2;
        svg.style.transform = `scale(${scale})`;
        svg.style.transformOrigin = `${centerX}px ${centerY}px`;
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
        this.addVisualFeedback(`Caminho ${pathStyle} desenhado com ${pathElements.length} elementos`, "success");
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
     * Adiciona feedback visual temporário
     */
    addVisualFeedback(message, type = "info") {
        const feedback = document.createElement("div");
        feedback.className = `visual-feedback ${type}`;
        feedback.textContent = message;
        feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 1rem 2rem;
      border-radius: 0.5rem;
      font-weight: 600;
      z-index: 10000;
      animation: fadeInOut 3s ease-in-out forwards;
      pointer-events: none;
      max-width: 300px;
      text-align: center;
      border: 2px solid transparent;
    `;
        // Adicionar estilos específicos por tipo
        switch (type) {
            case "success":
                feedback.style.background =
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(16, 185, 129, 0.9))";
                feedback.style.borderColor = "rgba(34, 197, 94, 0.5)";
                break;
            case "warning":
                feedback.style.background =
                    "linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(251, 191, 36, 0.9))";
                feedback.style.borderColor = "rgba(245, 158, 11, 0.5)";
                break;
            case "error":
                feedback.style.background =
                    "linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(248, 113, 113, 0.9))";
                feedback.style.borderColor = "rgba(239, 68, 68, 0.5)";
                break;
            default:
                feedback.style.background =
                    "linear-gradient(135deg, rgba(37, 99, 235, 0.9), rgba(59, 130, 246, 0.9))";
                feedback.style.borderColor = "rgba(37, 99, 235, 0.5)";
        }
        document.body.appendChild(feedback);
        // Remover após a animação
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
        if (!elementId)
            return;
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
     * Desenha um caminho com estilo específico
     */
    drawPath(pathElements, style) {
        const pathId = `path-${Date.now()}`;
        this.drawnPaths.add(pathId);
        pathElements.forEach((elementId, index) => {
            setTimeout(() => {
                this.highlightElement(elementId, style, index);
            }, index * 300); // Animação sequencial
        });
    }
    /**
     * Destaca um elemento específico
     */
    highlightElement(elementId, style, delay = 0) {
        setTimeout(() => {
            const element = document.querySelector(`[data-element-id="${elementId}"]`);
            if (element) {
                element.classList.add(`bpmn-path-${style}`);
                element.classList.add("bpmn-element-highlighted");
            }
        }, delay);
    }
    /**
     * Limpa todos os caminhos desenhados
     */
    clearAllPaths() {
        const allElements = document.querySelectorAll("[data-element-id]");
        allElements.forEach((element) => {
            element.classList.remove("bpmn-path-main", "bpmn-path-alternative", "bpmn-path-active", "bpmn-path-error", "bpmn-path-success", "bpmn-element-highlighted");
        });
        this.drawnPaths.clear();
    }
    /**
     * Destaca elementos de forma animada
     */
    animatePathSequence(pathElements, style) {
        pathElements.forEach((elementId, index) => {
            setTimeout(() => {
                const element = document.querySelector(`[data-element-id="${elementId}"]`);
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
        if (this.isRunning)
            return;
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
//# sourceMappingURL=BpmnViewer_enhanced.js.map