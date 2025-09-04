/**
 * Utilitário para gerenciar arquivos BPMN da pasta bpmn-files
 */
export class BpmnFileManager {
  /**
   * Lista todos os arquivos BPMN disponíveis
   */
  static getAvailableFiles() {
    console.log("🔍 BpmnFileManager.getAvailableFiles() chamado");
    // Lista hardcoded dos arquivos disponíveis
    // Em um ambiente real, isso poderia ser obtido via API
    const files = [
      "processo-simples.bpmn",
      "processo-compras.bpmn",
      "processo-gestao-projeto.bpmn",
    ];
    console.log("📁 Arquivos encontrados:", files);
    return files;
  }
  /**
   * Carrega um arquivo BPMN específico
   */
  static async loadBpmnFile(filename) {
    try {
      const response = await fetch(`${this.BPMN_FILES_PATH}${filename}`);
      if (!response.ok) {
        throw new Error(`Erro ao carregar arquivo: ${response.statusText}`);
      }
      const content = await response.text();
      return content;
    } catch (error) {
      console.error("Erro ao carregar arquivo BPMN:", error);
      throw new Error(`Não foi possível carregar o arquivo ${filename}`);
    }
  }
  /**
   * Obtém informações sobre um arquivo BPMN
   */
  static getBpmnFileInfo(filename) {
    const fileInfoMap = {
      "processo-simples.bpmn": {
        name: "Processo Simples",
        description: "Um processo básico com gateway de decisão",
        elements: ["StartEvent", "Task", "Gateway", "EndEvent"],
        complexity: "Simples",
      },
      "processo-compras.bpmn": {
        name: "Processo de Compras",
        description: "Fluxo completo de aprovação de compras",
        elements: [
          "StartEvent",
          "UserTask",
          "ServiceTask",
          "Gateway",
          "EndEvent",
        ],
        complexity: "Intermediário",
      },
      "processo-gestao-projeto.bpmn": {
        name: "Gestão de Projeto",
        description:
          "Processo completo de gestão de projetos com gateways paralelos",
        elements: [
          "StartEvent",
          "UserTask",
          "ServiceTask",
          "ParallelGateway",
          "ExclusiveGateway",
          "EndEvent",
        ],
        complexity: "Avançado",
      },
    };
    return (
      fileInfoMap[filename] || {
        name: filename,
        description: "Arquivo BPMN personalizado",
        elements: [],
        complexity: "Desconhecido",
      }
    );
  }
  /**
   * Valida se um arquivo existe
   */
  static isValidFile(filename) {
    return this.getAvailableFiles().includes(filename);
  }
  /**
   * Obtém caminhos predefinidos para arquivos específicos
   */
  static getPredefinedPaths(filename) {
    const pathsMap = {
      "processo-simples.bpmn": {
        mainPath: [
          "StartEvent_1",
          "SequenceFlow_1",
          "Task_1",
          "SequenceFlow_2",
          "Gateway_1",
          "SequenceFlow_3",
          "Task_2",
          "SequenceFlow_5",
          "EndEvent_1",
        ],
        alternativePath: [
          "StartEvent_1",
          "SequenceFlow_1",
          "Task_1",
          "SequenceFlow_2",
          "Gateway_1",
          "SequenceFlow_4",
          "Task_3",
          "SequenceFlow_6",
          "EndEvent_2",
        ],
      },
      "processo-compras.bpmn": {
        mainPath: [
          "StartEvent_1",
          "SequenceFlow_1",
          "UserTask_1",
          "SequenceFlow_2",
          "ServiceTask_1",
          "SequenceFlow_3",
          "Gateway_1",
          "SequenceFlow_5",
          "Gateway_2",
          "SequenceFlow_7",
          "ServiceTask_2",
          "SequenceFlow_9",
          "EndEvent_1",
        ],
        alternativePath: [
          "StartEvent_1",
          "SequenceFlow_1",
          "UserTask_1",
          "SequenceFlow_2",
          "ServiceTask_1",
          "SequenceFlow_3",
          "Gateway_1",
          "SequenceFlow_4",
          "UserTask_2",
          "SequenceFlow_6",
          "Gateway_2",
          "SequenceFlow_8",
          "EndEvent_2",
        ],
      },
      "processo-gestao-projeto.bpmn": {
        mainPath: [
          "InicioProcesso",
          "SequenceFlow_1",
          "AnaliseInicial",
          "SequenceFlow_2",
          "GatewayViabilidade",
          "SequenceFlow_Viavel",
          "PlanejamentoProjeto",
          "SequenceFlow_3",
          "GatewayParalelo1",
          "SequenceFlow_Equipe",
          "FormarEquipe",
          "SequenceFlow_EquipeFormada",
          "GatewayParalelo2",
          "SequenceFlow_4",
          "AprovacaoExecutiva",
          "SequenceFlow_5",
          "GatewayAprovacao",
          "SequenceFlow_Aprovado",
          "ExecucaoProjeto",
          "SequenceFlow_6",
          "ValidacaoEntrega",
          "SequenceFlow_7",
          "GatewayQualidade",
          "SequenceFlow_QualidadeOK",
          "EncerrarProjeto",
          "SequenceFlow_8",
          "FimSucesso",
        ],
        alternativePath: [
          "InicioProcesso",
          "SequenceFlow_1",
          "AnaliseInicial",
          "SequenceFlow_2",
          "GatewayViabilidade",
          "SequenceFlow_Inviavel",
          "RejeitarProjeto",
          "SequenceFlow_FimRejeicao",
          "FimRejeicao",
        ],
      },
    };
    return pathsMap[filename] || { mainPath: [], alternativePath: [] };
  }
}
BpmnFileManager.BPMN_FILES_PATH = "./bpmn-files/";
