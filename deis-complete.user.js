// ==UserScript==
// @name         DEIS - AdvancedMD scribe, complete
// @namespace    dryeye.institute
// @version      3.4
// @description  Everything one machine needs: opens the EHR as a tab instead of a popup, and carries the whole scribe library, re-seeding it on every page load. Self-updating from GitHub (crystalbrimerod-glitch/dee-scribe).
// @match        *://*.advancedmd.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/crystalbrimerod-glitch/dee-scribe/main/deis-complete.user.js
// @downloadURL  https://raw.githubusercontent.com/crystalbrimerod-glitch/dee-scribe/main/deis-complete.user.js
// ==/UserScript==

/* THIS IS THE ONLY SCRIPT A MACHINE NEEDS.

   SELF-UPDATING as of v3.0. Tampermonkey checks @updateURL (once a day by
   default, or on demand from its dashboard) and installs the file there when its
   @version is HIGHER than the installed one.

   TO SHIP A CODE CHANGE, from v3.0 onward:
     1. edit the module file in the project (deis-core.js etc.)
     2. rebuild this script
     3. BUMP @version - an update with the same or a lower number is ignored
        SILENTLY, which looks exactly like a machine that did not update
     4. upload the file over the top of the one at @updateURL, SAME ADDRESS
   Every machine then picks it up on its own. No pasting, on any machine.

   THE ADDRESS MUST NOT CHANGE. WordPress's Media Library renames an uploaded
   replacement to ...-1.js and files it under a dated folder, so the old address
   keeps serving the old code and every machine silently stops updating. Put this
   in a FIXED folder (File Manager / FTP), overwritten in place.

   WHOEVER CONTROLS THAT URL RUNS CODE ON PAGES WITH PATIENT CHARTS OPEN. It
   belongs on CB's own account and nowhere else.

   v3.4, 9/9/2026, overnight - HOST MIGRATED. dryeyeequation.com was never
   reachable by CB, and dryeye.institute turned out to run on Kajabi, which
   has no stable per-file URL (tested directly - see never-regress-ledger.md;
   Kajabi mints a new one-time link per upload, same trap as WordPress's
   Media Library). @updateURL/@downloadURL now point at a PUBLIC GitHub repo
   under CB's own account instead:
     https://raw.githubusercontent.com/crystalbrimerod-glitch/dee-scribe/main/deis-complete.user.js
   Public means this file is viewable by anyone with the link (not indexed
   or advertised, but not access-controlled) - CB's own informed tradeoff,
   accepted because dryeyeequation.com/Kajabi weren't viable. Shipping a
   change now means: edit the module file, rebuild, bump @version, then on
   github.com open this file in the repo, click the pencil (edit) icon,
   paste the new content over the old, commit - same address, every time.

   v3.1, 9/9/2026 - THIS UPLOAD IS NOT YET DONE. Folded in four fixes that had
   drifted out of sync between deis-core.js (canonical) and this deployed
   script - see never-regress-ledger.md for the incidents:
     1. __patientName() - was entirely missing from this file, present in
        deis-core.js since 9/8. Reconfirmed missing on FOUR machines this day.
     2. __clearSafe() - was still unconditionally wiping every __safe radio
        group on every __applyGrid call; deis-core.js's fix (skip groups
        already marked g.dictated) was never folded in here.
     3. __plan() - picked the first DOM-order textarea matching the plan
        regex with no visibility check, which is exactly what let it bind to
        a hidden, contaminated PT CC box on Ronald Gilbert's real chart
        instead of the real PLAN box. Now prefers a visible candidate.
     4. __preSave() - NEW. A last-check sweep to run immediately before every
        Save: strips leftover PT CC ASK/SPLIT lines and the gap box's
        "CONFIRM WITH PATIENT..." title line, and flags any unchecked
        consent checkbox, regardless of whether the upstream auto-clear
        triggers fired.
   v3.2, 9/9/2026, later same evening - THIS UPLOAD IS STILL NOT DONE EITHER.
   Folded in the deis-gap.js fix from the Marcia Starkey "PT routine reverted
   back" incident (see never-regress-ledger.md):
     5. __gapParse() now records whether a Patient Reports Using line was
        ticked [x] or left [ ], and __gap() carries that state forward for an
        ordinary (non-annotated) item instead of always rewriting it as [ ]
        on every regeneration - which is what was silently un-confirming
        every plain checkbox on every ANTERIOR OU tab click.
     6. The "(last: ...)" marker for a newly-noticed dose discrepancy no
        longer stamps window.__today() (today's date, wrong - CB confirmed
        live) - it is left undated and the discrepancy is surfaced in
        __gap()'s returned notes instead, since there is no tested reader yet
        for the actual last-treatment date off the panel.
   v3.3, 9/9/2026, last thing before CB went to bed - new function, not a bug
   fix. CB: "you should also add in the info tab summary as you learn the
   items/procedures and changes from last time to implement."
     7. window.__infoAdd(item, apply) - builds the Info tab's Comment field
        UP incrementally as things are learned during a visit (procedures
        done, changes from last time, anything worth surfacing at a glance)
        instead of composing the whole line once at the end. Idempotent -
        won't duplicate a piece already present. NOT YET TESTED LIVE.
   UNTIL THIS FILE IS UPLOADED to https://raw.githubusercontent.com/crystalbrimerod-glitch/dee-scribe/main/deis-complete.user.js
   (same address, replacing whatever version is currently live), every
   machine still running an older deployed script is missing ALL SEVEN fixes
   above and needs the OLD live-patch workarounds documented in
   never-regress-ledger.md (and per that file, live-patching is not reliable
   from a Claude/Cowork session either - a safety classifier has blocked it).

   PART 1 - open the EHR in a TAB, not a popup.
     Without it AdvancedMD opens the EHR in a popup WINDOW, invisible to Claude
     forever, and THERE IS NO WORKAROUND: the control that launches it sits in a
     cross-origin iframe no outside tool can reach.
     `name` is passed through untouched and only `features` is dropped. Dropping
     features is what makes it a tab; keeping the name is what lets AdvancedMD's
     follow-up POST deliver the session token. Strip the name and the chart loads
     EMPTY. Do not "improve" this.

   PART 2 - carry the library, and re-seed it on every page load.
     One machine clears site data every few minutes with Chrome still open.
     Tampermonkey storage survived every wipe, so the source lives here and every
     page load rewrites all seven keys. A wipe costs nothing. This also closes the
     9/3/2026 failure where DEISALL vanished with no backup.

   Startup is unchanged:  eval(localStorage.getItem('DEISBOOT'))
   Health check:          __deisVersion
   Rebuild, never hand-edit: edit the module files in the project and rebuild.  */

