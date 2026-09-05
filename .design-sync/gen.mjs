// design-sync generator. Rebuilds everything derived from the component
// sources so nothing in .design-sync/ has to be maintained by hand:
//
//   node .design-sync/gen.mjs
//
// Reads dist/**/*.d.ts (produced by `tsc -p .design-sync/dts-tsconfig.json`)
// and writes:
//   .design-sync/entry.ts          bundle entry barrel
//   dist/index.d.ts                declaration barrel package.json "types" points at
//   .design-sync/config.json       componentSrcMap sub-part exclusions
//   .design-sync/docs/<name>.md    one doc per root component (group + parts + examples)
//
// Run it after adding or removing a component. See NOTES.md.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// Which section of the design pane each source module belongs in.
const GROUPS = {
  'ui/button': 'Actions', 'ui/button-group': 'Actions', 'ui/toggle': 'Actions',
  'ui/toggle-group': 'Actions', 'ui/kbd': 'Actions',

  'ui/input': 'Forms', 'ui/input-group': 'Forms', 'ui/input-otp': 'Forms',
  'ui/textarea': 'Forms', 'ui/label': 'Forms', 'ui/field': 'Forms',
  'ui/checkbox': 'Forms', 'ui/radio-group': 'Forms', 'ui/select': 'Forms',
  'ui/native-select': 'Forms', 'ui/combobox': 'Forms', 'ui/switch': 'Forms',
  'ui/slider': 'Forms', 'ui/questionnaire': 'Forms',

  'ui/table': 'Data', 'ui/card': 'Data', 'ui/item': 'Data', 'ui/badge': 'Data',
  'ui/avatar': 'Data', 'ui/chart': 'Data', 'ui/progress': 'Data',
  'ui/skeleton': 'Data', 'ui/aspect-ratio': 'Data', 'ui/carousel': 'Data',
  'ui/marker': 'Data', 'ui/attachment': 'Data', 'simple-icon': 'Data',

  'ui/breadcrumb': 'Navigation', 'ui/pagination': 'Navigation', 'ui/tabs': 'Navigation',
  'ui/navigation-menu': 'Navigation', 'ui/sidebar': 'Navigation', 'ui/menubar': 'Navigation',
  'ui/command': 'Navigation',

  'ui/dialog': 'Overlays', 'ui/alert-dialog': 'Overlays', 'ui/sheet': 'Overlays',
  'ui/drawer': 'Overlays', 'ui/popover': 'Overlays', 'ui/hover-card': 'Overlays',
  'ui/tooltip': 'Overlays', 'ui/dropdown-menu': 'Overlays', 'ui/context-menu': 'Overlays',

  'ui/alert': 'Feedback', 'ui/sonner': 'Feedback', 'ui/spinner': 'Feedback',
  'ui/empty': 'Feedback',

  'ui/accordion': 'Layout', 'ui/collapsible': 'Layout', 'ui/resizable': 'Layout',
  'ui/scroll-area': 'Layout', 'ui/separator': 'Layout', 'ui/direction': 'Layout',

  'ui/message': 'Messaging', 'ui/message-scroller': 'Messaging', 'ui/bubble': 'Messaging',

  'ui/calendar': 'Calendar', 'date-range-picker': 'Calendar',
  'calendar/event-calendar-views': 'Calendar',
};

// Modules whose root export isn't the PascalCase of the file name.
const ROOTS = {
  'ui/chart': 'ChartContainer',
  'ui/direction': 'DirectionProvider',
  'ui/resizable': 'ResizablePanelGroup',
  'ui/sonner': 'Toaster',
};

// Type-only exports the bundle can't render.
const NOT_COMPONENTS = new Set(['ChartConfig', 'CarouselApi']);

const walk = (dir, test, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
};

// tsc declaration output: names arrive either in a trailing `export { ... };`
// list or as `export declare const|function|class Name`.
function exportsOf(file) {
  const txt = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of txt.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (n && /^[A-Z][A-Za-z0-9]*$/.test(n)) names.add(n);
    }
  }
  for (const m of txt.matchAll(/export\s+declare\s+(?:const|function|class)\s+([A-Z][A-Za-z0-9]*)/g)) names.add(m[1]);
  return [...names].filter((n) => !n.endsWith('Props') && !NOT_COMPONENTS.has(n));
}

