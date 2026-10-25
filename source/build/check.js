#!/usr/bin/env node
/**
 * 轻量校验：在 build.js 之外，检查 markdown 方言的结构性问题。
 * 用法：node build/check.js
 * 检查项：
 *   1. :::  自定义块的开启 / 闭合是否配平（按文件）
 *   2. 表格：表头下一行必须是分隔行；每行列数需与表头一致
 *   3. {{术语}} 是否都在术语库中
 *   4. 标题末尾 {#id} 是否重复
 *   5. 是否出现三连星号等会被行内解析器误读的写法
 *   6. 章节文件是否都在 meta.md 中被引用（_ 开头的除外）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const meta = fs.readFileSync(path.join(DATA, 'meta.md'), 'utf8');
const files = meta.split('\n').filter(l => /^@\S+$/.test(l.trim())).map(l => l.trim().slice(1));

const loadJSON = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const rawGloss = Object.assign({}, loadJSON('sample-glossary.json'),
  fs.existsSync(path.join(DATA, 'term-glossary.json')) ? loadJSON('term-glossary.json') : {});
const gloss = {};
Object.keys(rawGloss).forEach(k => {
  if (/^_/.test(k) || k === 'note') return;
  const v = rawGloss[k];
  if (!v || typeof v !== 'object' || Array.isArray(v)) { err('术语条目非法（数组或非对象）：' + k); return; }
  if (typeof v.def !== 'string' || !v.def.trim()) { err('术语条目缺少 def：' + k); return; }
  gloss[k] = v;
});

let errors = 0, warns = 0;
const err = m => { console.log('  ✗ ' + m); errors++; };
const warn = m => { console.log('  ! ' + m); warns++; };

// 1) 块配平
console.log('[1] ::: 块配平');
files.forEach(f => {
  if (f.startsWith('_')) return;
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) { err(`${f} 不存在`); return; }
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  let depth = 0, openLine = 0;
  lines.forEach((l, i) => {
    const m = /^:::\s*([a-z-]+)\s*(.*)$/.exec(l);
    if (m) {
      const inlineEnd = /^(.*?)\s*:::\s*$/.exec(m[2] || '');
      if (inlineEnd && inlineEnd[1].trim()) return; // 单行块
      if (depth === 0) openLine = i + 1;
      depth++;
      return;
    }
    if (/^:::\s*$/.test(l)) {
      depth--;
      if (depth < 0) err(`${f}:${i + 1} 多余的 ::: 闭合`);
    }
  });
  if (depth !== 0) err(`${f} 有 ${depth} 个未闭合的 ::: 块（最后一个开启于第 ${openLine} 行）`);
});
console.log('  ' + (errors ? '有错误' : '全部配平'));

// 2) 表格
console.log('[2] 表格');
files.forEach(f => {
  if (f.startsWith('_')) return;
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.indexOf('|') < 0 || !l.trim().startsWith('|')) continue;
    const next = lines[i + 1] || '';
    if (!/^\s*\|?\s*:?-{2,}/.test(next)) {
      // 可能是表格中间的行，只在上一行不是表格行时报错
      const prev = lines[i - 1] || '';
      if (prev.indexOf('|') < 0) err(`${f}:${i + 1} 表格缺少分隔行：${l.slice(0, 50)}`);
      continue;
    }
    const cols = l.split('|').length;
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith('|')) {
      const c = lines[j].split('|').length;
      if (c !== cols) err(`${f}:${j + 1} 表格列数 ${c} ≠ 表头 ${cols}：${lines[j].slice(0, 50)}`);
      j++;
    }
    i = j - 1;
  }
});
console.log('  ' + (errors ? '见上' : '无列数问题'));

// 3) 术语
console.log('[3] 术语');
const seenTerms = new Set();
files.forEach(f => {
  if (f.startsWith('_')) return;
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) return;
  const src = fs.readFileSync(p, 'utf8');
  [...src.matchAll(/{{([^}]+)}}/g)].forEach(m => {
    const k = m[1].split('|')[0].trim();
    seenTerms.add(k);
    if (!gloss[k]) err(`${f} 未收录术语：${k}`);
  });
});
Object.entries(gloss).forEach(([k, v]) => (v.see || []).forEach(s => {
  if (!gloss[s]) err(`术语「${k}」的 see 指向不存在的词条：${s}`);
}));
console.log(`  正文引用 ${seenTerms.size} 个词条，术语库 ${Object.keys(gloss).length} 条`);

// 4) 标题 id
console.log('[4] 标题 id');
const ids = new Map();
files.forEach(f => {
  if (f.startsWith('_')) return;
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
    const m = /^(#{1,6})\s+(.*?)\s*\{#([\w-]+)\}\s*$/.exec(l);
    if (!m) return;
    if (ids.has(m[3])) err(`重复 id #${m[3]}（${ids.get(m[3])} 与 ${f}:${i + 1}）`);
    else ids.set(m[3], `${f}:${i + 1}`);
  });
});
console.log(`  显式 id ${ids.size} 个`);

// 5) 危险写法
console.log('[5] 行内解析陷阱');
files.forEach(f => {
  if (f.startsWith('_')) return;
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
    if (/\*\*\*/.test(l)) warn(`${f}:${i + 1} 出现三连星号，可能被行内解析器误读：${l.slice(0, 40)}`);
    if (/<\/script/i.test(l)) err(`${f}:${i + 1} 含有 </script`);
  });
});
console.log('  ' + (warns ? warns + ' 处提示' : '无'));

// 6) meta 引用
console.log('[6] meta 引用');
const onDisk = fs.readdirSync(DATA).filter(f => /^\d\d-.*\.md$/.test(f));
onDisk.forEach(f => { if (!files.includes(f)) warn(`data/${f} 未被 meta.md 引用（不会进入正文）`); });
files.forEach(f => { if (!fs.existsSync(path.join(DATA, f))) err(`meta.md 引用了不存在的 ${f}`); });
console.log(`  引用 ${files.length} 个文件，目录中有 ${onDisk.length} 个章节文件`);

console.log('');
console.log(errors ? `✗ ${errors} 个错误，${warns} 个提示` : `✓ 通过（${warns} 个提示）`);
process.exit(errors ? 1 : 0);
