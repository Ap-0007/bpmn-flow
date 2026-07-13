/** Minimal ambient declaration for `bpmn-auto-layout`, which ships no types. */
declare module 'bpmn-auto-layout' {
  /**
   * Computes diagram interchange (layout) for a BPMN process and returns new
   * XML that includes BPMNDiagram/BPMNShape/BPMNEdge elements.
   */
  export function layoutProcess(xml: string): Promise<string>;
}
