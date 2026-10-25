#!/usr/bin/env node
/**
 * 构建脚本：把 data/*.md 与 meta + 术语库 + 时间线 拼装成单文件 HTML。
 * 用法：node build/build.js
 * 特点：classic script（无模块），可直接 file:// 打开；正文嵌在 <script type="text/markdown"> 中，
 *       避免 HTML 解析器把正文里的 < > 当成标签（正文大量使用「>」「<」做引证与比较）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, '基督教思想分裂史.html');

const meta = fs.readFileSync(path.join(DATA, 'meta.md'), 'utf8');
function loadJSON(file) {
  const p = path.join(DATA, file);
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^---[\s\S]*?\n---\n/, ''));
}
const rawGloss = Object.assign({}, loadJSON('sample-glossary.json'), fs.existsSync(path.join(DATA, 'term-glossary.json')) ? loadJSON('term-glossary.json') : {});
// 过滤掉元数据键（note / _note）与非法条目（非对象、缺 def、数组），保证抽屉一定能渲染
const gloss = {};
Object.keys(rawGloss).forEach(k => {
  if (/^_/.test(k) || k === 'note') return;
  const v = rawGloss[k];
  if (!v || typeof v !== 'object' || Array.isArray(v)) { console.warn('跳过非法术语条目: ' + k); return; }
  if (typeof v.def !== 'string' || !v.def.trim()) { console.warn('跳过无 def 的术语条目: ' + k); return; }
  gloss[k] = v;
});

// 时间线：sample-timeline.json 为基础，timeline.json 追加（按 year+text 去重后按 sort 排序）
const tlBase = loadJSON('sample-timeline.json');
const tlMore = fs.existsSync(path.join(DATA, 'timeline.json')) ? loadJSON('timeline.json') : [];
const tlSeen = new Set();
const timeline = tlBase.concat(tlMore).filter(t => {
  const k = (t.year || '') + '|' + (t.text || '').slice(0, 40);
  if (tlSeen.has(k)) return false;
  tlSeen.add(k);
  return true;
}).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

// meta.md 用 @FILE 引用章节，按顺序拼接
let body = meta.replace(/^@(\S+)$/gm, (_, f) => {
  if (f.startsWith('_')) return ''; // _ 开头为样例/元数据文件，不进入正文
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) {
    console.error('缺失章节文件: ' + f);
    return '\n<!-- 缺失: ' + f + ' -->\n';
  }
  return fs.readFileSync(p, 'utf8');
});

// 安全检查：不得出现无空格的长串（不可断行的超长「词」会让排版引擎渲染崩溃）
const WIDE = /[\u1100-\u11FF\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F\u{1F000}-\u{1FAFF}\u2600-\u27BF\u4E00-\u9FFF]/u;
const longWords = [];
body.split('\n').forEach((line, idx) => {
  (line.match(/[A-Za-z][A-Za-z'’\-]*/g) || []).forEach(w => {
    const wide = [...w].some(c => WIDE.test(c));
    const limit = wide ? 88 : 62;
    if (w.length > limit) longWords.push(`第 ${idx + 1} 行（${w.length} 字符）：${w.slice(0, 60)}…`);
  });
});
if (longWords.length) {
  console.error('⚠️ 发现过长的不可断串（可能引发渲染问题），请在词中插入空格或零宽空格：');
  longWords.forEach(l => console.error('   ' + l));
}

// ---- 统计占位符：让封面/使用说明里的数字永远与正文一致 ----
// 粗略估算「渲染后」正文长度（去掉 markdown 标记与卡片标记），用于封面自称
function proseLength(src) {
  return src
    .replace(/^:::.*$/gm, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, '')
    .replace(/\|/g, '')
    .replace(/\{\{([^}|]*)\|([^}]*)\}\}/g, '$2')
    .replace(/\{\{([^}]*)\}\}/g, '$1')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/\[\[k:(.*?)\]\]/g, (m, x) => x.split('|').filter(p => !p.startsWith('en:')).join(''))
    .replace(/\[cite:([^\]]*)\]/g, '$1')
    .replace(/[#`~]/g, '')
    .replace(/\s/g, '').length;
}

const stats = {
  CHARS: body.replace(/\s/g, '').length.toLocaleString('en-US'),
  PROSE: proseLength(body).toLocaleString('en-US'),
  TERMS: Object.keys(gloss).length,
  TIMELINE: timeline.length,
  CARDS: (body.match(/^>\s*\[\[k:/gm) || []).length,
  TABLES: (body.match(/^\s*\|([^\n]*\|)?\s*:?-{2,}[^\n]*\|\s*$/gm) || []).length,
  WHY: (body.match(/^:::why/gm) || []).length,
  PIT: (body.match(/^:::pit/gm) || []).length,
  SRC: (body.match(/^:::src/gm) || []).length,
  CHAPTERS: (body.match(/^##\s*第\s*\d+\s*章/gm) || []).length,
  PARTS: (body.match(/^#\s*第[一二三四五六七八九十]+部/gm) || []).length,
};
body = body.replace(/@@([A-Z]+)@@/g, (m, k) => (k in stats ? String(stats[k]) : m));
const unresolved = body.match(/@@[A-Z]+@@/g);
if (unresolved) console.warn('⚠️ 未替换的统计占位符: ' + [...new Set(unresolved)].join(', '));

// 安全检查：正文中不得出现 </script
if (/<\/script/i.test(body)) throw new Error('正文含有 </script，需转义');

const tpl = fs.readFileSync(path.join(ROOT, 'build', 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'build', 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'build', 'app.js'), 'utf8');

const esc = s => s.replace(/<\/script/gi, '<\\/script');

const html = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__GLOSSARY__*/', () => esc(JSON.stringify(gloss)))
  .replace('/*__TIMELINE__*/', () => esc(JSON.stringify(timeline)))
  .replace('<!--__BODY__-->', () => esc(body))
  .replace('/*__JS__*/', () => js);

fs.writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
const chars = Number(String(stats.CHARS).replace(/,/g, ''));
console.log(`已生成 ${OUT}`);
console.log(`  文件体积 ${kb} KB，正文 ${chars.toLocaleString()} 字（不含空白），术语 ${Object.keys(gloss).length} 条，时间线 ${timeline.length} 条`);