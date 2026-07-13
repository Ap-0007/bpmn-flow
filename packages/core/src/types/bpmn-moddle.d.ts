/**
 * Minimal ambient declaration for `bpmn-moddle`, which ships no types.
 * Only the surface consumed by the parser is declared; the parsed tree is
 * returned as `unknown` and narrowed through the internal moddle types.
 */
declare module 'bpmn-moddle' {
  export interface ModdleParseResult {
    rootElement: unknown;
    references: unknown[];
    warnings: unknown[];
    elementsById: Record<string, unknown>;
  }

  export class BpmnModdle {
    constructor(packages?: unknown, options?: unknown);
    fromXML(xml: string, typeName?: string): Promise<ModdleParseResult>;
    toXML(element: unknown, options?: unknown): Promise<{ xml: string }>;
  }
}
