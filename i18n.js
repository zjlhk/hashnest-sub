/* ============================================================
 * NestI18n — Universal language switcher for Nest series sites
 * Supports 6 languages: EN / 简体中文 / 繁體中文 / 日本語 / Español / Français
 *
 * Two modes:
 *   1. data-i18n attribute mode (static sites):
 *        <span data-i18n="loan.title">Loan Calculator</span>
 *   2. Full-page text-replacement mode (SPA sites):
 *        window.NEST_I18N_FULL = { en: {"original text": "translated text"}, ... }
 *        Every text node matching an EN key gets replaced; original kept in data-nest-i18n-orig.
 *
 * Dictionary injected separately per site:
 *   window.NEST_I18N = { en: {...}, zh: {...}, zh_tw: {...}, ja: {...}, es: {...}, fr: {...} }
 * ============================================================ */
(function () {
  'use strict';

  var LANGS = {
    en: { name: 'English', flag: '🇺🇸' },
    zh: { name: '简体中文', flag: '🇨🇳' },
    zh_tw: { name: '繁體中文', flag: '🇹🇼' },
    ja: { name: '日本語', flag: '🇯🇵' },
    es: { name: 'Español', flag: '🇪🇸' },
    fr: { name: 'Français', flag: '🇫🇷' },
  };
  var STORAGE_KEY = 'nest-lang';
  // Base/original language of the site's content (default English).
  // Chinese sites (e.g. tools) set window.NEST_I18N_BASE = 'zh'.
  var BASE_LANG = window.NEST_I18N_BASE || 'en';
  var currentLang = (function () {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGS[saved]) return saved;
    } catch (e) {}
    return BASE_LANG;
  })();

  function dict(lang) {
    return (window.NEST_I18N && window.NEST_I18N[lang]) || {};
  }

  function translateKey(key) {
    var d = dict(currentLang);
    if (d && d[key] !== undefined) return d[key];
    var base = dict(BASE_LANG);
    return (base && base[key]) || key;
  }

  /* ---------- Mode 1: data-i18n attribute translation ---------- */
  function applyDataI18n(root) {
    var els = (root || document).querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      var attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, translateKey(key));
      } else {
        var orig = el.getAttribute('data-nest-i18n-orig');
        if (orig === null) { el.setAttribute('data-nest-i18n-orig', el.textContent); }
        el.textContent = translateKey(key);
      }
    }
    // Title & meta
    var titleDict = dict(currentLang);
    if (titleDict && titleDict['__title']) document.title = titleDict['__title'];
    if (titleDict && titleDict['__description']) {
      var m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute('content', titleDict['__description']);
    }
  }

  /* ---------- Mode 2: full-page text replacement ---------- */
  var replacedNodes = [];

  function translateTextNode(node) {
    if (!window.NEST_I18N_FULL || !window.NEST_I18N_FULL[currentLang]) return;
    if (node.nodeType !== 3) return;
    var text = node.nodeValue;
    if (!text || !text.trim() || text.trim().length < 2) return;
    var parent = node.parentNode;
    // Skip if already translated in this language
    if (parent && parent.getAttribute && parent.getAttribute('data-nest-i18n-trans') === currentLang) return;
    var map = window.NEST_I18N_FULL[currentLang];
    if (!map) return;
    var trimmed = text.trim();
    var replacement = map[trimmed];
    if (replacement === undefined) replacement = map[text];
    if (replacement === undefined || replacement === trimmed) return;
    // Mark original on the parent element (only meaningful when leaving English)
    if (parent && parent.setAttribute) {
      parent.setAttribute('data-nest-i18n-orig', text);
      parent.setAttribute('data-nest-i18n-trans', currentLang);
      parent.setAttribute('data-nest-i18n-done', '1');
    }
    node.nodeValue = text.replace(trimmed, replacement);
  }

  function applyFullPage() {
    if (!window.NEST_I18N_FULL) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (var i = 0; i < nodes.length; i++) translateTextNode(nodes[i]);
    // Title & meta via full-page dict too
    var d = window.NEST_I18N_FULL[currentLang] || {};
    if (d['__title']) document.title = d['__title'];
    if (d['__description']) {
      var m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute('content', d['__description']);
    }
  }

  function restoreFullPage() {
    if (!window.NEST_I18N_FULL) return;
    var els = document.querySelectorAll('[data-nest-i18n-done]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-nest-i18n-trans') && el.hasAttribute('data-nest-i18n-orig')) {
        el.textContent = el.getAttribute('data-nest-i18n-orig');
      }
      el.removeAttribute('data-nest-i18n-trans');
      el.removeAttribute('data-nest-i18n-orig');
      el.removeAttribute('data-nest-i18n-done');
    }
  }

  /* ---------- Switcher UI ---------- */
  function buildSwitcher() {
    if (document.getElementById('nest-lang-switcher')) return;
    var div = document.createElement('div');
    div.id = 'nest-lang-switcher';
    div.setAttribute('data-nest-i18n', '');
    div.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    div.innerHTML =
      '<style>' +
      '#nest-lang-switcher select{padding:5px 9px;border:1px solid #d0d7de;border-radius:8px;font-size:13px;background:#fff;color:#24292f;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.12);max-width:150px;}' +
      '#nest-lang-switcher select:hover{border-color:#0969da;}' +
      '#nest-lang-switcher select:focus{outline:2px solid rgba(9,105,218,.4);}' +
      '</style>' +
      '<select id="nest-lang-select" aria-label="Language">' +
      Object.keys(LANGS).map(function (l) {
        return '<option value="' + l + '"' + (l === currentLang ? ' selected' : '') + '>' + LANGS[l].flag + ' ' + LANGS[l].name + '</option>';
      }).join('') +
      '</select>';
    document.body.appendChild(div);
    document.getElementById('nest-lang-select').addEventListener('change', function (e) {
      switchLang(e.target.value);
    });
  }

  function switchLang(lang) {
    if (!LANGS[lang]) return;
    var previous = currentLang;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    if (previous === BASE_LANG || lang === BASE_LANG) {
      // Going to/from the base language: full re-apply (restore first if leaving a translated lang)
      if (previous !== BASE_LANG) restoreFullPage();
      applyAll();
    } else {
      restoreFullPage();
      applyAll();
    }
    var sel = document.getElementById('nest-lang-select');
    if (sel) sel.value = lang;
    document.documentElement.setAttribute('lang', lang === 'zh_tw' ? 'zh-Hant' : lang);
    if (window.NEST_LANG_CALLBACK) window.NEST_LANG_CALLBACK(lang);
  }

  function applyAll() {
    if (currentLang === BASE_LANG) {
      restoreFullPage();
      applyDataI18n();
      return;
    }
    applyDataI18n();
    applyFullPage();
  }
  /* ---------- Init ---------- */
  function init() {
    buildSwitcher();
    applyAll();
    document.documentElement.setAttribute('lang', currentLang === 'zh_tw' ? 'zh-Hant' : currentLang);
    // Watch for SPA re-renders
    if (window.NEST_I18N_FULL && window.MutationObserver) {
      var mo = new MutationObserver(function () { applyFullPage(); });
      setTimeout(function () {
        mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      }, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NEST_I18N_API = {
    t: translateKey,
    switchLang: switchLang,
    currentLang: function () { return currentLang; },
  };
})();
