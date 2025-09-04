/**
 * Utilitários para trabalhar com arquivos BPMN
 */
export class FileUtils {
    /**
     * Lê um arquivo como texto
     */
    static readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result;
                if (typeof result === "string") {
                    resolve(result);
                }
                else {
                    reject(new Error("Erro ao ler arquivo"));
                }
            };
            reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
            reader.readAsText(file);
        });
    }
    /**
     * Valida se o arquivo é um BPMN válido
     */
    static validateBpmnFile(xmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlContent, "text/xml");
            // Verifica se há erros de parsing
            const parserError = doc.querySelector("parsererror");
            if (parserError) {
                return false;
            }
            // Verifica se tem elementos BPMN
            const bpmnElements = doc.querySelectorAll("[*|id]");
            return bpmnElements.length > 0;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Obtém um exemplo de diagrama BPMN simples
     */
    static getSampleBpmn() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_1"
                   targetNamespace="http://bpmn.io/schema/bpmn">
  
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Início">
      <bpmn:outgoing>SequenceFlow_1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <bpmn:task id="Task_1" name="Processar Solicitação">
      <bpmn:incoming>SequenceFlow_1</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_2</bpmn:outgoing>
    </bpmn:task>
    
    <bpmn:exclusiveGateway id="Gateway_1" name="Aprovado?">
      <bpmn:incoming>SequenceFlow_2</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_3</bpmn:outgoing>
      <bpmn:outgoing>SequenceFlow_4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:task id="Task_2" name="Aprovar">
      <bpmn:incoming>SequenceFlow_3</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_5</bpmn:outgoing>
    </bpmn:task>
    
    <bpmn:task id="Task_3" name="Rejeitar">
      <bpmn:incoming>SequenceFlow_4</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_6</bpmn:outgoing>
    </bpmn:task>
    
    <bpmn:endEvent id="EndEvent_1" name="Fim - Aprovado">
      <bpmn:incoming>SequenceFlow_5</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:endEvent id="EndEvent_2" name="Fim - Rejeitado">
      <bpmn:incoming>SequenceFlow_6</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:sequenceFlow id="SequenceFlow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="SequenceFlow_2" sourceRef="Task_1" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="SequenceFlow_3" name="Sim" sourceRef="Gateway_1" targetRef="Task_2" />
    <bpmn:sequenceFlow id="SequenceFlow_4" name="Não" sourceRef="Gateway_1" targetRef="Task_3" />
    <bpmn:sequenceFlow id="SequenceFlow_5" sourceRef="Task_2" targetRef="EndEvent_1" />
    <bpmn:sequenceFlow id="SequenceFlow_6" sourceRef="Task_3" targetRef="EndEvent_2" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="158" y="145" width="25" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="240" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1">
        <dc:Bounds x="395" y="95" width="50" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="396" y="65" width="50" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="500" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="500" y="200" width="100" height="80" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="652" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="632" y="145" width="76" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="EndEvent_2_di" bpmnElement="EndEvent_2">
        <dc:Bounds x="652" y="222" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="633" y="265" width="74" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="SequenceFlow_1_di" bpmnElement="SequenceFlow_1">
        <di:waypoint x="188" y="120" />
        <di:waypoint x="240" y="120" />
      </bpmndi:BPMNEdge>
      
      <bpmndi:BPMNEdge id="SequenceFlow_2_di" bpmnElement="SequenceFlow_2">
        <di:waypoint x="340" y="120" />
        <di:waypoint x="395" y="120" />
      </bpmndi:BPMNEdge>
      
      <bpmndi:BPMNEdge id="SequenceFlow_3_di" bpmnElement="SequenceFlow_3">
        <di:waypoint x="445" y="120" />
        <di:waypoint x="500" y="120" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="464" y="102" width="18" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      
      <bpmndi:BPMNEdge id="SequenceFlow_4_di" bpmnElement="SequenceFlow_4">
        <di:waypoint x="420" y="145" />
        <di:waypoint x="420" y="240" />
        <di:waypoint x="500" y="240" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="427" y="190" width="17" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      
      <bpmndi:BPMNEdge id="SequenceFlow_5_di" bpmnElement="SequenceFlow_5">
        <di:waypoint x="600" y="120" />
        <di:waypoint x="652" y="120" />
      </bpmndi:BPMNEdge>
      
      <bpmndi:BPMNEdge id="SequenceFlow_6_di" bpmnElement="SequenceFlow_6">
        <di:waypoint x="600" y="240" />
        <di:waypoint x="652" y="240" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    }
}
/**
 * Utilitários para destacar caminhos predefinidos
 */
export class PathUtils {
    /**
     * Obtém o caminho principal (caminho feliz)
     */
    static getMainPath() {
        return [
            "StartEvent_1",
            "SequenceFlow_1",
            "Task_1",
            "SequenceFlow_2",
            "Gateway_1",
            "SequenceFlow_3",
            "Task_2",
            "SequenceFlow_5",
            "EndEvent_1",
        ];
    }
    /**
     * Obtém o caminho alternativo (rejeição)
     */
    static getAlternativePath() {
        return [
            "StartEvent_1",
            "SequenceFlow_1",
            "Task_1",
            "SequenceFlow_2",
            "Gateway_1",
            "SequenceFlow_4",
            "Task_3",
            "SequenceFlow_6",
            "EndEvent_2",
        ];
    }
    /**
     * Obtém elementos de um determinado tipo
     */
    static getElementsByType(elements, type) {
        return elements
            .filter((el) => el.bpmnSemantic.kind.toLowerCase().includes(type.toLowerCase()))
            .map((el) => el.htmlElement.id);
    }
}
//# sourceMappingURL=BpmnUtils.js.map