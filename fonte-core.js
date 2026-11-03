/* ===== Bancada NGS · núcleo (parsers, consolidação, normalização, QIAgility) ===== */
const ROWS8 = 'ABCDEFGH';
const numBR = v => { if (v == null || v === '') return null; const n = parseFloat(String(v).trim().replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
const wellName = (idx, rows = 8) => ROWS8[(idx - 1) % rows] + (Math.floor((idx - 1) / rows) + 1);           // 1-based, por coluna
const wellIndex = (row, col, rows = 8) => (Number(col) - 1) * rows + (ROWS8.indexOf(String(row).toUpperCase()) + 1);

/* ---------- sigilo: código IL_INICIAIS ---------- */
/* regra do laboratório: inicial de TODAS as palavras, inclusive preposições (ANA DE SOUZA → ADS) */
function initials(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s'-]/g, ' ')
    .split(/[\s'-]+/).filter(Boolean).map(w => w[0]).join('');
}
const sampleCode = (il, ini) => String(il).padStart(7, '0') + (ini ? '_' + ini : '');

/* ---------- lista do LIMS (TXT) ---------- */
function controlKind(id, name) {
  // Só o NOME INTEIRO identifica controle; palavras soltas (ex.: sobrenome "BRANCO") não contam.
  const n = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (String(id) === '0' || /^(CONTROLE NEGATIVO|CN|NTC|BRANCO|BRANCO DE REACAO)$/.test(n)) return 'cn';
  if (/^(CONTROLE POSITIVO|CP)$/.test(n)) return 'cp';
  if (/^CONTROLE\b/.test(n)) return 'ctl';
  return 'sample';
}
function parseLimsTxt(text) {
  const out = [], bad = [];
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim(); if (!line) return;
    const m = line.match(/^(\d+)\s*[_;\t,]\s*(.*)$/);
    if (!m) { bad.push({ line: i + 1, text: line }); return; }
    out.push({ id: m[1], ini: initials(m[2]), kind: controlKind(m[1], m[2]) });  // o nome completo é descartado aqui
  });
  return { entries: out, bad };
}

/* ---------- mapa de trabalho (PDF) ---------- */
/* items: [{str, x, y, w}] com y crescendo para BAIXO (normalizado antes de chamar) */
function itemsToRows(items, tol = 3) {
  const sorted = items.filter(i => i.str && i.str.trim()).slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  sorted.forEach(it => {
    const L = rows.find(l => Math.abs(l.y - it.y) <= tol);
    if (L) L.items.push(it); else rows.push({ y: it.y, items: [it] });
  });
  return rows.sort((a, b) => a.y - b.y).map(l => {
    l.items.sort((a, b) => a.x - b.x);
    let s = '', end = null;
    l.items.forEach(it => { if (end != null) s += (it.x - end > 1.2 ? ' ' : ''); s += it.str; end = it.x + (it.w || 0); });
    return { y: l.y, items: l.items, text: s };
  });
}
const itemsToLines = (items, tol) => itemsToRows(items, tol).map(r => r.text);
function parseMapRow(line) {
  const t = line.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  if (t.length < 8 || !/^\d{1,3}$/.test(t[0])) return null;
  let k = -1; for (let i = t.length - 1; i > 0; i--) if (/^(PLACA|CAIXA|RACK|TUBO)$/i.test(t[i])) { k = i; break; }
  if (k < 0 || t.length < k + 4) return null;
  const firstAlpha = t.findIndex((x, i) => i > 0 && /^[^\d]+$/.test(x));
  if (firstAlpha < 2 || !/^\d{3,10}$/.test(t[firstAlpha - 1])) return null;
  let j = k - 1; while (j > firstAlpha && /^[xX]$/.test(t[j])) j--;
  const seq2 = /^\d{1,3}$/.test(t[j]) ? t[j--] : null;
  const nums = []; while (j > firstAlpha && /^\d+([.,]\d+)?$/.test(t[j])) nums.unshift(t[j--]);
  const donor = /^[SN]$/i.test(t[j]) ? t[j--].toUpperCase() : '';
  const name = t.slice(firstAlpha, j + 1).join(' ');
  return {
    seq: parseInt(t[0], 10), amostra: t.slice(1, firstAlpha - 1).join(' '), id: t[firstAlpha - 1], ini: initials(name), donor,
    conc: nums.length ? numBR(nums[0]) : null, r260: nums.length > 1 ? numBR(nums[1]) : null, seq2,
    storeType: t[k].toUpperCase(), storeNum: t[k + 1], col: t[k + 2], row: (t[k + 3] || '').toUpperCase(),
    kit: t.slice(k + 4).join(' ')
  };
}
function parseMapLines(lines) {
  let code = '';
  for (const l of lines) { const m = l.match(/\b([A-Z]{2,8}\d{6,8}[A-Z0-9]*)\b/); if (m) { code = m[1]; break; } }
  const rows = lines.map(parseMapRow).filter(Boolean);
  return { code, rows };
}

/* ---------- consolidação ---------- */
function consolidate(txt, maps, manual = {}) {
  const issues = [];
  const pdfRows = []; maps.forEach(m => m.rows.forEach(r => pdfRows.push({ ...r, mapCode: m.code, file: m.file })));
  const byId = new Map(); pdfRows.forEach(r => { if (byId.has(r.id)) issues.push(['bad', `Amostra ${r.id} aparece em mais de um mapa.`]); byId.set(r.id, r); });
  const seqs = pdfRows.map(r => r.seq).sort((a, b) => a - b);
  if (new Set(seqs).size !== seqs.length) issues.push(['bad', 'Há números SEQ repetidos entre os mapas.']);
  else if (seqs.length && seqs[seqs.length - 1] - seqs[0] + 1 !== seqs.length) issues.push(['warn', `A numeração SEQ dos mapas não é consecutiva (${seqs.join(', ')}).`]);
  const entries = txt.length ? txt : pdfRows.slice().sort((a, b) => a.seq - b.seq).map(r => ({ id: r.id, ini: r.ini, kind: 'sample' }));
  const seen = new Set();
  const rows = entries.map((e, i) => {
    const p = byId.get(e.id), m = manual[e.id] || {};
    seen.add(e.id);
    const ini = e.ini || p?.ini || '', kind = m.kind || e.kind;
    const r = { pos: i + 1, id: e.id, ini, code: sampleCode(e.id, ini), kind, origKind: e.kind, kindEdited: !!m.kind && m.kind !== e.kind, donor: p?.donor || '',
      conc: m.conc ?? p?.conc ?? null, r260: p?.r260 ?? null, storeType: m.storeType ?? p?.storeType ?? '', storeNum: m.storeNum ?? p?.storeNum ?? '',
      col: m.col ?? p?.col ?? '', row: m.row ?? p?.row ?? '', mapCode: p?.mapCode || '', kit: p?.kit || '', pdfSeq: p?.seq ?? null,
      found: !!p, edited: ['conc', 'storeNum', 'col', 'row'].some(k => m[k] != null), source: m.source || (kind === 'cn' ? 'diluent' : (p || m.storeNum ? 'stock' : (kind === 'sample' ? 'stock' : kind === 'cp' ? 'tube' : 'manual'))) };
    if (r.source === 'tube' && (r.conc == null || r.conc <= 0)) issues.push(['bad', `${r.code}: informe a concentração (ng/µL) do microtubo no bloco R1.`]);
    if (r.kindEdited) issues.push(['warn', `${r.code}: tipo alterado manualmente${m.kindBy ? ' (' + m.kindBy + ')' : ''}.`]);
    if (p && p.seq !== i + 1) issues.push(['warn', `${e.id}: posição ${i + 1} no TXT, SEQ ${p.seq} no mapa.`]);
    if (!p && kind === 'sample' && r.source === 'stock' && !m.storeNum) issues.push(['bad', `${e.id}: não encontrada nos mapas PDF. Informe placa, posição e concentração.`]);
    if (p && e.ini && p.ini && e.ini !== p.ini) issues.push(['warn', `${e.id}: iniciais diferentes entre TXT (${e.ini}) e mapa (${p.ini}).`]);
    return r;
  });
  pdfRows.forEach(p => { if (!seen.has(p.id)) issues.push(['bad', `${p.id} (SEQ ${p.seq}) está no mapa ${p.mapCode} mas não na lista TXT.`]); });
  return { rows, issues };
}
const norm = s => String(s).normalize('NFD').replace(/[^\w]/g, '').toUpperCase();

/* ---------- normalização ---------- */
const brNum = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', ',');
function normalizeAuto(r, c) {
  // QIAgility: DNA + diluente direto no poço de reação, volume final fixo.
  // Comportamento observado no relatório pós-corrida: abaixo do volume mínimo o robô pipeta o mínimo
  // e completa com diluente; a concentração final fica acima do alvo (poço marcado com *).
  const o = { vDNA: null, vDil: null, finalConc: null, adjusted: false, status: ['bad', 'Sem concentração'] };
  if (r.source === 'diluent') return { ...o, vDNA: 0, vDil: c.finalVol, finalConc: 0, status: ['ok', 'Diluente'] };
  if (r.source === 'manual') return { ...o, status: ['warn', 'Adicionar manualmente'] };
  if (r.conc == null || r.conc <= 0) return o;
  if (r.conc <= c.target) return c.allowBelow
    ? { ...o, vDNA: c.finalVol, vDil: 0, finalConc: r.conc, status: ['warn', 'Abaixo do alvo: DNA puro'] }
    : { ...o, status: ['bad', 'Abaixo do alvo'] };
  const vDNA = c.target * c.finalVol / r.conc;
  if (vDNA < c.minVol) {
    if (!c.autoAdjust) return { ...o, vDNA, vDil: c.finalVol - vDNA, finalConc: c.target, status: ['bad', `DNA < ${brNum(c.minVol)} µL sem ajuste automático`] };
    const fc = r.conc * c.minVol / c.finalVol;
    return { ...o, vDNA: c.minVol, vDil: c.finalVol - c.minVol, finalConc: fc, adjusted: true, status: ['warn', `Ajustado: final ${brNum(fc)} ng/µL`] };
  }
  // O mesmo limite vale para o diluente: se faltaria menos que o mínimo, o robô pipeta só DNA (puro)
  // no volume final e a concentração final fica igual à do estoque (poço marcado com *).
  if (c.finalVol - vDNA > 0 && c.finalVol - vDNA < c.minVol) {
    if (!c.autoAdjust) return { ...o, vDNA, vDil: c.finalVol - vDNA, finalConc: c.target, status: ['bad', `Diluente < ${brNum(c.minVol)} µL sem ajuste automático`] };
    return { ...o, vDNA: c.finalVol, vDil: 0, finalConc: r.conc, adjusted: true, status: ['warn', `Ajustado: diluente < ${brNum(c.minVol)} µL, DNA puro (${brNum(r.conc)} ng/µL)`] };
  }
  return { ...o, vDNA, vDil: c.finalVol - vDNA, finalConc: c.target, status: ['ok', 'OK'] };
}
function normalizeBench(r, c) {
  // Bancada: diluição intermediária em tubo, respeitando o volume mínimo de pipetagem (DNA e água)
  const o = { vDNA: null, vDil: null, vPrep: null, predil: 0, finalConc: null, status: ['bad', 'Sem concentração'] };
  if (r.source === 'diluent') return { ...o, vDNA: 0, vDil: c.useVol, finalConc: 0, status: ['ok', 'Água / diluente'] };
  if (r.source === 'manual') return { ...o, status: ['warn', 'Adicionar manualmente'] };
  if (r.conc == null || r.conc <= 0) return o;
  const neat = msg => c.allowBelow ? { ...o, vDNA: null, vDil: 0, finalConc: r.conc, status: ['warn', msg] } : { ...o, status: ['bad', 'Abaixo do alvo'] };
  if (r.conc <= c.target) return neat('Abaixo do alvo: usar DNA puro');
  const solve = conc => {
    let vp = Math.max(c.prepVol, c.minVol * conc / c.target);
    if (vp - c.target * vp / conc < c.minVol) vp = Math.max(vp, c.minVol / (1 - c.target / conc));
    vp = Math.ceil(vp * 10 - 1e-9) / 10;
    return vp <= c.maxVol ? { vPrep: vp, vDNA: c.target * vp / conc, vDil: vp - c.target * vp / conc } : null;
  };
  let x = solve(r.conc);
  if (x) return { ...o, ...x, finalConc: c.target, status: x.vPrep > c.prepVol ? ['warn', `Preparar ${String(x.vPrep).replace('.', ',')} µL`] : ['ok', 'OK'] };
  if (c.minVol * r.conc / c.target <= c.maxVol) return neat('Próximo do alvo: usar DNA puro');   // limitação é a água, não o DNA
  for (const f of [2, 5, 10, 20, 50]) {
    if (r.conc / f <= c.target) break;
    x = solve(r.conc / f);
    if (x) return { ...o, ...x, predil: f, finalConc: c.target, status: ['warn', `Pré-diluir 1:${f} (${String(c.minVol).replace('.', ',')} µL DNA + ${String(c.minVol * (f - 1)).replace('.', ',')} µL água)`] };
  }
  return { ...o, status: ['bad', 'Fora da faixa: diluir manualmente'] };
}
/* posições na placa de reação: itens do robô na ordem do TXT; manuais no fim (ou na ordem) */
function assignReactionWells(rows, manualAtEnd) {
  const robot = rows.filter(r => r.source !== 'manual'), man = rows.filter(r => r.source === 'manual');
  const order = manualAtEnd ? [...robot, ...man] : rows.slice();
  return order.map((r, i) => ({ ...r, dest: i + 1, destWell: wellName(i + 1) }));
}

/* ---------- QIAgility: relatório pós-corrida (Post-Run Report) ---------- */
const VOL_RE = /^(\d+(?:[.,]\d+)?)\s*(?:[µμu\uFFFD]|ï¿½|Âµ)?l\s+(.+)$/i;  // µl pode chegar como µ, μ, u ou caractere inválido (codificação do Windows)
function parsePostRun(rows) {
  const all = rows.map(r => r.text).join('\n');
  const g = re => ((all.match(re) || [])[1] || '').trim();
  const info = {
    qasFile: g(/([\w.\-]+\.QAS)\b/i), user: g(/Username\s*:\s*(\S+)/), version: g(/QIAgility Version\s*([\d.]+(?:\s*\(Build\s*\d+\))?)/),
    serial: g(/serial number\s*:\s*(\S+)/i), start: g(/Start time\s*:\s*([^\n]*?(?:AM|PM))/i), stop: g(/Stop Time\s*:\s*([^\n]*?(?:AM|PM))/i),
    duration: g(/Duration\s*:\s*([\d:]+)/), position: g(/Position\s*:\s*([^\n]+)/), reportName: g(/^(\S+ Report \d{4}-\d{2}-\d{2}_[\d-]+)/m)
  };
  const hi = rows.findIndex(r => /\bExpected\b/.test(r.text) && /\bActual\b/.test(r.text));
  const wells = [];
  if (hi >= 0) {
    const H = rows[hi].items, hx = w => (H.find(i => i.str.startsWith(w)) || {}).x;
    const X = { id: hx('ID'), exp: hx('Expected'), act: hx('Actual'), conc: hx('Conc'), max: hx('Max') };
    if (X.id == null || X.exp == null || X.act == null) return { info, wells, tasks: [], error: 'Cabeçalho da tabela não reconhecido' };
    const b1 = (X.id + X.exp) / 2, b2 = (X.exp + X.act) / 2, b3 = (X.act + (X.conc ?? X.act + 100)) / 2, b4 = ((X.conc ?? b3) + (X.max ?? b3 + 50)) / 2;
    let end = rows.findIndex((r, i) => i > hi && /Indicates wells|Reaction steps|Task list/i.test(r.text)); if (end < 0) end = rows.length;
    const region = rows.slice(hi + 1, end).filter(r => !/Report \d{4}-|^file:\/\/|Page \d+ of/.test(r.text));
    const first = region.findIndex(r => /[µμ]l\b/.test(r.text) || r.items.some(i => i.x < b1 && /^[A-P]\d{1,2}$/.test(i.str)));
    if (first > 0) region.splice(0, first);
    const anchors = region.filter(r => r.items.some(i => i.x < b1 && /^[A-P]\d{1,2}$/.test(i.str)));
    anchors.forEach(a => wells.push({ anchor: a, rows: [] }));
    region.forEach(r => {
      if (!wells.length) return;
      let best = wells[0]; wells.forEach(w => { if (Math.abs(w.anchor.y - r.y) < Math.abs(best.anchor.y - r.y)) best = w; });
      best.rows.push(r);
    });
    wells.forEach(w => {
      const its = w.rows.sort((a, b) => a.y - b.y).flatMap(r => r.items.map(i => ({ ...i, ry: r.y })));
      const zone = (lo, hi2) => its.filter(i => i.x >= lo && i.x < hi2);
      const left = zone(-1e9, b1); w.well = (left.find(i => /^[A-P]\d{1,2}$/.test(i.str)) || {}).str;
      w.id = left.filter(i => !/^[A-P]\d{1,2}$/.test(i.str) || i.ry !== w.anchor.y || i !== left.find(j => /^[A-P]\d{1,2}$/.test(j.str))).map(i => i.str).join('');
      const contents = list => { const out = []; let cur = null, y = null;
        list.forEach(i => { if (i.ry !== y) { if (cur) out.push(cur); cur = { text: i.str }; y = i.ry; } else cur.text += ' ' + i.str; });
        if (cur) out.push(cur);
        const res = []; out.forEach(o => { const m = o.text.match(VOL_RE); if (m) res.push({ vol: numBR(m[1]), name: m[2].replace(/\s+/g, '') }); else if (res.length) res[res.length - 1].name += o.text.replace(/\s+/g, ''); });
        return res; };
      w.expected = contents(zone(b1, b2)); w.actual = contents(zone(b2, b3));
      const cz = zone(b3, b4); w.conc = numBR((cz.find(i => /^\d+[.,]\d+$/.test(i.str)) || {}).str); w.adjusted = cz.some(i => i.str === '*');
      const rz = zone(b4, 1e9); const nums = rz.filter(i => /^\d+([.,]\d+)?$/.test(i.str)).map(i => numBR(i.str));
      w.maxVol = nums[0] ?? null; w.finalVol = nums[1] ?? null;
      w.status = rz.filter(i => /^[A-Za-z]/.test(i.str) && !/^[µμu]l$/i.test(i.str)).map(i => i.str).join(' ');
      delete w.anchor; delete w.rows;
    });
  }
  const ti = rows.findIndex(r => /Task list/i.test(r.text)), te = rows.findIndex((r, i) => i > ti && /Program Settings/i.test(r.text));
  const tasks = ti < 0 ? [] : rows.slice(ti + 1, te < 0 ? undefined : te).map(r => r.text.trim()).filter(t => t && !/Report \d{4}-|^file:\/\/|Page \d+ of/.test(t));
  return { info, wells: wells.filter(w => w.well), tasks };
}
/* Relatório pós-corrida em HTML (.htm salvo pelo QIAgility): tabela estruturada, leitura direta das células */
function htmlText(h) {
  return String(h || '').replace(/\s+/g, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/[ \t\r]+/g, ' ')
    .split('\n').map(x => x.trim()).join('\n').trim();
}
function parsePostRunHtml(html) {
  const text = htmlText(html);
  const g = re => ((text.match(re) || [])[1] || '').trim();
  const info = {
    qasFile: g(/([\w.\-]+\.QAS)\b/i), user: g(/Username\s*:\s*(\S+)/), version: g(/QIAgility Version\s*([\d.]+(?:\s*\(Build\s*\d+\))?)/),
    serial: g(/serial number\s*:\s*(\S+)/i) || (/virtual mode/i.test(text) ? 'modo virtual' : ''),
    start: g(/Start time\s*:\s*([^\n]*?(?:AM|PM))/i), stop: g(/Stop Time\s*:\s*([^\n]*?(?:AM|PM))/i),
    duration: g(/Duration\s*:\s*([\d:]+)/), position: g(/Position\s*:\s*(.+?\))/), reportName: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '',
    virtual: /virtual mode/i.test(text)
  };
  const wells = [];
  const start = html.search(/Expected\s+Contents/i);
  if (start >= 0) {
    const end = html.indexOf('</TABLE>', start) >= 0 ? html.toUpperCase().indexOf('</TABLE>', start) : html.length;
    const rows = html.slice(start, end).split(/<tr[\s>]/i).slice(1);
    rows.forEach(r => {
      const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)(?=<\/td>|<td[\s>]|$)/gi)].map(m => htmlText(m[1]));
      if (cells.length < 8 || !/^[A-P]\d{1,2}$/.test(cells[0])) return;
      const contents = t => t.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(VOL_RE); return m ? { vol: numBR(m[1]), name: m[2].replace(/\s+/g, '') } : null; }).filter(Boolean);
      wells.push({ well: cells[0], id: cells[1].trim(), expected: contents(cells[2]), actual: contents(cells[3]),
        conc: numBR((cells[4].match(/\d+(?:[.,]\d+)?/) || [])[0]), adjusted: cells[4].includes('*'),
        maxVol: numBR((cells[5].match(/\d+(?:[.,]\d+)?/) || [])[0]), finalVol: numBR((cells[6].match(/\d+(?:[.,]\d+)?/) || [])[0]), status: cells[7].trim() });
    });
  }
  const ti = html.search(/Task list/i);
  const tasks = ti < 0 ? [] : [...html.slice(ti, html.search(/Program Settings/i) > ti ? html.search(/Program Settings/i) : undefined).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map(m => htmlText(m[1]).replace(/\s+/g, ' ').replace(/(\d)\s*(?:\uFFFD|ï¿½|Âµ|μ)l\b/g, '$1 µl')).filter(t => t && !/<table/i.test(t));
  return { info, wells, tasks, format: 'html' };
}
const ilOf = s => { const m = String(s || '').match(/^(\d+)/); return m ? String(+m[1]) : ''; };
function validatePostRun(items, rep, c, expectedFile) {
  const out = [], general = [], byWell = {}; rep.wells.forEach(w => byWell[w.well] = w);
  const tolV = 0.05, tolC = 0.01;
  if (expectedFile && rep.info.qasFile && rep.info.qasFile.toUpperCase() !== expectedFile.toUpperCase()) general.push(['warn', `Arquivo executado: ${rep.info.qasFile}; o app gerou ${expectedFile}.`]);
  if (!rep.wells.length) general.push(['bad', 'Nenhum poço encontrado no relatório.']);
  if (rep.info.virtual) general.push(['warn', 'Relatório gerado em modo virtual (simulação), não em uma corrida real do robô.']);
  const robot = items.filter(r => r.source === 'stock' || r.source === 'tube' || r.source === 'diluent');
  robot.forEach(r => {
    const w = byWell[r.destWell], notes = [];
    if (!w) { out.push({ item: r, w: null, result: 'bad', notes: ['Poço ausente no relatório'] }); return; }
    const isDil = r.source === 'diluent';
    const expDNA = w.expected.find(e => !/^diluent$/i.test(e.name)), expDil = w.expected.find(e => /^diluent$/i.test(e.name));
    const actDNA = w.actual.find(e => !/^diluent$/i.test(e.name)), actDil = w.actual.find(e => /^diluent$/i.test(e.name));
    let bad = false, warn = false;
    if (!isDil) {
      if (ilOf(w.id) !== ilOf(r.id)) { bad = true; notes.push(`Amostra no poço: ${w.id || '—'}`); }
      else if (r.code && w.id !== r.code) { warn = true; notes.push(`ID no robô sem o código ${r.code}`); }
      if (!expDNA) { bad = true; notes.push('Sem DNA esperado'); }
      else if (r.vDNA != null && Math.abs(expDNA.vol - r.vDNA) > tolV) { warn = true; notes.push(`DNA previsto ${brNum(r.vDNA)} µL, robô ${brNum(expDNA.vol)} µL`); }
      if (!!w.adjusted !== !!r.adjusted) { warn = true; notes.push(w.adjusted ? 'Robô ajustou o volume (não previsto)' : 'Ajuste previsto não ocorreu'); }
      if (w.conc != null && r.finalConc && Math.abs(w.conc - r.finalConc) / r.finalConc > tolC) { warn = true; notes.push(`Conc. final ${brNum(w.conc)} vs prevista ${brNum(r.finalConc)} ng/µL`); }
    } else if (expDNA || w.id) { bad = true; notes.push('Esperado só diluente'); }
    const same = (a, b) => (!a && !b) || (a && b && Math.abs(a.vol - b.vol) < 0.005 && a.name === b.name);
    if (!same(expDNA, actDNA) || !same(expDil, actDil)) { bad = true; notes.push('Executado diferente do esperado'); }
    if (w.finalVol == null || Math.abs(w.finalVol - c.finalVol) > 0.01) { bad = true; notes.push(`Volume final ${w.finalVol ?? '—'} µL`); }
    if (!/^OK$/i.test(w.status || '')) { bad = true; notes.push(`Status do robô: ${w.status || '—'}`); }
    out.push({ item: r, w, result: bad ? 'bad' : warn ? 'warn' : 'ok', notes });
  });
  const exp = new Set(robot.map(r => r.destWell));
  rep.wells.filter(w => !exp.has(w.well)).forEach(w => out.push({ item: null, w, result: 'bad', notes: ['Poço executado sem estar previsto'] }));
  const pending = items.filter(r => r.source === 'manual');
  const level = general.some(g => g[0] === 'bad') || out.some(o => o.result === 'bad') ? 'bad' : (general.length || out.some(o => o.result === 'warn')) ? 'warn' : 'ok';
  return { level, rows: out, general, pending };
}

