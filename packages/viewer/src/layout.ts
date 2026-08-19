import { addFlowReferences } from '@bpmn-flow/core';
import { layoutProcess } from 'bpmn-auto-layout';

/**
 * Layout helpers, deliberately free of any rendering dependency: they turn
 * XML into XML, which keeps them testable outside a browser.
 */

/** True when the XML already carries diagram interchange (layout) data. */
export function hasDiagramInterchange(xml: string): boolean {
  return /BPMNDiagram|BPMNPlane|BPMNShape/.test(xml);
}

/**
 * Returns XML that is guaranteed to carry diagram interchange.
 *
 * A diagram authored purely in terms of semantics (no layout) is positioned
 * with `bpmn-auto-layout`; anything that already has DI is returned untouched.
 * Useful for consumers that require DI, such as a `bpmn-js` modeler.
 *
 * @throws when the layout engine cannot process the XML.
 */
export async function ensureLayout(xml: string): Promise<string> {
  if (hasDiagramInterchange(xml)) return xml;
  // The layout engine reads each node's incoming/outgoing children: without
  // them it places the shapes and draws no connection at all.
  return await layoutProcess(await addFlowReferences(xml));
}