const pascal = (s) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

// -- read the declaration tree -------------------------------------------
const distComponents = join(ROOT, 'dist', 'components');
if (!existsSync(distComponents)) {
  console.error('dist/ is missing — run: node_modules/.bin/tsc -p .design-sync/dts-tsconfig.json');
  process.exit(1);
}
const modules = [];
for (const file of walk(distComponents, (p) => p.endsWith('.d.ts')).sort()) {
  const mod = relative(join(ROOT, 'dist', 'components'), file).replace(/\.d\.ts$/, '');
  const names = exportsOf(file);
  if (!names.length) continue;
  const want = pascal(mod.split("/").pop()).toLowerCase();
  const root = ROOTS[mod] ?? names.find((n) => n.toLowerCase() === want);
  if (!root) { console.error(`! no root export identified for ${mod} (${names.join(', ')})`); process.exit(1); }
  const group = GROUPS[mod];
  if (!group) { console.error(`! ${mod} has no GROUPS entry — add one`); process.exit(1); }
  modules.push({ mod, group, root, names: names.sort(), parts: names.filter((n) => n !== root).sort() });
}

// -- entry barrel + declaration barrel ------------------------------------
const srcModules = modules.map((m) => `src/components/${m.mod}`);
writeFileSync(join(ROOT, '.design-sync', 'entry.ts'),
  '// Generated by .design-sync/gen.mjs — the design bundle entry.\n'
  + srcModules.map((p) => `export * from "../${p}";`).join('\n') + '\n');
writeFileSync(join(ROOT, 'dist', 'index.d.ts'),
  modules.map((m) => `export * from "./components/${m.mod}";`).join('\n') + '\n');

// -- config: exclude sub-parts as separate cards ---------------------------
// They stay in the bundle (the entry barrel exports every module), keep working
// as `window.MoversCRM.<Part>`, and are documented in their root's `## Parts`.
const cfgPath = join(ROOT, '.design-sync', 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.componentSrcMap = Object.fromEntries(modules.flatMap((m) => m.parts).sort().map((n) => [n, null]));
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

// -- docs: one per root component -----------------------------------------
// Frontmatter `category` sets the pane group. Body = the hand-written intro and
// examples from .design-sync/docs-src/<name>.md when one exists, plus a
// generated `## Parts` table. `## Props` is appended by the converter, so no
// doc may contain that heading.
const docsDir = join(ROOT, '.design-sync', 'docs');
rmSync(docsDir, { recursive: true, force: true });
mkdirSync(docsDir, { recursive: true });
const srcDir = join(ROOT, '.design-sync', 'docs-src');

let authored = 0;
for (const m of modules) {
  const srcFile = join(srcDir, `${kebab(m.root)}.md`);
  const hand = existsSync(srcFile) ? readFileSync(srcFile, 'utf8').trim() : '';
  if (hand) authored++;
  const parts = m.parts.length
    ? `\n## Parts\n\nComposed with ${m.parts.map((n) => `\`${n}\``).join(', ')}. Every part is a named export on \`window.MoversCRM\`.\n`
    : '';
  // The doc body suppresses the converter's synthesized ## Examples, so carry
  // the authored preview verbatim - it is code that is known to compile and render.
  const previewFile = join(ROOT, '.design-sync', 'previews', `${m.root}.tsx`);
  const example = existsSync(previewFile)
    ? `\n## Examples\n\n\`\`\`tsx\n${readFileSync(previewFile, 'utf8').trim()}\n\`\`\`\n`
    : '';
  writeFileSync(join(docsDir, `${kebab(m.root)}.md`),
    `---\ncategory: ${m.group}\n---\n\n${hand ? hand + '\n' : ''}${parts}${example}`);
}

const parts = modules.flatMap((m) => m.parts).length;
console.log(`${modules.length} root components, ${parts} sub-parts excluded as cards, ${authored} hand-written docs`);
console.log(Object.entries(modules.reduce((a, m) => ((a[m.group] = (a[m.group] ?? 0) + 1), a), {}))
  .map(([g, n]) => `  ${g}: ${n}`).join('\n'));
