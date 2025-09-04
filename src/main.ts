import { BpmnViewer, PathStyle } from "./components/BpmnViewer.js";
import { FileUtils, PathUtils } from "./utils/BpmnUtils.js";
import { BpmnFileManager } from "./utils/BpmnFileManager.js";

/**
 * Classe principal da aplicação
 * Gerencia a interface do usuário e coordena as funcionalidades
 */
class BpmnVisualizerApp {
  private viewer: BpmnViewer;
  private fileSelector: HTMLSelectElement;
  private currentFileName: string = "";

  constructor() {
    this.viewer = new BpmnViewer("bpmn-container");
    this.fileSelector = document.getElementById(
      "fileSelector"
    ) as HTMLSelectElement;
    this.setupEventListeners();
    this.loadAvailableFiles();
    this.updateUI();
  }

  /**
   * Carrega lista de arquivos BPMN disponíveis
   */
  private loadAvailableFiles(): void {
    const files = BpmnFileManager.getAvailableFiles();

    // Limpa opções existentes (exceto a primeira)
    this.fileSelector.innerHTML =
      '<option value="">Selecione um arquivo BPMN...</option>';

    // Adiciona arquivos disponíveis
    files.forEach((filename) => {
      const option = document.createElement("option");
      const fileInfo = BpmnFileManager.getBpmnFileInfo(filename);
      option.value = filename;
      option.textContent = `${fileInfo.name} (${fileInfo.complexity})`;
      option.title = fileInfo.description;
      this.fileSelector.appendChild(option);
    });
  }

  /**
   * Configura todos os event listeners da interface
   */
  private setupEventListeners(): void {
    // Seletor de arquivo
    this.fileSelector.addEventListener(
      "change",
      this.handleFileSelection.bind(this)
    );

    // Botões principais - apenas os que existem agora
    document
      .getElementById("drawPath")
      ?.addEventListener("click", this.drawMainPath.bind(this));
    document
      .getElementById("resetView")
      ?.addEventListener("click", this.resetView.bind(this));

    // Controles de visualização
    document
      .getElementById("fitDiagram")
      ?.addEventListener("click", () => this.viewer.fitDiagram());
    document
      .getElementById("zoomIn")
      ?.addEventListener("click", () => this.viewer.zoomIn());
    document
      .getElementById("zoomOut")
      ?.addEventListener("click", () => this.viewer.zoomOut());

    // Controles de caminho
    document
      .getElementById("showPath1")
      ?.addEventListener("click", this.showMainPath.bind(this));
    document
      .getElementById("showPath2")
      ?.addEventListener("click", this.showAlternativePath.bind(this));
    document
      .getElementById("clearPaths")
      ?.addEventListener("click", this.clearPaths.bind(this));

    // Controles de monitoramento
    document
      .getElementById("simulateProcess")
      ?.addEventListener("click", () => this.viewer.simulateProcess());
    document
      .getElementById("stopSimulation")
      ?.addEventListener("click", () => this.viewer.stopSimulation());
  }

  /**
   * Manipula a seleção de arquivo no dropdown
   */
  private async handleFileSelection(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    this.currentFileName = target.value;

    // Carrega automaticamente quando seleciona um arquivo
    if (this.currentFileName) {
      await this.loadSelectedFile();
    }
  }

  /**
   * Carrega o arquivo selecionado no dropdown
   */
  private async loadSelectedFile(): Promise<void> {
    if (!this.currentFileName) {
      this.showNotification("Selecione um arquivo primeiro", "error");
      return;
    }

    try {
      const content = await BpmnFileManager.loadBpmnFile(this.currentFileName);
      await this.viewer.loadBpmn(content);

      const fileInfo = BpmnFileManager.getBpmnFileInfo(this.currentFileName);
      this.showNotification(
        `Arquivo "${fileInfo.name}" carregado com sucesso!`,
        "success"
      );
    } catch (error) {
      console.error("Erro ao carregar arquivo:", error);
      this.showNotification("Erro ao carregar arquivo selecionado", "error");
    }
  }

  /**
   * Carrega diagrama de exemplo usando o primeiro arquivo disponível
   */
  private async loadSampleDiagram(): Promise<void> {
    try {
      const files = BpmnFileManager.getAvailableFiles();
      if (files.length > 0) {
        const firstFile = files[0];
        const content = await BpmnFileManager.loadBpmnFile(firstFile);
        await this.viewer.loadBpmn(content);

        this.currentFileName = firstFile;
        this.fileSelector.value = firstFile;

        const fileInfo = BpmnFileManager.getBpmnFileInfo(firstFile);
        this.showNotification(`Exemplo carregado: ${fileInfo.name}`, "info");
      } else {
        // Fallback para exemplo hardcoded
        const sampleBpmn = FileUtils.getSampleBpmn();
        await this.viewer.loadBpmn(sampleBpmn);
        this.showNotification("Diagrama de exemplo carregado!", "info");
      }
    } catch (error) {
      console.error("Erro ao carregar exemplo:", error);
      // Fallback para exemplo hardcoded
      const sampleBpmn = FileUtils.getSampleBpmn();
      await this.viewer.loadBpmn(sampleBpmn);
      this.showNotification("Diagrama de exemplo carregado!", "info");
    }
  }

