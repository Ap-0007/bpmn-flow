import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from '../src/sessions.js';
import { FileSessionStorage, InvalidSessionIdError } from '../src/storage.js';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn-flow.test" id="Defs">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:userTask id="Approve" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Approve" />
    <bpmn:sequenceFlow id="f1" sourceRef="Approve" targetRef="End" />
  </bpmn:process>
</bpmn:definitions>`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bpmn-flow-sessions-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('SessionStore with file storage', () => {
  it('resumes a session created by a previous process', async () => {
    const first = new SessionStore(new FileSessionStorage(dir));
    const created = await first.create({ xml: XML, variables: { amount: 10 } });
    expect(created.snapshot.status).toBe('waiting');

    // A brand new store, as if the server had been restarted.
    const second = new SessionStore(new FileSessionStorage(dir));
    const reloaded = await second.get(created.id);
    expect(reloaded?.snapshot.status).toBe('waiting');

    const token = reloaded!.snapshot.tokens.find((t) => t.waiting)!;
    const done = await second.complete(created.id, token.id, { approved: true });
    expect(done.snapshot.status).toBe('completed');
    expect(done.snapshot.variables).toMatchObject({ amount: 10, approved: true });
  });

  it('lists stored sessions without rebuilding engines', async () => {
    const store = new SessionStore(new FileSessionStorage(dir));
    const created = await store.create({ xml: XML });

    const listed = await new SessionStore(new FileSessionStorage(dir)).list();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: created.id, status: 'waiting', waiting: 1 });
    expect(listed[0]?.updatedAt).toBeTypeOf('string');
  });

  it('deletes the stored file along with the cached session', async () => {
    const store = new SessionStore(new FileSessionStorage(dir));
    const created = await store.create({ xml: XML });
    expect(await readdir(dir)).toHaveLength(1);

    expect(await store.delete(created.id)).toBe(true);
    expect(await readdir(dir)).toHaveLength(0);
    expect(await store.get(created.id)).toBeUndefined();
  });

  it('refuses session ids that could escape the storage directory', async () => {
    const storage = new FileSessionStorage(dir);
    await expect(storage.read('../../etc/passwd')).rejects.toBeInstanceOf(InvalidSessionIdError);
  });

  it('keeps working without storage (in-memory only)', async () => {
    const store = new SessionStore();
    const created = await store.create({ xml: XML });
    expect(await store.get(created.id)).toBeDefined();
    expect(await new SessionStore().get(created.id)).toBeUndefined();
  });
});
