// ==UserScript==
// @name         Dat-o-MATIC Hover -> BBCode (PS3 Themes)
// @namespace    tm-datomatic-bbcode
// @version      0.1.0
// @description  Hover Dat-o-MATIC links to generate BBCode; click to copy
// @match        *://*/*
// @connect      datomatic.no-intro.org
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // --- Styling (tooltip) ---
  GM_addStyle(`
    .tm-bbcode-tooltip{
      position: fixed;
      z-index: 999999;
      max-width: min(820px, 95vw);
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(18,18,18,0.96);
      color: #fff;
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      box-shadow: 0 12px 32px rgba(0,0,0,0.38);
      white-space: pre-wrap;
      word-break: break-word;
      pointer-events: none;
    }
    .tm-bbcode-tooltip .hint{
      opacity: .75;
      margin-top: 8px;
      font-size: 11px;
    }
  `);

  const DATOMATIC_HOST = 'datomatic.no-intro.org';
  const END_TEXT = 'The dump';

  /** @typedef {{crc32?: string|null, md5?: string|null, sha1?: string|null}} Hashes */

  /** Cache results per URL so we don't refetch on every hover */
  const cache = new Map(); // url -> { bbcode, ts }
  const inflight = new Map(); // url -> Promise<string>

  let tooltipEl = null;
  let currentLink = null;
  let currentBBCode = '';
  let lastMouse = { x: 0, y: 0 };

  // ---------- Helpers: UI ----------
  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tm-bbcode-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function showTooltip(x, y, text, hint = 'Click link to copy BBCode (Ctrl/Cmd click opens)') {
    const t = ensureTooltip();
    t.textContent = text;
    const hintDiv = document.createElement('div');
    hintDiv.className = 'hint';
    hintDiv.textContent = hint;
    t.appendChild(hintDiv);

    const pad = 16;
    const left = Math.min(x + 14, window.innerWidth - pad);
    const top = Math.min(y + 14, window.innerHeight - pad);
    t.style.left = `${left}px`;
    t.style.top = `${top}px`;
    t.style.display = 'block';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
  }

  // ---------- Helpers: network ----------
  function fetchHtml(url) {
    // mimic your headers a bit
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 30000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error(`HTTP ${res.status}`));
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout')),
      });
    });
  }

  // ---------- Helpers: parsing (JS port of your python) ----------
  function normalizeText(text) {
    // similar to your regex whitespace normalization
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  function soupSystemTextAndTitle(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // remove script/style/noscript
    doc.querySelectorAll('script,style,noscript').forEach((el) => el.remove());

    const system = findSystemName(doc) || 'Sony - PlayStation 3 (PSN) (Themes)';
    const title = findRomnameHeader(doc);

    const text = normalizeText(doc.body ? doc.body.innerText || '' : doc.documentElement.innerText || '');

    return { text, title, system };
  }

  function findSystemName(doc) {
    const h3 = doc.querySelector('h3');
    if (!h3) return null;
    const t = (h3.textContent || '').trim();
    return t || null;
  }

  function findRomnameHeader(doc) {
    const tr = doc.querySelector('tr.romname_section');
    if (!tr) return null;
    const td = tr.querySelector('td');
    if (!td) return null;
    let t = (td.textContent || '').replace(/\u00a0/g, '').trim();
    return t || null;
  }

  function findField(text, labels) {
    for (const label of labels) {
      const re = new RegExp(`\\b${escapeRegExp(label)}\\b\\s*[:\\-]?\\s*([A-Za-z0-9._\\-]+)`, 'i');
      const m = text.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  }

  function hasAnyHash(h) {
    return Boolean((h && (h.crc32 || h.md5 || h.sha1)));
  }

  function extractHashesNear(text, filename, endText) {
    const lower = text.toLowerCase();
    const fileLower = (filename || '').toLowerCase();
    const endLower = (endText || '').toLowerCase();

    let startIdx = fileLower ? lower.indexOf(fileLower) : -1;
    if (startIdx === -1) startIdx = 0;

    let endIdx = endLower ? lower.indexOf(endLower, startIdx) : -1;
    if (endIdx === -1) endIdx = text.length;

    const chunk = text.slice(startIdx, endIdx);

    /** @type {Hashes} */
    const out = { crc32: null, md5: null, sha1: null };

    let m = chunk.match(/\bCRC32\b\s*[:\-]?\s*([0-9a-fA-F]{8})\b/);
    if (m) out.crc32 = m[1].toLowerCase();

    m = chunk.match(/\bMD5\b\s*[:\-]?\s*([0-9a-fA-F]{32})\b/);
    if (m) out.md5 = m[1].toLowerCase();

    m = chunk.match(/\bSHA[- ]?1\b\s*[:\-]?\s*([0-9a-fA-F]{40})\b/);
    if (m) out.sha1 = m[1].toLowerCase();

    return out;
  }

  function findFirstFileWithExt(text, ext) {
    // pattern: ([^\n\r<>\"']+?\.ext)\b
    const re = new RegExp(`([^\\n\\r<>\\"']+?\\.${escapeRegExp(ext)})\\b`, 'i');
    const m = text.match(re);
    return m ? m[1].trim() : null;
  }

  function buildBBCode({ header, gameId, url, systemName, pkgFile, rapFile, pkg, rap }) {
    const linkText = systemName ? `Datomatic - ${systemName}` : 'Datomatic';

    const fmt = (h) =>
      `CRC32: [b]${h.crc32}[/b] | MD5: [b]${h.md5}[/b] | SHA-1: [b]${h.sha1}[/b]`;

    const lines = [
      '--------------------------------',
      `[align=center][b]${header}[/b]`,
      `Game ID: [b]${gameId}[/b]`,
      '',
      `Verified against No-Intro Checksums [url=${url}]${linkText}[/url]`,
      '',
      `PKG File: [b]${pkgFile}[/b]`,
      `RAP File: [b]${rapFile}[/b]`,
      '',
      `PKG - ${fmt(pkg)}`,
    ];

    // ONLY add RAP section if hashes actually exist
    if (hasAnyHash(rap)) {
      lines.push(`RAP - ${fmt(rap)}`);
    }

    lines.push('To use these files, install them on a modified PS3 or RPCS3[/align]');
    return lines.join('\n');
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ---------- Main generation ----------
  async function generateBBCodeForDatomaticUrl(url) {
    // cache hit
    const cached = cache.get(url);
    if (cached) return cached.bbcode;

    // inflight de-dupe
    const existing = inflight.get(url);
    if (existing) return existing;

    const p = (async () => {
      const html = await fetchHtml(url);
      const { text, title, system } = soupSystemTextAndTitle(html);

      const header = title || 'Dat-o-MATIC Record';
      const gameId =
        findField(text, ['Game ID', 'Title ID', 'TitleID', 'Serial', 'Product Code']) || 'N/A';

      const pkgFile = findFirstFileWithExt(text, 'pkg');
      let rapFile = findFirstFileWithExt(text, 'rap');
      if (!rapFile) rapFile = END_TEXT; // to limit scope (same trick as your python)

      const pkgHash = pkgFile ? extractHashesNear(text, pkgFile, rapFile) : { crc32: null, md5: null, sha1: null };
      const rapHash = rapFile ? extractHashesNear(text, rapFile, END_TEXT) : { crc32: null, md5: null, sha1: null };

      const bbcode = buildBBCode({
        header,
        gameId,
        url,
        systemName: system,
        pkgFile: pkgFile || 'N/A',
        rapFile: rapFile || 'N/A',
        pkg: pkgHash,
        rap: rapHash,
      });

      cache.set(url, { bbcode, ts: Date.now() });
      return bbcode;
    })();

    inflight.set(url, p);
    try {
      const out = await p;
      return out;
    } finally {
      inflight.delete(url);
    }
  }

  function isDatomaticLink(a) {
    try {
      const u = new URL(a.href, location.href);
      return u.host === DATOMATIC_HOST;
    } catch {
      return false;
    }
  }

  // ---------- Events ----------
  document.addEventListener('mousemove', (e) => {
    lastMouse = { x: e.clientX, y: e.clientY };
    if (tooltipEl && tooltipEl.style.display === 'block') {
      // follow cursor while visible
      tooltipEl.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 16)}px`;
      tooltipEl.style.top = `${Math.min(e.clientY + 14, window.innerHeight - 16)}px`;
    }
  });

  let hoverTimer = null;

  document.addEventListener('mouseover', async (e) => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    if (!isDatomaticLink(a)) return;

    currentLink = a;

    // Small debounce so we don't fetch when you just pass over links quickly
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      if (currentLink !== a) return;

      showTooltip(lastMouse.x, lastMouse.y, 'Loading Dat-o-MATIC…');

      try {
        const bb = await generateBBCodeForDatomaticUrl(a.href);
        if (currentLink !== a) return;
        currentBBCode = bb;
        showTooltip(lastMouse.x, lastMouse.y, bb);
      } catch (err) {
        if (currentLink !== a) return;
        showTooltip(lastMouse.x, lastMouse.y, `Failed to load/parse.\n${String(err)}`);
      }
    }, 180);
  });

  document.addEventListener('mouseout', (e) => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    if (a === currentLink) {
      currentLink = null;
      currentBBCode = '';
      if (hoverTimer) clearTimeout(hoverTimer);
      hideTooltip();
    }
  });

  // Click to copy instead of navigating (unless modifier keys are held)
  document.addEventListener(
    'click',
    async (e) => {
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      if (!isDatomaticLink(a)) return;

      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; // keep normal behavior

      e.preventDefault();
      e.stopPropagation();

      try {
        const bb = currentBBCode || (await generateBBCodeForDatomaticUrl(a.href));
        GM_setClipboard(bb, 'text');
        showTooltip(lastMouse.x, lastMouse.y, bb + '\n\n✅ Copied!');
        setTimeout(() => {
          if (!currentLink) hideTooltip();
        }, 650);
      } catch (err) {
        showTooltip(lastMouse.x, lastMouse.y, `Copy failed.\n${String(err)}`);
      }
    },
    true
  );
})();