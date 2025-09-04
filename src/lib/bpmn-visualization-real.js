// Biblioteca oficial bpmn-visualization-js integrada
import {
  BpmnVisualization as RealBpmnVisualization,
  FitType,
} from "./bpmn-visualization.esm.js";

/**
 * Wrapper da biblioteca real bpmn-visualization-js
 * Integra a biblioteca oficial mantendo compatibilidade com nosso código
 */
export class BpmnVisualization {
  constructor(config) {
    console.log("🚀 Inicializando bpmn-visualization-js oficial");

    // Inicializar biblioteca real
    this.bpmnVisualization = new RealBpmnVisualization({
      container: config.container,
      navigation: {
        enabled: config.navigation?.enabled ?? true,
      },
    });

    this.container = document.getElementById(config.container);
    this.navigation = new Navigation(this.bpmnVisualization);
    this.bpmnElementsRegistry = new BpmnElementsRegistry(
      this.bpmnVisualization
    );
  }

  async load(bpmnXml) {
    console.log("📊 Carregando BPMN com biblioteca oficial...");

    try {
      // Usar a biblioteca real para carregar o XML
      await this.bpmnVisualization.load(bpmnXml);
      console.log("✅ BPMN carregado com sucesso!");

      // Auto-fit após carregamento
      setTimeout(() => {
        this.bpmnVisualization.fit();
      }, 100);
    } catch (error) {
      console.error("❌ Erro ao carregar BPMN:", error);
      throw error;
    }
  }

  /**
   * Obtém elemento por ID
   */
  getElementById(id) {
    const elements = this.container.querySelectorAll(
      `[data-element-id="${id}"]`
    );
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Obtém todos os elementos de um tipo
   */
  getElementsByType(type) {
    const typeMap = {
      startEvent: '[data-element-kind="startEvent"]',
      endEvent: '[data-element-kind="endEvent"]',
      task: '[data-element-kind="task"]',
      userTask: '[data-element-kind="userTask"]',
      serviceTask: '[data-element-kind="serviceTask"]',
      gateway: '[data-element-kind*="Gateway"]',
      exclusiveGateway: '[data-element-kind="exclusiveGateway"]',
      parallelGateway: '[data-element-kind="parallelGateway"]',
      inclusiveGateway: '[data-element-kind="inclusiveGateway"]',
      sequenceFlow: '[data-element-kind="sequenceFlow"]',
      subprocess: '[data-element-kind="subProcess"]',
    };

    const selector = typeMap[type] || `[data-element-kind="${type}"]`;
    return this.container.querySelectorAll(selector);
  }

  /**
   * Aplica estilo a um elemento específico
   */
  addCssClasses(elementId, classNames) {
    const element = this.getElementById(elementId);
    if (element) {
      if (Array.isArray(classNames)) {
        element.classList.add(...classNames);
      } else {
        element.classList.add(classNames);
      }
    }
  }

  /**
   * Remove estilo de um elemento
   */
  removeCssClasses(elementId, classNames) {
    const element = this.getElementById(elementId);
    if (element) {
      if (Array.isArray(classNames)) {
        element.classList.remove(...classNames);
      } else {
        element.classList.remove(classNames);
      }
    }
  }

  /**
   * Aplica overlay colorido a um elemento
   */
  addOverlays(elementId, overlays) {
    const element = this.getElementById(elementId);
    if (element && overlays.length > 0) {
      const overlay = overlays[0];

      // Aplicar cor de fundo
      if (overlay.fill) {
        const shapes = element.querySelectorAll("rect, circle, polygon, path");
        shapes.forEach((shape) => {
          shape.style.fill = overlay.fill.color;
          if (overlay.fill.opacity) {
            shape.style.fillOpacity = overlay.fill.opacity;
          }
        });
      }

      // Aplicar cor de stroke
      if (overlay.stroke) {
        const shapes = element.querySelectorAll("rect, circle, polygon, path");
        shapes.forEach((shape) => {
          shape.style.stroke = overlay.stroke.color;
          if (overlay.stroke.width) {
            shape.style.strokeWidth = overlay.stroke.width;
          }
        });
      }

      // Adicionar classe CSS se especificada
      if (overlay.className) {
        element.classList.add(overlay.className);
      }
    }
  }

  /**
   * Remove todos os overlays
   */
  removeOverlays() {
    const allElements = this.container.querySelectorAll("[data-element-id]");
    allElements.forEach((element) => {
      // Remover estilos inline
      element
        .querySelectorAll("rect, circle, polygon, path")
        .forEach((shape) => {
          shape.style.removeProperty("fill");
          shape.style.removeProperty("fill-opacity");
          shape.style.removeProperty("stroke");
          shape.style.removeProperty("stroke-width");
        });

      // Remover classes de caminho
      element.classList.remove(
        "bpmn-path-main",
        "bpmn-path-alternative",
        "bpmn-path-active",
        "bpmn-path-error",
        "bpmn-path-success",
        "bpmn-element-highlighted"
      );
    });
  }
}

/**
 * Classe de navegação integrada com biblioteca real
 */
export class Navigation {
  constructor(bpmnVisualization) {
    this.bpmnVisualization = bpmnVisualization;
  }

  fit() {
    this.bpmnVisualization.fit({
      type: FitType.Center,
      margin: 20,
    });
  }

  zoom(level) {
    this.bpmnVisualization.zoom(level);
  }

  zoomIn() {
    const currentZoom = this.bpmnVisualization.getZoom();
    const newZoom = Math.min(currentZoom * 1.2, 3);
    this.bpmnVisualization.zoom(newZoom);
    return newZoom;
  }

  zoomOut() {
    const currentZoom = this.bpmnVisualization.getZoom();
    const newZoom = Math.max(currentZoom * 0.8, 0.3);
    this.bpmnVisualization.zoom(newZoom);
    return newZoom;
  }

  getZoomLevel() {
    return this.bpmnVisualization.getZoom();
  }
}

/**
 * Registry de elementos BPMN
 */
export class BpmnElementsRegistry {
  constructor(bpmnVisualization) {
    this.bpmnVisualization = bpmnVisualization;
  }

  getElementsByType(type) {
    const container = document.getElementById(this.bpmnVisualization.container);
    const typeMap = {
      startEvent: '[data-element-kind="startEvent"]',
      endEvent: '[data-element-kind="endEvent"]',
      task: '[data-element-kind*="Task"]',
      gateway: '[data-element-kind*="Gateway"]',
      sequenceFlow: '[data-element-kind="sequenceFlow"]',
    };

    const selector = typeMap[type] || `[data-element-kind="${type}"]`;
    return container?.querySelectorAll(selector) || [];
  }

  getElementById(id) {
    const container = document.getElementById(this.bpmnVisualization.container);
    return container?.querySelector(`[data-element-id="${id}"]`) || null;
  }
}
