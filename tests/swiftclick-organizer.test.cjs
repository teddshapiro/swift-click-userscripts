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

test('categories are flat and contain only projects or chats', () => {
  assert.deepEqual(Array.from(hooks.categories), [
    'family', 'health', 'business', 'ai', 'hobbies', 'uncategorized'
  ]);
  assert.equal(hooks.validCategory('family'), true);
  assert.equal(hooks.validCategory('hobbies'), true);
  assert.equal(hooks.validCategory('cinema'), false);
  assert.equal(hooks.validCategory('henry'), false);
  assert.equal(hooks.validCategory('bradley'), false);
  assert.equal(hooks.validCategory('unknown'), false);
  assert.equal(hooks.itemInCategory('hobbies', 'hobbies'), true);
  assert.equal(hooks.itemInCategory('family', 'hobbies'), false);
  assert.equal(hooks.itemInCategory('hobbies', null), true);
});

test('legacy assignments migrate to top-level categories without losing links', () => {
  const old = {
    'chat:transcript': 'cinema',
    'project:cinema': 'hobbies',
    'chat:henry': 'henry',
    'chat:bradley': 'bradley',
    'project:another': 'family-other',
    'chat:health': 'health',
    'project:ai-video': 'hobbies'
  };
  const { assignments, migrated } = hooks.migrateAssignments(old);
  assert.equal(migrated, true);
  assert.equal(Object.keys(assignments).length, Object.keys(old).length);
  assert.equal(assignments['chat:transcript'], 'hobbies');
  assert.equal(assignments['project:cinema'], 'hobbies');
  assert.equal(assignments['chat:henry'], 'family');
  assert.equal(assignments['chat:bradley'], 'family');
  assert.equal(assignments['project:another'], 'family');
  assert.equal(assignments['chat:health'], 'health');
  assert.equal(assignments['project:ai-video'], 'hobbies');
  assert.equal(hooks.migrateAssignments(assignments).migrated, false);
  assert.equal(hooks.normalizeCategoryId('cinema'), 'hobbies');
  assert.equal(hooks.normalizeCategoryId('henry'), 'family');
  assert.equal(hooks.normalizeCategoryId('nonexistent'), 'uncategorized');
  assert.equal(hooks.itemInCategory('cinema', 'hobbies'), true);
});

test('new category assignment remains a flat selector without nested navigation', () => {
  assert.doesNotMatch(script, /function isDescendant\(/);
  assert.doesNotMatch(script, /directChildren|categoryPath\(/);
  assert.match(script, /if \(!hasSearch && currentCategory === null\)/);
  assert.match(script, /CATEGORIES\.forEach\(\(category\) => cards\.appendChild\(makeCategoryCard\(category\)\)\)/);
  assert.match(script, /GM_setValue\(STORAGE_KEY, \{ version: 2, assignments: clean \}\)/);
  assert.match(script, /GM_setValue\(STORAGE_KEY, \{ version: 2, assignments \}\)/);
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

test('launcher is completely outside native ChatGPT navigation', () => {
  // The previous launcher was inserted as the first child of an existing
  // nav/sidebar. That DOM mutation can disrupt ChatGPT project hover buttons.
  assert.match(script, /document\.body\.appendChild\(launcherHost\)/);
  assert.doesNotMatch(script, /sidebar\.insertBefore|positionLauncher|findSidebar/);
  assert.doesNotMatch(script, /launcherHost\.dataset\.placement/);
  assert.match(script, /pointer-events:none/);
  assert.match(script, /pointer-events:auto/);
});

test('project-menu companion avoids mutations inside native menus and sidebar', () => {
  assert.match(script, /document\.body\.appendChild\(menuActionHost\)/);
  assert.match(script, /findNativeProjectMenu/);
  assert.match(script, /textContent\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.toLowerCase\(\) === 'project home'/);
  assert.match(script, /nativeLink\.getAttribute\('href'\)/);
  assert.match(script, /home\.click\(\)/);
  assert.match(script, /resolveNativeProjectIntake/);
  assert.match(script, /startNativeProjectIntake/);
  assert.doesNotMatch(script, /menu\.appendChild\(menuActionHost\)|menu\.insertBefore\(menuActionHost|sidebar\.insertBefore/);
});

test('project intake validates a project URL and keeps native data unchanged', () => {
  assert.match(script, /function openProjectIntake\(project\)/);
  assert.match(script, /Confirm the detected project and choose where its shortcut should appear/);
  assert.match(script, /sanitizeManualProject\(\{ title: name\.value, href: url\.value \}/);
  assert.match(script, /GM_setValue\(MANUAL_PROJECTS_KEY/);
  assert.match(script, /pendingNativeProject = \{ from: location\.href, at: Date\.now\(\) \}/);
});

test('discovered project titles are normalized without affecting chat titles', () => {
  const project = hooks.parseItemLink(
    '/g/g-p-123-project/project', 'ChatGPT - Cinema Decoder - Project', origin
  );
  assert.equal(project.title, 'Cinema Decoder');
  const chat = hooks.parseItemLink('/c/123', 'ChatGPT - Cinema Decoder - Project', origin);
  assert.equal(chat.title, 'ChatGPT - Cinema Decoder - Project');
});

test('intake navigation is treated differently from ordinary route navigation', () => {
  assert.match(script, /function openProjectIntake\(project\)/);
  assert.match(script, /lastRoute = location\.pathname;\s*show\(\);/);
  assert.match(script, /if \(pendingNativeProject\) \{\s*\/\/ First consume the project-home route/);
  assert.match(script, /else if \(open\) \{\s*hide\(\);/);
  assert.match(script, /sessionStorage\.setItem\(PENDING_INTAKE_KEY/);
  assert.match(script, /sessionStorage\.removeItem\(PENDING_INTAKE_KEY/);
  assert.match(script, /resumePendingIntake\(\);/);
});

test('categorizing a discovered project preserves its shortcut across reloads', () => {
  assert.match(script, /item\.type === 'project' && !saveProjectShortcut\(item\)/);
  assert.match(script, /function saveProjectShortcut\(project\)/);
  assert.match(script, /manualProjects = manualProjects\.filter/);
  assert.match(script, /seen\.set\(parsed\.key, parsed\)/);
  assert.match(script, /GM_setValue\(MANUAL_PROJECTS_KEY/);
  assert.doesNotMatch(script, /'Saved project' : 'Project'/);
  assert.match(script, /for \(const c of CATEGORIES\)/);
  assert.match(script, /for \(const category of CATEGORIES\)/);
});

test('script stays isolated from production distribution until review', () => {
  assert.match(script, /@version\s+0\.1\.0-alpha\.6/);
  assert.doesNotMatch(script, /@updateURL|@downloadURL/);
  assert.doesNotMatch(script, /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
  assert.doesNotMatch(script, /(?:fetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest)/);
  assert.match(script, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(script, /GM_setValue\(STORAGE_KEY/);
});
