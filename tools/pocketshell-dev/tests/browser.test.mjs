import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function browser() {
  const elements = new Map();
  const handlers = new Map();
  const timers = [];
  const errors = [];
  function element() {
    return { innerHTML: '', textContent: '', className: '', dataset: {},
      classList: { toggle() {}, add() {}, remove() {} },
      addEventListener() {}, append() {}, appendChild() {}, replaceChildren() {},
      getContext: () => ({ fillRect() {}, fillText() {} }) };
  }
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    querySelector: () => element(), querySelectorAll: () => [], createElement: element,
    addEventListener() {},
  };
  class WebSocket {
    static OPEN = 1;
    static instances = [];
    readyState = 1;
    sent = [];
    constructor() { WebSocket.instances.push(this); }
    send(value) { this.sent.push(JSON.parse(value)); }
    message(message) { this.onmessage({ data: JSON.stringify({ version: 1, ...message }) }); }
  }
  const context = { document, WebSocket, location: { protocol: 'http:', host: 'localhost:8080' },
    window: { addEventListener(name, handler) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(handler); } },
    setTimeout: callback => timers.push(callback), setInterval() {},
    fetch: async () => ({ json: async () => ({ lines: [] }) }),
    console: { error: error => errors.push(error) },
  };
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  const snapshot = { visible: 0, view: 0, rows: 24, cols: 54, cells: 0, fps: 60, frameMs: 1, workspaces: [{ name: 'SHELL', state: 'running', id: 0 }], logs: 2 };
  const socket = WebSocket.instances[0]; socket.onopen();
  return { socket, snapshot, errors, elements, reconnect() { socket.onclose(); timers.shift()(); const next = WebSocket.instances.at(-1); next.onopen(); return next; },
    type(key) { for (const handler of handlers.get('keydown')) handler({ key, target: { tagName: 'BODY' }, preventDefault() {} }); } };
}

test('initial snapshots render and retain separately delivered logs', () => {
  const b = browser();
  b.socket.message({ seq: 1, type: 'workspace_state', state: b.snapshot });
  b.socket.message({ seq: 2, type: 'logs', entries: ['PTY started'] });
  b.socket.message({ seq: 3, type: 'workspace_state', state: b.snapshot });
  assert.equal(b.errors.length, 0);
  assert.match(b.elements.get('logLines').innerHTML, /PTY started/);
});

test('plain text accepts f, digits and rejects control characters', () => {
  const b = browser();
  for (const key of ['f', '0', '7', '\n']) b.type(key);
  assert.deepEqual(b.socket.sent.filter(message => message.type === 'input').map(message => message.text), ['f', '0', '7']);
});

test('reconnect accepts a fresh sequence starting at one', () => {
  const b = browser();
  b.socket.message({ seq: 50, type: 'workspace_state', state: b.snapshot });
  const next = b.reconnect();
  next.message({ seq: 1, type: 'workspace_state', state: { ...b.snapshot, cols: 42 } });
  assert.match(b.elements.get('bufferKv').innerHTML, /42/);
  assert.equal(b.errors.length, 0);
});
