import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MAX_PHOTO_BYTES, validatePhoto } from '../src/utils/uploads.js';

const jpeg = () => new Blob([new Uint8Array([255, 216, 255, 0])], { type: 'image/jpeg' });
const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: 'image/png' });
const source = (await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'))
  .replace("import { DEFAULT_CONFIG } from '../config';", "const DEFAULT_CONFIG = { apiBaseUrl: 'https://offline.invalid' };");
const { api } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('JPEG and PNG signatures are accepted', async () => {
  await validatePhoto(jpeg());
  await validatePhoto(png());
});

test('spoofed MIME types, unsupported formats, and empty photos are rejected', async () => {
  for (const file of [new Blob(['<html>'], { type: 'image/jpeg' }),
    new Blob(['<svg/>'], { type: 'image/svg+xml' }), new Blob([], { type: 'image/png' }),
    new Blob([new Uint8Array([255, 216, 255])], { type: 'image/png' })]) {
    await assert.rejects(validatePhoto(file));
  }
});

test('oversized photo is rejected before reading file bytes', async () => {
  let read = false;
  await assert.rejects(validatePhoto({ type: 'image/jpeg', size: MAX_PHOTO_BYTES + 1,
    slice() { read = true; throw new Error('Should not read'); } }), /5 MB/);
  assert.equal(read, false);
});

test('signed POST submits policy fields and file without manually setting multipart headers', async () => {
  let sent;
  globalThis.fetch = async (url, options) => { sent = { url, options }; return { ok: true }; };
  const file = jpeg();
  await api.uploadPhotoToS3({ url: 'https://bucket.example', fields: { key: 'uploads/photo.jpg', policy: 'test-policy', 'Content-Type': 'image/jpeg' } }, file);
  assert.equal(sent.options.method, 'POST');
  assert.equal(sent.options.headers, undefined);
  assert.equal(sent.options.body.get('key'), 'uploads/photo.jpg');
  assert.equal(sent.options.body.get('policy'), 'test-policy');
  assert.equal(sent.options.body.get('Content-Type'), 'image/jpeg');
  assert.equal(sent.options.body.get('file').size, file.size);
});

test('legacy signed PUT remains supported during API rollout', async () => {
  let sent;
  globalThis.fetch = async (url, options) => { sent = options; return { ok: true }; };
  const file = jpeg();
  await api.uploadPhotoToS3('https://bucket.example/signed', file);
  assert.equal(sent.method, 'PUT');
  assert.equal(sent.headers['Content-Type'], 'image/jpeg');
  assert.equal(sent.body, file);
});

test('bad upload targets never send requests and failed uploads are reported', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 403 }; };
  await assert.rejects(api.uploadPhotoToS3('http://insecure.example', jpeg()));
  await assert.rejects(api.uploadPhotoToS3({ url: 'https://bucket.example' }, jpeg()));
  assert.equal(calls, 0);
  await assert.rejects(api.uploadPhotoToS3('https://bucket.example/signed', jpeg()), /403/);
});
