'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '..', 'swiftclick-organizer.user.js');
const script = fs.readFileSync(filename, 'utf8');
const hooks = {};
vm.runInNewContext(script, {
  __SC_ORGANIZER_TEST_HOOKS__: hooks,
  URL,
  console
}, { filename, timeout: 1500 });

const origin = 'https://chatgpt.com';

test('home auto-open gate excludes deep links', () => {
  assert.equal(hooks.isHomeRoute('/'), true);
  assert.equal(hooks.isHomeRoute(''), true);
  for (const route of ['/c/123', '/g/g-p-123-project/project', '/auth/login', '/share/abc']) {
    assert.equal(hooks.isHomeRoute(route), false, route);
  }
});

test('discover normal chat and project links without fetching chat data', () => {
  const chat = hooks.parseItemLink('/c/01234-abcd', 'Test chat', origin);
  assert.equal(chat.key, 'chat:01234-abcd');
  assert.equal(chat.type, 'chat');
  assert.equal(chat.title, 'Test chat');
  assert.equal(chat.href, 'https://chatgpt.com/c/01234-abcd');

  const project = hooks.parseItemLink('/g/g-p-12345-swiftclick/project', 'SwiftClick', origin);
  assert.equal(project.key, 'project:g-p-12345-swiftclick');
  assert.equal(project.type, 'project');
  assert.equal(project.href, 'https://chatgpt.com/g/g-p-12345-swiftclick/project');
});

test('distinguish project chat from project itself', () => {
  const chat = hooks.parseItemLink('/g/g-p-12345-swiftclick/c/abc-42', 'In project', origin);
  assert.equal(chat.type, 'chat');
  assert.equal(chat.key, 'chat:abc-42');
});

test('reject unrelated, malformed or external links', () => {
  for (const link of [
    'https://example.com/c/0123',
    'http://chatgpt.com/c/0123',
    '/g/g-some-custom-gpt',
    '/search',
    '/c/',
    'javascript:alert(1)',
    '/g/g-p-1234-project/edit'
  ]) {
    assert.equal(hooks.parseItemLink(link, 'Bad', origin), null, link);
  }
});

test('normalize labels and omit URL query parameters from stored navigation links', () => {
  const item = hooks.parseItemLink('/c/abc-42?foo=private', '  My\n  Chat  ', origin);
  assert.equal(item.title, 'My Chat');
  assert.equal(item.href, 'https://chatgpt.com/c/abc-42');
});

test('categories support nested Family and Cinema Decoder views', () => {
  assert.equal(hooks.validCategory('family'), true);
  assert.equal(hooks.validCategory('cinema'), true);
  assert.equal(hooks.validCategory('unknown'), false);
  assert.equal(hooks.isDescendant('henry', 'family'), true);
  assert.equal(hooks.isDescendant('bradley', 'family'), true);
  assert.equal(hooks.isDescendant('cinema', 'hobbies'), true);
  assert.equal(hooks.isDescendant('cinema', 'family'), false);
});

test('manual project shortcut validation accepts only ChatGPT projects', () => {
  const saved = hooks.sanitizeManualProject({
    title: '  Coding   —   Tampermonkey Scripts ',
    href: 'https://chatgpt.com/g/g-p-abcd-1234/project?share=secret'
  }, origin);
  assert.equal(saved.key, 'project:g-p-abcd-1234');
  assert.equal(saved.title, 'Coding — Tampermonkey Scripts');
  assert.equal(saved.href, 'https://chatgpt.com/g/g-p-abcd-1234/project');
  assert.equal(saved.manual, true);
  assert.equal(hooks.sanitizeManualProject({ title: 'Bad', href: 'https://chatgpt.com/c/abc' }, origin), null);
  assert.equal(hooks.sanitizeManualProject({ title: '', href: 'https://chatgpt.com/g/g-p-abcd/project' }, origin), null);
  assert.equal(hooks.sanitizeManualProject({ title: 'Foreign', href: 'https://example.org/g/g-p-abcd/project' }, origin), null);
});

test('manual project feature only stores shortcuts in Tampermonkey metadata', () => {
  assert.match(script, /MANUAL_PROJECTS_KEY/);
  assert.match(script, /GM_setValue\(MANUAL_PROJECTS_KEY/);
  assert.match(script, /Add project/);
  assert.match(script, /Save project shortcut/);
});

test('script stays isolated from production distribution until review', () => {
  assert.match(script, /@version\s+0\.1\.0-alpha\.2/);
  assert.doesNotMatch(script, /@updateURL|@downloadURL/);
  assert.doesNotMatch(script, /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
  assert.doesNotMatch(script, /(?:fetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest)/);
  assert.match(script, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(script, /GM_setValue\(STORAGE_KEY/);
});