/* ---------- QIAgility (.QAS) ---------- */
function qasInfo(xml) {
  const sockets = [...xml.matchAll(/<Socket>([\s\S]*?)<\/Socket>/g)].map((m, i) => {
    const b = m[1];
    return { idx: i + 1, plateId: (b.match(/<PlateID>(.*?)<\/PlateID>/) || [])[1] || '', plateCode: (b.match(/<PlateCode>(.*?)<\/PlateCode>/) || [])[1] || '',
      roles: [...b.matchAll(/<Role>(.*?)<\/Role>/g)].map(x => x[1]) };
  });
  let g = 0; const sampleSlots = [];
  sockets.forEach(s => s.roles.forEach((role, si) => { if (role === 'Sample') { g++; sampleSlots.push({ group: g, socket: s.idx, plateId: s.plateId, plateCode: s.plateCode, segment: si + 1, wholePlate: s.roles.length === 1 }); } }));
  const groups = [...xml.matchAll(/<SampleGroup><Index>(\d+)<\/Index>([\s\S]*?)<\/SampleGroup>/g)].map(m => ({ index: +m[1], size: (m[2].match(/<Sample>/g) || []).length }));
  sampleSlots.forEach(s => { s.size = (groups.find(x => x.index === s.group) || {}).size || (s.wholePlate ? 96 : 8); });
  const app = xml.match(/<App><Title>(.*?)<\/Title>\s*<Major>(\d+)<\/Major>\s*<Minor>(\d+)<\/Minor>\s*<Revision>(\d+)/);
  const banks = [...xml.matchAll(/<SampleBank>([\s\S]*?)<\/SampleBank>/g)].map(m => ({ name: (m[1].match(/<BankName>(.*?)<\/BankName>/) || [])[1], role: (m[1].match(/<Role>(.*?)<\/Role>/) || [])[1] }));
  const rx = [...xml.matchAll(/<Reaction>(?=<ElementType>|<SourceBank>)([\s\S]*?)<\/Reaction>/g)].map(m => m[1]).filter(b => !/<ElementType>Filter/.test(b));
  const val = (b, t) => ((b || '').match(new RegExp(`<${t}>(.*?)</${t}>`)) || [])[1];
  const normRx = rx.find(b => val(b, 'NormaliseActive') === '-1');
  return { sockets, sampleSlots, banks, version: app ? `${app[2]}.${app[3]}.${app[4]}` : '?',
    defaults: normRx ? { target: numBR(val(normRx, 'NormaliseTo')), finalVol: numBR(val(normRx, 'TotalVol')) } : null,
    diluentBank: banks.findIndex(b => b.role === 'Diluent') + 1 };
}
/* plates: [{key:'PLACA 586', code:'586', slot:<group>}]  items: linhas com dest, source, storeNum, col, row, conc, id */
function buildQas(template, items, plates, c, now = new Date()) {
  const nl = template.includes('\r\n') ? '\r\n' : '\n';
  const info = qasInfo(template);
  let xml = template;
  // 1. códigos das placas nos sockets
  const codeBySocket = {}; plates.forEach(p => { const s = info.sampleSlots.find(x => x.group === p.slot); if (s) codeBySocket[s.socket] = p.code; });
  let si = 0;
  xml = xml.replace(/<Socket>([\s\S]*?)<\/Socket>/g, (all, b) => {
    si++; const slot = info.sampleSlots.find(s => s.socket === si && s.wholePlate);
    if (!slot) return all;
    return all.replace(/<PlateCode>.*?<\/PlateCode>/, `<PlateCode>${codeBySocket[si] || ''}</PlateCode>`);
  });
  // 2. bancos de amostra: mantém os que não são Sample, recria um banco por trecho contínuo de mesma placa
  const blocks = [...xml.matchAll(/<SampleBank>[\s\S]*?<\/SampleBank>\r?\n?/g)];
  const keep = blocks.filter(m => !/<Role>Sample<\/Role>/.test(m[0])).map(m => m[0]);
  const robot = items.filter(r => r.source === 'stock' || r.source === 'tube').sort((a, b) => a.dest - b.dest);
  const runs = [];
  robot.forEach(r => {
    const p = plates.find(x => x.key === plateKey(r)); const last = runs[runs.length - 1];
    if (last && last.plate === p && r.dest === last.items[last.items.length - 1].dest + 1) last.items.push(r);
    else runs.push({ plate: p, items: [r] });
  });
  const nameCount = {};
  const newBanks = runs.map(run => {
    const base = run.plate.bankBase || 'PL' + run.plate.code; nameCount[base] = (nameCount[base] || 0) + 1;
    run.bankName = nameCount[base] > 1 ? `${base}_${nameCount[base]}` : base;
    return `<SampleBank><BankName>${xmlEsc(run.bankName)}</BankName>${nl}<Role>Sample</Role>${nl}<RoleIdx>${run.plate.slot}</RoleIdx>${nl}` +
      run.items.map(r => `<Sample>${srcIndex(r)}</Sample>${nl}`).join('') + `</SampleBank>${nl}`;
  });
  runs.forEach((run, i) => run.bankIndex = keep.length + i + 1);
  const firstBank = blocks[0].index, lastBlock = blocks[blocks.length - 1], afterBanks = lastBlock.index + lastBlock[0].length;
  xml = xml.slice(0, firstBank) + keep.join('') + newBanks.join('') + xml.slice(afterBanks);
  // 3. grupos de amostras (concentrações nas posições da placa)
  xml = xml.replace(/<SampleGroup><Index>(\d+)<\/Index>([\s\S]*?)<\/SampleGroup>/g, (all, idx) => {
    const slot = info.sampleSlots.find(s => s.group === +idx); const size = slot?.size || (all.match(/<Sample>/g) || []).length;
    const p = plates.find(x => x.slot === +idx);
    const cells = Array.from({ length: size }, () => null);
    if (p) robot.filter(r => plateKey(r) === p.key).forEach(r => { cells[srcIndex(r) - 1] = r; });
    return `<SampleGroup><Index>${idx}</Index>${nl}` + cells.map(r => r
      ? `<Sample><Name>${xmlEsc(r.code || r.id)}</Name>${nl}<ID>${xmlEsc(r.code || r.id)}</ID>${nl}<Conc>${fmtConc(r.conc)}</Conc>${nl}</Sample>${nl}`
      : `<Sample><Name></Name>${nl}<ID></ID>${nl}<Conc>0</Conc>${nl}</Sample>${nl}`).join('') + `</SampleGroup>`;
  });
  // 4. reações
  const rxBlocks = [...xml.matchAll(/<Reaction>(?=<ElementType>|<SourceBank>)[\s\S]*?<\/Reaction>\r?\n?/g)];
  const filters = rxBlocks.filter(m => /<ElementType>Filter/.test(m[0]));
  const steps = rxBlocks.filter(m => !/<ElementType>Filter/.test(m[0])).map(m => m[0]);
  const tplNorm = steps.find(b => /<NormaliseActive>-1/.test(b)) || DEFAULT_RX;
  const tplDil = steps.find(b => /<NormaliseActive>0</.test(b)) || tplNorm;
  const set = (b, tag, v) => b.replace(new RegExp(`<${tag}>.*?</${tag}>`), `<${tag}>${v}</${tag}>`);
  const out = runs.map(run => {
    let b = set(tplNorm, 'SourceBank', run.bankIndex);
    b = set(b, 'DestWell', run.items[0].dest); b = set(b, 'NormaliseActive', -1); b = set(b, 'NormaliseTo', fmtConc(c.target));
    b = set(b, 'NormaliseAutoAdjust', c.autoAdjust ? -1 : 0); b = set(b, 'DoAllowConcLessThanTarget', c.allowBelow ? -1 : 0);
    b = set(b, 'SampleVol', fmtConc(c.finalVol)); return set(b, 'TotalVol', fmtConc(c.finalVol));
  });
  items.filter(r => r.source === 'diluent').forEach(r => {
    let b = set(tplDil, 'SourceBank', info.diluentBank || 2); b = set(b, 'DestWell', r.dest); b = set(b, 'NormaliseActive', 0);
    b = set(b, 'SampleVol', fmtConc(c.finalVol)); out.push(set(b, 'TotalVol', fmtConc(c.finalVol)));
  });
  const ordered = out.map((b, i) => ({ b, d: +(b.match(/<DestWell>(\d+)/) || [])[1] })).sort((a, b) => a.d - b.d).map(x => x.b.replace(/\r?\n?$/, nl));
  if (rxBlocks.length) {
    const start = rxBlocks[0].index, last = rxBlocks[rxBlocks.length - 1], end = last.index + last[0].length;
    const head = filters[0] ? filters[0][0] : '', tail = filters[1] ? filters[1][0] : '';
    xml = xml.slice(0, start) + head + ordered.join('') + tail + xml.slice(end);
  }
  // 5. datas
  const stamp = qasDate(now);
  xml = xml.replace(/<Created>.*?<\/Created>/, `<Created>${stamp}</Created>`).replace(/<Modified>.*?<\/Modified>/, `<Modified>${stamp}</Modified>`);
  return { xml, runs: runs.map(r => ({ bank: r.bankName, bankIndex: r.bankIndex, slot: r.plate.slot, first: r.items[0].dest, n: r.items.length })) };
}
const TUBE_KEY = 'TUBO R1';
const plateKey = r => r.source === 'tube' ? TUBE_KEY : `${(r.storeType || 'PLACA').toUpperCase()} ${r.storeNum}`;
const srcIndex = r => r.source === 'tube' ? (r.tubePos || 1) : wellIndex(r.row, r.col);   // posição dentro do grupo de amostras do QIAgility
const xmlEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtConc = n => (n == null || !isFinite(n)) ? '0' : String(Math.round(n * 10000) / 10000);
function qasDate(d) {
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  const p = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`;
}
const DEFAULT_RX = '<Reaction><SourceBank>19</SourceBank>\n<DestRole>Reaction</DestRole>\n<DestIdx>1</DestIdx>\n<DestWell>1</DestWell>\n<NormaliseActive>-1</NormaliseActive>\n<NormaliseTo>7</NormaliseTo>\n<NormaliseAutoAdjust>-1</NormaliseAutoAdjust>\n<DoAllowConcLessThanTarget>-1</DoAllowConcLessThanTarget>\n<PauseTime>0</PauseTime>\n<MagnetUse>0</MagnetUse>\n<MagnetPow>0</MagnetPow>\n<HeaterUse>0</HeaterUse>\n<HeaterPow>0</HeaterPow>\n<ResetDst>0</ResetDst>\n<EjectPos>-1</EjectPos>\n<TakePos>-1</TakePos>\n<ForceWet>0</ForceWet>\n<PreMixCount>1</PreMixCount>\n<ForceMix>0</ForceMix>\n<dstMix>-1</dstMix>\n<dstMixCount>5</dstMixCount>\n<WaitMsg></WaitMsg>\n<ForceNoPickupTip>0</ForceNoPickupTip>\n<Repeats>1</Repeats>\n<AltWithWater>0</AltWithWater>\n<PreserveWellIndices>0</PreserveWellIndices>\n<SampleVol>4.3</SampleVol>\n<TotalVol>4.3</TotalVol>\n</Reaction>\n';
/* atribuição de placas aos sockets: mantém o socket se o modelo já tiver aquele código */
function assignSlots(info, plateKeys) {
  const slots = info.sampleSlots.filter(s => s.wholePlate);
  const used = new Set(), res = [];
  plateKeys.forEach(k => { const code = k.split(' ').pop(); const s = slots.find(x => x.plateCode === code && !used.has(x.group)); if (s) { used.add(s.group); res.push({ key: k, code, slot: s.group }); } else res.push({ key: k, code, slot: null }); });
  res.forEach(p => { if (p.slot == null) { const s = slots.find(x => !used.has(x.group)); if (s) { used.add(s.group); p.slot = s.group; } } });
  return res;
}
if (typeof module !== 'undefined') module.exports = { TUBE_KEY, srcIndex, itemsToRows, parsePostRun, parsePostRunHtml, validatePostRun, initials, sampleCode, parseLimsTxt, itemsToLines, parseMapLines, parseMapRow, consolidate, normalizeAuto, normalizeBench, assignReactionWells, qasInfo, buildQas, assignSlots, wellName, wellIndex, plateKey };
