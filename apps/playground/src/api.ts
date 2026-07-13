import type { ValidationIssue } from '@bpmn-flow/core';

export interface SaveResult {
  name: string;
  issues: ValidationIssue[];
}

/** Sample list from the server, or null when no API is available (dev). */
export async function fetchSampleNames(): Promise<string[] | null> {
  try {
    const res = await fetch('/api/samples');
    if (!res.ok) return null;
    const list = (await res.json()) as { name: string }[];
    return list.map((s) => s.name);
  } catch {
    return null;
  }
}

export async function fetchSampleXml(name: string): Promise<string> {
  const res = await fetch(`/api/samples/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Falha ao carregar "${name}".`);
  return res.text();
}

/** Validates and saves a diagram into the server's samples directory. */
export async function saveSample(name: string, xml: string): Promise<SaveResult> {
  const res = await fetch('/api/samples', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, xml }),
  });
  const data = (await res.json()) as SaveResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Falha ao salvar.');
  return data;
}