  /**
   * Desenha o caminho principal
   */
  /**
   * Desenha o caminho principal baseado no arquivo atual
   */
  private drawMainPath(): void {
    if (!this.currentFileName) {
      this.showNotification("Carregue um arquivo primeiro", "error");
      return;
    }

    const paths = BpmnFileManager.getPredefinedPaths(this.currentFileName);
    if (paths.mainPath.length > 0) {
      this.viewer.drawPath(paths.mainPath, PathStyle.PRIMARY);
      this.showNotification("Caminho principal desenhado", "info");
    } else {
      // Fallback para caminhos genéricos
      const mainPath = PathUtils.getMainPath();
      this.viewer.drawPath(mainPath, PathStyle.PRIMARY);
      this.showNotification("Caminho principal desenhado", "info");
    }
  }

  /**
   * Mostra o caminho principal
   */
  private showMainPath(): void {
    if (!this.currentFileName) {
      this.showNotification("Carregue um arquivo primeiro", "error");
      return;
    }

    this.viewer.reset();
    const paths = BpmnFileManager.getPredefinedPaths(this.currentFileName);
    if (paths.mainPath.length > 0) {
      this.viewer.drawPath(paths.mainPath, PathStyle.PRIMARY);
      this.showNotification("Caminho principal (aprovação)", "info");
    } else {
      // Fallback para caminhos genéricos
      const mainPath = PathUtils.getMainPath();
      this.viewer.drawPath(mainPath, PathStyle.PRIMARY);
      this.showNotification("Caminho principal (aprovação)", "info");
    }
  }

  /**
   * Mostra o caminho alternativo
   */
  private showAlternativePath(): void {
    if (!this.currentFileName) {
      this.showNotification("Carregue um arquivo primeiro", "error");
      return;
    }

    this.viewer.reset();
    const paths = BpmnFileManager.getPredefinedPaths(this.currentFileName);
    if (paths.alternativePath.length > 0) {
      this.viewer.drawPath(paths.alternativePath, PathStyle.ALTERNATIVE);
      this.showNotification("Caminho alternativo (rejeição)", "info");
    } else {
      // Fallback para caminhos genéricos
      const altPath = PathUtils.getAlternativePath();
      this.viewer.drawPath(altPath, PathStyle.ALTERNATIVE);
      this.showNotification("Caminho alternativo (rejeição)", "info");
    }
  }

  /**
   * Limpa todos os caminhos
   */
  private clearPaths(): void {
    this.viewer.reset();
    this.showNotification("Caminhos limpos", "info");
  }

  /**
   * Reset completo da visualização
   */
  private resetView(): void {
    this.viewer.reset();
    this.fileSelector.value = "";
    this.currentFileName = "";
    this.showNotification("Visualização resetada", "info");
  }

  /**
   * Atualiza elementos da interface
   */
  private updateUI(): void {
    // Adiciona tooltips aos botões
    this.addTooltips();
  }

  /**
   * Adiciona tooltips informativos
   */
  private addTooltips(): void {
    const tooltips = {
      fileInput: "Selecione um arquivo BPMN (.bpmn ou .xml)",
      loadSample: "Carrega um diagrama BPMN de exemplo",
      drawPath: "Desenha o caminho principal no diagrama",
      resetView: "Limpa tudo e reseta a visualização",
      fitDiagram: "Ajusta o diagrama para caber na tela",
      zoomIn: "Aumenta o zoom",
      zoomOut: "Diminui o zoom",
      showPath1: "Mostra o caminho de aprovação",
      showPath2: "Mostra o caminho de rejeição",
      clearPaths: "Remove todos os caminhos destacados",
      simulateProcess: "Simula a execução do processo",
      stopSimulation: "Para a simulação em andamento",
    };

    Object.entries(tooltips).forEach(([id, tooltip]) => {
      const element = document.getElementById(id);
      if (element) {
        element.title = tooltip;
      }
    });
  }

  /**
   * Exibe notificação para o usuário
   */
  private showNotification(
    message: string,
    type: "success" | "error" | "info"
  ): void {
    // Remove notificação anterior se existir
    const existingNotification = document.querySelector(".notification");
    if (existingNotification) {
      existingNotification.remove();
    }

    // Cria nova notificação
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Estiliza a notificação
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "12px 20px",
      borderRadius: "8px",
      color: "white",
      fontWeight: "500",
      zIndex: "1000",
      animation: "slideIn 0.3s ease-out",
      backgroundColor:
        type === "success"
          ? "#48bb78"
          : type === "error"
          ? "#f56565"
          : "#4299e1",
    });

    document.body.appendChild(notification);

    // Remove após 3 segundos
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-out";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

/**
 * Inicializa a aplicação quando o DOM estiver carregado
 */
document.addEventListener("DOMContentLoaded", () => {
  try {
    new BpmnVisualizerApp();
    console.log("🔄 BPMN Visualizador iniciado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao inicializar aplicação:", error);
  }
});

// Adiciona estilos para as animações das notificações
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    .path-primary {
        stroke: #48bb78 !important;
        stroke-width: 4px !important;
        stroke-dasharray: 8,4;
        animation: pathFlow 2s linear infinite;
    }

    .path-secondary {
        stroke: #ed8936 !important;
        stroke-width: 4px !important;
        stroke-dasharray: 8,4;
        animation: pathFlow 2s linear infinite;
    }

    .path-tertiary {
        stroke: #9f7aea !important;
        stroke-width: 4px !important;
        stroke-dasharray: 8,4;
        animation: pathFlow 2s linear infinite;
    }

    @keyframes pathFlow {
        0% { stroke-dashoffset: 20; }
        100% { stroke-dashoffset: 0; }
    }
`;
document.head.appendChild(style);