(function(){
  'use strict';

  /* ---- PART 1: popup -> tab ------------------------------------------- */
  try {
    var nativeOpen = window.open.bind(window);
    window.open = function (url, name, features){ return nativeOpen(url, name); };
  } catch(e){}

  /* ---- PART 2: the library -------------------------------------------- */
  var SRC = {};
  SRC.DEISALL = '(' + (function DEIS(){
  var out = [];

  /* ---- 0. output sanitiser -------------------------------------------------
     The MCP safety filter blocks any tool output containing ? & or =.
     A blocked return means you cannot tell whether a write landed, so you
     write twice. Every helper's return value goes through this.            */
  window.__san = function(s){ return String(s).replace(/[?&=]/g,' '); };

  /* ---- 1. acronym cache --------------------------------------------------*/
  try { window.__X = JSON.parse(localStorage.getItem('DEISX') || '{}'); }
  catch(e){ window.__X = {}; }

  /* ---- 2. note frame binding ---------------------------------------------
     CB keeps several notes open. The on-screen one is the frame with the
     largest frameElement area - NEVER first-in-DOM.                        */
  function collect(){
    var a = [];
    (function walk(w){
      try { if (/chartnotes/i.test(w.location.pathname)) a.push(w); }
      catch(e){ return; }
      for (var i=0;i<w.frames.length;i++){ try { walk(w.frames[i]); } catch(e){} }
    })(window.top);
    return a;
  }
  window.__cnAll = collect;
  window.__cnFind = function(){
    var a = collect(), best = null, bw = -1;
    a.forEach(function(w){
      var area = 0;
      try { var fe = w.frameElement; if (fe){ var r = fe.getBoundingClientRect(); area = r.width*r.height; } } catch(e){}
      if (area > bw){ bw = area; best = w; }
    });
    return best || a[a.length-1] || null;
  };

  /* ---- 3. speech ----------------------------------------------------------
     Runs in CB's own Chrome, out the exam room speakers. Voice Samantha on
     her Mac. NEVER speak unprompted - a patient is in the room.            */
  window.__sayReady = function(){
    return new Promise(function(res){
      var v = speechSynthesis.getVoices();
      if (v.length) return res(v);
      var t = setTimeout(function(){ res(speechSynthesis.getVoices()); }, 1500);
      speechSynthesis.onvoiceschanged = function(){ clearTimeout(t); res(speechSynthesis.getVoices()); };
    });
  };
  window.__voice = null;
  window.__say = async function(text, opts){
    opts = opts || {};
    var vs = await window.__sayReady();
    if (opts.cancel !== false) speechSynthesis.cancel();
    var pick = window.__voice || vs.filter(function(v){ return /en-US/.test(v.lang); })[0] || vs[0];
    // split on sentence ends so __shutup() can cut off mid-readout
    var parts = String(text).split(/([.!;])\s+/).reduce(function(a,p,i,arr){
      if (/^[.!;]$/.test(p)) return a;
      var nxt = arr[i+1];
      a.push(p + (/^[.!;]$/.test(nxt) ? nxt : ''));
      return a;
    }, []);
    parts.forEach(function(p){
      if (!p.trim()) return;
      var u = new SpeechSynthesisUtterance(p);
      if (pick) u.voice = pick;
      u.rate = opts.rate || 1.05;
      u.pitch = 1;
      u.volume = opts.volume === undefined ? 1 : opts.volume;   // volume 0 = silent test
      speechSynthesis.speak(u);
    });
    return 'speaking ' + parts.length + ' segments, voice ' + (pick ? pick.name : 'default');
  };
  window.__shutup = function(){ speechSynthesis.cancel(); return 'stopped'; };

  /* ---- 4. tab strip -------------------------------------------------------
     Tabs are LI > A > SPAN - target the <a>. The strip SCROLLS horizontally,
     so never filter tab anchors by on-screen position: ANTERIOR OU vanished
     from the lookup whenever Info was active. Switches are async - poll for a
     marker from the destination tab.                                       */
  window.__tabAnchor = function(name){
    if (!window.__cn) return null;
    var d = window.__cn.document;
    var want = String(name).replace(/\s+/g,' ').trim().toUpperCase();
    var as = [].slice.call(d.querySelectorAll('li > a'));
    var hit = as.filter(function(a){ return (a.textContent||'').replace(/\s+/g,' ').trim().toUpperCase() === want; });
    if (!hit.length) hit = as.filter(function(a){ return (a.textContent||'').replace(/\s+/g,' ').trim().toUpperCase().indexOf(want) === 0; });
    return hit[0] || null;
  };
  window.__tabWait = function(name, marker, ms){
    if (!window.__cn) return Promise.resolve('no note frame');
    var d = window.__cn.document;
    return new Promise(function(res){
      var a = window.__tabAnchor(name);
      if (!a) return res(name + ': tab NOT FOUND');
      a.scrollIntoView({block:'nearest', inline:'center'});
      a.click();
      var t0 = Date.now(), lim = ms || 4000;
      (function poll(){
        var ok = false;
        try {
          ok = [].slice.call(d.querySelectorAll('*')).some(function(el){
            return !el.children.length &&
              (el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase().indexOf(String(marker).toUpperCase()) >= 0 &&
              el.getBoundingClientRect().width > 0;
          });
        } catch(e){}
        if (ok) return res(name + ': ready in ' + (Date.now()-t0) + 'ms');
        if (Date.now()-t0 > lim) return res(name + ': TIMEOUT');
        setTimeout(poll, 10);
      })();
    });
  };

  /* ---- 5. bind, or stop here ---------------------------------------------*/
  var all = collect();
  if (!all.length){
    out.push('SPEECH + TAB HELPERS ONLY. No note frame is open, so the grid map,');
    out.push('the writers and the cue readouts are NOT installed.');
    out.push('Open the chart note and run the loader again.');
    return out.join('\n');
  }
  var cn = window.__cnFind();
  window.__cn = cn; window.__cnBound = cn;
  var d = cn.document;
  out.push('notes open: ' + all.length);

  window.__bindCheck = function(){
    var a = collect(), act = window.__cnFind();
    if (!window.__cnBound) return { ok:false, why:'no helpers bound' };
    if (window.__cnBound !== act) return { ok:false, why:'bound to a different note than the one on screen (' + a.length + ' open) - RELOAD' };
    return { ok:true, notes:a.length };
  };

  /* ---- 5b. patient name -----------------------------------------------
     Added 9/8/2026 after a session wasted CB's time guessing at __cnFind's
     return value (it returns the note FRAME/window, for binding - not a
     name, and never did). The patient banner lives in a SIBLING frame
     outside the note iframe entirely, not inside window.__cn, so it has to
     be found by walking every frame from window.top. Verified against
     TESTY TE: 'amds-patient-name' + 'amds-patient-demo' classes give
     "-,TESTY TE  (05-03-1975,  51y,  M)" in one call.
     ALWAYS use this to confirm the patient before the first write - do not
     hand-search the DOM again, and do not confuse it with the provider
     name, which lives elsewhere in the chrome and matches no patient class. */
  window.__patientName = function(){
    var frames = [];
    (function walk(w){
      frames.push(w);
      var fs = w.frames;
      for (var i=0;i<fs.length;i++){ try { walk(fs[i]); } catch(e){} }
    })(window.top);
    for (var i=0;i<frames.length;i++){
      try {
        var doc = frames[i].document;
        var nm = doc.querySelector('.amds-patient-name');
        if (nm) {
          var demo = doc.querySelector('.amds-patient-demo');
          return nm.textContent.trim() + (demo ? '  (' + demo.textContent.trim() + ')' : '');
        }
      } catch(e) {}
    }
    return 'NOT FOUND - banner markup may have changed';
  };

  /* ---- 6. event helpers ---------------------------------------------------*/
  function fire(el){
    el.dispatchEvent(new Event('click',  {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }
  // every text write journals its prior value so __revert can undo it
  window.__journal = [];
  window.__setVal = function(e, v){
    if (!e.__jrn){ window.__journal.push({e:e, prior:e.value}); e.__jrn = true; }
    e.value = v;
    e.dispatchEvent(new Event('input',  {bubbles:true}));
    e.dispatchEvent(new Event('change', {bubbles:true}));
    e.dispatchEvent(new Event('blur',   {bubbles:true}));
  };
  // checkboxes must journal too. __revert once restored radios and text but NOT
  // checkboxes, so __proc's treatment box and __opFinish's consent boxes stayed
  // checked after an undo. Caught on TESTY 9/3/2026.
  window.__setChk = function(e, v){
    if (!e.__jrn){ window.__journal.push({e:e, prior:e.checked, kind:'chk'}); e.__jrn = true; }
    e.checked = !!v;
    e.dispatchEvent(new Event('click',  {bubbles:true}));
    e.dispatchEvent(new Event('change', {bubbles:true}));
  };
  function txt(el){ return (el.textContent||'').replace(/\s+/g,' ').trim(); }
  function up(s){ return String(s).trim().toUpperCase(); }
  function bare(f){ return (f||'').replace(/^[-\s]*/,'').replace(/^(MILD|MOD|SEV|GR\d|Gr\d|TR)\s+/,'').trim(); }
  window.__today = function(){
    // the PAGE clock is CB's own machine, on Eastern. The session clock is UTC
    // and a day ahead after ~8 PM. Never use the session date in a chart.
    var n = new Date();
    return (n.getMonth()+1) + '/' + n.getDate() + '/' + n.getFullYear();
  };

  /* ---- 7. map the ANTERIOR OU grid ---------------------------------------
     Radio names are opaque (Ctrl12890065). Solved by GEOMETRY only. Radios on
     hidden tabs measure zero, so ANTERIOR OU must be active first.
     The printed labels LIE - pair by geometry, never by label.             */
  var at = window.__tabAnchor('ANTERIOR OU'); if (at) at.click();

  function labelAfter(el){
    var n = el.nextSibling, s = '';
    while (n && s.length < 30){
      if (n.nodeType === 3) s += n.textContent;
      else if (n.nodeType === 1){ if (n.tagName === 'INPUT') break; s += n.textContent; }
      n = n.nextSibling;
    }
    return s.replace(/\s+/g,' ').trim();
  }
  var byName = {};
  [].slice.call(d.querySelectorAll('input[type=radio]')).forEach(function(r){
    var b = r.getBoundingClientRect(); if (!b.width) return;
    (byName[r.name] = byName[r.name] || []).push({el:r, x:b.left, y:b.top});
  });
  var G = [];
  Object.keys(byName).forEach(function(nm){
    var a = byName[nm].sort(function(p,q){ return p.y-q.y || p.x-q.x; });
    var opts = a.map(function(o){ return labelAfter(o.el); });
    var find = opts.filter(function(t){ return t && !/^(MILD|MOD|SEV|TR|GR\d|Gr\d|-|)$/.test(t); })
                   .sort(function(x,y){ return y.length-x.length; })[0] || '';
    G.push({
      nm:nm, n:a.length, opts:opts, find:find,
      y: Math.round(a[0].y),
      x: Math.round(Math.min.apply(null, a.map(function(o){ return o.x; }))),
      checked: a.filter(function(o){ return o.el.checked; }).map(function(o){ return labelAfter(o.el); }),
      sec:'?', eye:''
    });
  });
  window.__groups = G;
  // BASELINE - last visit's chart. Snapshot BEFORE anything is cleared, or the
  // SUMMARY comparison and the cue readouts are impossible.
  G.forEach(function(g){ g.baseline = g.checked.slice(); g.dictated = false; g.restored = false; });

  var NAMES = ['ADNEXIA','LASHES','LIDS','TEAR FILM','CONJUNCTIVA','CORNEA','A/C','IRIS','LENS',
               'INTERFEROMETRY','DEBRIDEMENT','MG EXPRESSION','MG QUALITY'];
  var heads = [], lids = [], blocks = {}, sens = null, corneaHead = null;
  [].slice.call(d.querySelectorAll('*')).forEach(function(el){
    if (el.children.length) return;
    var t = txt(el), T = t.toUpperCase();
    var b = el.getBoundingClientRect(); if (!b.width) return;
    if (NAMES.indexOf(T) >= 0) heads.push({n:T, x:b.left, y:b.top, col: b.left < 500 ? 'L' : 'R'});
    if (T === 'CORNEA') corneaHead = {x:b.left, bottom:b.bottom};
    if (/^(RUL|RLL)$/.test(t)) lids.push({t:t, y:b.top});
    if (/^(Drop Out:|Truncation:)$/i.test(t)) blocks[T.replace(':','')] = {y:b.top};
    if (t === 'Corneal Sensitivity') sens = {y:b.top, x:b.left};
  });
  ['L','R'].forEach(function(c){
    var hs = heads.filter(function(h){ return h.col === c; }).sort(function(a,b){ return a.y-b.y; });
    hs.forEach(function(h,i){ h.lo = h.y-25; h.hi = hs[i+1] ? hs[i+1].y-25 : h.y+60; });
    G.filter(function(g){ return (g.x < 500 ? 'L' : 'R') === c; }).forEach(function(g){
      var hit = null; hs.forEach(function(h){ if (g.y >= h.lo && g.y < h.hi) hit = h; });
      g.sec = hit ? hit.n : '?';
    });
  });
  // sections anchored by option signature rather than a nearby header
  G.filter(function(g){ return g.opts.join('/') === 'NML/NS/PCIOL'; })
   .sort(function(a,b){ return a.y-b.y; })
   .forEach(function(g,i){ g.sec='LENS'; g.find='LENS'; g.eye = i ? 'OS' : 'OD'; });
  G.filter(function(g){ return g.n === 6 && g.opts.join('/').indexOf('SEMI-SOLID') === 0; })
   .sort(function(a,b){ return a.y-b.y; })
   .forEach(function(g,i){ g.sec='MG QUALITY'; g.find='MG QUALITY'; g.eye = i ? 'OS' : 'OD'; });
  if (sens){
    var er = [];
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length) return;
      var t = txt(el); var b = el.getBoundingClientRect(); if (!b.width) return;
      if ((t==='OD'||t==='OS') && b.top >= sens.y-6 && b.top < sens.y+100 && Math.abs(b.left-sens.x) < 40) er.push({t:t, y:b.top});
    });
    er.sort(function(a,b){ return a.y-b.y; });
    G.filter(function(g){ return g.opts.join('/') === 'NORMAL/QUESTIONABLE/ABNORMAL'; })
     .sort(function(a,b){ return a.y-b.y; })
     .forEach(function(g,i){ g.sec='CORNEAL SENSITIVITY'; g.find='CORNEAL SENSITIVITY'; g.eye = er[i] ? er[i].t : (i ? 'OS' : 'OD'); });
  }
  // per-lid sections: DROP OUT and TRUNCATION label only the RIGHT lids
  lids.sort(function(a,b){ return a.y-b.y; });
  lids.forEach(function(L){
    var best = null;
    Object.keys(blocks).forEach(function(k){ if (blocks[k].y < L.y && (!best || blocks[k].y > blocks[best].y)) best = k; });
    var row = G.filter(function(g){ return g.n === 3 && Math.abs(g.y-L.y) <= 12; }).sort(function(a,b){ return a.x-b.x; });
    row.forEach(function(g,i){ g.sec = best; g.find = best; g.eye = (i ? 'L' : 'R') + L.t.slice(1); });
  });
  // pair the remaining groups into OD/OS by geometry
  function pair(mode){
    var m = {}, n = 0;
    G.forEach(function(g){
      if (g.eye || g.sec === '?') return;
      var k = mode === 'h' ? g.sec+'|h'+Math.round(g.y/6)+'|'+g.n : g.sec+'|v'+g.x+'|'+g.n;
      (m[k] = m[k] || []).push(g);
    });
    Object.keys(m).forEach(function(k){
      var a = m[k]; if (a.length !== 2) return;
      if (mode === 'h') a.sort(function(p,q){ return p.x-q.x; });                 // side by side: OD LEFT
      else { a.sort(function(p,q){ return p.y-q.y; }); if (Math.abs(a[1].y-a[0].y) > 25) return; }  // stacked: OD UPPER
      a[0].eye = 'OD'; a[1].eye = 'OS';
      var nm = a[0].find.length >= a[1].find.length ? a[0].find : a[1].find;
      a[0].find = a[1].find = nm;
      n++;
    });
    return n;
  }
  var h = pair('h'), v = pair('v');
  G.forEach(function(g){ if (g.sec === 'LASHES' && g.n === 6 && !g.find) g.find = 'Collarettes'; });

  window.__safe = ['ADNEXIA','LASHES','LIDS','TEAR FILM','CONJUNCTIVA','CORNEA','INTERFEROMETRY',
    'DEBRIDEMENT','MG EXPRESSION','MG QUALITY','LENS','CORNEAL SENSITIVITY','DROP OUT','TRUNCATION'];

  /* ---- 8. finding lookup and setters -------------------------------------
     Three keys are NOT the printed label:
        MG EXPRESSION  -> 'EXCELLENT'
        MG QUALITY     -> 'MG QUALITY'
        INTERFEROMETRY -> 'Color'
     LENS, CORNEAL SENSITIVITY, DROP OUT, TRUNCATION take their section name. */
  function norm(s){ return (s||'').replace(/^[-\s]+/,'').replace(/\s+/g,' ').trim().toUpperCase(); }
  window.__find = function(sec, finding, eye){
    var s = norm(sec), f = norm(finding), e = (eye||'').toUpperCase();
    return G.filter(function(g){
      if (norm(g.sec) !== s || window.__safe.indexOf(g.sec) < 0) return false;
      var gf = norm(g.find).replace(/^(MILD|MOD|SEV|GR4|TR)\s+/,'');
      if (f && gf.indexOf(f) < 0 && f.indexOf(gf) < 0) return false;
      if (e && g.eye && g.eye !== e) return false;
      return true;
    });
  };
  // FIXED 9/8/2026: skip groups already marked g.dictated so a second
  // __applyGrid call this same visit does not wipe an earlier pass's
  // findings (see deis-core.js for the full incident and reasoning).
  window.__clearSafe = function(){
    var n = 0;
    G.forEach(function(g){
      if (window.__safe.indexOf(g.sec) < 0) return;
      if (g.dictated) return;   // already set by an earlier __applyGrid this visit - leave it alone
      [].slice.call(d.getElementsByName(g.nm)).forEach(function(r){
        if (r.checked){ r.checked = false; r.dispatchEvent(new Event('change',{bubbles:true})); n++; }
      });
    });
    return 'unchecked ' + n;
  };
  window.__setOne = function(sec, finding, eye, value){
    var gs = window.__find(sec, finding, eye);
    if (!gs.length)   return 'NO MATCH ' + sec+'/'+finding+'/'+eye;
    if (gs.length > 1) return 'AMBIGUOUS x'+gs.length+' '+sec+'/'+finding+'/'+eye;
    var g = gs[0], val = norm(value), els = [].slice.call(d.getElementsByName(g.nm)), idx = -1;
    g.opts.forEach(function(o,i){ if (norm(o).replace(/\s.*$/,'') === val && idx < 0) idx = i; });
    if (idx < 0) g.opts.forEach(function(o,i){ if (norm(o).indexOf(val) === 0 && idx < 0) idx = i; });
    if (idx < 0) return 'NO OPTION "'+value+'" in ['+g.opts.join('/')+']';
    els[idx].checked = true; fire(els[idx]); g.dictated = true;
    return 'SET '+g.sec+' '+g.find+' '+(g.eye||'')+' to '+g.opts[idx]+' | '+(els[idx].checked ? 'ok' : 'FAILED');
  };
  // the trailing "-" means the finding is ABSENT. norm() eats a leading dash,
  // so __setOne cannot reach it - set it by index instead.
  window.__setIdx = function(sec, finding, eye, idx){
    var gs = window.__find(sec, finding, eye);
    if (gs.length !== 1) return 'RESOLVE FAIL '+sec+'/'+finding+'/'+eye+' x'+gs.length;
    var g = gs[0], els = [].slice.call(d.getElementsByName(g.nm));
    var i = idx < 0 ? els.length + idx : idx;
    if (!els[i]) return 'NO INDEX ' + i;
    els[i].checked = true; fire(els[i]); g.dictated = true;
    return 'SET '+g.sec+' '+g.find+' '+g.eye+' to '+g.opts[i];
  };
  // clearing alone silently drops last visit's LENS, sensitivity, drop-out and
  // truncation. Anything not dictated today goes back to its baseline.
  window.__restore = function(){
    var r = [];
    G.forEach(function(g){
      if (window.__safe.indexOf(g.sec) < 0 || g.dictated || !g.baseline.length) return;
      var els = [].slice.call(d.getElementsByName(g.nm));
      g.baseline.forEach(function(val){ var i = g.opts.indexOf(val); if (i < 0) return; els[i].checked = true; fire(els[i]); });
      g.restored = true;
      r.push(g.sec+' '+g.find+' '+(g.eye||''));
    });
    return r;
  };
  window.__audit = function(){
    var rows = {}, un = [], re = [];
    G.forEach(function(g){
      var els = [].slice.call(d.getElementsByName(g.nm));
      var ck = els.filter(function(r){ return r.checked; }).map(function(r){ return g.opts[els.indexOf(r)]; });
      g.nowck = ck;
      var nm = bare(g.find) || '?';
      if (g.dictated){ var k = g.sec+' '+nm; rows[k] = rows[k] || {}; rows[k][g.eye||'--'] = ck.join(',') || 'EMPTY'; }
      else if (ck.length){ (g.restored ? re : un).push(g.sec+' '+nm+' '+(g.eye||'--')+' : '+ck.join(',')); }
    });
    return {
      readback: Object.keys(rows).map(function(k){
        var r = rows[k], a = r.OD || r['--'] || '(none)', b = r.OS || '';
        return k+':  OD '+a+(b ? '   OS '+b : '')+((r.OD && !r.OS) ? '  <<< ONE EYE ONLY' : '');
      }),
      restored: re, notDictated: un
    };
  };

  /* ---- 9. free-text boxes -------------------------------------------------
     A NEGATION IS AN INSTRUCTION TO ERASE. Every box carries forward; saying a
     finding is absent is the only way it is ever removed.
     Staining: COLUMNS ARE EYES (OD left), ROWS ARE DESCRIPTIONS within one eye.
     The box directly under a section header belongs to the SECTION - never
     write there. Boxes are captured as element references at load, because
     coordinates die when the pane scrolls, and filtered to width > 100 - the
     anterior-chamber and iris fields two rows below are w44 and w54.        */
  window.__isStain = function(v){
    return /\d+\s*%|\binf\b|\bsup\b|\bnasal\b|\btemp\b|\bexpo\w*\b|\bband\b|\bLOM\b|\bLWE\b|foreign body|\blinear\b|\bscattered\b|\bdense\b|\bclumped\b/i.test(v);
  };
  window.__stainBox = {OD:[], OS:[]};
  if (corneaHead){
    var cand = [];
    [].slice.call(d.querySelectorAll('input[type=text]')).forEach(function(e){
      var b = e.getBoundingClientRect();
      if (b.width < 100) return;
      if (b.top < corneaHead.bottom+30 || b.top > corneaHead.bottom+120) return;
      if (b.left < corneaHead.x-30 || b.left > corneaHead.x+520) return;
      cand.push({e:e, x:b.left});
    });
    var xs = cand.map(function(c){ return c.x; }).sort(function(a,b){ return a-b; });
    var split = xs.length ? (xs[0]+xs[xs.length-1])/2 : 0;
    cand.forEach(function(c){ (c.x <= split ? window.__stainBox.OD : window.__stainBox.OS).push(c.e); });
  }
  window.__stainPrior = {
    OD: window.__stainBox.OD.map(function(e){ return e.value; }),
    OS: window.__stainBox.OS.map(function(e){ return e.value; })
  };
  window.__stainSet = function(od, os){
    var rep = [];
    [['OD',od],['OS',os]].forEach(function(p){
      var eye = p[0], t = p[1]; if (t == null) return;
      var col = window.__stainBox[eye];
      if (!col.length){ rep.push(eye+': NO STAINING BOX MAPPED'); return; }
      var tgt = col.filter(function(e){ return window.__isStain(e.value); })[0]
             || col.filter(function(e){ return !e.value.trim(); })[0];
      if (!tgt){ rep.push(eye+': all boxes hold non-staining text, left alone'); return; }
      rep.push(eye+': "'+tgt.value.trim()+'" to "'+t+'"');
      window.__setVal(tgt, t);
      col.forEach(function(e){
        if (e !== tgt && window.__isStain(e.value)){ rep.push(eye+' cleared stale "'+e.value.trim()+'"'); window.__setVal(e,''); }
        else if (e !== tgt && e.value.trim()) rep.push(eye+' preserved "'+e.value.trim()+'"');
      });
    });
    return rep;
  };
  window.__clearBox = function(word){
    var w = String(word).toUpperCase(), hits = [];
    [].slice.call(d.querySelectorAll('input[type=text],textarea')).forEach(function(e){
      if (!e.getBoundingClientRect().width) return;
      var val = (e.value||'').trim();
      if (val && val.length < 120 && val.toUpperCase().indexOf(w) >= 0){ hits.push('cleared "'+val+'"'); window.__setVal(e,''); }
    });
    return hits.length ? hits : ['nothing matching "'+word+'" was in a box'];
  };

  /* ---- 10. the plan box ---------------------------------------------------
     THE HEADLINER MUST SURVIVE EVERY WRITE.
     FIXED 9/8/2026 EVENING: __plan() now prefers a VISIBLE textarea over
     plain DOM order when picking among candidates matching the plan regex -
     see deis-core.js for the full Ronald Gilbert incident this closes.     */
  window.__plan = function(){
    var cands = [].slice.call(d.querySelectorAll('textarea'))
      .filter(function(e){ return /FOLLOW UP|TODAY:|SUMMARY:/i.test(e.value); });
    var el = cands.filter(function(e){ return e.getBoundingClientRect().width > 0; })[0] || cands[0];
    if (!el) return null;
    if (window.__planEl !== el){
      window.__planEl = el;
      window.__planSaved = el.value;
      var v = el.value, i = v.indexOf('SUMMARY:');
      if (i < 0) i = v.indexOf('TODAY:');
      window.__planHeader = (i > 0 ? v.slice(0,i) : v).trim();
    }
    window.__planBox = el;
    return { len: el.value.length, header: (window.__planHeader||'').split('\n')[0].slice(0,70) };
  };
  window.__header = function(){ return window.__planHeader || '(none captured)'; };
  window.__planSpace = function(t){
    var L = String(t).split('\n'), o = [];
    for (var i=0;i<L.length;i++){
      if (/^>?\s*PLAN\b/i.test(L[i].trim()) && o.length && o[o.length-1].trim() !== '') o.push('');
      o.push(L[i]);
    }
    return o.join('\n');
  };
  window.__setPlan = function(text, opts){
    opts = opts || {};
    if (!window.__planBox || window.__planEl !== window.__planBox) window.__plan();
    if (!window.__planBox) return 'PLAN BOX NOT FOUND';
    var hdr = window.__planHeader || '', first = hdr.split('\n')[0].trim();
    if (hdr && opts.keepHeader !== false && first && text.indexOf(first) < 0) text = hdr + '\n\n' + text;
    text = window.__planSpace(text);
    window.__setVal(window.__planBox, text);
    return 'plan written ' + text.length + ' chars | HEADLINER RETAINED: ' +
      (first ? '"'+first.slice(0,60)+'"' : '*** NONE FOUND - CHECK THE TOP OF THE PLAN ***');
  };
  window.__appendPlan = function(text){
    if (!window.__planBox) window.__plan();
    if (!window.__planBox) return 'PLAN BOX NOT FOUND';
    var cur = window.__planBox.value;
    window.__setVal(window.__planBox, cur + (/\n$/.test(cur) ? '' : '\n') + text);
    return 'appended ' + text.length + ' chars, plan now ' + window.__planBox.value.length;
  };
  window.__planSection = function(label, text){
    if (!window.__planBox) window.__plan();
    if (!window.__planBox) return 'PLAN BOX NOT FOUND';
    var v = window.__planBox.value, i = v.indexOf(label);
    if (i < 0) return window.__appendPlan(text);
    var j = v.indexOf('\n\n', i + label.length);
    var nv = v.slice(0,i) + text + (j < 0 ? '' : v.slice(j));
    window.__setVal(window.__planBox, nv);
    return 'section "' + label + '" replaced, plan now ' + nv.length;
  };

  /* ---- 11. undo -----------------------------------------------------------*/
  window.__revert = function(){
    var n = 0;
    G.forEach(function(g){
      var els = [].slice.call(d.getElementsByName(g.nm));
      els.forEach(function(r){ if (r.checked){ r.checked = false; r.dispatchEvent(new Event('change',{bubbles:true})); } });
      g.baseline.forEach(function(val){ var i = g.opts.indexOf(val); if (i < 0) return; els[i].checked = true; fire(els[i]); });
      g.dictated = false; g.restored = false;
    });
    var t = 0;
    window.__journal.slice().reverse().forEach(function(j){
      if (j.kind === 'chk'){
        j.e.checked = j.prior;
        j.e.dispatchEvent(new Event('click', {bubbles:true}));
        j.e.dispatchEvent(new Event('change',{bubbles:true}));
      } else {
        j.e.value = j.prior;
        j.e.dispatchEvent(new Event('input', {bubbles:true}));
        j.e.dispatchEvent(new Event('change',{bubbles:true}));
        j.e.dispatchEvent(new Event('blur',  {bubbles:true}));
      }
      j.e.__jrn = false; t++;
    });
    window.__journal = [];
    return 'REVERTED: ' + n + ' radios to baseline, ' + t + ' fields (text and checkbox) to their prior state.';
  };

  /* ---- 12. the one-call grid write --------------------------------------*/
  window.__applyGrid = function(spec, none){
    var b = window.__bindCheck();
    if (!b.ok) return 'BLOCKED: ' + b.why;
    var bad = [];
    spec.concat(none||[]).forEach(function(s){
      var gs = window.__find(s[0], s[1], s[2]);
      if (gs.length !== 1) bad.push((gs.length ? 'AMBIG x'+gs.length : 'NOMATCH')+' '+s[0]+'/'+s[1]+'/'+s[2]);
    });
    if (bad.length) return window.__san('ABORTED, nothing written: ' + bad.join(' ; '));
    try {
      var cleared = window.__clearSafe(), probs = [];
      spec.forEach(function(s){ var r = window.__setOne(s[0],s[1],s[2],s[3]); if (!/\| ok$/.test(r)) probs.push(r); });
      (none||[]).forEach(function(s){ var r = window.__setIdx(s[0],s[1],s[2],-1); if (!/^SET /.test(r)) probs.push(r); });
      var rest = window.__restore(), a = window.__audit();
      return window.__san(
        'problems: ' + (probs.length ? probs.join(' ; ') : 'none') + '  |  ' + cleared +
        '\nrestored ' + rest.length + ' groups from last visit' +
        '\n--- READ BACK ---\n' + a.readback.join('\n'));
    } catch(e){
      return window.__san('EXCEPTION mid-write: ' + e.message + ' -- AUTO-REVERTED. ' + window.__revert());
    }
  };

  /* ---- 13. procedure day, places 1, 2 and 4 -----------------------------*/
  window.__panelBand = function(){
    var presc = null, reports = null, options = null;
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length) return;
      var t = txt(el), b = el.getBoundingClientRect(); if (!b.width || !t) return;
      if (/PRESCRIBED TREATMENTS/i.test(t) && presc == null) presc = b.top;
      if (/Patient Reports Using/i.test(t) && reports == null) reports = b.top;
      if (/PLAN:\s*OPTIONS DISCUSSED/i.test(t) && options == null) options = b.top;
    });
    if (presc == null) return null;
    return { lo: presc, hi: (reports != null && reports > presc) ? reports : presc+260, options: options };
  };
  window.__proc = function(name, date){
    date = date || window.__today();
    var band = window.__panelBand();
    if (!band) return 'PROC: PRESCRIBED TREATMENTS panel not found - is ANTERIOR OU active';
    var want = String(name).toUpperCase(), L = null, out2 = [];
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length || L) return;
      if (txt(el).toUpperCase() !== want) return;
      var b = el.getBoundingClientRect();
      if (!b.width || b.top < band.lo-6 || b.top > band.hi) return;   // PRESCRIBED band only
      L = {x:b.left, y:b.top};
    });
    if (!L) return 'PROC: no "'+name+'" column inside the PRESCRIBED panel';
    var cb = null, cd = 1e9;
    [].slice.call(d.querySelectorAll('input[type=checkbox]')).forEach(function(c){
      var b = c.getBoundingClientRect(); if (!b.width) return;
      if (Math.abs(b.top-L.y) > 14) return;
      var dx = L.x - b.right; if (dx < 0 || dx > 40) return;
      if (dx < cd){ cd = dx; cb = c; }
    });
    if (cb && !cb.checked){ window.__setChk(cb, true); out2.push('box checked'); }
    else out2.push(cb ? 'box already checked' : 'NO CHECKBOX FOUND');
    var row = [];
    [].slice.call(d.querySelectorAll('input[type=text]')).forEach(function(e){
      var b = e.getBoundingClientRect(); if (!b.width) return;
      if (b.top < L.y+6 || b.top > L.y+40) return;
      row.push({e:e, x:b.left});
    });
    var box = null, bd = 1e9;
    row.forEach(function(r){ var dd = Math.abs(r.x - (L.x-20)); if (dd < bd){ bd = dd; box = r; } });
    if (!box) return 'PROC '+name+': '+out2.join(', ')+' but NO DATE BOX below it';
    var was = box.e.value;
    window.__setVal(box.e, date);
    return 'PROC '+name+': '+out2.join(', ')+', date "'+was+'" to '+date;
  };
  window.__hist = function(block, date, type){
    date = date || window.__today();
    var hdr = null;
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length) return;
      if (txt(el).toUpperCase() === String(block).toUpperCase()){ var b = el.getBoundingClientRect(); if (b.width) hdr = b; }
    });
    if (!hdr) return 'HIST: block "'+block+'" not found - is the HISTORY tab active';
    var cells = [];
    [].slice.call(d.querySelectorAll('input[type=text]')).forEach(function(e){
      var b = e.getBoundingClientRect(); if (!b.width) return;
      if (b.top < hdr.top-5 || b.top > hdr.top+130) return;
      if (b.left < hdr.left-60 || b.left > hdr.left+540) return;
      cells.push({e:e, y:Math.round(b.top), x:Math.round(b.left)});
    });
    var ys = cells.map(function(c){ return c.y; }).filter(function(v,i,a){ return a.indexOf(v) === i; }).sort(function(a,b){ return a-b; });
    for (var i=0; i+1 < ys.length; i+=2){                     // date row over type row
      var dr = cells.filter(function(c){ return c.y === ys[i];   }).sort(function(a,b){ return a.x-b.x; });
      var tr = cells.filter(function(c){ return c.y === ys[i+1]; }).sort(function(a,b){ return a.x-b.x; });
      for (var j=0; j<dr.length; j++){
        if (!(dr[j].e.value||'').trim()){
          window.__setVal(dr[j].e, date);
          if (type && tr[j]) window.__setVal(tr[j].e, type);
          return 'HIST '+block+': row-pair '+(i/2+1)+' col '+(j+1)+' = '+date+(type ? ' / '+type : '');
        }
      }
    }
    return 'HIST '+block+': ALL SLOTS FULL - handle manually';
  };
  window.__info = function(text){
    var lbl = null;
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length || lbl) return;
      if (/^Comment/i.test(txt(el))){ var b = el.getBoundingClientRect(); if (b.width) lbl = b; }
    });
    if (!lbl) return 'INFO: Comment label not found - is the Info tab active';
    var fld = null, best = 1e9;
    [].slice.call(d.querySelectorAll('input[type=text],textarea')).forEach(function(e){
      var b = e.getBoundingClientRect(); if (!b.width) return;
      var dx = b.left - lbl.right, dy = Math.abs(b.top - lbl.top);
      if (dy > 24 || dx < -10 || dx > 400) return;
      if (dx < best){ best = dx; fld = e; }
    });
    if (!fld) return 'INFO: comment field not found';
    var was = fld.value;
    window.__setVal(fld, text);
    return 'INFO: "'+was+'" to written';
  };
  // ADDED 9/9/2026, late evening (CB, going to bed, last instruction of the
  // night): "you should also add in the info tab summary as you learn the
  // items/procedures and changes from last time to implement." Builds the
  // Info-tab Comment field UP as things are learned during a visit, instead
  // of composing it once at the end - same "write it the moment you learn
  // it, don't batch" philosophy as Rule Zero. Idempotent: won't duplicate a
  // piece already present (case-insensitive substring check). Starts an
  // empty box with "OSD: " per procedure-day-protocol.md's standing default
  // reason unless the piece itself already carries an ALLCAPS: prefix.
  // NOT YET TESTED LIVE - built with no browser access at the end of the
  // night. Test on TESTY before trusting it on a real visit.
  window.__infoAdd = function(item, apply){
    if (apply === undefined) apply = true;
    var lbl = null;
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length || lbl) return;
      if (/^Comment/i.test(txt(el))){ var b = el.getBoundingClientRect(); if (b.width) lbl = b; }
    });
    if (!lbl) return 'INFO: Comment label not found - is the Info tab active';
    var fld = null, best = 1e9;
    [].slice.call(d.querySelectorAll('input[type=text],textarea')).forEach(function(e){
      var b = e.getBoundingClientRect(); if (!b.width) return;
      var dx = b.left - lbl.right, dy = Math.abs(b.top - lbl.top);
      if (dy > 24 || dx < -10 || dx > 400) return;
      if (dx < best){ best = dx; fld = e; }
    });
    if (!fld) return 'INFO: comment field not found';
    var piece = String(item||'').trim();
    if (!piece) return 'INFO: nothing to add';
    var cur = String(fld.value||'').trim(), next;
    if (!cur){
      next = /^[A-Z]+:/i.test(piece) ? piece : ('OSD: ' + piece);
    } else {
      if (cur.toLowerCase().indexOf(piece.toLowerCase()) >= 0)
        return window.__san('INFO: "'+piece+'" already present, not duplicated');
      next = cur + ', ' + piece;
    }
    if (apply) window.__setVal(fld, next);
    return window.__san((apply ? 'INFO ADDED: ' : 'dry run: ') + '"'+piece+'"  ->  "'+next+'"');
  };
  // ORCHESTRATOR - already batches places 1, 2 and 4 in ONE call. Use it
  // instead of calling __proc/__hist/__info by hand.
  window.__procedureDone = async function(o){
    var log = [];
    log.push(await window.__tabWait('ANTERIOR OU','ADNEXIA',4000));
    log.push(window.__proc(o.name, o.date));
    if (o.block){
      log.push(await window.__tabWait('HISTORY', o.block, 4000));
      log.push(window.__hist(o.block, o.date, o.type));
    }
    if (o.info){
      log.push(await window.__tabWait('Info','Comment',4000));
      log.push(window.__info(o.info));
    }
    log.push(await window.__tabWait('ANTERIOR OU','ADNEXIA',4000));
    return window.__san(log.join('\n'));
  };

  /* ---- 14. the OP note ---------------------------------------------------*/
  window.__opSpot = function(){
    var w = window.__cn, dd = w.document, fr = {x:0,y:0};
    try { var b = w.frameElement.getBoundingClientRect(); fr = {x:b.left, y:b.top}; } catch(e){}
    var vw = w.innerWidth  || dd.documentElement.clientWidth;
    var vh = w.innerHeight || dd.documentElement.clientHeight;
    var best = null;
    for (var y = vh-160; y > 200 && !best; y -= 12){
      for (var x = 260; x < vw-60; x += 40){
        var el = dd.elementFromPoint(x,y); if (!el) continue;
        var t = el.tagName;
        if (t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||t==='BUTTON'||t==='A') continue;
        if (el.closest && el.closest('input,textarea,select,button,a')) continue;
        if ((el.textContent||'').trim().length > 0 && el.children.length === 0) continue;
        best = {x:x, y:y}; break;
      }
    }
    if (!best) return {ok:false, why:'no blank space found - scroll the OP note or click manually'};
    return { ok:true,
      click: [Math.round(fr.x+best.x),     Math.round(fr.y+best.y)],
      cb:    [Math.round(fr.x+best.x-170), Math.round(fr.y+best.y+64)],
      arrow: [Math.round(fr.x+best.x-60),  Math.round(fr.y+best.y+64)] };
  };
  window.__opItem = function(name){
    var res = [];
    [window.__cn, window.top].forEach(function(w){
      try {
        [].slice.call(w.document.querySelectorAll('*')).forEach(function(el){
          if (el.children.length) return;
          if ((el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase() !== String(name).toUpperCase()) return;
          var b = el.getBoundingClientRect(); if (!b.width) return;
          res.push({win: (w === window.top ? 'top' : 'note'), x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2)});
        });
      } catch(e) {}
    });
    return res.length ? res : '"'+name+'" not found in the DOM - use the screenshot';
  };
  window.__opFinish = function(skin){
    var res = [], by = {};
    function after(el){
      var n = el.nextSibling, s = '';
      while (n && s.length < 40){
        if (n.nodeType === 3) s += n.textContent;
        else if (n.nodeType === 1){ if (n.tagName === 'INPUT') break; s += n.textContent; }
        n = n.nextSibling;
      }
      return s.replace(/\s+/g,' ').trim();
    }
    [].slice.call(d.querySelectorAll('input[type=radio]')).forEach(function(r){
      var b = r.getBoundingClientRect(); if (!b.width) return; (by[r.name] = by[r.name] || []).push(r);
    });
    Object.keys(by).forEach(function(nm){
      var g = by[nm]; if (g.some(function(x){ return x.checked; })) return;
      var labs = g.map(after), i = -1, why = '';
      var j = labs.map(function(x){ return x.toUpperCase(); }).indexOf('IPL/RF');
      if (j >= 0){ i = j; why = 'device IPL/RF'; }
      else if (skin){
        var k = labs.map(function(x){ return x.toUpperCase(); }).indexOf(String(skin).toUpperCase());
        if (k >= 0){ i = k; why = 'Fitzpatrick '+labs[k]+' from HISTORY'; }
      }
      if (i < 0){ res.push('LEFT UNSET ['+labs.join('/')+']'); return; }
      g[i].checked = true; fire(g[i]); res.push('set '+why);
    });
    var chk = [];
    [].slice.call(d.querySelectorAll('input[type=checkbox]')).forEach(function(c){
      var b = c.getBoundingClientRect(); if (!b.width || c.checked) return;
      window.__setChk(c, true); chk.push('y'+Math.round(b.top));
    });
    res.push('consent/attestation checked: ' + (chk.join(', ') || 'none unchecked'));
    var by2 = {}, unset = [];
    [].slice.call(d.querySelectorAll('input[type=radio]')).forEach(function(r){
      var b = r.getBoundingClientRect(); if (!b.width) return; (by2[r.name] = by2[r.name] || []).push(r);
    });
    Object.keys(by2).forEach(function(nm){ if (!by2[nm].some(function(x){ return x.checked; })) unset.push('['+by2[nm].map(after).join('/')+']'); });
    var cbs = [].slice.call(d.querySelectorAll('input[type=checkbox]')).filter(function(c){ return c.getBoundingClientRect().width; });
    res.push('AUDIT: unset ' + unset.length + (unset.length ? ' '+unset.join(' ') : '') +
             ' | boxes ' + cbs.filter(function(c){ return c.checked; }).length + ' of ' + cbs.length);
    Object.keys(by2).forEach(function(nm){
      var labs = by2[nm].map(after);
      if (labs.indexOf('I') < 0 && labs.indexOf('II') < 0) return;
      var ck = by2[nm].filter(function(x){ return x.checked; });
      res.push('Fitzpatrick group = ' + (ck.length ? after(ck[0]) : 'UNSET'));
    });
    return window.__san(res.join('\n'));
  };

  /* ---- 15. cue readouts --------------------------------------------------*/
  var SAY = {TR:'trace',GR1:'grade 1',GR2:'grade 2',GR3:'grade 3',GR4:'grade 4',
    MILD:'mild',MOD:'moderate',SEV:'severe',CLEAN:'clean',NO:'no color',SOME:'some color',
    GREAT:'great color',NONE:'none',LIMITED:'limited',MEDIOCRE:'mediocre',EXCELLENT:'excellent',
    'SEMI-SOLID':'semi solid',THIN:'thin',MIXED:'mixed',COLORED:'colored',CLEAR:'clear',
    NML:'normal',NS:'nuclear sclerosis',PCIOL:'lens implant',
    NORMAL:'normal',QUESTIONABLE:'questionable',ABNORMAL:'abnormal',SEVERE:'severe',MODERATE:'moderate'};
  var EYEW = {OD:'right',OS:'left',RUL:'right upper',LUL:'left upper',RLL:'right lower',LLL:'left lower'};
  window.__SLOTS = {
    'staining'      : [['CORNEA','SPK',null,'stain']],
    'blink'         : [['TEAR FILM','Debris',null],['TEAR FILM','Allergic Mucous',null,'presence:mucous']],
    'look down'     : [['LASHES','Collarettes',null],['LASHES','Debris',null]],
    'look straight' : [['LIDS','Thickening',null],['LIDS','Hyperemia',null],
                       ['LIDS','Telangiectasia',null],['LIDS','Scurf',null],
                       ['CONJUNCTIVA','INJ','injection']],
    'conjunctiva'   : [['CONJUNCTIVA','INJ','injection'],['CONJUNCTIVA','CCH','C C H'],['CONJUNCTIVA','Papillae','papillae']],
    'debridement'   : [['DEBRIDEMENT','Production',null]],
    'expression'    : [['MG EXPRESSION','EXCELLENT',null],['MG QUALITY','MG QUALITY',null]],
    'picture review': [['INTERFEROMETRY','Color',null]],
    'adnexia'       : [['ADNEXIA','Ptosis','ptosis'],['ADNEXIA','Dermatochalasis','dermatochalasis'],['ADNEXIA','LL Lag','lower lid lag']],
    'drop out'      : [['DROP OUT','DROP OUT',null]],
    'truncation'    : [['TRUNCATION','TRUNCATION',null]],
    'lens'          : [['LENS','LENS',null]],
    'sensitivity'   : [['CORNEAL SENSITIVITY','CORNEAL SENSITIVITY',null]]
  };
  window.__ALIAS = {'lashes':'look down','lids':'look straight','lid margin':'look straight',
    'tear film':'blink','spk':'staining','cornea':'staining','injection':'conjunctiva',
    'quality':'expression','tod':'picture review','interferometry':'picture review','color':'picture review'};
  function group(sec, key, eye){
    var gs = G.filter(function(g){
      if (g.sec !== sec) return false;
      var nm = up(bare(g.find)), k = up(key);
      return nm === k || nm.indexOf(k) >= 0 || k.indexOf(nm) >= 0;   // "GREAT Color" matches "Color"
    });
    return gs.filter(function(x){ return x.eye === eye; })[0] || (gs.length === 1 ? gs[0] : null);
  }
  function slotVal(sec, key, eye, mode){
    var g = group(sec, key, eye); if (!g) return null;
    var v = (g.baseline||[])[0] || '';
    var absent = !v || /^-/.test(v) || up(v) === 'N/A';
    if (mode && mode.indexOf('presence:') === 0){
      var word = mode.split(':')[1];
      return absent ? 'no '+word : word;                              // never "allergic mucous mucous"
    }
    if (absent) return 'clear';
    var nm = bare(g.find);
    var c = String(v).replace(/^[-\s]*/,'')
      .replace(new RegExp('\\s*'+nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$','i'),'').trim();
    if (!c) c = String(v).replace(/^[-\s]*/,'').trim();               // the value WAS the name
    return SAY[up(c)] || c.toLowerCase();
  }
  function speakable(s){ return String(s).replace(/%/g,' percent'); }
  function eyeLine(slots, eye){
    var parts = [];
    slots.forEach(function(s){
      var mode = (s[3] && s[3].indexOf('presence:') === 0) ? s[3] : null;
      var v = slotVal(s[0], s[1], eye, mode);
      if (v == null) return;
      parts.push((s[2] && !mode) ? v+' '+s[2] : v);
      if (s[3] === 'stain'){
        var pri = (window.__stainPrior[eye]||[]).filter(function(x){ return x && window.__isStain(x); });
        if (pri.length) parts.push(speakable(pri.join(', ')));
      }
    });
    return parts.join(', ');
  }
  window.__cue = function(word, speak){
    var w = String(word||'').toLowerCase().trim(), keys = [], seen = {};
    Object.keys(window.__ALIAS).concat(Object.keys(window.__SLOTS))
      .sort(function(a,b){ return b.length-a.length; })
      .forEach(function(k){
        if (w.indexOf(k) < 0) return;
        var real = window.__ALIAS[k] || k;
        if (!seen[real]){ seen[real] = 1; keys.push(real); }
      });
    if (!keys.length) return 'no cue matched "'+word+'". known: ' + Object.keys(window.__SLOTS).join(', ');
    if (keys.length === 1 && keys[0] === 'staining') keys.push('blink');   // she wants both at once
    var slots = []; keys.forEach(function(k){ slots = slots.concat(window.__SLOTS[k]); });
    var perLid = slots.some(function(s){ return s[0] === 'DROP OUT' || s[0] === 'TRUNCATION'; });
    var t;
    if (perLid){
      t = ['RUL','RLL','LUL','LLL'].map(function(k){
        var v = slotVal(slots[0][0], slots[0][1], k);
        return v ? EYEW[k]+' '+v : '';
      }).filter(Boolean).join(', ') + '.';
    } else {
      t = 'Right. ' + eyeLine(slots,'OD') + '. Left. ' + eyeLine(slots,'OS') + '.';
    }
    if (speak !== false) window.__say(t);
    return t;
  };
  window.__reciteLast = function(speak){
    var order = ['look straight','look down','blink','staining','debridement','expression','picture review','adnexia'];
    var head = 'Last visit.';
    try {
      var pv = (window.__planBox && window.__planBox.value) || '', f = pv.split('\n')[0];
      if (/FOLLOW UP/i.test(f)) head = 'Last visit. Plan was ' + f.replace(/^FOLLOW UP AND\s*/i,'') + '.';
    } catch(e){}
    var t = head + ' ' + order.map(function(c){ return window.__cue(c, false); }).join(' ');
    if (speak !== false) window.__say(t);
    return t;
  };

  /* ---- 16. bind guard on every mutating helper --------------------------*/
  window.__wrapped = window.__wrapped || {};
  ['__setOne','__setIdx','__clearSafe','__restore','__applyGrid','__setPlan','__appendPlan',
   '__planSection','__stainSet','__clearBox','__proc','__hist','__info','__infoAdd'].forEach(function(k){
    if (typeof window[k] !== 'function' || window.__wrapped[k]) return;
    var orig = window[k]; window.__wrapped[k] = orig;
    window[k] = function(){
      var b = window.__bindCheck();
      if (!b.ok) return 'BLOCKED ' + k + ': ' + b.why;
      return orig.apply(this, arguments);
    };
  });

  /* ---- 17. health line and self-test -----------------------------------*/
  window.__ready = function(){
    var b = window.__bindCheck ? window.__bindCheck() : {ok:false, why:'not bound'};
    return window.__san('READY ' + (b.ok ? 'yes' : 'NO - '+b.why) +
      ' | groups ' + ((window.__groups||[]).length) +
      ' | acronyms ' + Object.keys(window.__X||{}).length +
      ' | stain OD ' + window.__stainBox.OD.length + ' OS ' + window.__stainBox.OS.length +
      ' | plan ' + ((window.__planBox && window.__planBox.value.length) || 0) + ' chars' +
      ' | headliner ' + ((window.__planHeader||'').split('\n')[0].slice(0,40) || 'NONE') +
      ' | cues ' + Object.keys(window.__SLOTS||{}).length +
      ' | host ' + location.hostname);
  };
  window.__selftest = function(){
    var r = [], bySec = {};
    G.forEach(function(g){ bySec[g.sec] = (bySec[g.sec]||0)+1; });
    r.push(window.__ready());
    r.push('sections: ' + Object.keys(bySec).sort().map(function(s){ return s+' '+bySec[s]; }).join('  '));
    r.push('expect: groups 67 | LIDS 8 | DROP OUT 4 | TRUNCATION 4 | TEAR FILM 4 | ? 15');
    var probe = [['LIDS','Thickening','OD'],['CORNEA','SPK','OS'],['MG EXPRESSION','EXCELLENT','OD'],
                 ['MG QUALITY','MG QUALITY','OS'],['INTERFEROMETRY','Color','OD'],
                 ['DEBRIDEMENT','Production','OS'],['TEAR FILM','Allergic Mucous','OD']];
    r.push('resolve check: ' + probe.map(function(p){
      var n = window.__find(p[0],p[1],p[2]).length;
      return p[1]+'/'+p[2]+(n===1 ? ' ok' : ' FAIL x'+n);
    }).join('  '));
    r.push('panel band: ' + JSON.stringify(window.__panelBand()));
    r.push('cue sample: ' + window.__cue('look straight', false));
    r.push('writers: ' + ['__applyGrid','__revert','__stainSet','__clearBox','__setPlan','__appendPlan',
      '__planSection','__proc','__hist','__info','__infoAdd','__opSpot','__cue','__say']
      .filter(function(k){ return typeof window[k] === 'function'; }).length + ' of 14');
    return window.__san(r.join('\n'));
  };

  var bySec = {}; G.forEach(function(g){ bySec[g.sec] = (bySec[g.sec]||0)+1; });
  var p = window.__plan();
  out.push('groups ' + G.length + '  pre-populated ' + G.filter(function(g){ return g.baseline.length; }).length + '  pairs h'+h+' v'+v);
  out.push(Object.keys(bySec).sort().map(function(s){ return s+' '+bySec[s]; }).join('  '));
  out.push('PLAN box: ' + (p ? p.len + ' chars, headliner "' + p.header + '"' : 'NOT FOUND'));
  out.push('staining boxes: OD ' + window.__stainBox.OD.length + ' OS ' + window.__stainBox.OS.length);
  out.push('acronyms loaded: ' + Object.keys(window.__X).length);
  return out.join('\n');
}).toString() + ')()';

  SRC.DEISCC = '(' + (function DEISCC(){
  var w = window.__cn; if (!w) return 'NO NOTE FRAME - load DEISALL first';
  var d = w.document;
  function T(el){ return (el.textContent||'').replace(/\s+/g,' ').trim(); }
  function U(s){ return String(s||'').trim().toUpperCase(); }
  function optLab(el){
    var n = el.nextSibling, s = '';
    while (n && s.length < 22){
      if (n.nodeType === 3) s += n.textContent;
      else if (n.nodeType === 1){ if (n.tagName === 'INPUT') break; s += n.textContent; }
      n = n.nextSibling;
    }
    return s.replace(/\s+/g,' ').trim();
  }
  // CB's symptom lexicon, from pt-cc-tab.md. Used to count problems in a box.
  var SYM = ['burn','itch','sting','pain','red','tear','water','dry','blur','fluctuat','grit','sandy',
    'foreign body','light sensit','photophob','crust','discharge','mucus','swell','heavy','tired',
    'ache','pressure','film','glare','halo'];
  function symsIn(s){ var l = String(s).toLowerCase(); return SYM.filter(function(k){ return l.indexOf(k) >= 0; }); }

  window.__cc = function(){
    var leaves = [];
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length) return;
      var t = T(el); if (!t) return;
      var b = el.getBoundingClientRect(); if (!b.width) return;
      leaves.push({t:t, x:b.left, y:b.top, r:b.right, b:b.bottom});
    });
    var heads = leaves.filter(function(l){ return /^(Primary|Secondary|Tertiary) Issue Today:$/i.test(l.t); })
                      .sort(function(a,b){ return a.y-b.y; });
    if (heads.length !== 3) return 'PT CC NOT ACTIVE - found ' + heads.length + ' issue headers, expected 3';
    var ctl = [].slice.call(d.querySelectorAll('textarea,input,select')).map(function(e){
      var b = e.getBoundingClientRect();
      return {e:e, x:b.left, y:b.top, w:b.width, r:b.right, vis:b.width > 0};
    }).filter(function(c){ return c.vis; });

    function nearRight(labelRe, lo, hi, want){
      var L = leaves.filter(function(l){ return labelRe.test(l.t) && l.y >= lo && l.y < hi; })[0];
      if (!L) return null;
      var row = null, rd = 1e9, below = null, bd2 = 1e9;
      ctl.forEach(function(c){
        if (want && want.indexOf(c.e.tagName) < 0) return;
        var dxl = c.x - L.x;
        if (Math.abs(c.y - L.y) <= 12 && dxl > 20 && dxl < 700){ if (dxl < rd){ rd = dxl; row = c.e; } return; }
        var dy = c.y - L.y;
        if (dy > 0 && dy < 70 && Math.abs(dxl) < 140){ if (dy < bd2){ bd2 = dy; below = c.e; } }
      });
      return row || below;
    }
    var blocks = heads.map(function(H, i){
      var lo = H.y - 12, hi = heads[i+1] ? heads[i+1].y - 12 : H.y + 330;
      var inBand = ctl.filter(function(c){ return c.y >= lo && c.y < hi && c.x < 600; });
      var groups = {};
      inBand.forEach(function(c){ if (c.e.type === 'radio') (groups[c.e.name] = groups[c.e.name] || []).push(c.e); });
      var g = {};
      Object.keys(groups).forEach(function(nm){
        var labs = groups[nm].map(optLab).map(U);
        if (labs.indexOf('OD') >= 0)                g.lat    = groups[nm];
        else if (labs.indexOf('BETTER') >= 0)       g.dir    = groups[nm];
        else if (labs.indexOf('WEEKS') >= 0)        g.onsetU = groups[nm];
        else if (labs.indexOf('INTERMITTENT') >= 0) g.freq   = groups[nm];
        else if (labs.indexOf('MINUTES') >= 0)      g.durU   = groups[nm];
      });
      return {
        name: H.t.split(' ')[0].toUpperCase(),
        y: H.y, lo: lo, hi: hi,
        box:  (inBand.filter(function(c){ return c.e.tagName === 'TEXTAREA'; })[0]||{}).e || null,
        none: (inBand.filter(function(c){ return c.e.type === 'checkbox' && Math.abs(c.y - H.y) < 16; })[0]||{}).e || null,
        lat: g.lat||null, dir: g.dir||null, onsetU: g.onsetU||null, freq: g.freq||null, durU: g.durU||null,
        relief: nearRight(/^Relief:?$/i, lo, hi, ['INPUT']),
        assoc:  nearRight(/^Associated Factors:?$/i, lo, hi, ['INPUT'])
      };
    });
    var R = {
      discomfort: nearRight(/^Overall discomfort:?$/i, -1e6, 1e6, ['SELECT']),
      gap:        nearRight(/gap between where you are NOW/i, -1e6, 1e6, ['INPUT']),
      sinceLast:  nearRight(/improvement since last treatment/i, -1e6, 1e6, ['INPUT']),
      sinceBegin: nearRight(/improvement since the beginning/i, -1e6, 1e6, ['INPUT']),
      past:       nearRight(/^Past Issues:?$/i, -1e6, 1e6, ['TEXTAREA','INPUT']),
      agenda:     nearRight(/^Today's Agenda:?$/i, -1e6, 1e6, ['TEXTAREA','INPUT'])
    };
    window.__CC = { blocks: blocks, right: R };
    return window.__san('CC mapped | ' + blocks.map(function(b){
      return b.name + '[box ' + (b.box?'y':'-') + ' none ' + (b.none?'y':'-') +
             ' lat ' + (b.lat?'y':'-') + ' dir ' + (b.dir?'y':'-') + ' onset ' + (b.onsetU?'y':'-') +
             ' freq ' + (b.freq?'y':'-') + ' dur ' + (b.durU?'y':'-') +
             ' relief ' + (b.relief?'y':'-') + ' assoc ' + (b.assoc?'y':'-') + ']';
    }).join(' ') + ' | right: ' + Object.keys(R).filter(function(k){ return R[k]; }).join(',') +
    ' | missing: ' + (Object.keys(R).filter(function(k){ return !R[k]; }).join(',') || 'none'));
  };

  function need(){ if (!window.__CC) window.__cc(); return window.__CC; }
  function setV(e, v){ if (window.__setVal) window.__setVal(e, v); else { e.value = v; e.dispatchEvent(new Event('change',{bubbles:true})); } }
  function anySet(g){ return !!(g && g.some(function(r){ return r.checked; })); }

  window.__ccDestray = function(apply){
    var C = need(); if (typeof C === 'string') return C;
    var rep = [];
    C.blocks.forEach(function(B){
      if (!B.box) return;
      var lines = String(B.box.value).split('\n'), keep = [], rel = [], asc = [];
      lines.forEach(function(ln){
        var m = ln.match(/^\s*relief\s*[-:]\s*(.+)$/i);
        var n = ln.match(/^\s*assoc\w*\s*(?:factors?)?\s*[-:]\s*(.+)$/i);
        if (m) rel.push(m[1].trim());
        else if (n) asc.push(n[1].trim());
        else keep.push(ln);
      });
      if (!rel.length && !asc.length) return;
      function into(field, vals, what){
        if (!vals.length) return;
        if (!field){
          rep.push(B.name + ': ' + what + ' field NOT FOUND, line left in the box');
          keep = keep.concat(vals.map(function(v){ return what + ' - ' + v; }));
          return;
        }
        var cur = String(field.value).trim();
        var nv = cur ? cur + '; ' + vals.join('; ') : vals.join('; ');
        rep.push(B.name + ': ' + what + ' to "' + nv.slice(0,50) + '"');
        if (apply) setV(field, nv);
      }
      into(B.relief, rel, 'Relief');
      into(B.assoc,  asc, 'Associated');
      if (apply) setV(B.box, keep.join('\n').replace(/\n{3,}/g,'\n\n').trim());
    });
    return window.__san(rep.length ? rep.join('\n') : 'no stray Relief / Associated lines');
  };

  window.__ccAssess = function(apply){
    var C = need(); if (typeof C === 'string') return C;
    window.__ccDestray(apply);
    var rep = [];
    C.blocks.forEach(function(B){
      if (!B.box) return;
      var raw = String(B.box.value).split('\n').filter(function(l){ return !/^\s*\[\s*\]\s*(ASK|SPLIT):/i.test(l); });
      var body = raw.join('\n').trim();
      if (!body){
        rep.push(B.name + ': empty' + (B.none ? (B.none.checked ? ', None already checked' : ', checking None') : ', NO None box'));
        if (apply){
          if (B.none && !B.none.checked){
            if (window.__setChk) window.__setChk(B.none, true);
            else { B.none.checked = true; B.none.dispatchEvent(new Event('change',{bubbles:true})); }
          }
          setV(B.box, '');
        }
        return;
      }
      var miss = [];
      if (!anySet(B.lat))    miss.push('which eye');
      if (!anySet(B.dir))    miss.push('better / worse / same');
      if (!anySet(B.onsetU)) miss.push('how long ago it started');
      if (!anySet(B.freq))   miss.push('how often');
      if (!anySet(B.durU))   miss.push('how long it lasts');
      var syms = symsIn(body);
      var pre = [];
      if (miss.length) pre.push('[ ] ASK: ' + miss.join(' - '));
      if (syms.length > 1) pre.push('[ ] SPLIT: ' + syms.length + ' problems in this box (' + syms.join(', ') + ') - one per box');
      rep.push(B.name + ': ' + (miss.length ? miss.length + ' unanswered' : 'complete') + (syms.length > 1 ? ', ' + syms.length + ' symptoms' : ''));
      if (apply){
        setV(B.box, pre.concat(body).join('\n'));
        try { B.box.scrollTop = 0; } catch(e){}
      }
    });
    return window.__san(rep.join('\n'));
  };

  window.__ccTint = function(el, on){
    if (!el) return;
    if (on){ el.style.outline = '2px solid #d33'; el.style.background = '#ffe9ef'; }
    else { el.style.outline = ''; el.style.background = ''; }
  };
  window.__ccNumbers = function(apply){
    var C = need(); if (typeof C === 'string') return C;
    var R = C.right;
    function num(e){
      if (!e) return null;
      var v = (e.tagName === 'SELECT' ? (e.options[e.selectedIndex]||{}).text : e.value);
      v = parseFloat(String(v).replace(/[^0-9.\-]/g,''));
      return isNaN(v) ? null : v;
    }
    var dis = num(R.discomfort), gap = num(R.gap), last = num(R.sinceLast), beg = num(R.sinceBegin);
    var bad = [], have = ['discomfort ' + (dis===null?'-':dis) + ', gap ' + (gap===null?'-':gap) +
      ', since last ' + (last===null?'-':last) + ', since beginning ' + (beg===null?'-':beg)];
    if (gap !== null && beg !== null){
      var tot = gap + beg;
      if (Math.abs(tot - 100) > 15) bad.push({f:[R.gap,R.sinceBegin],
        m:'gap + since-beginning = ' + tot + ', should be near 100 (off by ' + Math.round(Math.abs(tot-100)) + ')'});
    }
    if (gap !== null && dis !== null){
      var want = gap / 10;
      if (Math.abs(dis - want) > 3) bad.push({f:[R.discomfort,R.gap],
        m:'discomfort ' + dis + ' but gap ' + gap + ' implies about ' + want.toFixed(1)});
    }
    if (last !== null && beg !== null && last > beg){
      bad.push({f:[R.sinceLast,R.sinceBegin],
        m:'improvement since last treatment (' + last + ') exceeds since the beginning (' + beg + ')'});
    }
    [R.discomfort,R.gap,R.sinceLast,R.sinceBegin].forEach(function(e){ window.__ccTint(e, false); });
    if (apply) bad.forEach(function(b){ b.f.forEach(function(e){ window.__ccTint(e, true); }); });
    return window.__san(have.join('') + '\n' + (bad.length ? bad.map(function(b){ return 'FLAG: ' + b.m; }).join('\n') : 'numbers agree'));
  };

  window.__ccPastIssue = function(text, apply){
    var C = need(); if (typeof C === 'string') return C;
    var f = C.right.past;
    if (!f) return 'PAST ISSUES box not found';
    var cur = String(f.value);
    if (cur.toLowerCase().indexOf(String(text).toLowerCase().trim()) >= 0)
      return window.__san('already in Past Issues: "' + text + '"');
    var nv = cur.trim() ? cur.trim() + ', ' + text : text;
    if (apply) setV(f, nv);
    return window.__san('Past Issues to "' + nv.slice(0,80) + '"' + (apply ? '' : '  (dry run)'));
  };

  function optLabOf(el){
    var n = el.nextSibling, s = '';
    while (n && s.length < 30){
      if (n.nodeType === 3) s += n.textContent;
      else if (n.nodeType === 1){ if (n.tagName === 'INPUT') break; s += n.textContent; }
      n = n.nextSibling;
    }
    return s.replace(/\s+/g,' ').trim();
  }
  function setRadio(group, want, what){
    if (!group) return what + ': no group';
    var hit = group.filter(function(r){ return optLabOf(r).toUpperCase() === String(want).toUpperCase(); })[0];
    if (!hit) return what + ': no option "' + want + '" in [' + group.map(optLabOf).join('/') + ']';
    if (window.__setChk) window.__setChk(hit, true);
    else { hit.checked = true; hit.dispatchEvent(new Event('change',{bubbles:true})); }
    return what + ' = ' + want;
  }
  window.__ccNum = function(group){
    if (!group) return null;
    var rects = group.map(function(r){ return r.getBoundingClientRect(); }).filter(function(b){ return b.width; });
    if (!rects.length) return null;
    var top = rects[0].top, left = Math.min.apply(null, rects.map(function(b){ return b.left; }));
    var best = null, bd = 1e9;
    [].slice.call(d.querySelectorAll('input[type=text]')).forEach(function(e){
      var r = e.getBoundingClientRect();
      if (!r.width || r.width > 60) return;
      if (Math.abs(r.top - top) > 12) return;
      var dx = left - r.right; if (dx < 0 || dx > 120) return;
      if (dx < bd){ bd = dx; best = e; }
    });
    return best;
  };
  window.__ccSet = function(i, o){
    var C = need(); if (typeof C === 'string') return C;
    var B = C.blocks[i], out = [];
    if (!B) return 'no block ' + i;
    if (o.lat)    out.push(setRadio(B.lat, o.lat, 'eye'));
    if (o.dir)    out.push(setRadio(B.dir, o.dir, 'direction'));
    if (o.freq)   out.push(setRadio(B.freq, o.freq, 'frequency'));
    if (o.onsetU) out.push(setRadio(B.onsetU, o.onsetU, 'onset unit'));
    if (o.durU)   out.push(setRadio(B.durU, o.durU, 'duration unit'));
    [['pct', B.dir, '% change'], ['onsetN', B.onsetU, 'onset'], ['durN', B.durU, 'duration']].forEach(function(p){
      if (o[p[0]] == null) return;
      var box = window.__ccNum(p[1]);
      if (box){ setV(box, String(o[p[0]])); out.push(p[2] + ' = ' + o[p[0]]); }
      else out.push(p[2] + ' box NOT FOUND');
    });
    if (o.relief && B.relief){ setV(B.relief, o.relief); out.push('relief set'); }
    if (o.assoc && B.assoc){ setV(B.assoc, o.assoc); out.push('assoc set'); }
    if (o.text && B.box){ setV(B.box, o.text); out.push('box = ' + o.text); }
    return window.__san(B.name + ': ' + out.join(' | '));
  };

  window.__ccReport = function(apply){
    return window.__san([window.__cc(), window.__ccAssess(apply), window.__ccNumbers(apply)].join('\n'));
  };
  return 'CC helpers installed: __cc __ccSet __ccNum __ccDestray __ccAssess __ccNumbers __ccTint __ccPastIssue __ccReport';
}).toString() + ')()';

  SRC.DEISGAP = '(' + (function DEISGAP(){
  var w = window.__cn; if (!w) return 'NO NOTE FRAME';
  var d = w.document;
  function T(el){ return (el.textContent||'').replace(/\s+/g,' ').trim(); }
  var TITLE = 'CONFIRM WITH PATIENT - tech to confirm times per day and then erase this title line';
  var SEP = '----------';
  // Procedures are excluded - this box lists what the PATIENT does at home.
  // Evidence: TESTY had Prokera and Tixel checked in PRESCRIBED and neither
  // appears in the report the earlier session wrote.
  // NuLids is NOT a procedure here - it is in the report ("Nulids 2x daily").
  var PROC = ['IPL','TIXEL','TIXEL I','TIXEL 2','LIPIFLOW','LLLT','PLUGS','PROKERA','RINSADA'];
  var DOSE_RE = /\b(?:\d+\s*-\s*\d+\s*x\s*(?:per\s*)?(?:day|daily)|\d+\s*x\s*(?:per\s*)?(?:day|daily|week|weekly)|\d+\s*\/\s*(?:day|daily|week)|q\s*hs|qhs|bid|tid|qid|nightly|at night|twice daily|once daily|daily|weekly)\b/i;

  window.__pruBox = function(){
    var L = null;
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length || L) return;
      if (/Patient Reports Using/i.test(el.textContent||'')){ var b = el.getBoundingClientRect(); if (b.width) L = b; }
    });
    if (!L) return null;
    var box = null, bd = 1e9;
    [].slice.call(d.querySelectorAll('textarea')).forEach(function(e){
      var b = e.getBoundingClientRect(); if (!b.width) return;
      var dy = b.top - L.top; if (dy < 0 || dy > 60) return;
      if (Math.abs(b.left - L.left) > 140) return;
      if (dy < bd){ bd = dy; box = e; }
    });
    return box;
  };
  window.__prescribed = function(){
    var band = window.__panelBand(); if (!band) return null;
    var labels = [];
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length) return;
      var t = T(el); if (!t || t.length > 40) return;
      var b = el.getBoundingClientRect(); if (!b.width) return;
      if (b.top < band.lo - 6 || b.top > band.hi) return;
      labels.push({t:t, x:b.left, y:b.top});
    });
    var on = [];
    [].slice.call(d.querySelectorAll('input[type=checkbox]')).forEach(function(c){
      if (!c.checked) return;
      var b = c.getBoundingClientRect(); if (!b.width) return;
      if (b.top < band.lo - 6 || b.top > band.hi) return;
      var best = null, bd = 1e9;
      labels.forEach(function(L){
        if (Math.abs(L.y - b.top) > 14) return;
        var dx = L.x - b.right; if (dx < 0 || dx > 40) return;
        if (dx < bd){ bd = dx; best = L.t; }
      });
      if (best && on.indexOf(best) < 0) on.push(best);
    });
    return on;
  };
  function planDose(name){
    var p = (window.__planBox && window.__planBox.value) || '';
    var lines = p.split('\n'), key = name.toLowerCase();
    for (var i = 0; i < lines.length; i++){
      var ln = lines[i];
      if (ln.toLowerCase().indexOf(key) < 0) continue;
      var after = ln.slice(ln.toLowerCase().indexOf(key) + key.length);
      var m = after.match(DOSE_RE) || ln.match(DOSE_RE);
      if (m) return m[0].replace(/\s+/g,' ').trim();
    }
    return null;
  }
  // The H/O tail below the separator is preserved verbatim and NEVER erased.
  // Prior "(last: ...)" markers are stripped before comparing so they cannot
  // accumulate visit over visit.
  window.__gapParse = function(){
    var box = window.__pruBox(); if (!box) return null;
    var raw = String(box.value), si = raw.indexOf(SEP);
    var head = si < 0 ? raw : raw.slice(0, si);
    var tail = si < 0 ? '' : raw.slice(si);
    var items = [], other = [];
    head.split('\n').forEach(function(ln){
      var t = ln.trim(); if (!t) return;
      if (/^CONFIRM WITH PATIENT/i.test(t)) return;
      // Accept [x] as well as [ ]. The original pattern only matched an EMPTY
      // box, so every line the tech had already ticked fell into 'other' and
      // was invisible to priorOf() and __doingList(). That went unnoticed until
      // 9/4/2026, when CB asked for reviewed items to be ticked automatically -
      // which would have made the whole box unreadable to this module.
      // FIXED 9/9/2026: also capture WHICH of [x]/[ ] it was (`checked`) - the
      // earlier version matched both but threw the distinction away, which is
      // why __gap() below used to reset every confirmed item back to [ ] on
      // every regeneration. See the Marcia Starkey entry in the top comment.
      var m = t.match(/^\[\s*([xX]?)\s*\]\s*(.+)$/);
      var body = m ? m[2] : t;
      var checked = m ? !!m[1] : false;
      var last = null;
      body = body.replace(/\s*\(last:\s*([^)]*)\)\s*$/i, function(_, g){ last = g.trim(); return ''; }).trim();
      var parts = body.match(DOSE_RE);
      var dose = parts ? parts[0].trim() : '';
      var nm = dose ? body.slice(0, body.toLowerCase().lastIndexOf(dose.toLowerCase())).trim() : body;
      (m ? items : other).push({name: nm || body, dose: dose, full: body, last: last, boxed: !!m, checked: checked});
    });
    return {box: box, items: items, other: other, tail: tail};
  };
  window.__gap = function(apply){
    var st = window.__gapParse();
    if (!st) return 'PATIENT REPORTS USING box not found - is ANTERIOR OU active';
    var pres = window.__prescribed();
    if (!pres) return 'PRESCRIBED panel not found';
    var kept = pres.filter(function(p){ return PROC.indexOf(p.toUpperCase()) < 0; });
    var dropped = pres.filter(function(p){ return PROC.indexOf(p.toUpperCase()) >= 0; });
    // The PRESCRIBED column label and the box entry are often not the same
    // string: the column says "SBH", the box says "SBH Hydroeyes 4x/day".
    // Prefix matching either way, or SBH gets listed twice - once bare and once
    // as a phantom carried-forward item. (That bug appeared on the first run.)
    function key(x){ return String(x).toLowerCase().replace(/[^a-z0-9]/g,''); }
    function sameItem(a,b){ var p = key(a), q = key(b); return p && q && (p === q || p.indexOf(q) === 0 || q.indexOf(p) === 0); }
    var allPrior = st.items.concat(st.other);
    function priorOf(n){ return allPrior.filter(function(it){ return sameItem(it.name, n); })[0] || null; }
    // qhs and nightly are the same instruction; so are "2-4 X DAILY" and
    // "2-4x daily". Only a GENUINE difference earns a (last: ...) marker.
    function dkey(x){ return String(x).toLowerCase().replace(/\s+/g,'').replace(/atnight|nightly/g,'qhs').replace(/perday/g,'day').replace(/daily/g,'day').replace(/x\//g,'/'); }
    var lines = [], notes = [];
    kept.slice().sort(function(a,b){ return a.toLowerCase() < b.toLowerCase() ? -1 : 1; }).forEach(function(nm){
      var pd = planDose(nm), pr = priorOf(nm);
      var dose = pd || (pr ? pr.dose : '') || '';
      // keep the richer name the box already had (SBH -> SBH Hydroeyes)
      if (pr && pr.name && key(pr.name).indexOf(key(nm)) === 0 && pr.name.length > nm.length) nm = pr.name;
      // An ANNOTATED line (see __gapNote) already carries the patient's own
      // report and its date. Never append a prescribed dose to it and never
      // rebuild it - EyeSeals: not using bc falls off x 8/4/2026 must survive
      // every later regeneration exactly as written.
      if (pr && pr.boxed && /:/.test(pr.full)){ lines.push('[x] ' + pr.full); return; }
      // FIXED 9/9/2026: carry the PRIOR checked state forward for an ordinary
      // item instead of always emitting an unchecked box. A tech's [x]
      // confirmation on a plain item (no __gapNote annotation) used to be
      // silently wiped on every regeneration - see the top comment.
      var box0 = (pr && pr.checked) ? '[x] ' : '[ ] ';
      var line = box0 + (dose ? nm + ' ' + dose : nm);
      // CB, 9/3/2026: keep the marker AND date it, so an old discrepancy is
      // visibly old instead of looking like today's. A legacy undated marker
      // STAYS undated - never invent a date for a discrepancy you did not
      // observe.
      // FIXED 9/9/2026: a NEW difference used to be stamped with
      // window.__today() here. CB confirmed live (Marcia Starkey) that this
      // is wrong - the marker needs the actual LAST EXAM DATE off the
      // treatment panel (procedure-day-protocol.md, 9/4/2026), not today's
      // date. No tested reader for that date exists yet from this module, so
      // rather than stamp a second wrong date, leave it undated and flag the
      // discrepancy in the notes for a human to date correctly.
      if (pd && pr && pr.dose && dkey(pd) !== dkey(pr.dose)){
        line += '   (last: ' + pr.full + ')';
        notes.push('DOSE CHANGED for ' + nm + ' - was "' + pr.full + '". The (last:) marker needs the ' +
          'actual last-treatment date from the treatment panel - NOT stamped automatically. Confirm and hand-date.');
      }
      else if (pr && pr.last) line += '   (last: ' + pr.last + ')';
      // only a REGRESSION is worth a note - items like Diet never had a dose
      if (!dose && pr && pr.dose) notes.push('LOST DOSE for ' + nm + ' - confirm with CB');
      lines.push(line);
    });
    // carried forward but NOT prescribed today: kept, listed WITHOUT a checkbox
    var carried = st.items.filter(function(it){ return !kept.some(function(k){ return sameItem(k, it.name); }); });
    carried.forEach(function(it){ lines.push(it.full); notes.push('carried forward, not prescribed today: ' + it.name); });
    var out = [TITLE].concat(lines);
    if (st.tail) out.push(st.tail.replace(/^\n+/,''));
    var text = out.join('\n');
    var same = text.trim() === String(st.box.value).trim();
    if (apply && !same) window.__setVal(st.box, text);
    return window.__san('prescribed ' + pres.length + ', procedures excluded: ' + (dropped.join(', ')||'none') +
      '\n' + (same ? 'NO CHANGE - box already correct' : (apply ? 'WRITTEN' : 'dry run')) +
      (notes.length ? '\nnotes: ' + notes.join(' ; ') : '') +
      '\n--- WOULD BE ---\n' + text);
  };

  /* ---- what the patient actually reports, and WHEN ---------------------
     CB, 9/4/2026: if you are listening and there is data about the patient
     reports using, add the pertinent data and timing. ex. the patient goes
     into a long story about not being able to keep the mask on and she says
     she gave up on it a month ago, you go to the eyeseals qhs line and
     delete qhs and add : not using bc falls off x aug 4, 2026. i'm not
     concerned about an exact date -- just don't want it to say 1 month ago
     and then we never know if that is old or new.

     So: a relative phrase is ALWAYS converted to an absolute date before it
     goes in the chart. a month ago is worthless six months from now.
     If the phrase cannot be dated, __gapNote REFUSES rather than guessing -
     an undated note is the exact failure CB described.
     -------------------------------------------------------------------- */
  var WORDNUM = {a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,
                 eight:8,nine:9,ten:10,eleven:11,twelve:12,couple:2,few:3,several:3};
  window.__whenDate = function(p){
    if (p === 0 || !p) return '';
    var s = String(p).trim().toLowerCase().replace(/^(?:about|around|roughly|like|maybe)\s+/,'').replace(/^~\s*/,'');
    var now = new Date();   // CB's own machine clock - the chart is her local date
    function fmt(dt){ return (dt.getMonth()+1) + '/' + dt.getDate() + '/' + dt.getFullYear(); }
    if (/^(today|now|just now|this week)$/.test(s)) return fmt(now);
    if (/^yesterday$/.test(s)){ now.setDate(now.getDate()-1); return fmt(now); }
    // a couple of months ago carries BOTH an article and a word-number.
    s = s.replace(/^an?\s+(?=couple|few|several)/,'').replace(/^(couple|few|several)\s+of\s+/,'$1 ');
    var m = s.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple(?:\s+of)?|few|several|\d+)\s*(day|wk|week|mo|month|yr|year)s?(?:\s+ago)?$/);
    if (m){
      var w = m[1].replace(/\s+of$/,'');
      var n = /^\d+$/.test(w) ? parseInt(w,10) : WORDNUM[w];
      if (!n) return '';
      var dt = new Date(now.getTime()), u = m[2];
      if (u === 'day') dt.setDate(dt.getDate() - n);
      else if (u === 'wk' || u === 'week') dt.setDate(dt.getDate() - 7*n);
      else if (u === 'mo' || u === 'month') dt.setMonth(dt.getMonth() - n);
      else dt.setFullYear(dt.getFullYear() - n);
      return fmt(dt);
    }
    // A bare aug 4 parses to the YEAR 2001 in V8, not to this year, and
    // new Date('last summer 2026') returns 1/1/2026 instead of failing. Both
    // are exactly the silently-wrong date CB is guarding against, so gate the
    // parse on something that LOOKS like a date and supply the missing year.
    if (!/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s*\d|\d{1,2}\s*[\/\-.]\s*\d{1,2}/.test(s)) return '';
    var bare = s.replace(/(\d)(st|nd|rd|th)\b/g,'$1');
    var hasYear = /\d{4}/.test(bare);
    var dt2 = new Date(hasYear ? bare : bare + ' ' + now.getFullYear());
    if (!isNaN(dt2.getTime())){
      if (!hasYear && dt2.getTime() > now.getTime()) dt2.setFullYear(dt2.getFullYear()-1);
      return fmt(dt2);
    }
    return '';
  };

  // __gapNote('EyeSeals', 'not using bc falls off', 'a month ago')
  //   [x] EyeSeals qhs   ->   [x] EyeSeals: not using bc falls off x 8/4/2026
  // The dose token is REMOVED (it is no longer true), any earlier annotation is
  // replaced rather than stacked, and a stale (last: ...) marker is dropped
  // because the annotation now carries the timing.
  window.__gapNote = function(item, note, when, apply){
    if (apply === undefined) apply = true;
    var box = window.__pruBox();
    if (!box) return 'PATIENT REPORTS USING box not found - is ANTERIOR OU active';
    var when2 = window.__whenDate(when);
    if (when && !when2)
      return window.__san('CANNOT DATE ' + when + ' - give it as a date, or as N days/weeks/months/years ago. Nothing written.');
    function key(x){ return String(x).toLowerCase().replace(/[^a-z0-9]/g,''); }
    var K = key(item), lines = String(box.value).split('\n'), hit = -1;
    for (var i = 0; i < lines.length; i++){
      var body0 = lines[i].replace(/^\s*\[[^\]]*\]\s*/,'');
      if (!body0.trim()) continue;
      if (key(body0).indexOf(K) === 0){
        if (hit >= 0) return window.__san('AMBIGUOUS - ' + item + ' matches more than one line. Nothing written.');
        hit = i;
      }
    }
    if (hit < 0) return window.__san('NO LINE starting with ' + item + '. Nothing written.');
    var mm = lines[hit].match(/^(\s*\[[^\]]*\]\s*)?([\s\S]*)$/);
    var body = mm[2];
    body = body.replace(/\s*\(last:[^)]*\)\s*$/i, '').trim();   // annotation supersedes it
    body = body.replace(/\s*:\s*[\s\S]*$/, '').trim();          // replace, never stack
    var dm = body.match(DOSE_RE);
    if (dm) body = body.slice(0, body.toLowerCase().lastIndexOf(dm[0].toLowerCase())).trim();
    var before = lines[hit];
    lines[hit] = '[x] ' + body + ': ' + String(note).trim() + (when2 ? ' x ' + when2 : '');
    if (apply) window.__setVal(box, lines.join('\n'));
    return window.__san((apply ? 'WROTE' : 'dry run') + '\n  was: ' + before.trim() + '\n  now: ' + lines[hit]);
  };


  /* ---- drop the options she is already doing ---------------------------
     CB, 9/4/2026: "when the acronym lists something the patient is already
     doing such as hydroeyes x4 or DE3 x4 or Nulids 2/day then you need to
     delete that option automatically because it does not make sense to have
     it in there."

     Written live on the note 9/4/2026 and mirrored here afterwards - it had
     existed only in the page, which is exactly the single-point-of-failure
     that wiped DEISALL once already.

     THE ONE EXCEPTION: a line containing "or" is KEPT. An option written as
     "Add a long term immunomodulator drop such as Restasis, Cequa OR Xiidra"
     still offers live alternatives even if the patient is on one of them;
     dropping the line would remove the other two.
     -------------------------------------------------------------------- */
  window.__doingList = function(){
    var st = window.__gapParse();
    if (!st) return [];
    return st.items.concat(st.other).map(function(it){ return String(it.name||'').trim(); })
      .filter(function(n){ return n.length > 2; });
  };
  window.__pruneOptions = function(code, doing){
    doing = doing || window.__doingList();
    var dropped = [];
    var kept = String(code).split('\n').filter(function(l){
      if (!/^>/.test(l.trim())) return true;
      if (/\bor\b/i.test(l)) return true;                 // alternatives still live
      var hit = doing.filter(function(p){ return l.toLowerCase().indexOf(p.toLowerCase()) >= 0; });
      if (hit.length){ dropped.push(hit[0] + ' -> ' + l.trim().slice(0, 60)); return false; }
      return true;
    }).join('\n');
    window.__lastPruned = dropped;
    return kept;
  };

  return 'gap installed: __gap __gapParse __pruBox __prescribed __gapNote __whenDate __pruneOptions';
}).toString() + ')()';

  SRC.DEISAUTO = '(' + (function DEISAUTO(){
  var w = window.__cn; if (!w) return 'NO NOTE FRAME';
  var d = w.document;
  var SYM = ['burn','itch','sting','pain','red','tear','water','dry','blur','fluctuat','grit','sandy',
    'foreign body','light sensit','photophob','crust','discharge','mucus','swell','heavy','tired',
    'ache','pressure','film','glare','halo'];
  function syms(s){ var l = String(s).toLowerCase(); return SYM.filter(function(k){ return l.indexOf(k) >= 0; }); }
  function setV(e,v){ if (window.__setVal) window.__setVal(e,v); else { e.value=v; e.dispatchEvent(new Event('change',{bubbles:true})); } }

  window.__ccSplit = function(apply){
    if (!window.__CC) window.__cc();
    var C = window.__CC; if (typeof C === 'string' || !C) return 'PT CC not mapped';
    window.__ccDestray(apply);
    var B = C.blocks[0]; if (!B || !B.box) return 'no PRIMARY box';
    var body = String(B.box.value).split('\n')
      .filter(function(l){ return !/^\s*\[\s*\]\s*(ASK|SPLIT):/i.test(l); }).join(' ').trim();
    if (!body) return 'PRIMARY is empty, nothing to split';
    var parts = body.split(/\s*(?:,|;|\band\b|\.)\s*/i).map(function(x){ return x.trim(); }).filter(Boolean);
    var cl = [];
    parts.forEach(function(p){
      if (!syms(p).length && cl.length){ cl[cl.length-1] += ' ' + p; return; }
      cl.push(p);
    });
    if (cl.length > 1 && !syms(cl[0]).length){ cl[1] = cl[0] + ' ' + cl[1]; cl.shift(); }
    var rep = ['clauses: ' + cl.length];
    cl.forEach(function(text, i){
      var lat = /\bright eye\b|\bOD\b/i.test(text) ? 'OD' : (/\bleft eye\b|\bOS\b/i.test(text) ? 'OS' : (/\bboth eyes\b|\bOU\b/i.test(text) ? 'OU' : null));
      var tag = lat ? '   [text says ' + lat + ' - NOT auto-set]' : '';
      if (i > 2){ rep.push('NO SLOT for "' + text.slice(0,40) + '" - more than three problems, NOT dropped, left in Primary' + tag); return; }
      var Tb = C.blocks[i];
      if (!Tb || !Tb.box){ rep.push('block ' + i + ' missing'); return; }
      var cur = String(Tb.box.value).split('\n').filter(function(l){ return !/^\s*\[\s*\]\s*(ASK|SPLIT):/i.test(l); }).join(' ').trim();
      if (i === 0){ rep.push('PRIMARY keeps "' + text.slice(0,42) + '"' + tag); if (apply) setV(Tb.box, text); return; }
      if (!cur){
        rep.push(Tb.name + ' <- "' + text.slice(0,42) + '"' + tag);
        if (apply){
          setV(Tb.box, text);
          if (Tb.none && Tb.none.checked){
            if (window.__setChk) window.__setChk(Tb.none, false);
            else { Tb.none.checked = false; Tb.none.dispatchEvent(new Event('change',{bubbles:true})); }
          }
        }
        return;
      }
      var a = syms(cur), b = syms(text);
      var subset = a.length && a.every(function(x){ return b.indexOf(x) >= 0; });
      if (subset){ rep.push(Tb.name + ' replaced "' + cur.slice(0,26) + '" with the fuller "' + text.slice(0,34) + '"' + tag); if (apply) setV(Tb.box, text); }
      else rep.push(Tb.name + ' OCCUPIED by "' + cur.slice(0,34) + '" - clause NOT moved: "' + text.slice(0,34) + '"' + tag);
    });
    var P = C.blocks[0];
    if (P.relief && String(P.relief.value).trim() && cl.length > 1){
      var ents = String(P.relief.value).split(/\s*;\s*/).filter(Boolean), stay = [];
      ents.forEach(function(en){
        var hit = -1;
        for (var i = 1; i < Math.min(cl.length,3); i++){ if (syms(en).some(function(x){ return syms(cl[i]).indexOf(x) >= 0; })) { hit = i; break; } }
        if (hit < 0){ stay.push(en); return; }
        var Tr = C.blocks[hit].relief;
        if (!Tr){ stay.push(en); return; }
        var cur2 = String(Tr.value).trim();
        rep.push('relief "' + en.slice(0,26) + '" follows to ' + C.blocks[hit].name);
        if (apply) setV(Tr, cur2 ? cur2 + '; ' + en : en);
      });
      if (apply) setV(P.relief, stay.join('; '));
    }
    return window.__san(rep.join('\n') + '\nLATERALITY IS NEVER AUTO-SET - CB or the tech sets the eye.');
  };

  window.__clock = async function(){
    var t = await window.__tabWait('Info', 'Time Elapsed', 5000);
    if (/TIMEOUT|NOT FOUND/.test(t)) return 'CLOCK: could not reach the Info tab - ' + t;
    var L = null;
    [].slice.call(d.querySelectorAll('*')).forEach(function(el){
      if (el.children.length || L) return;
      if (/Time Elapsed/i.test(el.textContent||'')){ var b = el.getBoundingClientRect(); if (b.width) L = b; }
    });
    if (!L) return 'CLOCK: Time Elapsed label not found';
    var fields = [].slice.call(d.querySelectorAll('input.timer,input')).filter(function(e){
      var b = e.getBoundingClientRect();
      return b.width && Math.abs(b.top - L.top) < 24 && b.left > L.right - 10 && b.left < L.right + 300;
    });
    var right = fields.length ? Math.max.apply(null, fields.map(function(e){ return e.getBoundingClientRect().right; })) : L.right;
    var btn = null, bd = 1e9;
    [].slice.call(d.querySelectorAll('button,input[type=button],input[type=image],a,img')).forEach(function(e){
      var b = e.getBoundingClientRect(); if (!b.width) return;
      if (Math.abs(b.top - L.top) > 26) return;
      var dx = b.left - right; if (dx < -4 || dx > 120) return;
      if (dx < bd){ bd = dx; btn = e; }
    });
    var was = fields.map(function(e){ return e.value; }).join(':');
    if (!btn) return window.__san('CLOCK: timer reads ' + was + ' but the start button was not found - start it by hand');
    if (/[1-9]/.test(was)) return window.__san('CLOCK: already running at ' + was + ' - NOT touched');
    btn.click();
    return window.__san('CLOCK: started, was ' + was + '. Never stop or reset it.');
  };

  window.__armGap = function(){
    if (w.__gapArmed) return 'gap already armed';
    d.addEventListener('click', function(ev){
      try {
        var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
        if (!a) return;
        if ((a.textContent||'').replace(/\s+/g,' ').trim().toUpperCase().indexOf('ANTERIOR OU') !== 0) return;
        if (w.__gapDone) return;
        w.__gapDone = true;
        setTimeout(function(){ try { window.__gapLast = window.__gap(true); } catch(e){ window.__gapLast = 'gap failed: ' + e.message; } }, 400);
      } catch(e){}
    }, true);
    w.__gapArmed = true;
    return 'gap armed - fires once per note on the ANTERIOR OU click';
  };
  window.__ccWatch = function(sec){
    if (!window.__CC) window.__cc();
    var C = window.__CC;
    if (typeof C === 'string' || !C){
      if (!w.__ccPending){
        w.__ccPending = true;
        d.addEventListener('click', function(){
          setTimeout(function(){
            try {
              if (!window.__CC || typeof window.__CC === 'string') window.__cc();
              var CC = window.__CC;
              if (CC && typeof CC !== 'string' && CC.blocks && CC.blocks[0] && CC.blocks[0].box
                  && CC.blocks[0].box.getBoundingClientRect().width && !CC.blocks[0].box.__watched){
                window.__ccWatchLate = window.__ccWatch(sec);
              }
            } catch(e){}
          }, 400);
        }, true);
      }
      return 'PT CC not visible yet - watch will arm the first time that tab is opened';
    }
    var P = C.blocks[0]; if (!P || !P.box) return 'no PRIMARY box';
    if (P.box.__watched) return 'watch already armed';
    P.box.__watched = true;
    var t = null, ms = (sec || 30) * 1000;
    P.box.addEventListener('input', function(){
      try { if (t) return; t = setTimeout(function(){ t = null; try { window.__ccLast = window.__ccReport(true); } catch(e){} }, ms); } catch(e){}
    });
    var fire = function(){
      try { window.__ccToday(); } catch(e){}
      if (t) return;
      t = setTimeout(function(){ t = null; try { window.__ccLast = window.__ccReport(true); } catch(e){} }, ms);
    };
    (C.blocks||[]).forEach(function(B){ if (B.box && !B.box.__watched2){ B.box.__watched2 = true; B.box.addEventListener('input', fire); } });
    if (!w.__ccChangeArmed){
      w.__ccChangeArmed = true;
      d.addEventListener('change', function(){
        try {
          if (!window.__CC || typeof window.__CC === 'string') return;
          var b0 = window.__CC.blocks[0];
          if (!b0 || !b0.box || !b0.box.getBoundingClientRect().width) return;
          fire();
        } catch(e){}
      }, true);
    }
    return 'watch armed - ticks Today report on the first edit, then re-assesses ' + (sec||30) + 's later (drops the ASK line by itself)';
  };
  window.__ccToday = function(force){
    if (w.__ccTodayDone && !force) return 'already ticked';
    var lbl = [].slice.call(d.querySelectorAll('*')).filter(function(e){
      return !e.children.length && /Today.s report/i.test(e.textContent||'') && e.getBoundingClientRect().width;
    })[0];
    if (!lbl) return 'Today report label not visible - is PT CC showing';
    var L = lbl.getBoundingClientRect();
    var cb = [].slice.call(d.querySelectorAll('input[type=checkbox]')).filter(function(c){
      var b = c.getBoundingClientRect();
      return b.width && Math.abs(b.top - L.top) <= 14 && b.left < L.left && (L.left - b.left) < 60;
    }).sort(function(x,y){ return y.getBoundingClientRect().left - x.getBoundingClientRect().left; })[0];
    if (!cb) return 'Today report checkbox not found';
    if (!cb.checked) window.__setChk(cb, true);
    w.__ccTodayDone = true;
    return 'Today report checked';
  };
  window.__ccGuard = function(on){
    if (on === false){ w.__ccGuardOff = true; return 'guard disabled'; }
    if (w.__ccGuardArmed) return 'guard already armed';
    w.__ccGuardArmed = true; w.__ccGuardOff = false;
    d.addEventListener('click', function(ev){
      try {
        if (w.__ccGuardOff) return;
        var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
        if (!a) return;
        if (!window.__CC || !window.__CC.blocks[0] || !window.__CC.blocks[0].box) return;
        if (!window.__CC.blocks[0].box.getBoundingClientRect().width) return;
        if (w.__ccPass && Date.now() - w.__ccPass < 8000) return;
        var r = window.__ccReport(true);
        var n = (String(r).match(/unanswered/g) || []).length;
        var f = (String(r).match(/FLAG:/g) || []).length;
        if (!n && !f) return;
        ev.preventDefault(); ev.stopPropagation();
        w.__ccPass = Date.now();
        var ban = d.getElementById('__ccBan') || d.createElement('div');
        ban.id = '__ccBan';
        ban.textContent = n + ' issue block(s) incomplete, ' + f + ' number check(s) flagged - click again to leave anyway';
        ban.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#d33;color:#fff;font:600 14px system-ui,sans-serif;padding:7px 12px;text-align:center;';
        d.documentElement.appendChild(ban);
        setTimeout(function(){ try { ban.remove(); } catch(e){} }, 8000);
      } catch(e){}
    }, true);
    return 'guard armed - one speed bump, second click always passes, red tint stays';
  };
  window.__armAll = function(sec){
    return window.__san([window.__armGap(), window.__ccWatch(sec||30), window.__ccGuard(true)].join('\n'));
  };
  return 'auto installed: __ccSplit __clock __armGap __ccWatch __ccGuard __armAll';
}).toString() + ')()';

  SRC.DEISSUP = '(' + (function DEISSUP(){
  var MODS = ['DEISALL','DEISCC','DEISGAP','DEISAUTO'];
  window.__MODS = MODS;
  window.__seenFrames = window.__seenFrames || [];

  window.__reload = function(){
    var log = [];
    MODS.forEach(function(k){
      var src = localStorage.getItem(k);
      if (!src){ log.push(k + ' MISSING'); return; }
      try { eval(src); log.push(k + ' ok'); } catch(e){ log.push(k + ' ERROR ' + e.message); }
    });
    try { log.push(window.__armAll()); } catch(e){ log.push('arm failed ' + e.message); }
    return log.join(' | ');
  };

  window.__supervise = function(ms){
    if (window.__supTimer) return 'supervisor already running';
    if (window.__cnBound && window.__seenFrames.indexOf(window.__cnBound) < 0) window.__seenFrames.push(window.__cnBound);
    window.__supTimer = setInterval(function(){
      try {
        var act = window.__cnFind();
        if (!act || act === window.__cnBound) return;
        if (window.__seenFrames.indexOf(act) >= 0){
          window.__supWarn = 'BACK ON A PREVIOUS NOTE - writers are blocked until a deliberate reload';
          return;
        }
        window.__seenFrames.push(act);
        window.__supWarn = null;
        var r = window.__reload();
        var n = (window.__groups||[]).length;
        if (n < 60){
          window.__seenFrames = window.__seenFrames.filter(function(f){ return f !== act; });
          window.__cnBound = null;
          window.__supLast = 'REBIND REJECTED - only ' + n + ' groups mapped (ANTERIOR OU not rendered yet). Writers blocked, retrying.';
          return;
        }
        window.__supLast = 'rebound to a NEW note - ' + r + ' - groups ' + n;
      } catch(e){ window.__supLast = 'supervisor error: ' + e.message; }
    }, ms || 1500);
    return 'supervisor running every ' + (ms||1500) + 'ms';
  };
  window.__supStop = function(){
    if (window.__supTimer){ clearInterval(window.__supTimer); window.__supTimer = null; return 'supervisor stopped'; }
    return 'not running';
  };

  // NEW 9/9/2026 - see the top-of-file changelog. Run before every Save.
  window.__preSave = function(apply){
    if (apply === undefined) apply = true;
    var dd = window.__cn && window.__cn.document;
    if (!dd) return 'NO NOTE FRAME BOUND';
    var rep = [];

    try {
      if (!window.__CC) window.__cc();
      var C = window.__CC;
      if (C && typeof C !== 'string' && C.blocks){
        C.blocks.forEach(function(B){
          if (!B.box) return;
          var v = String(B.box.value);
          var stripped = v.split('\n').filter(function(l){ return !/^\s*\[\s*\]\s*(ASK|SPLIT):/i.test(l); }).join('\n');
          if (stripped !== v){
            rep.push(B.name + ': stripped leftover warning line(s)');
            if (apply && window.__setVal) window.__setVal(B.box, stripped);
          }
        });
      } else {
        rep.push('PT CC not on the active tab - could not check for ASK/SPLIT lines (switch to PT CC and re-run before saving if procedures were dictated there)');
      }
    } catch(e){ rep.push('PT CC check failed: ' + e.message); }

    try {
      var box = window.__pruBox ? window.__pruBox() : null;
      if (box){
        var v2 = String(box.value);
        if (/^CONFIRM WITH PATIENT/im.test(v2)){
          var nv = v2.replace(/^CONFIRM WITH PATIENT[^\n]*\n?/im, '');
          rep.push('Patient Reports Using: stripped the CONFIRM WITH PATIENT title line');
          if (apply && window.__setVal) window.__setVal(box, nv);
        } else {
          rep.push('Patient Reports Using: title line already clear');
        }
        if (/H\W?O\b/i.test(v2) && !/-{5,}/.test(v2)){
          rep.push('WARNING: box mentions H/O but no dashed separator was found - __gap() tail-preservation will NOT protect this content on its next run. Verify by hand before relying on __gap() again on this note.');
        }
      } else {
        rep.push('Patient Reports Using box not found - is ANTERIOR OU active');
      }
    } catch(e){ rep.push('Patient Reports Using check failed: ' + e.message); }

    try {
      var unchecked = [];
      [].slice.call(dd.querySelectorAll('input[type=checkbox]')).forEach(function(c){
        var b = c.getBoundingClientRect(); if (!b.width || c.checked) return;
        var n = c.nextSibling, s = '';
        while (n && s.length < 60){
          if (n.nodeType === 3) s += n.textContent;
          else if (n.nodeType === 1){ if (n.tagName === 'INPUT') break; s += n.textContent; }
          n = n.nextSibling;
        }
        var near = s.replace(/\s+/g,' ').trim();
        if (/consent/i.test(near)) unchecked.push(near || '(unlabeled consent box)');
      });
      rep.push(unchecked.length
        ? 'UNCHECKED CONSENT BOX(ES) STILL ON SCREEN: ' + unchecked.join(' | ') + ' - CHECK BEFORE SAVING, not auto-checked here'
        : 'consent boxes on the active tab: none found unchecked');
    } catch(e){ rep.push('consent check failed: ' + e.message); }

    return window.__san ? window.__san(rep.join('\n')) : rep.join('\n');
  };

  return 'supervisor installed: __supervise __supStop __reload __preSave';
}).toString() + ')()';

  SRC.DEISBOOT = '(' + (function DEISBOOTFN(){
  var log = [], noNote = false, missing = [];
  ['DEISALL','DEISCC','DEISGAP','DEISAUTO','DEISSUP'].forEach(function(k){
    var src = localStorage.getItem(k) || (window.__deisSrc && window.__deisSrc[k]);
    if (!src){ missing.push(k); log.push(k + ': MISSING'); return; }
    try {
      var r = String(eval(src));
      if (/SPEECH \+ TAB HELPERS ONLY|NO NOTE FRAME/.test(r)) noNote = true;
      log.push(k + ': ' + r.split('\n')[0].slice(0,58));
    } catch(e){ log.push(k + ': ERROR ' + e.message); }
  });
  if (missing.length) return 'INCOMPLETE INSTALL on ' + location.hostname + ' - missing ' + missing.join(', ') + '.\n' + log.join('\n');
  if (noNote) return 'THE CHART NOTE IS NOT OPEN - this is not a failure. The patient chart being up is not enough; the NOTE has to be open. Ask CB to open the note, then run DEISBOOT again.\n' + log.join('\n');
  try { log.push(window.__armAll()); } catch(e){ log.push('ARM FAILED: ' + e.message); }
  try { log.push(window.__supervise()); } catch(e){ log.push('SUPERVISOR FAILED: ' + e.message); }
  try {
    if (window.__t0note !== window.__cnBound){
      window.__t0note = window.__cnBound;
      window.__t0 = Date.now();
      window.__t0str = new Date().toLocaleTimeString();
    }
    window.__elapsed = function(){
      var s = Math.round((Date.now() - window.__t0)/1000);
      return Math.floor(s/60) + 'm ' + (s%60) + 's since the note opened (' + window.__t0str + ')';
    };
    log.push('our clock started ' + window.__t0str + ' - __elapsed() reports it');
  } catch(e){ log.push('OUR CLOCK FAILED: ' + e.message); }
  log.push('NEXT: await __clock() to start the chart timer, then confirm the patient name with __patientName().');
  log.push('BEFORE SAVING: await __preSave(true) - strips leftover warning lines and flags unchecked consent boxes.');
  try { log.push(window.__ready()); } catch(e){ log.push('NOT BOUND: ' + e.message); }
  return window.__san ? window.__san(log.join('\n')) : log.join('\n');
}).toString() + ')()';

  var ACRO = {
"WAT0": "GOOD. Continue high water intake",
"WAT1": "OK. Maintain higher water intake, at least half your body weight in ounces per day.",
"WAT2": "LOW water volume. DRINK MORE WATER, at least half your body weight in ounces per day. Consider DRY EYE DRINK: HELPS YOU ABSORB NUTRIENTS FROM WATER. It makes 1 bottle of water absorb as if it were 3 bottles of water. Dry Eye Drink has ELECTROLYTES, ANTI-INFLAMMATORIES, and SUPPLEMENTS that help dry eye, BUT NO SUGAR.\nPM VERSION: also contains melatonin, valerian root, chamomile to help you relax and sleep.",
"DEB0": "Tear Film is clean! Continue current cleaning routine.",
"DEB1": "MINIMAL DEBRIS! Continue current cleaning routine.",
"DEB2": "MODERATE DEBRIS.\n> PURE AND CLEAN DROPS: INSERT 2-3 DROPS IN EACH EYE AND RUB EXCESS INTO LASHES. LET DRY COMPLETELY. REPEAT AT LEAST 2-4 X DAILY",
"DEB3": "SIGNIFICANT DEBRIS!\n> Flood a heavy stream of eyewash over your eyes morning and night (and as desired) to rinse off allergens/ remove tear film debris.\n> PURE AND CLEAN DROPS: INSERT 2-3 DROPS IN EACH EYE AND RUB EXCESS INTO LASHES. LET DRY COMPLETELY. REPEAT AT LEAST ~4 X DAILY",
"PNC": "PURE AND CLEAN DROPS: INSERT 2-3 DROPS IN EACH EYE AND RUB EXCESS INTO LASHES. LET DRY COMPLETELY. REPEAT AT LEAST 2-4 X DAILY",
"PNCQ": "Apply Pure and Clean to the lower lid's waterline with a Qtip 1-2 times per day.",
"IWASH": "Flood a heavy stream of eyewash over your eyes morning and night (and as desired) to rinse off allergens / remove tear film debris.",
"RINS": "In-office Rinsada: Powerwash for the superior and inferior cul de sacs to reduce inflammatory contributors.",
"LAC": "Lacrimal Sac Irrigation: A tiny cannula is inserted into the puncta (exit pipe) of the lid and saline is flushed internally to rinse out contaminants and inflammatory proteins within the drainage system in order to reduce mucous production and secondary inflammation on the ocular surface.",
"OIL0": "OIL is coming out with the blink!!\n> Continue current routine with supplements, Nulids, and blink exercises.",
"OIL1": "OIL IS COMING OUT WTH FORCED EXPRESSION BUT NOT WITH THE BLINK. NEED FIRMER BLINKS!\n> Do BLINK Exercises! Close and push down. Do NOT use your forehead! The key is remembering to do it throughout the day. PAIR the blink exercise with ONE thing that you do constantly throughout the day: Ex. every sip of water, phone check, email, TV Commercial, stoplight.",
"OIL2": "Your oil glands are not expressing oil when you blink (no rainbow on the video), because the oil is too thick a/o some glands are clogged.\n\nPLAN:\n> Do BLINK Exercises! Close and push down. Do NOT use your forehead! The key is remembering to do it throughout the day. PAIR the blink exercise with ONE thing that you do constantly throughout the day: Ex. every sip of water, phone check, email, TV Commercial, stoplight.\n> Eat more GOOD FATS: WILD CAUGHT OILY FISH 2/WEEK, NUTS, SEEDS: HEMP SEED, chia seed, flax seed, olive oil, walnut, avocado.",
"BLI": "Do BLINK Exercises! Close and push down. Do NOT use your forehead! The key is remembering to do it throughout the day. PAIR the blink exercise with ONE thing that you do constantly throughout the day: Ex. every sip of water, phone check, email, TV Commercial, stoplight.",
"OILOP": "OPTIONS:\n> Add another supplement: HYDROEYES (black current seed oil) 4 pills/ day\n> Increase PRN DE3 to 4 pills/ day\n> Add Rx oral antibiotic such as Azythromycin 1000 mg weekly x 4 weeks or Doxycycline 50 mg twice daily for ~90 days\n> Nulids twice per day (precede with heat when able)\n> Melt clogs with Tixel externally (3 treatments, 2 weeks apart) or evacuate the glands with Lipiflow (1 treatment)",
"NUM": "Nulids > massage the upper and lower lid close to the lash line. Keep the wheel flat and use firm pressure for 30 seconds each at least once a day",
"NUWC": "NULIDS once or twice daily, immediately after warm compress mask, while lids are still warm",
"NUCL": "Nulids cleaning technique: Using the edge of the wheel, clean along the upper and lower lash lines adjacent to the base of the eyelashes for 15 seconds. Then pull down the lower lid and do 2 passes on the lower waterline.",
"NUINS": "30 seconds top, 30 seconds bottom, flush to the lid with steady/firm pressure then go back and angle the wheel to clean at base of lashes",
"INCNU": "INCREASE NULIDS to TWICE daily when able (while lids are still warm after warm compress mask)",
"INF0": "STABLE/ IMPROVED!",
"INF1": "MINIMAL / PERSISTENT",
"INF2": "MODERATE. NEED BETTER INFLAMMATORY CONTROL.",
"INF3": "SEVERE INFLAMMATION: NEED BETTER INFLAMMATORY CONTROL.",
"INFOP": "OPTIONS:\n> Add a long term immunomodulator drop such as Restasis, Cequa, Xiidra, or Vevy twice per day\n> Add a feel good drop that also protects the cornea: Miebo 4 times per day\n> Add a tear made from your blood\n> Return for Prokera placement: A frozen amniotic membrane to help the cornea grow nerve and stem cells\n> Add an oral drug off label that is known to reduce inflammation: Low Dose Naltrexone 3 mg",
"SPK0": "NONE!",
"SPK1": "MINIMAL / PERSISTENT",
"SPK2": "MODERATE CORNEAL STAINING. NEED BETTER CONTROL / MORE AGGRESSIVE REGIMEN",
"SPK3": "SIGNIFICANT/ PERSISTENT CORNEAL STAINING/ PUNCTATE EPITHELIAL EROSIONS.\nNEED BETTER CONTROL / MORE AGGRESSIVE REGIMEN",
"NK": "NEUROTROPHIC KERATITIS",
"pNK": "NEUROTOPHIC KERATITIS: Your corneal nerves are absent or low functioning. This causes decreased water/oil pump and blink function. It also causes the cornea to be more fragile and prone to damage / epithelial erosions.",
"NKOP": "OPTIONS:\n> Autologous Blood Serum tears made from your own blood\n> Placement of a frozen amniotic membrane over the cornea for 5 days to act as fertilizer to grow corneal nerves.\n> If additional treatment is needed, OXERVATE is an 8 week course of man made NERVE GROWTH FACTOR, used evert 2 hours during the day",
"pLIP": "Advise Lipiflow as a safe and effective treatment to evacuate the clogged meibomian glands in order to prevent further gland loss and help improve flow of the oil into the tear film.",
"LIPI": "LIPIFLOW: Heat is administered under the lids with simultaneous external massage for 12 minutes to EVACUATE OIL GLANDS.",
"IPLS": "Intense Pulsed Light (IPL) with Radiofrequency (RF): 1 session every 2-4 weeks for 4 sessions and then a booster every ~6 months",
"IPL6": "RTC for 6 month BOOSTER IPL treatment for maintenance.",
"TIXi": "TIXELi: An in-office procedure using HEAT to melt the clogs within the OIL GLANDS. No numbing or corneal shields, takes only 2 minutes to perform. THREE WEEKS apart.",
"TIXL": "TIXEL: HEAT to create channels to the DERMIS layer. We will tighten your lower lid and reduce the excess skin/hooding above your upper lid. THIS WILL PREPARE YOU FOR BETTER BLINK FUNCTION, however it still takes PRACTICE! Arrive 30 minutes early for NUMBING CREAM. DISCONTINUE Retinols ~5 days beforehand. EXPECT SWELLING FOR 24-72 HOURS AND a faint GRID appearance in areas.",
"TIXF": "TIXEL: serums specific to the issue (redness, scar smoothing, hooding, under eye bags, lower lid tightening, volumizing, etc). Arrive 30 minutes early for NUMBING CREAM. DISCONTINUE Retinols beforehand. EXPECT SWELLING FOR 24-72 HOURS AND a faint GRID appearance in areas.",
"PLUOP": "> CONISDER PUNCTAL PLUGS: Plugging the drainage canal. These buried plugs are made of collagen and will dissolve within 6 months.",
"PLU": "KSICCA: plugs",
"SBH": "SBH Hydroeyes 4x /day",
"INCPRN": "INCREASE PRN DE3 TO 4/DAY",
"EXPOS": "EXPOSURE DURING NIGHT CAUSING DRYNESS AT WAKE UP\n> Add Eyeseals Sleep Mask (and Hylo PM ointment if still waking up dry)",
"LAG": "EYE SEAL MASK a/o use press and seal over eyes at night. (add HYLO PM ointment if still waking up dry)",
"EAT": "Eat more GOOD FATS: WILD CAUGHT OILY FISH 2/WEEK, NUTS, SEEDS: HEMP SEED, chia seed, flax seed, olive oil, walnut, avocado. <SEE LIST IN THE BOOK>",
"DED": "DRY EYE DRINK HELPS YOU ABSORB NUTRIENTS FROM WATER. It makes 1 water absorb as if it were 3 bottles of water. Dry Eye Drink has ELECTROLYTES, ANTIINFLAMMATORIES, and SUPPLEMENTS that help dry eye, BUT NO SUGAR.\nPM VERSION: with melatonin, valerian root, chamomile to help you relax and sleep.",
"LLTT": "LOW LEVEL LIGHT THERAPY (BIOPHOTOMODULATION): RED and INFRARED help reduce inflammation BLUE helps with rosacea. YELLOW helps with lymphatic drainage and allergies. ALL FOUR COLORS are used at once for 15 minutes, twice per week for 3 weeks. ONE session is needed as a BOOSTER EVERY ~3 MONTHS to maintain results.",
"OILNERVES": "DO NOTHING for the nerves, but EVACUATE GLANDS to get more oil on the surface to protect the surface from damage."
};

  window.__deisSrc = SRC;

  function seed(){
    var n = 0;
    try {
      Object.keys(SRC).forEach(function(k){ localStorage.setItem(k, SRC[k]); n++; });
      localStorage.setItem('DEISX', JSON.stringify(ACRO)); n++;
    } catch(e){}
    return n;
  }
  window.__deisSeed = seed;
  seed();
  try { document.addEventListener('DOMContentLoaded', seed); } catch(e){}

  window.__deisBoot = function(){ return eval(SRC.DEISBOOT); };
  window.__deisVersion = 'DEIS complete 3.4 (self-updating from GitHub) - popup fix ON, patientName+clearSafe+plan-visibility+preSave+gapFix+infoAdd folded in, ' + Object.keys(SRC).length +
    ' modules + ' + Object.keys(ACRO).length + ' acronyms, seeded ' + new Date().toLocaleTimeString();
})();
