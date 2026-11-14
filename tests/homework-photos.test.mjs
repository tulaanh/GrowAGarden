import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const compiledUrl = new URL(`.homework-photos-${process.pid}.mjs`, import.meta.url);
const compiled = buildSync({
  entryPoints: [fileURLToPath(new URL('../app/homework-photos.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external',
  loader: { '.module.css': 'empty' }, jsx: 'automatic',
});
let HomeworkPhotos;
await writeFile(compiledUrl, compiled.outputFiles[0].contents, { flag: 'wx' });
try { ({ HomeworkPhotos } = await import(compiledUrl.href)); }
finally { await unlink(compiledUrl); }

async function setup(t, getUserMedia) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const originalError = console.error;
  t.mock.method(console, 'error', (...args) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args);
  });
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia } }, configurable: true });
  const blobs = [];
  const oldDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: fn => blobs.push(fn) }),
  };
  let revoked = 0;
  t.mock.method(URL, 'createObjectURL', () => `blob:test-${Math.random()}`);
  t.mock.method(URL, 'revokeObjectURL', () => { revoked++; });
  const source = { videoWidth: 1920, videoHeight: 1440, play: async () => {} };
  const modal = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  let files = [];
  function Form({ disabled }) {
    const [value, setValue] = useState([]);
    files = value;
    return React.createElement(HomeworkPhotos, { files: value, onChange: setValue, disabled });
  }
  let root;
  await act(async () => {
    root = TestRenderer.create(React.createElement(Form), {
      createNodeMock: el => el.type === 'video' ? source : el.type === 'dialog' ? modal : null,
    });
  });
  t.after(async () => {
    await act(async () => root.unmount());
    globalThis.document = oldDocument;
    Object.defineProperty(globalThis, 'navigator', oldNavigator);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  const button = text => root.root.findAllByType('button').find(b => [b.props.children].flat().join('') === text);
  return {
    root, button, blobs, modal, files: () => files, revoked: () => revoked,
    open: async () => {
      await act(async () => button(files.length ? 'Chụp thêm ảnh' : 'Mở camera chụp bài').props.onClick());
      await act(async () => root.root.findByType('video').props.onCanPlay());
    },
    snap: async () => {
      await act(async () => button('Chụp ảnh').props.onClick());
      await act(async () => blobs.shift()(new Blob(['photo'], { type: 'image/jpeg' })));
    },
    disable: async () => { await act(async () => root.update(React.createElement(Form, { disabled: true }))); },
  };
}

test('captures five photos in one camera session, removes and appends without losing earlier pages', async t => {
  let opens = 0, stops = 0;
  const h = await setup(t, async () => { opens++; return { getTracks: () => [{ stop: () => stops++ }] }; });
  await h.open();
  for (let i = 0; i < 5; i++) await h.snap();
  assert.equal(opens, 1);
  assert.equal(stops, 1);
  assert.equal(h.files().length, 5);
  assert.equal(new Set(h.files().map(f => f.name)).size, 5);
  assert.ok(h.files().every(f => f.type === 'image/jpeg' && f.size > 0));
  assert.equal(h.root.root.findAllByType('video').length, 0);
  assert.equal(h.button('Chụp thêm ảnh').props.disabled, true);
  const retained = h.files().filter((_, i) => i !== 1);
  await act(async () => h.button('Xóa ảnh 2').props.onClick());
  assert.deepEqual(h.files(), retained);
  assert.ok(h.revoked() > 0);
  await h.open();
  await h.snap();
  assert.deepEqual(h.files().slice(0, 4), retained);
  assert.equal(h.files().length, 5);
  assert.equal(opens, 2);
});

test('file selection appends after camera denial, rejects invalid batches and retains photos when busy', async t => {
  const denied = new Error('denied'); denied.name = 'NotAllowedError';
  const h = await setup(t, async () => { throw denied; });
  await act(async () => h.button('Mở camera chụp bài').props.onClick());
  assert.match(h.root.root.findByProps({ role: 'alert' }).props.children, /cấp quyền camera/);
  const picker = () => h.root.root.findAllByType('input').find(i => i.props.multiple);
  const change = async (input, files) => {
    const target = { files, value: 'selected' };
    await act(async () => input.props.onChange({ target }));
    assert.equal(target.value, '');
  };
  const a = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
  const b = new File(['b'], 'b.png', { type: 'image/png' });
  await change(picker(), [a]);
  await change(picker(), [a]);
  await change(picker(), [b]);
  assert.deepEqual(h.files(), [a, a, b]);
  await change(picker(), [a, a, a]);
  assert.equal(h.files().length, 3);
  assert.match(h.root.root.findByProps({ role: 'alert' }).props.children, /tối đa 5/);
  await change(picker(), [new File(['text'], 'bad.txt', { type: 'text/plain' })]);
  assert.equal(h.files().length, 3);
  await h.disable();
  assert.ok(h.root.root.findAllByType('button').every(b => b.props.disabled));
  assert.deepEqual(h.files(), [a, a, b]);
});

test('closing while camera permission is pending stops the late stream', async t => {
  let resolve, stops = 0;
  const h = await setup(t, () => new Promise(r => { resolve = r; }));
  await act(async () => h.button('Mở camera chụp bài').props.onClick());
  await act(async () => h.button('Đóng camera').props.onClick());
  await act(async () => resolve({ getTracks: () => [{ stop: () => stops++ }] }));
  assert.equal(stops, 1);
  assert.equal(h.root.root.findAllByType('video').length, 0);
});

test('submitting stops camera and discards a photo still being encoded', async t => {
  let stops = 0;
  const h = await setup(t, async () => ({ getTracks: () => [{ stop: () => stops++ }] }));
  await h.open();
  await h.snap();
  await act(async () => h.button('Chụp ảnh').props.onClick());
  await h.disable();
  assert.equal(stops, 1);
  await act(async () => h.blobs.shift()(new Blob(['late photo'], { type: 'image/jpeg' })));
  assert.equal(h.files().length, 1);
});

test('camera opens as a modal, updates photo count and Escape closes only the camera', async t => {
  let stops = 0;
  const h = await setup(t, async () => ({ getTracks: () => [{ stop: () => stops++ }] }));
  await h.open();
  assert.equal(h.modal.open, true);
  const camera = () => h.root.root.findByType('dialog');
  assert.equal(camera().props['aria-label'], 'Chụp ảnh bài làm toàn màn hình');
  await h.snap();
  const counter = camera().findByProps({ role: 'status' });
  assert.match([counter.props.children].flat().join(''), /1\/5/);
  const event = { preventDefault: t.mock.fn(), stopPropagation: t.mock.fn() };
  await act(async () => camera().props.onCancel(event));
  assert.equal(event.preventDefault.mock.callCount(), 1);
  assert.equal(event.stopPropagation.mock.callCount(), 1);
  assert.equal(h.modal.open, false);
  assert.equal(stops, 1);
  assert.equal(h.files().length, 1);
});
