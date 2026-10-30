// Counts on-screen English that hasn't moved into src/i18n/locales yet, and fails when the count
// goes above UNTRANSLATED_MAX, so it can only go down while screens are translated. Lower
// UNTRANSLATED_MAX in .github/workflows/ci.yml as it drops.
//
// Counted in the .tsx files the app imports (from src/main.tsx): JSX text, string literals in JSX children ({'Save'},
// {busy ? 'Saving…' : 'Save'}), and the attributes people see or hear (placeholder, title, alt,
// aria-label, label). Not counted: other strings in code (errors passed to setError, toasts),
// which the screen-by-screen pass catches by reading the file.
//
//   node .github/scripts/untranslated-ratchet.mjs          # count, worst files first
//   node .github/scripts/untranslated-ratchet.mjs --list   # every string, file:line
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const VISIBLE_ATTRIBUTES = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'aria-description']);
// Text worth translating has a letter in it; brand names and symbols on their own don't
const WORDS = /[A-Za-z]{2,}/;
const KEEP_AS_IS = new Set(['Ooga', 'ILS', 'USD', 'EUR', 'GBP', 'JPY', 'Visa Cal', 'Max', 'Isracard']);

// Only what the app can show: files reachable from src/main.tsx. Unused legacy components don't count.
function reachable(entry) {
  const seen = new Set();
  const queue = [resolve(entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
    const specifiers = [];
    const collect = (node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
      // lazy(() => import('./Page'))
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text);
      ts.forEachChild(node, collect);
    };
    collect(source);
    for (const spec of specifiers.filter((s) => s.startsWith('.'))) {
      const base = resolve(dirname(file), spec);
      const hit = [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')].find((f) => /\.tsx?$/.test(f) && existsSync(f));
      if (hit) queue.push(hit);
    }
  }
  return [...seen].filter((f) => f.endsWith('.tsx'));
}

const isText = (s) => WORDS.test(s) && !KEEP_AS_IS.has(s.trim());

function untranslated(path) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const add = (node, text) => found.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: text.trim().replace(/\s+/g, ' ') });

  // Inside a JSX child expression, strings are shown unless they're keys or arguments of a call (t('…'), cn('…'))
  const visitChild = (node) => {
    if (ts.isCallExpression(node) || ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      if (!ts.isCallExpression(node)) visit(node);
      return;
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isText(node.text)) add(node, node.text);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken && node.operatorToken.kind !== ts.SyntaxKind.BarBarToken && node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken && node.operatorToken.kind !== ts.SyntaxKind.PlusToken) return;
    ts.forEachChild(node, visitChild);
  };

  const visit = (node) => {
    if (ts.isJsxText(node) && isText(node.text)) add(node, node.text);
    else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      visitChild(node.expression);
      return;
    } else if (ts.isJsxAttribute(node) && VISIBLE_ATTRIBUTES.has(node.name.getText(source)) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) && isText(init.text)) add(init, init.text);
      else if (ts.isJsxExpression(init) && init.expression) visitChild(init.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const results = reachable('src/main.tsx')
  .map((path) => ({ path: relative(process.cwd(), path), strings: untranslated(path) }))
  .filter((r) => r.strings.length > 0);
const total = results.reduce((sum, r) => sum + r.strings.length, 0);

if (process.argv.includes('--list')) {
  for (const r of results) for (const s of r.strings) console.log(`${r.path}:${s.line}  ${s.text}`);
} else {
  for (const r of [...results].sort((a, b) => b.strings.length - a.strings.length).slice(0, 15)) {
    console.log(`${String(r.strings.length).padStart(4)}  ${r.path}`);
  }
}

const max = Number(process.env.UNTRANSLATED_MAX);
console.log(`Untranslated strings: ${total}${Number.isInteger(max) ? ` (baseline allows ${max})` : ''}.`);
if (!Number.isInteger(max)) process.exit(0);
if (total > max) {
  console.log(`::error::Untranslated on-screen strings went up from ${max} to ${total}. Put new text in src/i18n/locales (docs/I18N.md) and show it with t().`);
  process.exit(1);
}
if (total < max) {
  console.log(`::notice::Untranslated strings dropped to ${total}. Lower UNTRANSLATED_MAX in .github/workflows/ci.yml to lock it in.`);
}
