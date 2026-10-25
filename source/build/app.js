/* 裂教与正统 —— 阅读器脚本（classic，无模块） */
(function () {
  'use strict';

  var raw = document.getElementById('src').textContent;
  var GL = window.__GLOSSARY__ || {};
  var TL = window.__TIMELINE__ || [];

  /* ============ 1. Markdown 解析 ============ */
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // 去掉正文里的 HTML 注释（<!-- 注：... -->）与 &lt;/script&gt; 转义，避免被当成正文排版
  raw = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/<\\\/script>/gi, '');
  function attr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  var slugCount = {};
  function slugify(t, explicit) {
    var s = explicit || t.replace(/<[^>]+>/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!s) s = 'sec';
    if (slugCount[s] != null) { slugCount[s]++; s = s + '-' + slugCount[s]; }
    else slugCount[s] = 0;
    return s;
  }

  // 行内解析
  function inline(s) {
    var out = '';
    var i = 0;
    var n = s.length;
    while (i < n) {
      var c = s[i];
      // 转义
      if (c === '\\' && i + 1 < n && /[\\`*_{}\[\]()#+\-.!<>~|]/.test(s[i + 1])) { out += esc(s[i + 1]); i += 2; continue; }
      // 行内代码
      if (c === '`') {
        var j = s.indexOf('`', i + 1);
        if (j > -1) { out += '<code>' + esc(s.slice(i + 1, j)) + '</code>'; i = j + 1; continue; }
      }
      // 图片/链接
      if (c === '[') {
        var close = matchBracket(s, i);
        if (close > -1 && s[close + 1] === '(') {
          var par = matchParen(s, close + 1);
          if (par > -1) {
            var label = s.slice(i + 1, close), href = s.slice(close + 2, par).trim();
            var cls = '';
            if (/^\[[A-Za-z0-9.]+\]$/.test(label) || /^\[[^\]]{1,120}\]$/.test(label) && !href) { /* noop */ }
            var isCite = /^\s*cite:/.test(href);
            if (isCite) href = href.replace(/^\s*cite:/, '');
            var numbered = /^\s*#[fn]/.test(href);
            var wasRef = /^\s*ref:/.test(href);
            if (wasRef) href = href.replace(/^\s*ref:/, '');
            cls = isCite || wasRef ? ' class="cite" ' : '';
            var target = href ? ' href="' + attr(href) + '"' : '';
            var ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
            out += '<a' + cls + target + ext + '>' + inline(label) + '</a>';
            i = par + 1; continue;
          }
        }
      }
      // 行内引用标记 [cite:出处] → 小号灰字
      if (c === '[' && s.substr(i, 6) === '[cite:') {
        var ce = s.indexOf(']', i + 6);
        if (ce > -1) { out += '<span class="cite">' + inline(s.slice(i + 6, ce)) + '</span>'; i = ce + 1; continue; }
      }
      // 脚注引用 [^1]
      if (c === '[' && s[i + 1] === '^') {
        var fe = s.indexOf(']', i + 2);
        if (fe > -1) {
          var fk = s.slice(i + 2, fe).trim();
          if (/^\d+$/.test(fk)) { out += '<sup><a class="fn-ref" href="#fn-' + fk + '" id="fnref-' + fk + '">' + fk + '</a></sup>'; i = fe + 1; continue; }
          out += '<sup class="fn-ref">' + esc(fk) + '</sup>'; i = fe + 1; continue;
        }
      }
      // 粗体 / 斜体
      if (c === '*' && s[i + 1] === '*') {
        var e = s.indexOf('**', i + 2);
        if (e > -1) { out += '<strong>' + inline(s.slice(i + 2, e)) + '</strong>'; i = e + 2; continue; }
      }
      if (c === '*' ) {
        var e2 = s.indexOf('*', i + 1);
        if (e2 > -1) { out += '<em>' + inline(s.slice(i + 1, e2)) + '</em>'; i = e2 + 1; continue; }
      }
      // 删除线
      if (c === '~' && s[i + 1] === '~') {
        var e3 = s.indexOf('~~', i + 2);
        if (e3 > -1) { out += '<del>' + inline(s.slice(i + 2, e3)) + '</del>'; i = e3 + 2; continue; }
      }
      // 术语 {{词}} 或 {{词|显示}}
      if (c === '{' && s[i + 1] === '{') {
        var e4 = s.indexOf('}}', i + 2);
        if (e4 > -1) {
          var inner = s.slice(i + 2, e4), key = inner, disp = inner;
          if (inner.indexOf('|') > -1) { key = inner.split('|')[0]; disp = inner.split('|').slice(1).join('|'); }
          key = key.trim(); disp = disp.trim();
          out += '<span class="term" data-term="' + attr(key) + '" tabindex="0">' + esc(disp) + '</span>';
          i = e4 + 2; continue;
        }
      }
      if (c === '<') { out += '&lt;'; i++; continue; }
      if (c === '&') { out += '&amp;'; i++; continue; }
      if (c === '>') { out += '&gt;'; i++; continue; }
      out += c; i++;
    }
    return out;
  }
  function matchBracket(s, i) {
    var d = 0;
    for (var k = i; k < s.length; k++) {
      if (s[k] === '\\') { k++; continue; }
      if (s[k] === '[') d++;
      if (s[k] === ']') { d--; if (d === 0) return k; }
    }
    return -1;
  }
  function matchParen(s, i) {
    var d = 0;
    for (var k = i; k < s.length; k++) {
      if (s[k] === '\\') { k++; continue; }
      if (s[k] === '(') d++;
      if (s[k] === ')') { d--; if (d === 0) return k; }
    }
    return -1;
  }

  // 块级解析
  function block(src) {
    var lines = src.replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }

      // 段落（连续非空行）
      // 标题
      var hm = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (hm) {
        var lv = hm[1].length, txt = hm[2];
        var explicit = null;
        var idm = /\{#([\w\-]+)\}\s*$/.exec(txt);
        if (idm) { explicit = idm[1]; txt = txt.replace(/\s*\{#[\w\-]+\}\s*$/, ''); }
        var id = slugify(txt, explicit);
        out.push('<h' + lv + ' id="' + id + '">' + inline(txt) + '<a class="anchor" href="#' + id + '" aria-hidden="true">#</a></h' + lv + '>');
        i++; continue;
      }
      // HR
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      // fenced code
      var fm = /^\s*```(\w*)\s*$/.exec(line);
      if (fm) {
        var buf = []; i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      // 自定义块 :::type {attrs} —— 也支持 :::type 与结束 ::: 在同一行（:::type 内容 :::）
      var dm = /^:::\s*([a-z-]+)\s*(.*)$/.exec(line);
      if (dm) {
        var type = dm[1], attrs = {};
        var rest = dm[2] || '';
        rest.replace(/([a-z][\w-]*)\s*=\s*"([^"]*)"/g, function (_, k, v) { attrs[k] = v; return ''; });
        var inlineEnd = /^(.*?)\s*:::\s*$/.exec(rest);
        if (inlineEnd && inlineEnd[1].trim()) {
          out.push(renderBlockType(type, attrs, inlineEnd[1].trim()));
          i++; continue;
        }
        rest = rest.replace(/\s*:::\s*$/, '');
        var buf2 = []; i++;
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) { buf2.push(lines[i]); i++; }
        i++;
        out.push(renderBlockType(type, attrs, buf2.join('\n')));
        continue;
      }

      // blockquote / 派别卡片
      if (/^\s*>/.test(line)) {
        var bq = [];
        while (i < lines.length && (/^\s*>/.test(lines[i]) || (lines[i].trim() && bq.length && !/^\s*(#{1,6}\s|:::|```)/.test(lines[i]) && !/^\s*(-{3,})\s*$/.test(lines[i])))) {
          if (/^\s*>/.test(lines[i])) bq.push(lines[i].replace(/^\s*>\s?/, ''));
          else bq.push(lines[i]);
          i++;
          if (i < lines.length && !lines[i].trim()) break;
        }
        out.push(renderQuote(bq.join('\n')));
        continue;
      }

      // 表格
      if (line.indexOf('|') > -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var head = splitRow(line);
        var align = splitRow(lines[i + 1]).map(function (c) {
          if (/^:-+:$/.test(c.trim())) return 'center';
          if (/-+:$/.test(c.trim())) return 'right';
          return 'left';
        });
        i += 2;
        var rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
        var th = head.map(function (c, k) { return '<th style="text-align:' + (align[k] || 'left') + '">' + inline(c.trim()) + '</th>'; }).join('');
        var tb = rows.map(function (r) {
          return '<tr>' + head.map(function (_, k) { return '<td style="text-align:' + (align[k] || 'left') + '">' + inline((r[k] || '').trim()) + '</td>'; }).join('') + '</tr>';
        }).join('');
        out.push('<div class="tablewrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table></div>');
        continue;
      }

      // 列表
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        var res = parseList(lines, i);
        out.push(res.html); i = res.next; continue;
      }

      // 段落
      var par = [line]; i++;
      while (i < lines.length && lines[i].trim() &&
             !/^(#{1,6}\s|:::|```|\s*>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) &&
             !(lines[i].indexOf('|') > -1 && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) &&
             !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
             !(/\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))) {
        par.push(lines[i]); i++;
      }
      var ptext = par.join('\n');
      // 引文来源行：「—— 某某」
      var paras = ptext.split(/\n(?=[^ \t])/);
      var htmlP = '';
      var joined = par.map(function (l) { return l.trim(); });
      var textAll = joined.join('\n');
      // 处理硬换行（行尾两个空格）
      var withBr = inline(textAll).replace(/  \n/g, '<br>\n');
      if (/^——|^— |^>>/.test(textAll)) {
        htmlP = '<p class="cite-src">' + withBr + '</p>';
      } else {
        htmlP = '<p>' + withBr.replace(/\n/g, '') + '</p>';
      }
      out.push(htmlP);
    }
    return out.join('\n');
  }

  // 把换行拆成单独的原子，避免 sub 反复重扫整行时陷入回溯地狱
  function atomizeBreaks(s) {
    return s.split('\n').map(function (l) { return l + '\u0001'; }).join('\n');
  }

  function isTableSep(l) {
    if (l.indexOf('-') < 0) return false;
    var cells = splitRow(l);
    if (cells.length < 2) return false;
    for (var k = 0; k < cells.length; k++) if (!/^\s*:?-{2,}:?\s*$/.test(cells[k])) return false;
    return true;
  }

  function splitRow(l) {
    var s = l.trim().replace(/^\|/, '').replace(/\|$/, '');
    var cells = [], cur = '', inCode = false;
    for (var k = 0; k < s.length; k++) {
      if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++; continue; }
      if (s[k] === '`') inCode = !inCode;
      if (s[k] === '|' && !inCode) { cells.push(cur); cur = ''; continue; }
      cur += s[k];
    }
    cells.push(cur);
    return cells;
  }

  function parseList(lines, i) {
    var first = /^(\s*)([-*+]|\d+[.)])\s+/.exec(lines[i]);
    var baseIndent = first[1].length;
    var ordered = /\d/.test(first[2]);
    var items = [];
    var cur = null;
    function sameMarker(mk) { return ordered ? /\d/.test(mk) : !/\d/.test(mk); }
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) {
        // 允许列表项之间空行
        if (i + 1 < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i + 1]) && /^\s*/.exec(lines[i + 1])[0].length === baseIndent) { i++; continue; }
        break;
      }
      var m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l);
      if (m && m[1].length <= baseIndent + 1) {
        if (sameMarker(m[2])) {
          if (cur) items.push(cur);
          cur = [m[3]];
          i++; continue;
        }
        // 混合编号：在主列表里另起一个同层列表
        var res2 = parseList(lines, i);
        if (cur) { cur.push('\u0000' + res2.html); }
        i = res2.next; continue;
      }
      // 惰性续行：不以列表标记或块级标记开头的行，归入上一项
      if (cur && !/^\s*(#{1,6}\s|:::|```)/.test(l)) { cur.push(l.replace(/^\s{0,6}/, '')); i++; continue; }
      break;
    }
    if (cur) items.push(cur);
    var tag = ordered ? 'ol' : 'ul';
    // 列表项的内容用「行内块」解析器：段落、行内格式照常，但列表标记不再开启新列表
    function liBlock(txt2) {
      var lines3 = txt2.split('\n');
      var acc = [], res = [];
      for (var q = 0; q < lines3.length; q++) {
        if (!lines3[q].trim()) { if (acc.length) { res.push('<p>' + inline(acc.join('')).replace(/^\s+|\s+$/g, '') + '</p>'); acc = []; } continue; }
        acc.push(lines3[q].replace(/^\s+/, ''));
      }
      if (acc.length) res.push('<p>' + inline(acc.join('')).replace(/^\s+|\s+$/g, '') + '</p>');
      return res.join('');
    }
    var html = '<' + tag + '>' + items.map(function (it) {
      var txt = it.join('\n');
      var sub = null;
      var lines2 = txt.split('\n');
      for (var k = 0; k < lines2.length; k++) {
        if (/^\s*([-*+]|\d+[.)])\s+/.test(lines2[k])) { sub = block(lines2.slice(k).join('\n')); lines2 = lines2.slice(0, k); break; }
        // 列表项内部出现段落空行、blockquote、表格等，也交给块级解析器处理尾部
        if (k > 0 && !lines2[k].trim()) { sub = block(lines2.slice(k + 1).join('\n')); lines2 = lines2.slice(0, k); break; }
        if (k > 0 && /^\s*(>|:::|\|)/.test(lines2[k])) { sub = block(lines2.slice(k).join('\n')); lines2 = lines2.slice(0, k); break; }
      }
      var t = lines2.join('\n');
      var ex = t.split('\u0000'), li = liBlock([ex[0]].concat(ex.slice(1).map(function () { return ''; })).join('\n'));
      if (ex.length > 1) li = liBlock(ex[0]).slice(0, -4) + '<div class="li-mixed">' + ex.slice(1).join('') + '</div></p>';
      return '<li>' + li + (sub ? sub : '') + '</li>';
    }).join('') + '</' + tag + '>';
    return { html: html, next: i };
  }

  function renderQuote(body) {
    // 派别卡片？首行为 [[k:名称 | en:... | 年代 | 标签]]
    var firstLine = body.split('\n')[0].trim();
    var km = /^\[\[(.*)\]\]$/.exec(firstLine);
    if (km) {
      var parts = km[1].split('|').map(function (x) { return x.trim(); });
      var name = '', en = '', tags = [];
      parts.forEach(function (p, idx) {
        if (/^k:/.test(p)) name = p.slice(2).trim();
        else if (/^en:/.test(p)) en = p.slice(3).trim();
        else if (p) tags.push(p);
      });
      var rest = body.split('\n').slice(1).join('\n');
      return '<div class="ccard"><div class="ccard-hd"><span class="ccard-k">' + inline(name) + '</span>' +
        (en ? '<span class="ccard-en">' + esc(en) + '</span>' : '') +
        '<span class="ccard-tags">' + tags.map(function (t) {
          var cls = 'ccard-tag';
          if (/^已消亡|消亡/.test(t)) cls += ' t5';
          else if (/^现存|延续/.test(t)) cls += ' t4';
          else if (/^第|世纪/.test(t)) cls += ' t2';
          else if (/^异端/.test(t)) cls += ' t5';
          else if (/^正统|主流/.test(t)) cls += ' t4';
          return '<span class="' + cls + '">' + esc(t) + '</span>';
        }).join('') + '</span></div><div class="ccard-body">' + block(rest) + '</div></div>';
    }
    return '<blockquote>' + block(body) + '</blockquote>';
  }

  function renderBlockType(type, attrs, body) {
    if (type === 'why' || type === 'pit' || type === 'src' || type === 'note') {
      var title = attrs.t || { why: '为什么会有争议', pit: '常见误解 / 反驳', src: '史料与文献', note: '注' }[type];
      return '<div class="callout ' + type + '"><div class="co-title">' + esc(title) + '</div>' + block(body) + '</div>';
    }
    if (type === 'versus') {
      var parts = body.split(/^---\s*$/m);
      return '<div class="versus">' + parts.map(function (p, k) {
        var t = /^###\s*(.*)$/m.exec(p);
        var txt = p.replace(/^###\s*.*$/m, '');
        return '<div><h6>' + esc(t ? t[1] : (k ? 'B' : 'A')) + '</h6>' + block(txt) + '</div>';
      }).join('') + '</div>';
    }
    if (type === 'timeline') {
      var tlines = body.split('\n').filter(function (l) { return l.trim(); });
      return '<ul class="tl">' + tlines.map(function (l) {
        var m = /^-\s+\*\*(.+?)\*\*\s*(.*)$/.exec(l.trim());
        if (m) return '<li class="major"><span class="tl-year">' + inline(m[1]) + '</span> <span class="tl-txt">' + inline(m[2]) + '</span></li>';
        m = /^-\s+(\S+)\s+(.*)$/.exec(l.trim());
        if (m) return '<li><span class="tl-year">' + esc(m[1]) + '</span> <span class="tl-txt">' + inline(m[2]) + '</span></li>';
        return '<li class="tl-txt">' + inline(l.trim()) + '</li>';
      }).join('') + '</ul>';
    }
    if (type === 'level') {
      var lv = attrs.n || '2';
      return '<div class="l' + lv + '">' + block(body) + '</div>';
    }
    if (type === 'biblio') {
      return '<div class="biblio">' + block(body) + '</div>';
    }
    if (type === 'titre') {
      return '<div class="titre-page">' + block(body) + '</div>';
    }
    return '<div class="callout">' + block(body) + '</div>';
  }

  var contentEl = document.getElementById('content');
  contentEl.innerHTML = block(raw);

  /* ============ 2. 首段 dropcap ============ */
  var leads = contentEl.querySelectorAll('h1, h2, h3');
  // 手动标记的 .lead 已由 CSS 处理

  /* ============ 3. 目录 ============ */
  var tocEl = document.getElementById('toc');
  var heads = contentEl.querySelectorAll('h1, h2, h3');
  var tocHTML = '';
  var firstH1 = true;
  heads.forEach(function (h) {
    var lv = +h.tagName[1];
    var txt = h.textContent.replace(/#$/, '').trim();
    if (lv === 1) {
      if (firstH1 && /^h1/.test(h.tagName) && /裂教与正统/.test(txt) && !h.id) firstH1 = false;
      tocHTML += '<a class="toc-part" href="#' + h.id + '">' + esc(txt) + '</a>';
    } else {
      tocHTML += '<a class="lv' + lv + '" href="#' + h.id + '">' + esc(txt) + '</a>';
    }
  });
  tocEl.innerHTML = tocHTML;

  var tocLinks = Array.prototype.slice.call(tocEl.querySelectorAll('a'));

  /* ============ 4. 滚动进度 / 当前章节 ============ */
  var bar = document.querySelector('#progressbar');
  var tbBar = document.querySelector('.tb-progress span');
  var totop = document.getElementById('totop');
  var ticking = false;
  var current = null;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var p = docH > 0 ? Math.min(1, window.scrollY / docH) : 0;
      bar.style.width = (p * 100) + '%';
      if (tbBar) tbBar.style.width = (p * 100) + '%';
      totop.classList.toggle('on', window.scrollY > 900);
      updateCurrent();
      ticking = false;
    });
  }
  function updateCurrent() {
    var y = window.scrollY + 90;
    var found = null;
    for (var k = 0; k < heads.length; k++) {
      if (heads[k].offsetTop <= y) found = heads[k]; else break;
    }
    if (found && found !== current) {
      current = found;
      tocLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + found.id); });
      var act = tocEl.querySelector('a.active');
      if (act) {
        var r = act.getBoundingClientRect(), sr = tocEl.getBoundingClientRect();
        if (r.top < sr.top + 20 || r.bottom > sr.bottom - 20) { if (act.scrollIntoView) act.scrollIntoView({ block: 'center' }); }
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ============ 5. 术语：悬浮提示 + 抽屉 ============ */
  var pop = document.getElementById('popover');
  var drawer = document.getElementById('drawer');
  var backdrop = document.getElementById('drawer-backdrop');
  var dwTitle = document.getElementById('dw-title');
  var dwBody = document.getElementById('dw-body');

  function plain(s) {
    return String(s || '').replace(/\{\{(.*?)\}\}/g, function (_, x) { return x.split('|').pop(); })
      .replace(/\*\*/g, '').replace(/\*/g, '');
  }

  var popTimer = null;
  contentEl.addEventListener('mouseover', function (e) {
    var t = e.target.closest('.term');
    if (!t) return;
    var key = t.dataset.term;
    var g = GL[key];
    if (!g) return;
    clearTimeout(popTimer);
    popTimer = setTimeout(function () {
      var def = plain(g.def || '');
      pop.innerHTML = '<b>' + esc(key) + '</b>' + (g.en ? ' <span style="color:var(--ink3);font-style:italic">' + esc(g.en) + '</span>' : '') +
        '<div>' + esc(def.slice(0, 160)) + (def.length > 160 ? '…' : '') + '</div>' +
        '<div class="po-hint">点击查看完整词条与相关条目</div>';
      var r = t.getBoundingClientRect();
      pop.hidden = false;
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = Math.min(window.innerWidth - pw - 10, Math.max(10, r.left + window.scrollX - 20));
      var top = r.bottom + window.scrollY + 8;
      if (r.bottom + ph + 20 > window.innerHeight && r.top > ph + 20) top = r.top + window.scrollY - ph - 8;
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    }, 260);
  });
  contentEl.addEventListener('mouseout', function (e) {
    if (e.target.closest && e.target.closest('.term')) { clearTimeout(popTimer); pop.hidden = true; }
  });
  contentEl.addEventListener('focusin', function (e) {
    var t = e.target.closest && e.target.closest('.term');
    if (t) openTerm(t.dataset.term);
  });

  contentEl.addEventListener('click', function (e) {
    var t = e.target.closest('.term');
    if (t) { e.preventDefault(); pop.hidden = true; openTerm(t.dataset.term); return; }
    var a = e.target.closest('a[href^="#"]');
    if (a) {
      var id = a.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#' + id); closeSidebar(); }
    }
  });

  function renderTermHTML(g) {
    // 先用不可被 HTML 转义的占位符包住 {{术语}}，等 block() 跑完再换成真实标签，
    // 否则 block() 会把 <span ...> 转义成字面文本。
    var tok = [];
    var body = String(g.def || '').replace(/\{\{(.*?)\}\}/g, function (_, x) {
      var parts = x.split('|');
      var k = parts[0].trim();
      var d = (parts.length > 1 ? parts.slice(1).join('|') : k).trim();
      tok.push({ k: k, d: d });
      return '\u0001T' + (tok.length - 1) + '\u0001';
    });
    var html = block(body);
    return html.replace(/\u0001T(\d+)\u0001/g, function (_, i) {
      var t = tok[+i];
      if (!t) return '';
      return '<span class="term" data-term="' + attr(t.k) + '" tabindex="0">' + esc(t.d) + '</span>';
    });
  }

  function openTerm(key) {
    var g = GL[key];
    if (!g) { toast('术语库暂无「' + key + '」词条'); return; }
    var head = drawer.querySelector('.dw-head');
    head.innerHTML = '<h3 id="dw-title"><span>' + esc(key) + '</span>' +
      (g.en ? '<small>' + esc(g.en) + '</small>' : '') + '</h3>' +
      '<button id="dw-close" aria-label="关闭">×</button>';
    head.querySelector('#dw-close').onclick = closeDrawer;
    var extra = '';
    if (g.see && g.see.length) {
      extra += '<div class="dw-label">相关</div><div class="dw-rel">' + g.see.map(function (s) { return '<button data-jump="' + attr(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>';
    }
    if (g.ch && g.ch.length) {
      extra += '<div class="dw-label">详见</div><div class="dw-rel">' + g.ch.map(function (c) { return '<button data-go="' + attr(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
    }
    dwBody.innerHTML = renderTermHTML(g) + extra;
    drawer.hidden = false; backdrop.hidden = false;
    dwBody.scrollTop = 0;
    history.replaceState(null, '', '#term=' + encodeURIComponent(key));
  }
  function cleanHash() {
    // 用 pathname+search 代替 ' '，避免某些环境把空格当 URL 解析出错
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function closeDrawer() {
    drawer.hidden = true; backdrop.hidden = true;
    if (location.hash.indexOf('#term=') === 0) cleanHash();
  }
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDrawer(); pop.hidden = true; closeSidebar(); }
  });
  drawer.addEventListener('click', function (e) {
    var t = e.target.closest('.term');
    if (t) { openTerm(t.dataset.term); return; }
    var b = e.target.closest('button[data-jump]');
    if (b) { openTerm(b.dataset.jump); return; }
    var gg = e.target.closest('button[data-go]');
    if (gg) {
      closeDrawer();
      var key = gg.dataset.go;
      var direct = document.getElementById(key);
      if (direct) { direct.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var hh = Array.prototype.slice.call(contentEl.querySelectorAll('h1,h2,h3')).filter(function (x) { return x.textContent.indexOf(key) > -1; })[0];
      if (hh) { hh.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      // 最后兵：按章节号数字回退（ch-4 → 「第 4 章」）
      var num = /^ch-(\d+)$/.exec(key);
      if (num) {
        var re = new RegExp('第\\s*' + num[1] + '\\s*章');
        var byNum = Array.prototype.slice.call(contentEl.querySelectorAll('h2')).filter(function (x) { return re.test(x.textContent); })[0];
        if (byNum) { byNum.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  /* ============ 6. 全文检索 ============ */
  var searchEl = document.getElementById('search');
  var resultsEl = document.getElementById('search-results');
  var clearBtn = document.getElementById('search-clear');
  // 建立索引
  var index = [];
  (function () {
    var hstack = [];
    Array.prototype.forEach.call(contentEl.children, function (node) {
      if (/^H[1-3]$/.test(node.tagName)) {
        var lv = +node.tagName[1];
        hstack = hstack.slice(0, lv - 1);
        hstack[lv - 1] = node.textContent.replace(/#$/, '').trim();
        return;
      }
      var text = node.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
      index.push({ text: text, node: node, path: hstack.filter(Boolean).join(' › '), title: hstack[hstack.length - 1] || '' });
    });
  })();

  var lastQ = '';
  searchEl.addEventListener('input', function () {
    var q = searchEl.value.trim();
    if (!q) { resultsEl.hidden = true; resultsEl.innerHTML = ''; return; }
    if (q === lastQ) return;
    lastQ = q;
    var terms = q.split(/\s+/).filter(Boolean);
    var hits = [];
    index.forEach(function (it) {
      var low = it.text.toLowerCase();
      var score = 0, ok = true;
      terms.forEach(function (t) {
        var idx = low.indexOf(t.toLowerCase());
        if (idx < 0) ok = false;
        else score += (it.title.toLowerCase().indexOf(t.toLowerCase()) > -1) ? 6 : 1;
      });
      if (ok) hits.push({ it: it, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    hits = hits.slice(0, 40);
    if (!hits.length) { resultsEl.innerHTML = '<div class="sr-empty">无匹配结果</div>'; resultsEl.hidden = false; return; }
    resultsEl.innerHTML = hits.map(function (h, k) {
      var t = h.it.text, low = t.toLowerCase(), pos = -1;
      terms.forEach(function (term) { var p = low.indexOf(term.toLowerCase()); if (pos < 0 || (p >= 0 && p < pos)) pos = p; });
      var start = Math.max(0, pos - 36), snip = t.slice(start, start + 140);
      var marked = esc(snip);
      terms.forEach(function (term) {
        var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        marked = marked.replace(re, '<mark>$1</mark>');
      });
      return '<div class="sr-item" data-k="' + k + '"><div class="sr-path">' + esc(h.it.path) + '</div><div class="sr-snip">' + (start > 0 ? '…' : '') + marked + '…</div></div>';
    }).join('');
    resultsEl.hidden = false;
    resultsEl.querySelectorAll('.sr-item').forEach(function (el, k) {
      el.addEventListener('click', function () {
        var h = hits[k];
        var el2 = h.it.node;
        el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el2.style.transition = 'background .2s';
        el2.style.background = 'var(--mark)';
        setTimeout(function () { el2.style.background = ''; }, 1600);
        resultsEl.hidden = true;
        closeSidebar();
      });
    });
  });
  clearBtn.addEventListener('click', function () { searchEl.value = ''; resultsEl.hidden = true; searchEl.focus(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      if (window.innerWidth <= 1080) document.body.classList.add('sb-open');
      searchEl.focus(); searchEl.select();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (window.innerWidth <= 1080) document.body.classList.add('sb-open');
      searchEl.focus(); searchEl.select();
    }
  });

  /* ============ 7. 工具：主题 / 层级 / 字号 / 侧栏 ============ */
  var html = document.documentElement;
  function store(k, v) { try { localStorage.setItem('lj-' + k, v); } catch (e) {} }
  function load(k, d) { try { return localStorage.getItem('lj-' + k) || d; } catch (e) { return d; } }

  html.dataset.theme = load('theme', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  html.dataset.level = load('level', 'l3');

  var levelLabel = document.getElementById('level-label');
  var LEVELS = { l1: '总览', l2: '标准', l3: '深潜' };
  function refreshLevel() { levelLabel.textContent = LEVELS[html.dataset.level] || '深潜'; }
  refreshLevel();

  var fontSteps = [16, 17.5, 19, 21];
  var fontIdx = +load('font', '1');
  function applyFont() { html.style.setProperty('--fs', fontSteps[fontIdx] + 'px'); }
  applyFont();

  function handleAct(act) {
    if (act === 'theme') {
      html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
      store('theme', html.dataset.theme);
    } else if (act === 'level') {
      var order = ['l1', 'l2', 'l3'];
      var k = (order.indexOf(html.dataset.level) + 1) % 3;
      html.dataset.level = order[k];
      store('level', html.dataset.level);
      refreshLevel();
      toast('阅读层级：' + LEVELS[html.dataset.level] + '（' + { l1: '只读主线，隐藏细节与深潜', l2: '隐藏最细的枝节', l3: '全部展开' }[html.dataset.level] + '）');
    } else if (act === 'font') {
      fontIdx = (fontIdx + 1) % fontSteps.length;
      applyFont(); store('font', String(fontIdx));
    } else if (act === 'glossary') {
      showGlossaryIndex();
    } else if (act === 'timeline') {
      showTimeline();
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (b) handleAct(b.dataset.act);
  });
  document.getElementById('print-btn').addEventListener('click', function () { window.print(); });

  function showGlossaryIndex() {
    var keys = Object.keys(GL).sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
    var groups = {};
    keys.forEach(function (k) {
      var first = k[0];
      var g = /[A-Za-z]/.test(first) ? 'A-Z' : first;
      (groups[g] = groups[g] || []).push(k);
    });
    var bodyHTML = Object.keys(groups).map(function (g) {
      return '<div class="dw-label">' + esc(g) + '</div><div class="dw-rel">' + groups[g].map(function (k) {
        return '<button data-jump="' + attr(k) + '">' + esc(k) + '</button>';
      }).join('') + '</div>';
    }).join('');
    var head = drawer.querySelector('.dw-head');
    head.innerHTML = '<h3>' + '术语库' + '<small>共 ' + keys.length + ' 条 · 点击查看</small></h3><button id="dw-close" aria-label="关闭">×</button>';
    dwBody.innerHTML = '<p style="color:var(--ink3);font-size:13.5px">词条按首字分组。正文中以虚线下划线加「°」标记的词语均可点击查看。</p>' + bodyHTML;
    drawer.hidden = false; backdrop.hidden = false;
    head.querySelector('#dw-close').onclick = closeDrawer;
  }

  function showTimeline() {
    var head = drawer.querySelector('.dw-head');
    head.innerHTML = '<h3>' + '年表' + '<small>共 ' + TL.length + ' 条 · 点击定位相关章节</small></h3><button id="dw-close" aria-label="关闭">×</button>';
    var TYPE = { event: '事件', council: '会议', schism: '分裂', person: '人物', text: '文献' };
    var rows = TL.map(function (t) {
      var tag = TYPE[t.type] || '事件';
      return '<li class="dtl" data-type="' + attr(t.type || 'event') + '">' +
        '<span class="tl-year">' + esc(t.year) + '</span>' +
        '<span class="tl-tag">' + esc(tag) + '</span>' +
        '<span class="tl-txt">' + esc(t.text) + '</span></li>';
    }).join('');
    dwBody.innerHTML = '<p style="color:var(--ink3);font-size:13.5px">全书大事年表。公元前年份以「前」标记；同一时期存在多条平行线索时按时间排序，不代表因果。</p>' +
      '<ul class="dtl-list">' + rows + '</ul>';
    drawer.hidden = false; backdrop.hidden = false;
    head.querySelector('#dw-close').onclick = closeDrawer;
    dwBody.scrollTop = 0;
  }

  // 因为抽屉头部会被重建，重绑定关闭按钮
  document.addEventListener('click', function (e) {
    if (e.target.id === 'dw-close') closeDrawer();
  });

  /* 侧栏：移动端 */
  var menuBtn = document.getElementById('menu-btn');
  var scrim = document.getElementById('sidebar-scrim');
  function closeSidebar() { document.body.classList.remove('sb-open'); }
  menuBtn.addEventListener('click', function () { document.body.classList.toggle('sb-open'); });
  scrim.addEventListener('click', closeSidebar);
  tocEl.addEventListener('click', function (e) { if (e.target.closest('a')) closeSidebar(); });

  /* 回到顶部 */
  totop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* toast */
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ============ 8. 统计 & 初始定位 ============ */
  (function () {
    var txt = contentEl.textContent.replace(/\s/g, '');
    var chars = txt.length;
    var mins = Math.round(chars / 480);
    document.getElementById('reading-stats').innerHTML =
      '全文约 <b>' + (chars / 10000).toFixed(1) + '</b> 万字<br>深潜读法约 <b>' + mins + '</b> 分钟<br>' +
      '术语 <b>' + Object.keys(GL).length + '</b> 条 · 字号/主题可调';
  })();

  if (location.hash && location.hash.indexOf('#term=') === 0) {
    openTerm(decodeURIComponent(location.hash.slice(6)));
  } else if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) setTimeout(function () {
      target.scrollIntoView({ block: 'start' });
    }, 60);
  }
})();
