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




test('New Chat suppresses one automatic Home opening without affecting ordinary visits', () => {
  const now = 1794510000000;
  assert.equal(hooks.shouldAutoOpenHome('/', '', null, now), true);
  assert.equal(hooks.shouldAutoOpenHome('/', '', String(now), now), false);
  assert.equal(hooks.shouldAutoOpenHome('/', '', String(now-30000), now), false);
  assert.equal(hooks.shouldAutoOpenHome('/', '', String(now-61000), now), true);
  assert.equal(hooks.shouldAutoOpenHome('/', '', String(now+30000), now), true);
  assert.equal(hooks.shouldAutoOpenHome('/', '?temporary-chat=true', null, now), false);
  assert.equal(hooks.shouldAutoOpenHome('/', '?x=y&temporary-chat=true', null, now), false);
  assert.equal(hooks.shouldAutoOpenHome('/c/abc', '', null, now), false);
  assert.match(script,/sessionStorage\.setItem\(SUPPRESS_NEXT_HOME_AUTOOPEN_KEY,String\(Date\.now\(\)\)\)/);
  assert.match(script,/sessionStorage\.getItem\(SUPPRESS_NEXT_HOME_AUTOOPEN_KEY\)/);
  assert.match(script,/sessionStorage\.removeItem\(SUPPRESS_NEXT_HOME_AUTOOPEN_KEY\)/);
  assert.match(script,/shouldAutoOpenHome\(location\.pathname, location\.search, autoOpenMarker\)/);
  assert.doesNotMatch(script,/GM_setValue\(SUPPRESS_NEXT_HOME_AUTOOPEN_KEY/);
});

test('Health opens its user-confirmed destination, Adobe is removed, and browser labels are generic', () => {
  const catalog = hooks.toolCatalog;
  assert.equal(catalog.length, 15);
  assert.equal(catalog.find((tool)=>tool.id==='health').href,'https://chatgpt.com/health');
  assert.equal(catalog.find((tool)=>tool.id==='health').status,'verified');
  assert.equal(catalog.find((tool)=>tool.id==='adobe'),undefined);
  const prefs=hooks.sanitizeToolPrefs({version:1,order:['adobe','health','finances'],
     hidden:['adobe','health'],icons:{adobe:'🎨'},urlOverrides:{adobe:'https://chatgpt.com/test'}});
  assert.equal(prefs.order.length,15);
  assert.equal(prefs.order.includes('adobe'),false);
  assert.equal(prefs.hidden.includes('adobe'),false);
  assert.equal(prefs.hidden.includes('health'),true);
  assert.equal(prefs.urlOverrides.adobe,undefined);
  assert.match(script,/Check in your browser/);
  assert.match(script,/Some destinations may need verification in your browser/);
  assert.doesNotMatch(script,/Check in Firefox|signed-in Firefox verification|adjustment in Firefox/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});

test('category cards use the ChatGPT Tools icon size and explicit project/chat counts', () => {
  assert.match(script, /\.tool-icon\{font-size:24px;line-height:1\.1;\}/);
  assert.match(script, /\.card-icon\{display:block;font-size:24px;line-height:1\.1;\}/);
  assert.match(script, /card\.appendChild\(el\('span', 'card-icon', category\.icon\)\)/);
  assert.match(script, /formatCategoryItemCounts\(visibleItems\(category\.id\)\)/);
  assert.match(script, /card\.appendChild\(el\('span', 'card-meta', summary\)\)/);
  assert.doesNotMatch(script,/count \+ ' item'/);
  assert.equal(hooks.formatCategoryItemCounts([]), '0 projects | 0 chats');
  assert.equal(hooks.formatCategoryItemCounts([{type:'project'}]), '1 project | 0 chats');
  assert.equal(hooks.formatCategoryItemCounts([{type:'chat'}]), '0 projects | 1 chat');
  const mixed = [
    {type:'project',key:'p1'}, {type:'project',key:'p2'},
    {type:'project',key:'p3'}, {type:'project',key:'p4'},
    {type:'chat',key:'c1'}, {type:'chat',key:'c2'}
  ];
  assert.equal(hooks.formatCategoryItemCounts(mixed), '4 projects | 2 chats');
  assert.equal(hooks.formatCategoryItemCounts([{type:'project'},{type:'chat'}]),
    '1 project | 1 chat');
  // Ignore unexpected item types instead of inflating totals.
  assert.equal(hooks.formatCategoryItemCounts([{type:'other'},...mixed]),
    '4 projects | 2 chats');
});

test('ChatGPT Tools catalog, three tabs, and regular/temporary New Chat split action', () => {
  assert.equal(hooks.toolCatalog.length,15);
  assert.deepEqual(Array.from(hooks.toolGroups,(g)=>g.id),['features','specialized','account']);
  assert.equal(hooks.toolCatalog.find((t)=>t.id==='new-chat').status,'action');
  assert.equal(hooks.temporaryChatUrl,'https://chatgpt.com/?temporary-chat=true');
  assert.match(script,/button\('New regular chat','action'/);
  assert.match(script,/button\('New temporary chat','action'/);
  assert.match(script,/Confirm the Temporary banner and select personalization/);
  assert.match(script,/\{ id: 'tools', title: 'ChatGPT Tools' \}/);
  assert.match(script,/if \(activeTab==='tools'\)/);
});
test('ChatGPT Tools preferences persist only user overrides and do not alter shortcut storage', () => {
  const p=hooks.sanitizeToolPrefs(null);
  assert.equal(p.order.length,15);
  assert.equal(p.hidden.length,0);
  assert.deepEqual(Object.keys(p.icons),[]);
  const changed=hooks.editToolPrefs(p,'images',{visible:false,icon:'📚'});
  assert.ok(changed.hidden.includes('images'));
  assert.equal(changed.icons.images,'📚');
  assert.equal(hooks.listTools(changed,'features').some((x)=>x.id==='images'),false);
  const loaded=hooks.sanitizeToolPrefs({version:1,order:['settings','fake','settings'],
    hidden:['images','images','fake'],icons:{images:'📚',plugins:'<img>'},
    urlOverrides:{gpts:'javascript:alert(1)'}});
  assert.equal(loaded.order[0],'settings');
  assert.equal(loaded.order.length,15);
  assert.deepEqual(Array.from(loaded.hidden),['images']);
  assert.equal(loaded.icons.plugins,undefined);
  assert.equal(loaded.urlOverrides.gpts,undefined);
  assert.match(script,/GM_setValue\(CHATGPT_TOOLS_KEY,next\)/);
});
test('ChatGPT Tools URL overrides are safe and New Chat cannot be overridden', () => {
  const p=hooks.sanitizeToolPrefs(null);
  assert.equal(hooks.validateToolOverride('https://chatgpt.com/area','personalization'),
    'https://chatgpt.com/area');
  for(const url of ['https://evil.example','http://chatgpt.com/test',
     'javascript:alert(1)','https://chatgpt.com@evil.example/',
     'https://chatgpt.com/?token=abc','https://chatgpt.com:8080/path']) {
    assert.equal(hooks.validateToolOverride(url,'personalization'),null);
  }
  assert.equal(hooks.validateToolOverride('https://help.openai.com/en/','help-center'),
    'https://help.openai.com/en/');
  assert.equal(hooks.validateToolOverride('https://help.openai.com/en/','personalization'),null);
  const x=hooks.editToolPrefs(p,'personalization',{urlOverride:'https://chatgpt.com/settings'});
  assert.equal(hooks.toolHref(hooks.toolCatalog.find((t)=>t.id==='personalization'),x),
    'https://chatgpt.com/settings');
  assert.equal(hooks.editToolPrefs(p,'new-chat',{urlOverride:'https://chatgpt.com/test'}),null);
  assert.equal(hooks.moveToolPrefs(p,'plugins','finances',false),null);
  assert.ok(hooks.moveToolPrefs(p,'plugins','scheduled',false));
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});


test('Quick Link subheadings coexist with links in stable ordered v2 storage', () => {
  const old = hooks.sanitizeQuickLinks({version:2,entries:[
    {id:'google-drive',title:'Google Drive',href:'https://drive.google.com/',icon:'📁'},
    {id:'youtube',title:'YouTube',href:'https://www.youtube.com/',icon:'🎬'}
  ]});
  assert.deepEqual(Array.from(old,(x)=>x.id),['google-drive','youtube']);
  const withHeading=hooks.saveQuickHeadingModel(old,{
    kind:'heading',id:'qh-research001',title:'  Research   and   Reference '
  });
  assert.equal(withHeading.length,3);
  assert.equal(withHeading[2].title,'Research and Reference');
  assert.equal(hooks.isQuickHeading(withHeading[2]),true);
  const positioned=hooks.reorderQuickLinksModel(withHeading,'qh-research001','google-drive',true);
  assert.deepEqual(Array.from(positioned,(x)=>x.id),
    ['google-drive','qh-research001','youtube']);
  const saved=hooks.serializeQuickLinksV2(positioned);
  assert.equal(saved.version,2);
  assert.equal(saved.entries[1].kind,'heading');
  assert.equal(saved.entries[1].href,undefined);
  const loaded=hooks.sanitizeQuickLinks(saved);
  assert.deepEqual(Array.from(loaded,(x)=>x.id),
    ['google-drive','qh-research001','youtube']);
  assert.equal(loaded[0].href,'https://drive.google.com/');
  assert.equal(loaded[2].href,'https://www.youtube.com/');
  assert.equal(loaded[1].title,'Research and Reference');
  assert.equal(hooks.sanitizeQuickLinks({version:2,entries:[]}).length,0);
});

test('Quick Links V2-only startup retains safety guards instead of auto-importing V1',()=>{
  const v2={version:2,entries:[
    {id:'youtube',title:'YouTube',href:'https://youtube.com/',icon:'🎬'}
  ]};
  const valid=hooks.planQuickLinksStartup(v2,{version:1,links:[]});
  assert.equal(valid.status,'ok');
  assert.deepEqual(Array.from(valid.items,x=>x.id),['youtube']);
  assert.equal(hooks.planQuickLinksStartup(null,{version:1,links:[]}).status,'needs-v2');
  assert.equal(hooks.planQuickLinksStartup({version:2,entries:'bad'},null).status,'blocked');
  assert.equal(hooks.planQuickLinksStartup({version:3,entries:[]},null).status,'blocked');
  const blank=hooks.planQuickLinksStartup(null,null);
  assert.equal(blank.status,'new');
  assert.deepEqual(Array.from(blank.items,x=>x.id),['youtube','google-drive']);
  assert.equal(hooks.sanitizeQuickLinks({version:1,links:v2.entries}).length,0);
  assert.deepEqual(Array.from(hooks.sanitizeQuickLinks({version:2,entries:[]}),x=>x.id),[]);
  const runtime=script.slice(script.indexOf('function readQuickLinks()'),
    script.indexOf('let quickLinks = readQuickLinks()'));
  assert.match(runtime,/planQuickLinksStartup\(savedV2,oldV1\)/);
  assert.match(runtime,/quickLinksLocked=true/);
  assert.doesNotMatch(runtime,/serializeQuickLinksV2\(initial\)|sanitizeQuickLinks\(oldV1\)/);
  assert.doesNotMatch(runtime,/GM_setValue\(QUICK_LINKS_KEY/);
  assert.match(script,/manageLinks\.disabled=quickLinksLocked/);
});

test('Quick Link subheadings rename, move, and delete without deleting their links', () => {
  const old=hooks.sanitizeQuickLinks(null);
  const heading=hooks.saveQuickHeadingModel(old,{
    kind:'heading',id:'qh-work001',title:'Work'
  });
  assert.equal(old.length,2);
  assert.equal(hooks.saveQuickHeadingModel(heading,{
    kind:'heading',id:'qh-work001',title:'Duplicate'
  }),null);
  assert.equal(hooks.saveQuickHeadingModel(heading,{
    kind:'heading',id:'qh-',title:'Bad'
  }),null);
  assert.equal(hooks.saveQuickHeadingModel(heading,{
    kind:'heading',id:'qh-empty001',title:'   '
  }),null);
  const renamed=hooks.editQuickHeadingModel(heading,'qh-work001',{title:'Personal Research'});
  assert.equal(renamed[2].title,'Personal Research');
  assert.equal(heading[2].title,'Work');
  assert.equal(hooks.editQuickHeadingModel(renamed,'youtube',{title:'Not a heading'}),null);
  assert.equal(hooks.editQuickLinkModel(renamed,'qh-work001',{title:'Not a link'}),null);
  const moved=hooks.reorderQuickLinksModel(renamed,'qh-work001','youtube',false);
  assert.deepEqual(Array.from(moved,(x)=>x.id),['qh-work001','youtube','google-drive']);
  const removed=hooks.deleteQuickLinkModel(moved,'qh-work001');
  assert.deepEqual(Array.from(removed,(x)=>x.id),['youtube','google-drive']);
  assert.equal(removed[0].href,'https://www.youtube.com/');
  assert.equal(removed[1].href,'https://drive.google.com/');
});

test('Quick Link headings reject unsafe and malformed records without losing other links', () => {
  const raw={version:2,entries:[
    {kind:'heading',id:'qh-good001',title:'Useful'},
    {kind:'heading',id:'qh-good001',title:'Duplicate'},
    {kind:'heading',id:'qh-bad001',title:'  '},
    {kind:'heading',id:'qh-bad002',title:'x'.repeat(81)},
    {kind:'heading',id:'youtube',title:'Malformed'},
    {kind:'heading',id:'qh-bad003',title:'Image',href:'javascript:alert(1)'},
    {id:'youtube',title:'YouTube',href:'https://www.youtube.com/',icon:'🎬'}
  ]};
  const result=hooks.sanitizeQuickLinks(raw);
  // Subheadings have no destination: unexpected fields are stripped.
  assert.deepEqual(Array.from(result,(x)=>x.id),
    ['qh-good001','qh-bad003','youtube']);
  assert.equal(result[1].href,undefined);
  assert.equal(hooks.sanitizeQuickHeading({kind:'link',id:'qh-x001',title:'Wrong type'}),null);
  assert.equal(hooks.sanitizeQuickLinks({version:3,entries:[]}).length,0);
});

test('Quick Link subheadings render section breaks and share link drag order', () => {
  assert.match(script,/const QUICK_LINKS_V2_KEY = APP_ID \+ '\.quickLinks\.v2'/);
  assert.match(script,/const savedV2=GM_getValue\(QUICK_LINKS_V2_KEY,null\)/);
  assert.match(script,/planQuickLinksStartup\(savedV2,oldV1\)/);
  assert.match(script,/function makeQuickLinksSections\(items\)/);
  assert.match(script,/sections\.appendChild\(el\('h3', 'quick-section-title', item\.title\)\)/);
  assert.match(script,/sections\.appendChild\(cards\)/);
  assert.match(script,/content\.appendChild\(sections\)/);
  assert.match(script,/button\(quickHeadingAdding \? '− Cancel subheading' : '\+ Add subheading'/);
  assert.match(script,/function makeQuickHeadingForm\(heading = null\)/);
  assert.match(script,/rows\.appendChild\(isQuickHeading\(link\) \? makeQuickHeadingForm\(link\) : makeQuickLinkForm\(link\)\)/);
  assert.match(script,/reorderQuickLinksModel\(quickLinks, source, link\.id, after\)/);
  assert.match(script,/moveQuickLink\(link\.id, -1\)/);
  assert.match(script,/Links below it will remain in the list/);
  assert.match(script,/quickHeadingAdding = false/);
  assert.match(script,/if \(activeTab === 'quicklinks' && managingQuickLinks && quickHeadingAdding\)/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});



test('Prompt Builder requires explicit Initialize and keeps the active form while browsing', () => {
  assert.match(script,/let promptInitializedId=null/);
  assert.match(script,/function initializePromptTemplate\(id\)/);
  assert.match(script,/promptCategory=catSelect\.value;\s*promptTemplateId='';/);
  assert.match(script,/promptTemplateId=templateSelect\.value/);
  assert.match(script,/initialize\.disabled=!promptCategory \|\| !promptTemplateId/);
  assert.match(script,/if \(!active\) \{/);
  assert.match(script,/root\.appendChild\(initialize\)/);
  assert.match(script,/root\.appendChild\(heading\)/);
  assert.match(script,/function currentPromptTemplate\(\)/);
  assert.match(script,/promptInitializedId=id/);
  assert.match(script,/window\.confirm\('Starting a new prompt template will discard/);
  assert.match(script,/const first=panel\.querySelector\('\.prompt-fields input, \.prompt-fields textarea'\)/);
  assert.doesNotMatch(script,/\.prompt-summary\{padding:/);
});
test('Prompt Builder confirms only when entered fields or edited preview would be discarded', () => {
  const template=hooks.promptCatalog.templates[0];
  const initial=hooks.assemblePrompt(template,{});
  assert.equal(hooks.promptHasWork(template,{},initial),false);
  assert.equal(hooks.promptHasWork(template,{topic:' '},initial),false);
  const values={topic:'Important project'};
  assert.equal(hooks.promptHasWork(template,values,hooks.assemblePrompt(template,values)),true);
  assert.equal(hooks.promptHasWork(template,{},'Custom edited prompt'),true);
  assert.equal(hooks.promptHasWork(null,{topic:'x'},'text'),false);
});

test('Custom shared combobox renders legible highlighted options without relying on native Firefox select painting', () => {
  assert.match(script,/function enhanceSelects\(root\)/);
  assert.match(script,/querySelectorAll\('select:not\(\[data-sc-enhanced\]\)'\)/);
  assert.match(script,/queueMicrotask\(\(\)=>enhanceSelects\(panel\)\)/);
  assert.match(script,/select\.selectedIndex=i/);
  assert.match(script,/select\.dispatchEvent\(new Event\('change',\{bubbles:true,composed:true\}\)\)/);
  assert.match(script,/trigger\.setAttribute\('role','combobox'\)/);
  assert.match(script,/list\.setAttribute\('role','listbox'\)/);
  assert.match(script,/item\.setAttribute\('role','option'\)/);
  assert.match(script,/highlight\(index\+\(event\.key==='ArrowDown'\?1:-1\)\)/);
  assert.match(script,/event\.key==='Escape' && !list\.hidden/);
  assert.match(script,/event\.key==='Tab'/);
  assert.match(script,/const viewport=trigger\.closest\('\.main'\)/);
  assert.match(script,/list\.classList\.toggle\('above',below<220 && above>below\)/);
  assert.match(script,/\.sc-select-option:hover,\.sc-select-option\[data-active="true"\],\.sc-select-option:focus-visible\{background:#f0f4fa!important;color:#111827!important;/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});

test('Select menus have high-contrast options; all editable inputs show white caret and focus', () => {
  assert.match(script,/select option,select optgroup\{background-color:#ffffff;color:#111827;\}/);
  assert.match(script,/select option:hover,select option:focus,select option:checked\{background-color:#ffffff;color:#111827;\}/);
  assert.match(script,/textarea\{caret-color:#ffffff;\}/);
  assert.match(script,/textarea:focus-visible,select:focus-visible\{outline:3px solid #f4fbff;/);
  assert.match(script,/\.prompt-section-heading h3\{/);
});

test('Prompt Builder has exactly 25 validated local templates and seven categories', () => {
  const cat=hooks.promptCatalog;
  assert.equal(cat.templates.length,25);
  assert.equal(cat.categories.length,7);
  assert.equal(hooks.validatePromptCatalog(cat),true);
  assert.equal(new Set(cat.templates.map(x=>x.id)).size,25);
  for (const tpl of cat.templates) {
    assert.ok(tpl.fields.length>=3 && tpl.fields.length<=4);
    assert.equal(hooks.promptMissingFields(tpl,{}).length,tpl.fields.length);
    assert.equal(hooks.promptMissingFields(tpl,Object.fromEntries(tpl.fields.map(f=>[f.key,'OK']))).length,0);
  }
});
test('Prompt Builder uses literal replacement, honest blanks and safe input handling', () => {
  const tpl=hooks.promptCatalog.templates.find(x=>x.id==='research-brief');
  const result=hooks.assemblePrompt(tpl,{topic:'<script> & {{focus}}',purpose:'evaluation',focus:'reliability'});
  assert.ok(result.includes('<script> & {{focus}}'));
  assert.ok(result.includes('evaluation'));
  assert.ok(result.includes('reliability'));
  const preview=hooks.assemblePrompt(tpl,{topic:'cats'});
  assert.ok(preview.includes("[Why you're researching it]"));
  assert.ok(preview.includes('[Questions or aspects to cover]'));
  assert.equal(hooks.promptMissingFields(tpl,{topic:' ',purpose:'yes'}).length,2);
  assert.equal(hooks.assemblePrompt(null,{}),'');
});
test('Prompt Builder filters original task prompts by type and keyword', () => {
  const catalog=hooks.promptCatalog;
  assert.equal(hooks.filterPromptTemplates(catalog,'','').length,25);
  assert.equal(hooks.filterPromptTemplates(catalog,'coding','').length,4);
  assert.equal(hooks.filterPromptTemplates(catalog,'coding','debug')[0].id,'debug-issue');
  assert.equal(hooks.filterPromptTemplates(catalog,'writing','debug').length,0);
});
test('Prompt Builder UI is browser-local, editable, explicit-copy and never auto-sends', () => {
  assert.match(script,/\{ id: 'prompts', title: 'Prompt Builder' \}/);
  assert.match(script,/if \(activeTab === 'prompts'\)/);
  assert.match(script,/content\.appendChild\(makePromptBuilder\(\)\)/);
  assert.match(script,/function clearPromptDraft\(\)/);
  assert.match(script,/function makePromptBuilder\(\)/);
  assert.match(script,/Editable generated prompt/);
  assert.match(script,/copyPromptToClipboard\(preview\.value,preview\)/);
  assert.match(script,/button\('Reset preview','action'/);
  assert.match(script,/button\('Clear fields','action'/);
  assert.match(script,/promptMissingFields\(active,promptValues\)/);
  assert.match(script,/if \(activeTab === 'prompts' && tab\.id !== 'prompts'\) clearPromptDraft\(\)/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
  assert.doesNotMatch(script,/(?:fetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest)/);
});

test('Quick Links start with YouTube and Google Drive only for uninitialized storage', () => {
  const defaults = hooks.sanitizeQuickLinks(null);
  assert.deepEqual(Array.from(defaults, (item) => item.title), ['YouTube', 'Google Drive']);
  assert.equal(defaults[0].href, 'https://www.youtube.com/');
  assert.equal(defaults[1].href, 'https://drive.google.com/');
  assert.deepEqual(Array.from(hooks.sanitizeQuickLinks({version:2,entries:[]})), []);
  assert.deepEqual(Array.from(hooks.sanitizeQuickLinks({version:1,links:[defaults[0]]})), []);
  assert.equal(defaults[0].icon, '🎬');
  assert.equal(defaults[1].icon, '📁');
});

test('Quick Links validate HTTP(S) destinations without changing deep links', () => {
  const origin = hooks.sanitizeQuickLink({
    id:'ql-test123', title:' Custom  Portal ',href:'https://example.com/app?x=123#section',icon:'💻'
  });
  assert.equal(origin.title, 'Custom Portal');
  assert.equal(origin.href, 'https://example.com/app?x=123#section');
  assert.equal(origin.icon, '💻');
  assert.equal(hooks.sanitizeQuickLink({id:'ql-test123',title:'T',href:'http://localhost:8000/',icon:'📁'}).href, 'http://localhost:8000/');
  for (const href of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd',
    'https://person:password@example.com/', 'not a link', 'ftp://example.com/']) {
    assert.equal(hooks.sanitizeQuickLink({id:'ql-invalid',title:'Bad',href}),null,href);
  }
  assert.equal(hooks.sanitizeQuickLink({id:'ql-invalid',title:' ',href:'https://example.com/'}),null);
  assert.equal(hooks.sanitizeQuickLink({id:'wrong-id',title:'Bad',href:'https://example.com/'}),null);
  assert.equal(hooks.sanitizeQuickLink({id:'ql-anything',title:'Name',href:'https://example.com/',icon:'<script>'}).icon,'🔖');
});

test('Quick Links add, edit, remove and reorder are pure and preserve IDs', () => {
  const original = hooks.sanitizeQuickLinks(null);
  const added = hooks.saveQuickLinkModel(original, {
    id:'ql-wiki123',title:'Wikipedia',href:'https://en.wikipedia.org/',icon:'📚'
  });
  assert.equal(added.length,3);
  assert.equal(hooks.saveQuickLinkModel(added, added[0]),null);
  assert.equal(original.length,2);
  const edited = hooks.editQuickLinkModel(added, 'ql-wiki123', {
    title:'Reference Wiki',href:'https://en.wikipedia.org/wiki/Main_Page'
  });
  assert.equal(edited[2].title,'Reference Wiki');
  assert.equal(edited[2].id,'ql-wiki123');
  assert.equal(edited[2].href,'https://en.wikipedia.org/wiki/Main_Page');
  assert.equal(added[2].title,'Wikipedia');
  assert.equal(hooks.editQuickLinkModel(added,'not-there',{title:'New'}),null);
  const moved = hooks.reorderQuickLinksModel(edited,'ql-wiki123','youtube',false);
  assert.deepEqual(Array.from(moved, (i)=>i.id),['ql-wiki123','youtube','google-drive']);
  assert.equal(hooks.reorderQuickLinksModel(moved,'youtube','youtube',false),null);
  const removed = hooks.deleteQuickLinkModel(moved,'youtube');
  assert.deepEqual(Array.from(removed, (i)=>i.id),['ql-wiki123','google-drive']);
  assert.equal(hooks.deleteQuickLinkModel(removed,'youtube'),null);
});


test('ChatGPT category search precedes forms, cards and footer Add controls', () => {
  const render = script.slice(script.indexOf('  function render() {'),script.indexOf('  function show('));
  const search = render.indexOf("const search = el('input', 'search')");
  const intake = render.indexOf("if (addingProject) content.appendChild(makeAddProjectForm())");
  const items = render.indexOf("const hasSearch = query.trim().length > 0");
  const footer = render.lastIndexOf("const footer = el('div', 'foot')");
  const add = render.indexOf("footerActions.appendChild(button(addingProject ?",footer);
  const chat = render.indexOf("footerActions.appendChild(button(addingChat ?",footer);
  const manage = render.indexOf("footerActions.appendChild(button('⚙ Manage Profiles & Categories'",footer);
  assert.ok(search >= 0 && search < intake && intake < items && items < footer &&
    footer < add && add < chat && chat < manage);
  assert.equal((render.match(/button\(addingProject \?/g)||[]).length,1);
  assert.equal((render.match(/button\(addingChat \?/g)||[]).length,1);
  assert.match(render,/footer\.appendChild\(footerActions\)/);
  assert.match(script,/\.footer-actions\{display:flex/);
  assert.doesNotMatch(render,/Where would you like to go\?|Only items you explicitly add are listed/);
});
test('footer intake preserves project/chat autofill, cancellation and form focus', () => {
  const render = script.slice(script.indexOf('  function render() {'),script.indexOf('  function show('));
  assert.match(render,/intakeProject = addingProject \? currentProjectForManualIntake\(\) : null/);
  assert.match(render,/intakeChat = addingChat \? currentChatForManualIntake\(\) : null/);
  assert.match(render,/if \(addingProject\) content\.appendChild\(makeAddProjectForm\(\)\)/);
  assert.match(render,/if \(addingChat\) content\.appendChild\(makeAddChatForm\(\)\)/);
  assert.match(render,/if \(main\) main\.scrollTop = 0/);
  assert.match(render,/const firstField = panel\.querySelector\('\.add-form input'\)/);
  assert.match(render,/if \(firstField\) firstField\.focus\(\)/);
  assert.match(render,/manageLinks=button\('⚙ Manage Quick Links','action'/);
  assert.match(render,/activeTab === 'quicklinks'/);
});

test('Quick Links opens real new-tab anchors and is isolated from ChatGPT inventory', () => {
  assert.match(script,/const QUICK_LINKS_KEY = APP_ID \+ '\.quickLinks\.v1'/);
  assert.match(script,/GM_getValue\(QUICK_LINKS_V2_KEY,null\)/);
  assert.match(script,/GM_getValue\(QUICK_LINKS_KEY,null\)/);
  assert.match(script,/GM_setValue\(QUICK_LINKS_V2_KEY, serializeQuickLinksV2\(next\)\)/);
  assert.match(script,/const DEFAULT_QUICK_LINKS = \[/);
  assert.match(script,/card\.target = '_blank'/);
  assert.match(script,/card\.rel = 'noopener noreferrer'/);
  assert.match(script,/function makeQuickLinkCard\(link\)/);
  assert.match(script,/function makeQuickLinkManager\(\)/);
  assert.match(script,/tab\.title, 'section-tab'/);
  assert.match(script,/activeTab = 'categories'/);
  assert.match(script,/activeTab === 'quicklinks'/);
  assert.match(script,/quickLinkEditingId = null/);
  assert.match(script,/manageLinks=button\('⚙ Manage Quick Links','action'/);
  assert.match(script,/reorderQuickLinksModel\(quickLinks, source, link\.id, after\)/);
  assert.match(script,/button\('Delete', 'action remove-action'/);
  assert.match(script,/name\.maxLength = 100/);
  assert.match(script,/url\.maxLength = 2048/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});

test('fresh installations create a blank V2 Starter profile directly', () => {
  const initial=hooks.firstProfileState(hooks.starterCategoryDefinitions,{}, {},'Starter',[]);
  const checked=hooks.sanitizeProfilesState(initial);
  assert.equal(checked.version,2);
  assert.equal(checked.profiles[0].name,'Starter');
  assert.deepEqual(Array.from(checked.profiles[0].categories,c=>c.id),
    ['work','personal','learning','interests','uncategorized']);
  assert.deepEqual(Array.from(checked.profiles[0].members),[]);
  assert.match(script,/firstProfileState\(DEFAULT_CATEGORIES,\{\}, \{\},'Starter',\[\]\)/);
  assert.match(script,/GM_setValue\(PROFILES_V2_KEY,created\)/);
});

test('pre-V2 installations cannot silently initialize over saved data', () => {
  assert.match(script,/LEGACY_ORGANIZER_KEYS\.some\(key=>GM_getValue\(key,null\)!==null\)/);
  assert.match(script,/manualProjects\.length>0 \|\| savedChats\.length>0/);
  assert.match(script,/if\(oldData\)throw Error/);
  assert.match(script,/if\(!profilesState\)/);
  assert.match(script,/warning\.setAttribute\('role','alert'\)/);
  assert.doesNotMatch(script,/upgradeProfilesToV2|chooseInitialCategoryDefinitions/);
  assert.doesNotMatch(script,/GM_setValue\(STORAGE_KEY|GM_setValue\(ORDER_KEY|GM_setValue\(CATEGORY_DEFS_KEY/);
});

test('V2 custom categories, assignments and ordering survive validation', () => {
  const categories=hooks.sanitizeCategoryDefinitions({version:1,categories:[
    {id:'business',label:'My studio',icon:'🎨'},
    {id:'custom-work123',label:'Client work',icon:'💼'},
    {id:'uncategorized',label:'Uncategorized',icon:'▤'}
  ]});
  const initial=hooks.firstProfileState(categories,
    {'project:g-p-client':'custom-work123','chat:family':'business'},
    {'custom-work123':['project:g-p-client']},'Private profile',
    ['project:g-p-client','chat:family']);
  const result=hooks.sanitizeProfilesState(initial);
  assert.deepEqual(Array.from(result.profiles[0].categories,c=>c.id),
    ['business','custom-work123','uncategorized']);
  assert.equal(result.profiles[0].categories[0].label,'My studio');
  assert.equal(result.profiles[0].assignments['chat:family'],'business');
  assert.deepEqual(Array.from(result.profiles[0].categoryOrders['custom-work123']),
    ['project:g-p-client']);
  assert.deepEqual(Array.from(result.profiles[0].members),
    ['project:g-p-client','chat:family']);
});

test('category catalog defaults and persists custom names, order and deletion', () => {
  const defaults = hooks.sanitizeCategoryDefinitions(null);
  assert.deepEqual(Array.from(defaults, (c) => c.id), [
    'work','personal','learning','interests','uncategorized'
  ]);
  assert.equal(defaults[0].label, 'Work & Projects');
  const stored = {
    version: 1,
    categories: [
      {id:'home', label:'House & Renovations'},
      {id:'custom-garden1', label:'Outdoor projects'},
      {id:'family', label:'Family'},
      {id:'uncategorized', label:'Uncategorized'}
    ]
  };
  const loaded = hooks.sanitizeCategoryDefinitions(stored);
  assert.deepEqual(Array.from(loaded, (c) => c.id), [
    'home','custom-garden1','family','uncategorized'
  ]);
  assert.equal(loaded[0].label, 'House & Renovations');
  assert.equal(loaded[1].label, 'Outdoor projects');
  assert.equal(loaded[1].icon, '▦');
  assert.equal(loaded.some((c) => c.id === 'hobbies'), false); // intentional deletion persists
});

test('category create, rename, reorder and delete preserve stable item-category IDs', () => {
  const initial = hooks.sanitizeCategoryDefinitions({version:1,categories:hooks.legacyCategoryDefinitions});
  const created = hooks.createCategoryModel(initial, '  Garden   &  Yard ', 'custom-yard123');
  assert.ok(created);
  assert.equal(created[created.length - 2].label, 'Garden & Yard');
  assert.equal(created[created.length - 2].id, 'custom-yard123');
  assert.equal(hooks.createCategoryModel(created, 'Family', 'custom-duplicate'), null);
  assert.equal(hooks.createCategoryModel(created, 'Another', 'invalid-id'), null);
  assert.equal(hooks.createCategoryModel(created, '   ', 'custom-empty'), null);

  const renamed = hooks.renameCategoryModel(created, 'home', 'House projects');
  assert.equal(renamed.find((c) => c.id === 'home').label, 'House projects');
  assert.equal(initial.find((c) => c.id === 'home').label, 'Home'); // pure
  assert.equal(hooks.renameCategoryModel(created,'home','family'), null);
  assert.equal(hooks.renameCategoryModel(created,'missing','Nope'), null);
  const moved = hooks.moveCategoryModel(renamed, 'custom-yard123', -1);
  assert.ok(moved.findIndex((c) => c.id === 'custom-yard123') <
            renamed.findIndex((c) => c.id === 'custom-yard123'));
  assert.equal(hooks.moveCategoryModel(moved, 'family', -1), null);
  assert.equal(hooks.deleteCategoryModel(created, 'uncategorized'), null);
  const withoutHome = hooks.deleteCategoryModel(renamed, 'home');
  assert.equal(withoutHome.some((c) => c.id === 'home'),false);

  const assignments = {'project:g-p-house': 'home', 'chat:other':'family',
    'project:g-p-garden':'custom-yard123'};
  const relocated = hooks.deleteCategoryAssignments(assignments,'home');
  assert.equal(Object.hasOwn(relocated, 'project:g-p-house'), false);
  assert.equal(relocated['chat:other'], 'family');
  assert.equal(relocated['project:g-p-garden'], 'custom-yard123');
  assert.equal(assignments['project:g-p-house'], 'home'); // pure
  assert.equal(hooks.normalizeCategoryId('home', withoutHome), 'uncategorized');
});

test('custom categories preserve assignments and ordering across reload', () => {
  const catalog = hooks.createCategoryModel(hooks.sanitizeCategoryDefinitions({version:1,categories:hooks.legacyCategoryDefinitions}),
    'Home Services', 'custom-services');
  const saved = hooks.sanitizeCategoryDefinitions({version:1,
    categories:Array.from(catalog,(c)=>({id:c.id,label:c.label}))});
  assert.equal(hooks.validCategory('custom-services', saved), true);
  const cleaned = hooks.sanitizeProfileAssignments({'project:g-p-a':'custom-services',
    'chat:one':'home'}, saved);
  assert.equal(cleaned['project:g-p-a'], 'custom-services');
  assert.equal(cleaned['chat:one'], 'home');
  const ordered = hooks.sanitizeCategoryOrders({version:1,categories:{
    'custom-services':['project:g-p-a'], home:['chat:one']
  }}, saved);
  assert.deepEqual(Array.from(ordered['custom-services']), ['project:g-p-a']);
  assert.deepEqual(Array.from(ordered.home), ['chat:one']);
  const removed = hooks.deleteCategoryModel(saved, 'custom-services');
  assert.equal(hooks.sanitizeProfileAssignments({'project:g-p-a':'custom-services'},removed)
    ['project:g-p-a'],undefined);
});


test('icon changes persist locally while category IDs and old icons remain valid', () => {
  const defaults = hooks.sanitizeCategoryDefinitions({version:1,categories:hooks.legacyCategoryDefinitions});
  assert.equal(defaults.find((c)=>c.id==='home').icon,'⌂');
  const changed = hooks.changeCategoryIconModel(defaults,'home','🏡');
  assert.ok(changed);
  assert.equal(changed.find((c)=>c.id==='home').icon,'🏡');
  assert.equal(defaults.find((c)=>c.id==='home').icon,'⌂');
  const stored = hooks.sanitizeCategoryDefinitions({version:1,categories:Array.from(changed,
    ({id,label,icon})=>({id,label,icon}))});
  assert.equal(stored.find((c)=>c.id==='home').icon,'🏡');
  assert.equal(stored.find((c)=>c.id==='home').id,'home');
  assert.equal(hooks.renameCategoryModel(stored,'home','Renovations').find((c)=>c.id==='home').icon,'🏡');
  assert.equal(hooks.moveCategoryModel(stored,'home',-1).find((c)=>c.id==='home').icon,'🏡');
  assert.equal(hooks.changeCategoryIconModel(stored,'home','<svg>'),null);
  assert.equal(hooks.changeCategoryIconModel(stored,'missing','🏡'),null);
});

test('legacy category definitions keep default icons; unknown icon values are rejected', () => {
  const old = hooks.sanitizeCategoryDefinitions({version:1,categories:[
    {id:'home',label:'Home'},
    {id:'custom-garden',label:'Garden'},
    {id:'uncategorized',label:'Uncategorized'}
  ]});
  assert.equal(old[0].icon,'⌂');
  assert.equal(old[1].icon,'▦');
  assert.equal(old[2].icon,'▤');
  const edited = hooks.changeCategoryIconModel(old,'custom-garden','🌳');
  assert.equal(hooks.sanitizeCategoryDefinitions({version:1,categories:Array.from(edited,
    ({id,label,icon})=>({id,label,icon}))})[1].icon,'🌳');
  const corrupt = hooks.sanitizeCategoryDefinitions({version:1,categories:[
    {id:'home',label:'Home',icon:'javascript:alert(1)'}
  ]});
  assert.equal(corrupt[0].icon,'⌂');
});

test('icon library can be searched and includes existing category glyphs', () => {
  assert.ok(hooks.iconLibrary.length >= 65);
  for (const icon of ['👪','♡','＄','⌂','◈','✧','✿','▤','▦']) {
    assert.equal(hooks.categoryIconAllowed(icon),true);
  }
  assert.equal(hooks.categoryIconAllowed('<img src=x>'),false);
  assert.ok(hooks.filterCategoryIcons('home').some((v)=>v.icon==='🏡'));
  assert.ok(hooks.filterCategoryIcons('bank','Finances').some((v)=>v.icon==='🏦'));
  assert.equal(hooks.filterCategoryIcons('bank','Creative').length,0);
  assert.equal(hooks.filterCategoryIcons('not-an-icon').length,0);
  assert.equal(hooks.filterCategoryIcons('').length,hooks.iconLibrary.length);
});

test('Manage Categories contains an accessible offline icon picker', () => {
  assert.match(script,/button\('Set icon', 'action'/);
  assert.match(script,/const picker = el\('div', 'category-icon-picker'\)/);
  assert.match(script,/search\.addEventListener\('input', filterIcons\)/);
  assert.match(script,/groupFilter\.addEventListener\('change', filterIcons\)/);
  assert.match(script,/changeCategoryIconModel\(CATEGORIES, category\.id, choice\.icon\)/);
  assert.match(script,/option\.setAttribute\('aria-pressed'/);
  assert.match(script,/button\('Cancel icon selection'/);
  assert.match(script,/profileSnapshot\(CATEGORIES,assignments,categoryOrders,/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});

test('category editor is isolated from chat sidebar and keeps destructive reset in manager', () => {
  assert.match(script, /activateProfileSnapshot\(chosen\)/);
  assert.match(script, /function saveCategoryDefinitions\(\) \{ return persistCurrentProfile\(\); \}/);
  assert.doesNotMatch(script, /GM_setValue\(CATEGORY_DEFS_KEY/);
  assert.match(script, /const wrapper = el\('div', 'category-manager'\)/);
  assert.match(script, /button\('⚙ Manage Profiles & Categories', 'action'/);
  assert.match(script, /content\.appendChild\(makeCategoryManager\(\)\)/);
  assert.match(script, /button\('Clear all category assignments', 'action remove-action'/);
  assert.match(script, /deleteCategoryAssignments\(assignments, category\.id\)/);
  assert.match(script, /category\.id !== 'uncategorized'/);
  assert.match(script, /row\.addEventListener\('drop'/);
  assert.match(script, /moveCategoryByArrow\(category\.id, event\.key === 'ArrowUp'/);
  assert.match(script, /gap:12px;margin-top:22px/);
  assert.doesNotMatch(script, /const reset = button\('Clear local category labels'/);
});

test('categories are flat and contain only projects or chats', () => {
  assert.deepEqual(Array.from(hooks.categories), [
    'work', 'personal', 'learning', 'interests', 'uncategorized'
  ]);
  assert.equal(hooks.validCategory('work'), true);
  assert.equal(hooks.validCategory('personal'), true);
  assert.equal(hooks.validCategory('learning'), true);
  assert.equal(hooks.validCategory('interests'), true);
  assert.equal(hooks.validCategory('family'), false);
  assert.equal(hooks.validCategory('cinema'), false);
  assert.equal(hooks.validCategory('henry'), false);
  assert.equal(hooks.validCategory('unknown'), false);
  assert.equal(hooks.itemInCategory('work', 'work'), true);
  assert.equal(hooks.itemInCategory('personal', 'work'), false);
  assert.equal(hooks.itemInCategory('interests', null), true);
  assert.equal(hooks.itemInCategory('learning', 'learning'), true);
});

test('historical category aliases are normalized within V2 profiles', () => {
  const legacy=hooks.sanitizeCategoryDefinitions({version:1,
    categories:hooks.legacyCategoryDefinitions});
  const assignments=hooks.sanitizeProfileAssignments({
    'chat:transcript':'cinema','chat:henry':'henry','chat:bradley':'bradley',
    'project:house':'home','chat:retirement':'finances'
  },legacy);
  assert.equal(assignments['chat:transcript'],'hobbies');
  assert.equal(assignments['chat:henry'],'family');
  assert.equal(assignments['chat:bradley'],'family');
  assert.equal(assignments['project:house'],'home');
  assert.equal(assignments['chat:retirement'],'finances');
  assert.equal(hooks.normalizeCategoryId('nonexistent'),'uncategorized');
});

test('new category assignment remains a flat selector without nested navigation', () => {
  assert.doesNotMatch(script, /function isDescendant\(/);
  assert.doesNotMatch(script, /directChildren|categoryPath\(/);
  assert.match(script, /if \(!hasSearch && currentCategory === null\)/);
  assert.match(script, /CATEGORIES\.forEach\(\(category\) => cards\.appendChild\(makeCategoryCard\(category\)\)\)/);
  assert.match(script, /sanitizeProfileAssignments\(p\.assignments,categories\)/);
  assert.match(script, /function saveAssignments\(\) \{ return persistCurrentProfile\(\); \}/);
});

test('organized chats save a validated local shortcut for later visits', () => {
  const chat = hooks.sanitizeSavedChat({
    title: '  Transcript   Content Warning ',
    href: 'https://chatgpt.com/g/g-p-abc-123/c/abcd-1234?token=not-stored'
  }, origin);
  assert.equal(chat.key, 'chat:abcd-1234');
  assert.equal(chat.title, 'Transcript Content Warning');
  assert.equal(chat.href, 'https://chatgpt.com/g/g-p-abc-123/c/abcd-1234');
  assert.equal(chat.manual, true);
  assert.equal(hooks.sanitizeSavedChat({
    title: 'Not a chat', href: 'https://chatgpt.com/g/g-p-abc-123/project'
  }, origin), null);
  assert.equal(hooks.sanitizeSavedChat({
    title: 'Foreign site', href: 'https://example.com/c/abc-1234'
  }, origin), null);
});

test('saved chats persist only via explicit actions, not background observation', () => {
  assert.match(script, /GM_getValue\(SAVED_CHATS_KEY, \[\]\)/);
  assert.match(script, /GM_setValue\(SAVED_CHATS_KEY/);
  assert.match(script, /function saveChatShortcut\(chat,category='uncategorized'\)/);
  assert.match(script, /function makeAddChatForm\(/);
  assert.match(script, /currentChatForManualIntake\(\)/);
  assert.match(script, /Save chat shortcut/);
  assert.match(script, /saveChatShortcut\(item,selector.value\)/);
  assert.match(script, /function removeSavedShortcut\(item\)/);
  assert.doesNotMatch(script, /collectLoadedLinks|function indexAnchor\(/);
});



test('project and chat shortcut display names can be edited without changing link identity', () => {
  const projects = [
    hooks.sanitizeManualProject({title:'Cinema Decoder',
      href:origin + '/g/g-p-cinema123/project'}, origin),
    hooks.sanitizeManualProject({title:'AI Video',
      href:origin + '/g/g-p-ai123/project'}, origin)
  ];
  const renamed = hooks.renameSavedShortcutModel(projects, projects[0].key,
    '  Film   analysis \n research  ', origin);
  assert.ok(renamed);
  assert.equal(renamed[0].title, 'Film analysis research');
  assert.equal(renamed[0].key, projects[0].key);
  assert.equal(renamed[0].href, projects[0].href);
  assert.equal(renamed[1].title, 'AI Video');
  assert.equal(projects[0].title, 'Cinema Decoder'); // immutable
  assert.deepEqual(Array.from(renamed, (v)=>v.key), Array.from(projects, (v)=>v.key));

  const chats = [hooks.sanitizeSavedChat({title:'Original conversation',
    href:origin + '/c/abc-123'}, origin)];
  const editedChat = hooks.renameSavedShortcutModel(chats, chats[0].key,
    'Personal reference', origin);
  assert.ok(editedChat);
  assert.equal(editedChat[0].title, 'Personal reference');
  assert.equal(editedChat[0].key, chats[0].key);
  assert.equal(editedChat[0].href, chats[0].href);
  assert.equal(chats[0].title, 'Original conversation');
});

test('shortcut renaming rejects blank, too-long, missing or mismatched links', () => {
  const projects = [hooks.sanitizeManualProject({
    title:'Home',href:origin+'/g/g-p-house123/project'
  }, origin)];
  assert.equal(hooks.renameSavedShortcutModel(projects, projects[0].key, '   ', origin), null);
  assert.equal(hooks.renameSavedShortcutModel(projects, projects[0].key, 'A'.repeat(141), origin), null);
  assert.equal(hooks.renameSavedShortcutModel(projects, 'project:g-p-not-saved', 'New', origin), null);
  assert.equal(hooks.renameSavedShortcutModel([], projects[0].key, 'New', origin), null);
});

test('edit popover saves name and category together and keeps remove action separate', () => {
  assert.match(script, /const nameInput = el\('input', 'edit-name'\)/);
  assert.match(script, /nameInput\.value = item\.title/);
  assert.match(script, /nameInput\.maxLength = 140/);
  assert.match(script, /const saveChanges = \(\) =>/);
  assert.match(script, /button\('Save changes', 'action', saveChanges\)/);
  assert.match(script, /title !== item\.title && !renameSavedShortcut\(item, title\)/);
  assert.match(script, /if \(selector\.value !== categoryFor\(item\)\)/);
  assert.match(script, /button\('Remove from profile'/);
  assert.doesNotMatch(script, /selector\.addEventListener\('change'/);
  assert.match(script, /GM_setValue\(storageKey, updated\.map/);
  assert.match(script, /seen\.set\(item\.key, renamed\)/);
  assert.match(script, /const storageKey = isProject \? MANUAL_PROJECTS_KEY : SAVED_CHATS_KEY/);
  assert.match(script, /Only the SwiftClick shortcut name changes, not the title in ChatGPT/);
});

test('two-column grid offers compact cards with edit-only secondary actions', () => {
  assert.match(script, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(script, /@media\(max-width:720px\).*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(script, /const editButton = button\('✎', 'edit-toggle'/);
  assert.match(script, /editButton\.setAttribute\('aria-expanded'/);
  assert.match(script, /const editor = el\('div', 'edit-panel'\)/);
  assert.match(script, /label\.appendChild\(selector\)/);
  assert.match(script, /editor\.appendChild\(actions\)/);
  assert.match(script, /actions\.appendChild\(remove\)/);
  assert.match(script, /row\.appendChild\(editButton\)/);
  assert.doesNotMatch(script, /row\.appendChild\(selector\)/);
  assert.doesNotMatch(script, /row\.appendChild\(remove\)/);
  assert.match(script, /item\.drop-before\{border-left:/);
  assert.match(script, /item\.drop-after\{border-right:/);
  assert.match(script, /positionOpenEditor\(\)/);
  assert.match(script, /if \(editItemKey !== null\)/);
});

test('grid reordering can target another column by left/right half of card', () => {
  assert.equal(hooks.dropAfterGridTarget(109, 100, 200), false);
  assert.equal(hooks.dropAfterGridTarget(200, 100, 200), true);
  assert.equal(hooks.dropAfterGridTarget(299, 100, 200), true);
  assert.equal(hooks.dropAfterGridTarget(NaN, 100, 200), false);
  assert.equal(hooks.dropAfterGridTarget(200, 100, 0), false);

  const initial = ['project:cinema', 'project:image', 'project:politics', 'chat:note'];
  const draggedToOtherColumn = hooks.reorderKeys(initial, 'project:cinema', 'project:image', true);
  assert.deepEqual(Array.from(draggedToOtherColumn), ['project:image', 'project:cinema', 'project:politics', 'chat:note']);
  assert.match(script, /dropAfterGridTarget\(event\.clientX, rect\.left, rect\.width\)/);
  assert.doesNotMatch(script, /event\.clientY >= row\.getBoundingClientRect\(\)\.top/);
});

test('manual ordering supports moving mixed chat/project rows before or after targets', () => {
  const initial = ['project:ai', 'chat:note', 'project:cinema'];
  assert.deepEqual(Array.from(hooks.reorderKeys(initial, 'project:cinema', 'project:ai')), [
    'project:cinema', 'project:ai', 'chat:note'
  ]);
  assert.deepEqual(Array.from(hooks.reorderKeys(initial, 'project:ai', 'project:cinema', true)), [
    'chat:note', 'project:cinema', 'project:ai'
  ]);
  assert.deepEqual(Array.from(hooks.reorderKeys(initial, 'project:ai', 'project:ai')), initial);
  assert.deepEqual(Array.from(hooks.reorderKeys(initial, 'chat:absent', 'project:cinema')), initial);
  assert.deepEqual(initial, ['project:ai', 'chat:note', 'project:cinema']); // pure
});

test('ordered items are category-specific and previously unseen items append', () => {
  const items = [
    { key: 'project:ai', title: 'AI Video', type: 'project' },
    { key: 'chat:note', title: 'Transcript', type: 'chat' },
    { key: 'project:cinema', title: 'Cinema Decoder', type: 'project' },
    { key: 'project:new', title: 'New project', type: 'project' }
  ];
  const stored = { hobbies: ['project:cinema', 'chat:note', 'project:ai'] };
  assert.deepEqual(
    Array.from(hooks.orderItems(items, 'hobbies', stored), (item) => item.key),
    ['project:cinema', 'chat:note', 'project:ai', 'project:new']
  );
  assert.deepEqual(
    Array.from(hooks.orderItems(items, 'family', stored), (item) => item.key),
    ['chat:note', 'project:ai', 'project:cinema', 'project:new']
  );
});

test('reordering preserves stored IDs that are not currently visible', () => {
  const stored = ['project:ai', 'chat:hidden', 'project:cinema'];
  const visibleReordered = ['project:cinema', 'project:ai', 'project:new'];
  assert.deepEqual(
    Array.from(hooks.mergeVisibleOrder(stored, visibleReordered)),
    ['project:cinema', 'chat:hidden', 'project:ai', 'project:new']
  );
});

test('category order deserialization removes invalid and duplicate IDs', () => {
  const state = hooks.sanitizeCategoryOrders({ version: 1, categories: {
    hobbies: ['project:cinema', 'project:cinema', 'chat:note', 'bad', 123],
    family: ['chat:henry'],
    home: ['project:maintenance'],
    finances: ['chat:investments'],
    madeUp: ['project:unrelated']
  } }, hooks.sanitizeCategoryDefinitions({version:1,categories:hooks.legacyCategoryDefinitions}));
  assert.deepEqual(Array.from(state.hobbies), ['project:cinema', 'chat:note']);
  assert.deepEqual(Array.from(state.family), ['chat:henry']);
  assert.deepEqual(Array.from(state.home), ['project:maintenance']);
  assert.deepEqual(Array.from(state.finances), ['chat:investments']);
  assert.equal(Object.hasOwn(state, 'madeUp'), false);
});

test('drag handle changes virtual order only; search results stay non-draggable', () => {
  assert.match(script, /function persistCategoryOrders\(\) \{ return persistCurrentProfile\(\); \}/);
  assert.doesNotMatch(script, /GM_setValue\(ORDER_KEY/);
  assert.match(script, /handle\.draggable = true/);
  assert.match(script, /handle\.addEventListener\('dragstart'/);
  assert.match(script, /row\.addEventListener\('dragover'/);
  assert.match(script, /row\.addEventListener\('drop'/);
  assert.match(script, /keyboardReorder\(item, event\.key === 'ArrowUp'/);
  assert.match(script, /!hasSearch && currentCategory !== null && ordered\.length <= 250/);
  assert.match(script, /forgetItemOrder\(item\.key\)/);
  assert.match(script, /event\.dataTransfer\.setData\('text\/plain', 'SwiftClick Organizer'\)/);
  assert.doesNotMatch(script, /row\.draggable = true/);
});

test('manual-only mode retains prior saved items without indexing the sidebar', () => {
  assert.match(script, /let manualProjects = readManualProjects\(\)/);
  assert.match(script, /let savedChats = readSavedChats\(\)/);
  assert.match(script, /for \(const project of manualProjects\) seen\.set/);
  assert.match(script, /for \(const chat of savedChats\) seen\.set/);
  assert.doesNotMatch(script, /function indexAnchor|collectLoadedLinks/);
  assert.doesNotMatch(script, /function show\(automatic = false\) \{\s*collect/);
  assert.doesNotMatch(script, /Only items you explicitly add are listed/);
  assert.match(script, /\+ Add project/);
  assert.match(script, /\+ Add chat/);
  assert.match(script, /Only the dedicated handle is draggable/);
});

test('menu companion identifies saved projects strictly by native project ID', () => {
  const existing = {key:'project:g-p-aaa-111', title:'Home Structural Maintenance', at:1000};
  assert.equal(hooks.resolveMenuProjectKey(null, existing, origin, 2000), 'project:g-p-aaa-111');
  assert.equal(hooks.resolveMenuProjectKey('', existing, origin, 2000), 'project:g-p-aaa-111');
  assert.equal(hooks.resolveMenuProjectKey(
    '/g/g-p-other-222/project', existing, origin, 2000
  ), 'project:g-p-other-222'); // explicit menu link overrides stale captured row
  assert.equal(hooks.resolveMenuProjectKey(null, existing, origin, 12000), null);
  assert.equal(hooks.resolveMenuProjectKey(null, {key:'chat:abc', at:1000}, origin, 2000), null);
  assert.equal(hooks.resolveMenuProjectKey(null, {key:'project:g-p-aaa-111', at:3000}, origin, 2000), null);
  assert.equal(hooks.resolveMenuProjectKey('/c/another-chat', null, origin, 2000), null);
  assert.equal(hooks.resolveMenuProjectKey('https://untrusted.example/g/g-p-a/project', null, origin, 2000), null);
});

test('explicit project metadata can supply URL without navigation', () => {
  assert.equal(hooks.projectIdFromMetadata({'data-project-id':'g-p-xyz123abc'}), 'g-p-xyz123abc');
  assert.equal(hooks.projectIdFromMetadata({'data-item-id':'project:g-p-abc456xyz'}), 'g-p-abc456xyz');
  assert.equal(hooks.projectIdFromMetadata({'data-entity-id':'g-p-789abc'}), 'g-p-789abc');
  assert.equal(hooks.projectIdFromMetadata({'data-project-id':'chat:abc'}), null);
  assert.equal(hooks.projectIdFromMetadata({'data-id':'g-p-123456'}), null);
  assert.equal(hooks.projectIdFromMetadata({'data-project-id':'g-p-test abc'}), null);
  assert.equal(hooks.projectIdFromMetadata({}), null);
  assert.match(script, /function captureProjectTrigger\(target\)/);
  assert.match(script, /projectIdFromMetadata\(attributes\)/);
  assert.match(script, /ids\.size === 1/);
  assert.match(script, /ids\.size > 1/);
  assert.match(script, /parseItemLink\('\/g\/\' \+ id \+ '\/project'/);
  assert.doesNotMatch(script, /home\.click\(\)/);
});

test('menu status distinguishes ID-verified saved, unique-title possible, and unsaved', () => {
  const saved = [
    {key:'project:g-p-a', title:'Cinema Decoder', href:origin + '/g/g-p-a/project'},
    {key:'project:g-p-b', title:'Home Structural Maintenance', href:origin + '/g/g-p-b/project'}
  ];
  const now = 5000;
  const seen = hooks.classifyMenuProject('/g/g-p-b/project',
    {at:now, key:'project:g-p-a', title:'Cinema Decoder'}, saved, origin, now);
  assert.equal(seen.status,'saved');
  assert.equal(seen.project.key,'project:g-p-b'); // explicit native link wins

  const idOnly = hooks.classifyMenuProject(null,
    {at:now, key:'project:g-p-a', title:''}, saved, origin, now);
  assert.equal(idOnly.status,'saved');

  const uniqueName = hooks.classifyMenuProject(null,
    {at:now, key:null, title:'Cinema Decoder'}, saved, origin, now);
  assert.equal(uniqueName.status,'possible');
  assert.equal(uniqueName.project.key,'project:g-p-a');

  const duplicateName = hooks.classifyMenuProject(null,
    {at:now,key:null,title:'Cinema Decoder'}, [...saved,
      {key:'project:g-p-c',title:'Cinema Decoder'}], origin, now);
  assert.equal(duplicateName.status,'manual');
  const differentIdSameName = hooks.classifyMenuProject('/g/g-p-new/project',
    {at:now,key:null,title:'Cinema Decoder'}, saved, origin, now);
  assert.equal(differentIdSameName.status,'add');
  assert.equal(differentIdSameName.project.key,'project:g-p-new');

  const stale = hooks.classifyMenuProject(null,
    {at:1,key:'project:g-p-a',title:'Cinema Decoder'}, saved, origin, now+20000);
  assert.equal(stale.status,'manual');

  const notSaved = hooks.classifyMenuProject('/g/g-p-fresh/project',
    {at:now,key:'project:g-p-fresh',title:'New Project'}, saved, origin, now);
  assert.equal(notSaved.status,'add');
  assert.equal(notSaved.project.href,origin + '/g/g-p-fresh/project');
  assert.equal(hooks.classifyMenuProject(null,null,saved,origin,now).status,'manual');
});

test('project menu action is click-based, status-safe and never navigates natively', () => {
  assert.match(script, /menuActionButton\.textContent=isSaved\?'✓ Already in this profile'/);
  assert.match(script, /isPossible\?'\? Possible match — Review'/);
  assert.match(script, /const context = menuActionSnapshot \|\|/);
  assert.match(script, /menuPressActive = true/);
  assert.match(script, /menuActionSnapshot = menuContextFor\(activeNativeProjectHome\)/);
  assert.match(script, /function handleProjectMenuAction\(\)/);
  assert.match(script, /if \(context\.status === 'saved' \|\| context\.status === 'possible'\)/);
  assert.match(script,/context\.status === 'saved' && context\.project && !isInActiveProfile/);
  assert.match(script, /openProjectManualIntake\(context\.title\)/);
  assert.match(script, /currentCategory = categoryFor\(project\)/);
  assert.doesNotMatch(script, /home\.click\(\)|resolveNativeProjectIntake|pendingNativeProject/);
  assert.match(script, /if \(depth > 0 && bounds && bounds\.height > 110\) break/);
  assert.doesNotMatch(script, /menu\.appendChild\(menuActionHost\)|sidebar\.insertBefore/);
});

test('manual project-menu intake captures selected project title, not current page', () => {
  assert.equal(hooks.cleanIntakeName(' Unnamed project '), '');
  assert.equal(hooks.cleanIntakeName('  ChatGPT - Cinema Decoder - Project '), 'Cinema Decoder');
  assert.equal(hooks.cleanIntakeName('  AI Video Production '), 'AI Video Production');
  assert.equal(hooks.cleanIntakeName('Transcript Content Warning | ChatGPT'), 'Transcript Content Warning');
  assert.equal(hooks.cleanIntakeName('ChatGPT - ChatGPT'), '');
  assert.equal(hooks.cleanIntakeName('ChatGPT - Project'), '');
  const now = Date.now();
  const selected = { key: 'project:g-p-222', title: 'Coding — Tampermonkey Scripts', at: now };
  assert.equal(
    hooks.chooseProjectName(selected, 'project:g-p-222', 'Old saved title', 'Other open project'),
    'Coding — Tampermonkey Scripts'
  );
  assert.equal(
    hooks.chooseProjectName(selected, 'project:g-p-wrong', 'Known real title', 'Other open project'),
    'Known real title'
  );
  assert.equal(hooks.chooseProjectName(null, 'project:g-p-222', '', 'Unnamed project'), '');
  assert.match(script, /function captureProjectTrigger\(target\)/);
  assert.match(script, /document\.addEventListener\('pointerdown'/);
  assert.match(script, /recentProjectTrigger/);
  assert.match(script, /function classifyMenuProject\(/);
  assert.match(script, /function openProjectManualIntake\(title\)/);
  assert.doesNotMatch(script, /home\.click\(\)/);
  assert.match(script, /if \(intakeProject\) name\.value = cleanIntakeName\(intakeProject\.title\)/);
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

test('header icon geometry places a small toggle LEFT of search with safe fallback', () => {
  const allowed = hooks.headerLauncherGeometry({left:300, top:15, width:35, height:35}, 1440);
  assert.equal(allowed.x,260);
  assert.equal(allowed.y,17);
  assert.equal(allowed.size,32);
  assert.equal(hooks.headerLauncherGeometry({left:135, top:15, width:35, height:35}, 1440),null);
  assert.equal(hooks.headerLauncherGeometry({left:400, top:200, width:35, height:35},1440),null);
  assert.equal(hooks.headerLauncherGeometry({left:900, top:15, width:35, height:35},1440),null);
  assert.equal(hooks.headerLauncherGeometry({left:300, top:15, width:0, height:35},1440),null);
});

test('icon launcher is visually header-anchored, without injecting into native controls', () => {
  assert.match(script, /function findHeaderSearchButton\(\)/);
  assert.match(script, /function positionLauncher\(\)/);
  assert.match(script, /headerLauncherGeometry\(rect, window\.innerWidth\)/);
  assert.match(script, /launcherHost\.dataset\.placement = 'header'/);
  assert.match(script, /launcherHost\.dataset\.placement = 'fallback'/);
  assert.match(script, /document\.body\.appendChild\(launcherHost\)/);
  assert.match(script, /document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/);
  assert.match(script, /button\('', '', \(\) => open \? hide\(\) : show\(\)\)/);
  assert.match(script, /launcherButton\.setAttribute\('aria-expanded', 'true'\)/);
  assert.match(script, /launcherButton\.setAttribute\('aria-expanded', 'false'\)/);
  assert.match(script, /window\.addEventListener\('resize', scheduleRefresh/);
  assert.doesNotMatch(script, /sidebar\.insertBefore|header\.appendChild\(launcherHost\)|searchButton\.parentNode\.insertBefore/);
});

test('header launcher uses matching navy bookmark styling, preserving alignment', () => {
  const css=script.slice(script.indexOf('const LAUNCHER_CSS'),
    script.indexOf('const OVERLAY_CSS'));
  assert.match(css,/width:32px;height:32px/);
  assert.match(css,/border:1px solid #7992aa/);
  assert.match(css,/background:#182b3e;color:#e3f0ff/);
  assert.match(css,/box-shadow:0 4px 14px #0004/);
  assert.match(css,/button:hover\{background:#294760/);
  assert.doesNotMatch(css,/background:transparent|--sc-launcher-color/);
  assert.match(script,/const size = 32/);
  assert.match(script,/launcherHost\.dataset\.placement = 'header'/);
  assert.match(script,/launcherHost\.dataset\.placement = 'fallback'/);
});

test('launcher is completely outside native ChatGPT navigation', () => {
  // The previous launcher was inserted as the first child of an existing
  // nav/sidebar. That DOM mutation can disrupt ChatGPT project hover buttons.
  assert.match(script, /document\.body\.appendChild\(launcherHost\)/);
  assert.doesNotMatch(script, /sidebar\.insertBefore|findSidebar/);
  assert.match(script, /launcherHost\.dataset\.placement = 'header'/);
  assert.match(script, /pointer-events:none/);
  assert.match(script, /pointer-events:auto/);
});

test('project-menu companion avoids mutations inside native menus and sidebar', () => {
  assert.match(script, /document\.body\.appendChild\(menuActionHost\)/);
  assert.match(script, /findNativeProjectMenu/);
  assert.match(script, /textContent\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.toLowerCase\(\) === 'project home'/);
  assert.match(script, /nativeLink\.getAttribute\('href'\)/);
  assert.match(script, /classifyMenuProject\(href, recentProjectTrigger, manualProjects, location\.origin\)/);
  assert.match(script, /menuActionButton\.addEventListener\('click'/);
  assert.doesNotMatch(script, /home\.click\(\)/);
  assert.doesNotMatch(script, /startNativeProjectIntake|resolveNativeProjectIntake/);
  assert.doesNotMatch(script, /menu\.appendChild\(menuActionHost\)|menu\.insertBefore\(menuActionHost|sidebar\.insertBefore/);
});

test('project intake validates a project URL and keeps native data unchanged', () => {
  assert.match(script, /function openProjectIntake\(project\)/);
  assert.match(script, /Confirm the selected project and choose where its shortcut should appear/);
  assert.match(script, /The project URL was not available from that menu/);
  assert.match(script, /intakeProject = addingProject \? currentProjectForManualIntake\(\) : null/);
  assert.match(script, /sanitizeManualProject\(\{ title: name\.value, href: url\.value \}/);
  assert.match(script, /GM_setValue\(MANUAL_PROJECTS_KEY/);
  assert.match(script, /function openProjectManualIntake\(title\)/);
  assert.match(script, /intakeProject = \{ type: 'project', key: null, title: cleanIntakeName\(title\), href: '' \}/);
});

test('discovered project titles are normalized without affecting chat titles', () => {
  const project = hooks.parseItemLink(
    '/g/g-p-123-project/project', 'ChatGPT - Cinema Decoder - Project', origin
  );
  assert.equal(project.title, 'Cinema Decoder');
  const chat = hooks.parseItemLink('/c/123', 'ChatGPT - Cinema Decoder - Project', origin);
  assert.equal(chat.title, 'ChatGPT - Cinema Decoder - Project');
});

test('native menu companion never navigates or restores an old automatic intake', () => {
  assert.match(script, /function openProjectIntake\(project\)/);
  assert.match(script, /function openProjectManualIntake\(title\)/);
  assert.doesNotMatch(script, /LEGACY_PENDING_INTAKE_KEY|resumePendingIntake/);
  assert.match(script, /if \(open\) hide\(\); \/\/ Ordinary navigation closes the organizer/);
  assert.doesNotMatch(script, /home\.click\(\)|resumePendingIntake|pendingNativeProject/);
});

test('categorizing a discovered project preserves its shortcut across reloads', () => {
  assert.match(script, /title !== item\.title && !renameSavedShortcut\(item, title\)/);
  assert.match(script, /function saveProjectShortcut\(project,category='uncategorized'\)/);
  assert.match(script, /const next=existing\.filter\(p=>p\.key!==parsed\.key\)\.concat\(parsed\)/);
  assert.match(script, /seen\.set\(parsed\.key,parsed\)/);
  assert.match(script, /GM_setValue\(MANUAL_PROJECTS_KEY/);
  assert.doesNotMatch(script, /'Saved project' : 'Project'/);
  assert.match(script, /for \(const c of CATEGORIES\)/);
  assert.match(script, /for \(const category of CATEGORIES\)/);
});


test('bookmark status follows URL identity and saved assignments, not titles', () => {
  const projects=[hooks.sanitizeManualProject({title:'Renamed project',
    href:'https://chatgpt.com/g/g-p-123/project'},origin)];
  const chats=[hooks.sanitizeSavedChat({title:'Renamed chat',
    href:'https://chatgpt.com/c/abc123'},origin)];
  const categories=hooks.sanitizeCategoryDefinitions({version:1,categories:[
    {id:'work',label:'Work'},{id:'custom-one123',label:'Mine'},
    {id:'uncategorized',label:'Uncategorized'}]});
  const assigned={'project:g-p-123':'custom-one123','chat:abc123':'work'};
  const status=(url)=>hooks.quickSaveStateForRoute(url,origin,projects,chats,assigned,categories);
  assert.equal(status('https://chatgpt.com/g/g-p-123/project').saved.title,'Renamed project');
  assert.equal(status('https://chatgpt.com/g/g-p-123/project').category,'custom-one123');
  assert.equal(status('https://chatgpt.com/c/abc123').saved.title,'Renamed chat');
  assert.equal(status('https://chatgpt.com/c/abc123').category,'work');
  assert.equal(status('https://chatgpt.com/c/different').saved,null);
  assert.equal(status('https://chatgpt.com/c/different').category,'uncategorized');
  for(const url of ['https://chatgpt.com/','https://chatgpt.com/library',
    'https://example.com/c/abc123','https://chatgpt.com/g/g-some-gpt']) {
    assert.equal(status(url),null);
  }
});

test('bookmark widget is isolated and keeps user-initiated mutations local', () => {
  assert.match(script,/const quickSaveRoot = quickSaveHost\.attachShadow\(\{mode:'open'\}\)/);
  assert.match(script,/document\.body\.appendChild\(quickSaveHost\)/);
  assert.match(script,/function persistQuickSave\(item,operation,title,category\)/);
  assert.match(script,/GM_setValue\(storageKey,serialize\(next\)\)/);
  assert.match(script,/const target=profileMemberUpdate\(profilesState,profilesState\.activeId,/);
  assert.match(script,/currentProjectForManualIntake\(\):currentChatForManualIntake\(\)/);
  assert.match(script,/if\(item\.key!==quickSaveActiveKey\)\{closeQuickSave\(\)/);
  assert.match(script,/Remove from profile/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});

test('Quick Save CSS uses real rule separators and keeps the bookmark clickable', () => {
  const start=script.indexOf('const QUICK_SAVE_CSS = [');
  const end=script.indexOf('const quickSaveHost =',start);
  assert.ok(start>=0 && end>start);
  const section=script.slice(start,end);
  // A literal backslash-n leaves rules concatenated into invalid CSS;
  // this caused a blank, inert rectangle in the initial bookmark build.
  assert.ok(section.includes("].join('\\n');"));
  assert.equal(section.includes("].join('\\\\n');"),false);
  assert.match(section, /pointer-events:auto;width:36px;height:36px/);
  assert.match(section, /svg\{width:20px;height:20px/);
  assert.match(section, /\.popover\{pointer-events:auto/);
  const saveStart=script.indexOf('function persistQuickSave(');
  const saveEnd=script.indexOf('function renderQuickSaveEditor(',saveStart);
  const save=script.slice(saveStart,saveEnd);
  assert.ok(save.includes("replace(/\\s+/g,' ').trim()"));
  assert.equal(save.includes("replace(/\\\\s+/g,' ').trim()"),false);
});

test('Quick Save category grid expands naturally and only scrolls when viewport-constrained', () => {
  const start=script.indexOf('const QUICK_SAVE_CSS = [');
  const end=script.indexOf('const quickSaveHost =',start);
  const css=script.slice(start,end);
  assert.match(css,/\.popover\{[^']*max-height:calc\(100dvh - 145px\)/);
  assert.match(css,/\.popover\{[^']*display:flex;flex-direction:column/);
  assert.match(css,/\.choices\{[^']*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.choices\{[^']*flex:0 1 auto;min-height:0;max-height:none;overflow-y:auto/);
  assert.match(css,/\.actions\{[^']*flex-shrink:0/);
  assert.doesNotMatch(css,/max-height:165px/);
});


test('V2 profile snapshots preserve definitions, assignments and item order independently',()=>{
  const old=hooks.sanitizeCategoryDefinitions({version:1,categories:[
    {id:'business',label:'Clients',icon:'◈'},
    {id:'custom-work123',label:'Personal projects',icon:'🎨'},
    {id:'uncategorized',label:'Uncategorized',icon:'▤'}
  ]});
  const assignments={'project:g-p-client':'business','chat:abc':'custom-work123'};
  const orders={business:['project:g-p-client'], 'custom-work123':['chat:abc']};
  const initial=hooks.firstProfileState(old,assignments,orders,'My Organization',['project:g-p-client','chat:abc']);
  assert.equal(initial.version,2);
  assert.equal(initial.activeId,'profile-original');
  assert.equal(initial.defaultId,'profile-original');
  assert.equal(initial.profiles[0].name,'My Organization');
  assert.deepEqual(Array.from(initial.profiles[0].categories,c=>c.label),
    ['Clients','Personal projects','Uncategorized']);
  assert.equal(initial.profiles[0].assignments['chat:abc'],'custom-work123');
  assert.deepEqual(Array.from(initial.profiles[0].categoryOrders.business),
    ['project:g-p-client']);
  const checked=hooks.sanitizeProfilesState(initial);
  assert.ok(checked);
  // Mutating a validated copy does not affect the original configuration.
  checked.profiles[0].categories[0].label='Other';
  assert.equal(old[0].label,'Clients');
  assert.equal(initial.profiles[0].categories[0].label,'Clients');
});

test('duplicate, blank, activation and deletion retain independent profiles',()=>{
  const old=hooks.firstProfileState(hooks.legacyCategoryDefinitions,{'chat:abc':'family'},
    {family:['chat:abc']});
  const duplicate=hooks.newProfileState(old,'profile-experiment123','Experiment',
    old.profiles[0]);
  assert.ok(duplicate);
  assert.equal(duplicate.profiles.length,2);
  duplicate.profiles[1].categories[0].label='Personalized';
  duplicate.profiles[1].assignments['chat:abc']='home';
  assert.equal(old.profiles[0].categories[0].label,'Family');
  assert.equal(old.profiles[0].assignments['chat:abc'],'family');
  const blank=hooks.newProfileState(duplicate,'profile-empty123','Clean slate');
  assert.equal(blank.profiles.length,3);
  assert.deepEqual(Array.from(blank.profiles[2].categories,c=>c.id),
    ['work','personal','learning','interests','uncategorized']);
  assert.equal(Object.keys(blank.profiles[2].assignments).length,0);
  const deleteOriginal=hooks.deleteProfileState(blank,'profile-original');
  assert.equal(deleteOriginal.profiles.length,2);
  assert.equal(deleteOriginal.activeId,'profile-experiment123');
  assert.equal(deleteOriginal.defaultId,'profile-experiment123');
  assert.equal(hooks.deleteProfileState(blank,'profile-empty123').profiles.length,2);
  const deleteActive=hooks.deleteProfileState({...blank,activeId:'profile-empty123'},'profile-empty123');
  assert.equal(deleteActive.activeId,'profile-original');
  assert.equal(deleteActive.defaultId,'profile-original');
  const snap=hooks.profileSnapshot(blank.profiles[2].categories,
    {'chat:abc':'work'},{work:['chat:abc']});
  const revised=hooks.profileWithSnapshot(blank,'profile-empty123',snap);
  assert.equal(revised.profiles[2].assignments['chat:abc'],'work');
  assert.equal(blank.profiles[2].assignments['chat:abc'],undefined);
});

test('profile deletion works for active, default, both, or inactive without resetting survivors',()=>{
  const base=hooks.firstProfileState(hooks.starterCategoryDefinitions,
    {'chat:shared':'work'},{work:['chat:shared']},'Original',['chat:shared']);
  const second=hooks.newProfileState(base,'profile-two123','Second');
  const withShared=hooks.profileMemberUpdate(second,'profile-two123','chat:shared','learning',true);
  const third=hooks.newProfileState(withShared,'profile-three123','Third');
  // Delete current active+default profile: first remaining becomes both.
  const both=hooks.deleteProfileState(third,'profile-original');
  assert.deepEqual(Array.from(both.profiles,p=>p.id),['profile-two123','profile-three123']);
  assert.equal(both.activeId,'profile-two123');
  assert.equal(both.defaultId,'profile-two123');
  assert.equal(both.profiles[0].assignments['chat:shared'],'learning');
  assert.equal(hooks.isMemberAnywhere(both,'chat:shared'),true);
  // Delete active but not default: switch to the existing default profile.
  const activeOnly={...third,activeId:'profile-three123'};
  const activeDeleted=hooks.deleteProfileState(activeOnly,'profile-three123');
  assert.equal(activeDeleted.activeId,'profile-original');
  assert.equal(activeDeleted.defaultId,'profile-original');
  // Delete default but not active: active profile becomes the new default.
  const defaultOnly={...third,activeId:'profile-two123'};
  const defaultDeleted=hooks.deleteProfileState(defaultOnly,'profile-original');
  assert.equal(defaultDeleted.activeId,'profile-two123');
  assert.equal(defaultDeleted.defaultId,'profile-two123');
  // Delete neither active nor default without changing the selections.
  const inactiveDeleted=hooks.deleteProfileState(third,'profile-three123');
  assert.equal(inactiveDeleted.activeId,'profile-original');
  assert.equal(inactiveDeleted.defaultId,'profile-original');
  assert.equal(hooks.deleteProfileState(third,'profile-missing'),null);
  const lastRemaining=hooks.deleteProfileState(both,'profile-three123');
  assert.equal(lastRemaining.profiles.length,1);
  assert.equal(hooks.deleteProfileState(lastRemaining,'profile-two123'),null);
  assert.equal(third.profiles.length,3); // Pure model: never mutate input.
  assert.ok(hooks.sanitizeProfilesState(both));
  assert.ok(hooks.sanitizeProfilesState(defaultDeleted));
});

test('profile delete action is visible for active and default when a survivor exists',()=>{
  const start=script.indexOf('function makeProfilesManager()');
  const end=script.indexOf('function render()',start);
  const manager=script.slice(start,end);
  assert.match(manager,/if\(profilesState\.profiles\.length>1\)\{/);
  assert.match(manager,/button\('Delete','action remove-action'/);
  assert.doesNotMatch(manager,/if\(p\.id!==profilesState\.activeId && p\.id!==profilesState\.defaultId\)/);
  assert.match(manager,/const next=deleteProfileState\(profilesState,p\.id\)/);
  assert.match(manager,/if\(!window\.confirm\(/);
  assert.match(manager,/const exclusive=p\.members\.filter/);
  assert.match(manager,/if\(!persistProfiles\(next\)\)\{render\(\);return;\}/);
  assert.match(manager,/window\.sessionStorage\.removeItem\(ACTIVE_PROFILE_TAB_KEY\)/);
  assert.match(manager,/window\.sessionStorage\.setItem\(ACTIVE_PROFILE_TAB_KEY,next\.activeId\)/);
  assert.match(manager,/currentCategory=null;query='';editItemKey=null/);
});

test('new users receive a named Starter profile with generic categories',()=>{
  const starter=hooks.firstProfileState(hooks.starterCategoryDefinitions,{}, {},'Starter');
  assert.equal(starter.profiles[0].name,'Starter');
  assert.equal(starter.profiles[0].categories.length,5);
  assert.equal(hooks.sanitizeProfilesState(starter).profiles[0].name,'Starter');
  assert.match(script,/firstProfileState\(DEFAULT_CATEGORIES,\{\}, \{\},'Starter',\[\]\)/);
});

test('invalid profile storage fails closed rather than resetting user categories',()=>{
  const base=hooks.firstProfileState(hooks.legacyCategoryDefinitions,{}, {});
  assert.equal(hooks.sanitizeProfilesState({...base,version:999}),null);
  assert.equal(hooks.sanitizeProfilesState({...base,activeId:'profile-missing'}),null);
  assert.equal(hooks.sanitizeProfilesState({...base,profiles:[]}),null);
  assert.equal(hooks.sanitizeProfilesState({...base,profiles:[{
    ...base.profiles[0],categories:[{id:'bad',label:'Untrusted'}]
  }]}),null);
  assert.equal(hooks.newProfileState(base,'invalid','bad'),null);
  assert.equal(hooks.deleteProfileState(base,'profile-original'),null);
});

test('V2 profile store is authoritative and obsolete storage keys are read-only guards',()=>{
  assert.match(script,/const PROFILES_V2_KEY = APP_ID \+ '\.profiles\.v2'/);
  assert.match(script,/const ACTIVE_PROFILE_TAB_KEY = APP_ID \+ '\.activeProfileTab\.v1'/);
  assert.match(script,/GM_getValue\(PROFILES_V2_KEY,null\)/);
  assert.match(script,/GM_setValue\(PROFILES_V2_KEY,created\)/);
  assert.match(script,/GM_setValue\(PROFILES_V2_KEY,checked\)/);
  assert.match(script,/function saveCategoryDefinitions\(\) \{ return persistCurrentProfile\(\); \}/);
  assert.match(script,/function persistCategoryOrders\(\) \{ return persistCurrentProfile\(\); \}/);
  assert.match(script,/function saveAssignments\(\) \{ return persistCurrentProfile\(\); \}/);
  assert.match(script,/function removeSavedShortcut\(item\)/);
  assert.match(script,/profileMemberUpdate\(profilesState,profilesState\.activeId,/);
  assert.match(script,/newProfileState\(profilesState,id,entry\.value,source\)/);
  assert.match(script,/deleteProfileState\(profilesState,p\.id\)/);
  assert.match(script,/wrapper\.appendChild\(makeProfileManagerIntro\(\)\)/);
  assert.doesNotMatch(script,/\bprofileMode\b|upgradeProfilesToV2|migrateAssignments\(/);
  assert.doesNotMatch(script,/GM_setValue\(PROFILES_KEY|GM_setValue\(STORAGE_KEY|GM_setValue\(ORDER_KEY/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});

test('profile switching is scoped to ChatGPT Categories, with admin and category editor combined',()=>{
  const start=script.indexOf('function render()');
  const end=script.indexOf('function show(',start);
  const renderer=script.slice(start,end);
  const manager=script.slice(script.indexOf('function makeCategoryManager()'),
    script.indexOf('function makeCategoryCard('));
  assert.ok(renderer.includes("const searchRow=el('div','category-search-row')"));
  assert.ok(renderer.includes("makeProfileSelector('category-profile-select','Switch active Organizer profile')"));
  assert.ok(renderer.includes("searchRow.appendChild(selectorLabel)"));
  assert.ok(renderer.includes("content.appendChild(searchRow)"));
  assert.ok(renderer.includes("footerActions.appendChild(button('⚙ Manage Profiles & Categories'"));
  assert.doesNotMatch(renderer,/activeTab==='profiles'|activeTab='profiles'/);
  assert.doesNotMatch(renderer,/header\.appendChild\(control\)/);
  assert.match(manager,/Manage Profiles & Categories/);
  assert.match(manager,/makeProfileManagerIntro\(\)/);
  assert.match(manager,/makeProfilesManager\(\)/);
  assert.match(manager,/profileAdminExpanded/);
  assert.match(script,/function makeProfileSelector\(className, ariaLabel\)/);
  assert.match(script,/if\(!switchProfile\(select\.value\)\)/);
  assert.match(script,/let profileAdminExpanded = false/);
});


test('bookmark can switch among profiles without altering the default',()=>{
  const start=script.indexOf('function renderQuickSaveEditor()');
  const end=script.indexOf('function refreshQuickSave(force=false)',start);
  const ui=script.slice(start,end);
  assert.doesNotMatch(ui,/profileMode/);
  assert.match(ui,/const active=profilesState\.profiles\.find\(p=>p\.id===profilesState\.activeId\)/);
  assert.match(ui,/for\(const profile of profilesState\.profiles\)/);
  assert.match(ui,/trigger\.setAttribute\('aria-label','Select profile for this shortcut/);
  assert.match(ui,/switchProfile\(profile\.id\)/);
  assert.doesNotMatch(ui,/switchProfile\(profile\.id,true\)/);
  assert.match(ui,/renderQuickSaveEditor\(\)/);
  assert.match(ui,/profile\.id===profilesState\.defaultId/);
  assert.match(ui,/label.*shared|display name \(shared\)/i);
  assert.match(ui,/Category in this profile/);
  assert.match(ui,/role','status'/);
  assert.match(ui,/select another profile to organize it there/);
  assert.match(ui,/Remove from profile/);
  assert.match(ui,/last profile/);
});

test('bookmark profile list remains visible, keyboard usable and non-HTML-injected',()=>{
  const css=script.slice(script.indexOf('const QUICK_SAVE_CSS'),
    script.indexOf('const quickSaveHost'));
  assert.match(css,/\.profile-list\{position:absolute;/);
  assert.match(css,/\.profile-list\[hidden\]\{display:none!important/);
  assert.match(css,/\.profile-option:hover,\.profile-option:focus-visible/);
  const ui=script.slice(script.indexOf('function renderQuickSaveEditor()'),
    script.indexOf('function refreshQuickSave(force=false)'));
  assert.match(ui,/list\.setAttribute\('role','listbox'\)/);
  assert.match(ui,/option\.setAttribute\('role','option'\)/);
  assert.match(ui,/event\.key==='Escape'/);
  assert.match(ui,/event\.key==='ArrowDown'/);
  assert.match(ui,/event\.key==='Home'/);
  assert.doesNotMatch(ui,/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});


test('V2-only startup preserves validated data and refuses legacy-only auto-upgrade',()=>{
  const initial=hooks.firstProfileState(hooks.starterCategoryDefinitions,
    {'chat:a':'work'},{work:['chat:a']},'Existing',['chat:a','chat:b']);
  const parsed=hooks.sanitizeProfilesState(initial);
  assert.deepEqual(Array.from(parsed.profiles[0].members),['chat:a','chat:b']);
  assert.equal(parsed.profiles[0].assignments['chat:a'],'work');
  assert.deepEqual(Array.from(parsed.profiles[0].categoryOrders.work),['chat:a']);
  assert.match(script,/if\(storedV2!==null\)/);
  assert.match(script,/const loaded=sanitizeProfilesState\(storedV2\)/);
  assert.match(script,/if\(oldData\)throw Error/);
  assert.doesNotMatch(script,/upgradeProfilesToV2/);
});

test('Stage 1.5 independent membership supports Uncategorized and profile-specific removal',()=>{
  const initial=hooks.firstProfileState(hooks.starterCategoryDefinitions,{}, {},
    'Personal',['chat:shared','chat:only-first']);
  const second=hooks.newProfileState(initial,'profile-second123','Other');
  assert.deepEqual(Array.from(second.profiles[1].members),[]);
  assert.equal(hooks.memberInProfile(second.profiles[0],'chat:shared'),true);
  assert.equal(hooks.memberInProfile(second.profiles[1],'chat:shared'),false);
  const added=hooks.profileMemberUpdate(second,'profile-second123','chat:shared','learning',true);
  assert.equal(added.profiles[1].assignments['chat:shared'],'learning');
  assert.equal(hooks.isMemberAnywhere(added,'chat:shared'),true);
  const removedFirst=hooks.profileMemberUpdate(added,'profile-original','chat:shared',
    'uncategorized',false);
  assert.equal(hooks.memberInProfile(removedFirst.profiles[0],'chat:shared'),false);
  assert.equal(hooks.memberInProfile(removedFirst.profiles[1],'chat:shared'),true);
  const removedSecond=hooks.profileMemberUpdate(removedFirst,'profile-second123',
    'chat:shared','uncategorized',false);
  assert.equal(hooks.isMemberAnywhere(removedSecond,'chat:shared'),false);
  assert.equal(hooks.isMemberAnywhere(removedSecond,'chat:only-first'),true);
  const uncategorized=hooks.profileMemberUpdate(removedSecond,'profile-second123',
    'chat:yet-another','uncategorized',true);
  assert.equal(hooks.memberInProfile(uncategorized.profiles[1],'chat:yet-another'),true);
  assert.equal(uncategorized.profiles[1].assignments['chat:yet-another'],undefined);
  assert.equal(hooks.sanitizeProfilesState(uncategorized).profiles.length,2);
});

test('Stage 1.5 duplicate copies membership while starter stays empty',()=>{
  const first=hooks.firstProfileState(hooks.starterCategoryDefinitions,{}, {},
    'Personal',['chat:a','project:g-p-test']);
  const copied=hooks.newProfileState(first,'profile-copy123','Duplicate',first.profiles[0]);
  assert.deepEqual(Array.from(copied.profiles[1].members),['chat:a','project:g-p-test']);
  const clean=hooks.newProfileState(copied,'profile-starter123','Starter');
  assert.deepEqual(Array.from(clean.profiles[2].members),[]);
  const removed=hooks.deleteProfileState(clean,'profile-copy123');
  assert.equal(removed.profiles.length,2);
  assert.equal(hooks.isMemberAnywhere(removed,'chat:a'),true);
});

test('Stage 1.5 preserves per-category item ordering when placement unchanged',()=>{
  const first=hooks.firstProfileState(hooks.starterCategoryDefinitions,
    {'chat:a':'work'},{work:['chat:a','chat:b']},'Personal',['chat:a','chat:b']);
  const saved=hooks.profileMemberUpdate(first,'profile-original','chat:a','work',true);
  assert.deepEqual(Array.from(saved.profiles[0].categoryOrders.work),['chat:a','chat:b']);
  const moved=hooks.profileMemberUpdate(saved,'profile-original','chat:a','learning',true);
  assert.deepEqual(Array.from(moved.profiles[0].categoryOrders.work),['chat:b']);
  assert.equal(moved.profiles[0].assignments['chat:a'],'learning');
});

test('Stage 1.5 wiring filters profile lists and cleans orphans without rewriting V1',()=>{
  assert.match(script,/const PROFILES_V2_KEY/);
  assert.match(script,/GM_getValue\(PROFILES_V2_KEY,null\)/);
  assert.match(script,/firstProfileState\(DEFAULT_CATEGORIES,\{\}, \{\},'Starter',\[\]\)/);
  assert.match(script,/memberInProfile\(active,item\.key\)/);
  assert.match(script,/function isInActiveProfile\(key\)/);
  assert.match(script,/function setActiveProfileMembership\(key,category,included\)/);
  assert.match(script,/lost=previous\?/);
  assert.match(script,/\.filter\(key=>!isMemberAnywhere\(checked,key\)\)/);
  assert.match(script,/GM_setValue\(PROFILES_V2_KEY,checked\)/);
  assert.doesNotMatch(script,/\bprofileMode\b/);
  assert.match(script,/setActiveProfileMembership\(parsed\.key,category,true\)/);
  assert.match(script,/setActiveProfileMembership\(item\.key,'uncategorized',false\)/);
  assert.match(script,/const included=Boolean\(item\.saved && isInActiveProfile\(item\.key\)\)/);
  assert.match(script,/quickSaveButton\.dataset\.saved=String\(included\)/);
  assert.match(script,/Not included in this profile/);
  assert.match(script,/Remove from profile/);
  assert.doesNotMatch(script,/GM_setValue\(PROFILES_KEY,/);
});

test('profile deletion warns before last-reference shortcut cleanup',()=>{
  assert.match(script,/const exclusive=p\.members\.filter\(key=>/);
  assert.match(script,/exist only in this profile and will be removed from the SwiftClick library/);
  assert.match(script,/Links included in other profiles will remain/);
  assert.match(script,/No original ChatGPT projects or chats are deleted/);
  assert.match(script,/isInActiveProfile\(context\.project\.key\)/);
  assert.match(script,/Saved in SwiftClick but not included in this profile/);
});

test('Conversation Overrun Warning settings default to Off and reject unknown choices',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(hooks.sanitizeOrganizerSettings(null))),
    {version:1,continuityLevel:'off'});
  assert.equal(hooks.sanitizeOrganizerSettings({version:1,continuityLevel:'medium'}).continuityLevel,'medium');
  assert.equal(hooks.sanitizeOrganizerSettings({version:1,continuityLevel:'high'}).continuityLevel,'high');
  assert.equal(hooks.sanitizeOrganizerSettings({version:1,continuityLevel:'low'}).continuityLevel,'low');
  assert.equal(hooks.sanitizeOrganizerSettings({version:1,continuityLevel:'maximum'}).continuityLevel,'off');
  assert.equal(hooks.sanitizeOrganizerSettings({version:999,continuityLevel:'high'}).continuityLevel,'off');
  assert.equal(hooks.sanitizeOrganizerSettings({version:1}).continuityLevel,'off');
});

test('Conversation Overrun Warning applies only to named non-temporary conversation routes',()=>{
  assert.equal(hooks.continuityConversationKey('/c/abc-123'),'chat:abc-123');
  assert.equal(hooks.continuityConversationKey('/g/g-p-project123/c/CHAT-123/'),'chat:chat-123');
  assert.equal(hooks.continuityConversationKey('/c/ABC','?x=1&temporary-chat=true'),null);
  assert.equal(hooks.continuityConversationKey('/'),null);
  assert.equal(hooks.continuityConversationKey('/c/'),null);
  assert.equal(hooks.continuityConversationKey('/g/g-p-x/project'),null);
  assert.equal(hooks.continuityConversationKey('/share/abc-123'),null);
  assert.equal(hooks.continuityConversationKey('https://example.com/c/test'),null);
});

test('Conversation Overrun Warning ledger is bounded, validated, and content-free',()=>{
  const bad=[
    {id:'chat:abc',sends:30,nextAt:47,dismissed:true},
    {id:'chat:abc',sends:19,nextAt:0,dismissed:false},
    {id:'chat:<script>',sends:1},
    {id:'chat:def',sends:-2,nextAt:12000,dismissed:'true'},
    {id:'other',sends:5},
    ...Array.from({length:41},(_,i)=>({
      id:'chat:a'+String(i).padStart(3,'0'),sends:i,nextAt:i+10
    }))
  ];
  const result=hooks.sanitizeContinuityLedger({version:1,entries:bad});
  assert.ok(result.entries.length<=30);
  assert.ok(result.entries.every(x=>/^chat:[a-z0-9-]+$/.test(x.id)));
  assert.equal(hooks.sanitizeContinuityLedger({version:2,entries:bad}).entries.length,0);
  const one=hooks.sanitizeContinuityLedger({version:1,entries:bad.slice(0,4)});
  assert.equal(one.entries[0].sends,30);
  assert.equal(one.entries[0].dismissed,true);
  assert.equal(one.entries[1].sends,0);
  assert.equal(one.entries[1].nextAt,0);
  assert.equal(one.entries[1].dismissed,false);
});

test('Conversation Overrun Warning thresholds are reminders, not token-limit predictions',()=>{
  const at=n=>({sends:n,nextAt:0,dismissed:false});
  assert.equal(hooks.continuityShouldRemind('off',at(10000)),false);
  assert.equal(hooks.continuityShouldRemind('high',at(11)),false);
  assert.equal(hooks.continuityShouldRemind('high',at(12)),true);
  assert.equal(hooks.continuityShouldRemind('medium',at(24)),false);
  assert.equal(hooks.continuityShouldRemind('medium',at(25)),true);
  assert.equal(hooks.continuityShouldRemind('low',at(44)),false);
  assert.equal(hooks.continuityShouldRemind('low',at(45)),true);
  assert.equal(hooks.continuityShouldRemind('high',{...at(30),nextAt:35}),false);
  assert.equal(hooks.continuityShouldRemind('high',{...at(35),nextAt:35}),true);
  assert.equal(hooks.continuityShouldRemind('high',{...at(100),dismissed:true}),false);
});

test('Settings and handoff are a separate user-controlled screen, not another tab',()=>{
  assert.match(script,/const ORGANIZER_SETTINGS_KEY = APP_ID \+ '\.settings\.v1'/);
  assert.match(script,/GM_getValue\(ORGANIZER_SETTINGS_KEY,null\)/);
  assert.match(script,/GM_setValue\(ORGANIZER_SETTINGS_KEY,next\)/);
  assert.match(script,/settingsButton=button\(settingsOpen\?'← Back':'⚙ Settings'/);
  assert.match(script,/if\(settingsOpen\)\{/);
  assert.match(script,/main\.appendChild\(makeSettingsPanel\(\)\)/);
  assert.match(script,/Conversation Overrun Warning/);
  assert.doesNotMatch(script,/'Conversation Continuity|"Conversation Continuity/);
  assert.match(script,/BETA/);
  assert.match(script,/Copy handoff request/);
  assert.match(script,/copyPromptToClipboard\(area\.value,area\)/);
  assert.match(script,/Preview overrun warning in this chat/);
  assert.match(script,/role','status'/);
  assert.match(script,/settingsOpen=false;settingsFeatureExpanded=false;render\(\)/);
  assert.equal((script.match(/\{ id: 'settings', title:/g)||[]).length,0);
});

test('Settings starts collapsed and expands the whole beta feature as one section',()=>{
  const code=script.slice(script.indexOf('  function makeSettingsPanel() {'),
    script.indexOf('  function render() {'));
  assert.match(code,/el\('h2','','Organizer Settings'\)/);
  assert.match(code,/el\('h3','','Conversation Overrun Warning'\)/);
  assert.match(code,/settingsFeatureExpanded\?'▾ Close settings':'▸ Configure'/);
  assert.match(code,/expand\.setAttribute\('aria-expanded',String\(settingsFeatureExpanded\)\)/);
  assert.match(code,/expand\.setAttribute\('aria-controls','swiftclick-overrun-warning-settings'\)/);
  assert.match(code,/details\.hidden=!settingsFeatureExpanded/);
  assert.match(code,/if\(settingsFeatureExpanded\)\{/);
  assert.match(code,/details\.appendChild\(handoff\)/);
  assert.match(code,/section\.appendChild\(details\)/);
  assert.match(script,/let settingsFeatureExpanded = false/);
  assert.match(script,/settingsFeatureExpanded=false;/);
  assert.match(script,/settingsFeatureExpanded=true;/);
  assert.match(script,/settingsOpen=true;\s+settingsFeatureExpanded=true;\s+render\(\)/);
  assert.match(script,/settingsFeatureExpanded=false;render\(\)/);
  assert.match(script,/\.settings-feature-details\[hidden\]\{display:none!important;\}/);
});

test('Organizer scroll bar is persistent and has visible contrast on Firefox and Chromium',()=>{
  assert.match(script,/\.main\{[^']*overflow-y:scroll;/);
  assert.match(script,/scrollbar-gutter:stable;scrollbar-width:auto;scrollbar-color:#b3d9fa #22364c/);
  assert.match(script,/\.main::-webkit-scrollbar\{width:15px;height:15px;\}/);
  assert.match(script,/\.main::-webkit-scrollbar-track\{background:#22364c;/);
  assert.match(script,/\.main::-webkit-scrollbar-thumb\{background:#9ac7ec;/);
  assert.match(script,/\.main::-webkit-scrollbar-thumb:hover\{background:#d2e9ff;\}/);
  assert.match(script,/const previousScroll=priorMain\?priorMain\.scrollTop:0/);
  assert.match(script,/if\(nextMain\)nextMain\.scrollTop=previousScroll/);
});

test('Ko-fi footer support is optional, local-first, and links only on deliberate click',()=>{
  assert.match(script,/const SWIFTCLICK_SUPPORT_URL='https:\/\/ko-fi\.com\/teddshapiro'/);
  assert.match(script,/function appendOrganizerFooter\(footer\)/);
  assert.match(script,/button\('☕ Support SwiftClick','support-footer-action'/);
  assert.equal((script.match(/appendOrganizerFooter\((?:foot|footer)\);/g)||[]).length,8);
  assert.match(script,/function openSupportPopup\(trigger\)/);
  assert.match(script,/function closeSupportPopup\(\)/);
  assert.match(script,/dialog\.setAttribute\('role','dialog'\)/);
  assert.match(script,/dialog\.setAttribute\('aria-modal','true'\)/);
  assert.match(script,/dialog\.setAttribute\('aria-label','Support SwiftClick'\)/);
  assert.match(script,/visit\.href=SWIFTCLICK_SUPPORT_URL/);
  assert.match(script,/visit\.target='_blank'/);
  assert.match(script,/visit\.rel='noopener noreferrer'/);
  assert.match(script,/visit\.addEventListener\('click',\(\)=>window\.setTimeout\(closeSupportPopup,0\)\)/);
  assert.match(script,/button\('Not now','action support-close',closeSupportPopup\)/);
  assert.match(script,/if\(supportBackdrop\) \{\s+closeSupportPopup\(\)/);
  assert.match(script,/if\(event\.target===backdropNode\)closeSupportPopup\(\)/);
  assert.doesNotMatch(script,/GM_setValue\(.*(?:donation|support)/);
  assert.doesNotMatch(script,/(?:fetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest)/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
});

test('Handoff text requests a reviewable new-chat prompt and does not claim unseen work',()=>{
  const prompt=hooks.continuityHandoffRequest;
  assert.ok(prompt.includes('NEW ChatGPT conversation'));
  assert.ok(prompt.includes('READY-TO-PASTE OPENING PROMPT'));
  assert.ok(prompt.includes('Do not invent facts'));
  assert.ok(prompt.includes('missing earlier context'));
  assert.ok(prompt.includes('Do not open a new chat or submit'));
});

test('Reminder respects privacy: no transcript extraction, message text, network or auto-submit',()=>{
  assert.match(script,/if\(organizerSettings\.continuityLevel==='off'\)return/);
  assert.match(script,/if\(!event\.isTrusted\)return/);
  assert.match(script,/target\.closest\('#prompt-textarea,\[data-testid="prompt-textarea"\]'\)/);
  assert.match(script,/button\[data-testid="send-button"\]/);
  assert.match(script,/countContinuitySend\(\)/);
  assert.match(script,/continuityHost\.hidden=!eligible/);
  assert.match(script,/continuityRoot\.appendChild\(notice\)/);
  assert.match(script,/snoozeContinuity\(id\)/);
  assert.match(script,/dismissContinuity\(id\)/);
  assert.match(script,/window\.sessionStorage\.setItem\(CONTINUITY_TAB_KEY/);
  assert.match(script,/window\.sessionStorage\.removeItem\(CONTINUITY_TAB_KEY\)/);
  assert.doesNotMatch(script,/data-message-author-role|\.textContent\s*=\s*.*querySelector\(/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
  assert.doesNotMatch(script,/(?:fetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest)/);
  assert.doesNotMatch(script,/document\.querySelectorAll\('.*(?:message|conversation)/);
});

test('AI profile suggestion prompt uses available Memory but never invents history access',()=>{
  const prompt=hooks.buildAIProfileCategoryPrompt('Research & Projects');
  assert.ok(prompt.includes('Research & Projects'));
  assert.ok(prompt.includes('Memory'));
  assert.ok(prompt.includes('inaccessible information'));
  assert.ok(prompt.includes('generic categories'));
  assert.ok(prompt.includes('Do NOT reveal personal details'));
  assert.ok(prompt.includes('no projects, URLs, chat links or memberships'));
  assert.ok(prompt.includes('NEW EMPTY profile'));
  assert.ok(prompt.includes('Uncategorized'));
  assert.ok(prompt.includes('"schema":"swiftclick-organizer-categories"'));
  assert.ok(prompt.includes('"version":1'));
  assert.ok(prompt.includes('💼'));
  assert.ok(!prompt.includes('my entire chat history has been read'));
  assert.match(hooks.buildAIProfileCategoryPrompt('name "quoted"'),/name \\"quoted\\"/);
});

test('AI category importer accepts plain or fenced JSON and optional supported icons',()=>{
  const data={schema:hooks.aiProfilePackageSchema,version:1,categories:[
    {label:'Work & Projects',icon:'💼'},
    {label:'  Creative    Work ',icon:'🎨'},
    {label:'Research'}
  ]};
  const json=JSON.stringify(data);
  const parsed=hooks.parseAIProfileCategoryPackage(json);
  assert.equal(parsed.error,undefined);
  assert.deepEqual(Array.from(parsed.categories,x=>x.label),[
    'Work & Projects','Creative Work','Research'
  ]);
  assert.deepEqual(Array.from(parsed.categories,x=>x.icon),['💼','🎨','▦']);
  const fence=String.fromCharCode(96).repeat(3);
  const fenced=fence+'json\n'+JSON.stringify(data,null,2)+'\n'+fence;
  const fencedResult=hooks.parseAIProfileCategoryPackage('Suggestions:\n'+fenced);
  assert.deepEqual(Array.from(fencedResult.categories,x=>x.label),
    ['Work & Projects','Creative Work','Research']);
});

test('AI importer rejects untrusted or malformed response packages without side effects',()=>{
  const good={schema:hooks.aiProfilePackageSchema,version:1,categories:[{label:'Research',icon:'📖'}]};
  const failures=[
    '',
    'Not JSON',
    '{}',
    JSON.stringify({...good,version:2}),
    JSON.stringify({...good,schema:'different-schema'}),
    JSON.stringify({...good,personal_data:{name:'Private'}}),
    JSON.stringify({...good,categories:[]}),
    JSON.stringify({...good,categories:Array.from({length:21},(_,i)=>({label:'Topic '+i,icon:'📖'}))}),
    JSON.stringify({...good,categories:[{label:'Research',icon:'📖'},{label:'research',icon:'📖'}]}),
    JSON.stringify({...good,categories:[{label:'Uncategorized',icon:'▦'}]}),
    JSON.stringify({...good,categories:[{label:'Too long '.repeat(9),icon:'▦'}]}),
    JSON.stringify({...good,categories:[{label:'Bad\nLabel',icon:'📖'}]}),
    JSON.stringify({...good,categories:[{label:'Research',icon:'👽'}]}),
    JSON.stringify({...good,categories:[{label:'Research',icon:'📖',chatUrls:[]}]}),
    JSON.stringify({...good,categories:[{label:'Research',icon:'📖',__private:'secret'}]}),
    'x'.repeat(16001)
  ];
  for(const raw of failures){
    const parsed=hooks.parseAIProfileCategoryPackage(raw);
    assert.equal(typeof parsed.error,'string','Expected validation failure: '+raw.slice(0,90));
    assert.equal(parsed.categories,undefined);
  }
  const one=hooks.parseAIProfileCategoryPackage(JSON.stringify(good));
  assert.equal(one.categories.length,1);
});

test('AI suggested profile starts empty with custom categories plus Uncategorized',()=>{
  const parsed=hooks.parseAIProfileCategoryPackage(JSON.stringify({
    schema:hooks.aiProfilePackageSchema,version:1,
    categories:[{label:'Making things',icon:'💡'},{label:'Learning',icon:'📖'}]
  }));
  const snap=hooks.snapshotFromAIProfileCategories(parsed.categories,'test-123');
  assert.deepEqual(Array.from(snap.categories,c=>c.label),
    ['Making things','Learning','Uncategorized']);
  assert.ok(snap.categories[0].id.startsWith('custom-ai-test-123-'));
  assert.equal(snap.members.length,0);
  assert.deepEqual(Object.keys(snap.assignments),[]);
  assert.deepEqual(Object.keys(snap.categoryOrders),[]);
  const initial=hooks.firstProfileState(hooks.starterCategoryDefinitions,
    {'chat:existing':'work'},{work:['chat:existing']},'Original',['chat:existing']);
  const next=hooks.newProfileState(initial,'profile-ai-test123','AI Proposal',snap);
  const validated=hooks.sanitizeProfilesState(next);
  assert.ok(validated);
  assert.deepEqual(Array.from(validated.profiles[0].members),['chat:existing']);
  assert.equal(validated.profiles[0].name,'Original');
  assert.equal(validated.profiles[1].name,'AI Proposal');
  assert.deepEqual(Array.from(validated.profiles[1].members),[]);
  assert.equal(validated.defaultId,initial.defaultId);
  assert.equal(validated.activeId,initial.activeId);
  assert.equal(hooks.snapshotFromAIProfileCategories(parsed.categories,'bad@'),null);
});

test('AI profile UI is opt-in: third choice, manual copy, paste, preview and save only on confirmation',()=>{
  assert.match(script,/\['ai','Ask ChatGPT to suggest categories based on my usage'\]/);
  assert.match(script,/if\(mode\.value==='ai'\)\{/);
  assert.match(script,/openAIProfileImportDialog\(name,add\)/);
  assert.match(script,/function openAIProfileImportDialog\(name,trigger\)/);
  assert.match(script,/function closeAIProfileImportDialog\(restoreFocus=true\)/);
  assert.match(script,/dialog\.setAttribute\('aria-modal','true'\)/);
  assert.match(script,/Copy category suggestion prompt/);
  assert.match(script,/Open ChatGPT in a new tab/);
  assert.match(script,/openChat\.target='_blank'/);
  assert.match(script,/openChat\.rel='noopener noreferrer'/);
  assert.match(script,/copyPromptToClipboard\(prompt,copyHelper\)/);
  assert.match(script,/Paste ChatGPT category JSON package/);
  assert.match(script,/parseAIProfileCategoryPackage\(pasted\.value\)/);
  assert.match(script,/previewList\.replaceChildren\(\)/);
  assert.match(script,/Create profile with these categories/);
  assert.match(script,/create\.disabled=true/);
  assert.match(script,/create\.disabled=false/);
  assert.match(script,/const next=snapshot && newProfileState\(profilesState,id,name,snapshot\)/);
  assert.match(script,/if\(!next \|\| !persistProfiles\(next\)\)/);
  assert.match(script,/closeAIProfileImportDialog\(false\)/);
  assert.match(script,/closeAIProfileImportDialog\(\)/);
  assert.match(script,/if\(aiProfileImportDialog\) \{/);
  assert.doesNotMatch(script,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
  assert.doesNotMatch(script,/(?:fetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest)/);
});

test('AI importer is not a cross-chat scraper or hidden memory API',()=>{
  const importer=script.slice(script.indexOf('  function openAIProfileImportDialog(name,trigger)'),
    script.indexOf('  function makeProfilesManager()'));
  assert.match(importer,/textarea/);
  assert.match(importer,/No profile is created until you review and confirm/);
  assert.match(importer,/Return to this tab when ChatGPT responds/);
  assert.match(importer,/only what you deliberately paste/);
  assert.doesNotMatch(importer,/GM_getValue|GM_xmlhttpRequest|fetch\s*\(/);
  assert.doesNotMatch(importer,/document\.querySelector\([^)]*message/);
  assert.doesNotMatch(importer,/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML/);
});

test('script stays isolated from production distribution until review', () => {
  assert.match(script, /@version\s+0\.1\.0-alpha\.39/);
  assert.doesNotMatch(script, /@updateURL|@downloadURL/);
  assert.doesNotMatch(script, /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/);
  assert.doesNotMatch(script, /(?:fetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest)/);
  assert.match(script, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(script, /GM_setValue\(PROFILES_V2_KEY/);
});
