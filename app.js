(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ui = {
    status: $('statusText'), map: $('mapSelect'), date: $('dateSelect'), match: $('matchSelect'), reset: $('resetButton'), notice: $('notice'),
    mapHeading: $('mapHeading'), mapViewport: $('mapViewport'), mapSvg: $('mapSvg'), mapImage: $('mapImage'), mapEmpty: $('mapEmpty'), heat: $('heatLayer'), paths: $('pathLayer'), events: $('eventLayer'), caption: $('mapCaption'), outside: $('outsideCount'), tooltip: $('mapTooltip'),
    zoomIn: $('zoomIn'), zoomOut: $('zoomOut'), fit: $('fitButton'), heatMode: $('heatMode'), heatNote: $('heatNote'), summary: $('summaryContent'), eventList: $('eventList'), eventCount: $('eventCount'), timeline: $('timeline'), play: $('playButton'), playIcon: $('playIcon'), current: $('currentTime'), duration: $('durationLabel'), context: $('timelineContext'), ticks: $('timelineTicks'), tickCount: $('timelineEventCount'), speed: $('speedSelect')
  };
  const MAPS = {
    AmbroseValley: { label: 'Ambrose Valley', originX: -370, originZ: -473, scale: 900, asset: 'assets/minimaps/AmbroseValley.webp' },
    GrandRift: { label: 'Grand Rift', originX: -290, originZ: -290, scale: 581, asset: 'assets/minimaps/GrandRift.webp' },
    Lockdown: { label: 'Lockdown', originX: -500, originZ: -500, scale: 1000, asset: 'assets/minimaps/Lockdown.webp' }
  };
  const EVENT_COLORS = { Kill: '#ff7281', BotKill: '#f39a8f', Killed: '#f7edf0', BotKilled: '#ffc178', Loot: '#72b7ff', KilledByStorm: '#bba1ff' };
  const EVENT_LABELS = { Kill: 'Kill · kill record', BotKill: 'BotKill · bot-tagged kill record', Killed: 'Killed · death record', BotKilled: 'BotKilled · bot-tagged death record', Loot: 'Loot · loot record', KilledByStorm: 'KilledByStorm · storm death' };
  const dataCache = new Map();
  let manifest = null, activeData = [], maxDuration = 0, cursor = 0, playing = false, raf = 0, lastFrame = 0, view = null, imageSize = { width: 1024, height: 1024 }, imageLoaded = false, selectionToken = 0, heatMode = 'off', eventNodes = [], mapKey = '', cachedStream = [], cachedDiscrete = [];
  const svgNS = 'http://www.w3.org/2000/svg';
  const finite = (n) => Number.isFinite(Number(n));
  const fmtTime = (s) => { const value = Math.max(0, Math.floor(Number(s) || 0)); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; };
  const fmtExact = (s) => `${fmtTime(s)}${Math.floor((Number(s) || 0) % 1 * 10) ? `.${Math.floor((Number(s) || 0) % 1 * 10)}` : ''}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const setNotice = (message, error = false) => { ui.notice.textContent = message; ui.notice.hidden = !message; ui.notice.classList.toggle('is-error', error); };
  function setStatus(text, ready = false) { ui.status.textContent = text; document.querySelector('.status-dot').classList.toggle('ready', ready); }
  function svgElement(tag, attrs = {}) { const el = document.createElementNS(svgNS, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; }
  function datasetsForFilters() { return manifest.datasets.filter((entry) => entry && entry.map && entry.date && entry.file && MAPS[entry.map]); }
  function initFilters() {
    const entries = datasetsForFilters();
    const maps = [...new Set(entries.map((d) => d.map))].sort((a, b) => a.localeCompare(b));
    ui.map.innerHTML = maps.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(MAPS[id].label)}</option>`).join('');
    ui.map.disabled = !maps.length;
    if (!maps.length) throw new Error('The manifest contains no supported map datasets.');
    ui.map.value = maps.includes('AmbroseValley') ? 'AmbroseValley' : maps[0];
    ui.date.disabled = false; ui.match.disabled = false; ui.reset.disabled = false;
    updateDates(); updateMatches();
  }
  function updateDates() {
    const dates = [...new Set(datasetsForFilters().filter((d) => d.map === ui.map.value).map((d) => d.date))].sort();
    ui.date.innerHTML = dates.map((date) => `<option value="${escapeHtml(date)}">${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${date === '2026-02-14' ? ' · partial' : ''}</option>`).join('');
    if (!dates.length) { ui.date.innerHTML = '<option value="">No dates available</option>'; }
    else ui.date.value = dates[dates.length - 1];
  }
  function matchingEntries() { return datasetsForFilters().filter((d) => d.map === ui.map.value && d.date === ui.date.value); }
  function matchesForCurrentDay() {
    const found = new Map();
    for (const entry of matchingEntries()) for (const match of (entry.matches || [])) if (match && match.id != null) found.set(String(match.id), { ...match, id: String(match.id), file: entry.file });
    return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  function updateMatches() {
    const matches = matchesForCurrentDay();
    ui.match.innerHTML = `<option value="*">All matches · ${matches.length}</option>` + matches.map((match) => `<option value="${escapeHtml(match.id)}">${escapeHtml(match.id)}</option>`).join('');
    ui.match.disabled = !matches.length;
    if (matches.length) ui.match.value = '*';
    loadSelection();
  }
  async function getFile(entry) {
    if (!dataCache.has(entry.file)) {
      const promise = fetch(entry.file).then((response) => { if (!response.ok) throw new Error(`Could not load ${entry.file} (${response.status}).`); return response.json(); });
      dataCache.set(entry.file, promise);
    }
    try { return await dataCache.get(entry.file); }
    catch (error) { dataCache.delete(entry.file); throw error; }
  }
  function validMatch(match) { return match && Array.isArray(match.players); }
  async function loadSelection() {
    stopPlayback();
    const token = ++selectionToken;
    activeData = []; cachedStream = []; cachedDiscrete = []; cursor = 0; maxDuration = 0; resetLayer(); setNotice('');
    ui.mapHeading.textContent = `${MAPS[ui.map.value]?.label || 'Match'} · ${formatDate(ui.date.value)}`;
    if (!ui.match.value) { emptyState('No matches for this map and date.'); updateSummary(); updateEvents(); updateTimeline(); return; }
    setStatus('Loading match data…'); ui.mapEmpty.hidden = false; ui.mapEmpty.innerHTML = '<span class="empty-symbol" aria-hidden="true">◌</span><strong>Loading recorded journeys</strong><span>Preparing map and player events…</span>';
    try {
      const entries = matchingEntries();
      const needed = ui.match.value === '*' ? entries : entries.filter((entry) => (entry.matches || []).some((m) => String(m.id) === ui.match.value));
      const files = [...new Set(needed.map((entry) => entry.file))];
      const loaded = await Promise.all(files.map(async (file) => [file, await getFile(needed.find((e) => e.file === file))]));
      if (token !== selectionToken) return;
      const byFile = new Map(loaded);
      const selected = new Set(ui.match.value === '*' ? matchesForCurrentDay().map((m) => m.id) : [ui.match.value]);
      for (const [file, payload] of byFile) {
        const sourceMatches = payload?.matches;
        if (!sourceMatches || typeof sourceMatches !== 'object') continue;
        for (const [id, match] of Object.entries(sourceMatches)) if (selected.has(String(id)) && validMatch(match)) activeData.push({ id: String(id), match, file });
      }
      activeData.sort((a, b) => a.id.localeCompare(b.id));
      cachedStream = playerEventStream();
      cachedDiscrete = cachedStream.filter((e) => EVENT_LABELS[e.type]);
      maxDuration = activeData.reduce((longest, item) => Math.max(longest, Number(item.match.duration) || 0), 0);
      cursor = maxDuration;
      await loadMapImage(ui.map.value);
      if (token !== selectionToken) return;
      if (!activeData.length) { setStatus('No journey data'); setNotice('The index lists matches for this date, but the selected dataset contained no valid match records.', true); emptyState('No journey data found.'); }
      else { setStatus(`${activeData.length} ${activeData.length === 1 ? 'match' : 'matches'} ready`, true); ui.mapSvg.removeAttribute('hidden'); ui.mapEmpty.hidden = true; }
      updateSummary(); updateEvents(); updateTimeline(); draw();
    } catch (error) {
      if (token !== selectionToken) return;
      setStatus('Unable to load data'); setNotice(`${error.message} Check that data/manifest.json and its referenced files are available from this static site.`, true);
      emptyState('Data could not be loaded.'); updateSummary(); updateEvents(); updateTimeline();
    }
  }
  function formatDate(date) { if (!date) return 'No date'; const parsed = new Date(`${date}T12:00:00`); return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function emptyState(text) { ui.mapSvg.setAttribute('hidden', ''); ui.mapEmpty.hidden = false; ui.mapEmpty.innerHTML = `<span class="empty-symbol" aria-hidden="true">⌖</span><strong>${escapeHtml(text)}</strong><span>Try another date or match selection.</span>`; }
  function loadMapImage(mapId) {
    const map = MAPS[mapId]; if (!map) return Promise.reject(new Error(`Unsupported map: ${mapId}`));
    if (mapKey === mapId && imageLoaded) return Promise.resolve();
    mapKey = mapId; imageLoaded = false;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { imageSize = { width: img.naturalWidth, height: img.naturalHeight }; imageLoaded = true; ui.mapSvg.setAttribute('viewBox', `0 0 ${imageSize.width} ${imageSize.height}`); ui.mapImage.setAttribute('href', map.asset); ui.mapImage.setAttribute('width', imageSize.width); ui.mapImage.setAttribute('height', imageSize.height); fitView(); resolve(); };
      img.onerror = () => { mapKey = ''; reject(new Error(`Could not load minimap ${map.asset}.`)); };
      img.src = map.asset;
    });
  }
  function resetLayer() { ui.heat.replaceChildren(); ui.paths.replaceChildren(); ui.events.replaceChildren(); eventNodes = []; ui.outside.textContent = ''; }
  function normalizedPoint(event) {
    return { x: Number(event[1]) * imageSize.width, y: Number(event[2]) * imageSize.height };
  }
  function playerEventStream() {
    const all = [];
    for (const item of activeData) for (const player of item.match.players) {
      if (!Array.isArray(player.events)) continue;
      for (const row of player.events) {
        if (!Array.isArray(row) || row.length < 4 || !finite(row[0]) || typeof row[3] !== 'string') continue;
        const t = Number(row[0]);
        all.push({ t, x: Number(row[1]), z: Number(row[2]), type: row[3], player, matchId: item.id });
      }
    }
    return all.sort((a, b) => a.t - b.t);
  }
  function matchesEvents() { return cachedStream; }
  function eventsAtOrBeforeTime() { return matchesEvents().filter((event) => event.t <= cursor); }
  function draw() {
    resetLayer();
    if (!activeData.length || !imageLoaded) return;
    const mapId = ui.map.value, eventStream = matchesEvents();
    let outside = 0;
    const heatCounts = new Map();
    for (const e of eventStream) {
      if (e.t > cursor || !finite(e.x) || !finite(e.z)) continue;
      const p = normalizedPoint([e.t, e.x, e.z], mapId);
      if (p.x < 0 || p.y < 0 || p.x > imageSize.width || p.y > imageSize.height) outside++;
      const isTrafficSample = e.type === 'Position' || e.type === 'BotPosition';
      const isKill = e.type === 'Kill' || e.type === 'BotKill';
      const isDeath = e.type === 'Killed' || e.type === 'BotKilled' || e.type === 'KilledByStorm';
      const include = (heatMode === 'traffic' && isTrafficSample) || (heatMode === 'kills' && isKill) || (heatMode === 'deaths' && isDeath);
      if (include && p.x >= 0 && p.y >= 0 && p.x <= imageSize.width && p.y <= imageSize.height) {
        const gx = Math.min(23, Math.floor(p.x / imageSize.width * 24)), gy = Math.min(23, Math.floor(p.y / imageSize.height * 24)), key = `${gx}:${gy}`;
        heatCounts.set(key, (heatCounts.get(key) || 0) + 1);
      }
    }
    if (heatMode !== 'off') {
      const max = Math.max(1, ...heatCounts.values());
      const color = heatMode === 'traffic' ? [104, 216, 192] : heatMode === 'kills' ? [255, 114, 129] : [187, 161, 255];
      for (const [key, count] of heatCounts) {
        const [gx, gy] = key.split(':').map(Number); const rect = svgElement('rect', { x: gx * imageSize.width / 24, y: gy * imageSize.height / 24, width: imageSize.width / 24, height: imageSize.height / 24, fill: `rgba(${color.join(',')},${0.10 + 0.52 * count / max})`, stroke: `rgba(${color.join(',')},.25)`, 'stroke-width': Math.max(imageSize.width / 1024, 1) });
        const title = svgElement('title'); title.textContent = `${count} recorded sample${count === 1 ? '' : 's'} in this grid cell`; rect.append(title); ui.heat.append(rect);
      }
    }
    const groups = new Map();
    for (const e of eventStream) {
      if (e.t > cursor || !['Position', 'BotPosition'].includes(e.type) || !finite(e.x) || !finite(e.z)) continue;
      const key = `${e.matchId}:${e.player.id}`;
      if (!groups.has(key)) groups.set(key, { player: e.player, matchId: e.matchId, points: [] });
      groups.get(key).points.push(normalizedPoint([e.t, e.x, e.z], mapId));
    }
    for (const group of groups.values()) {
      if (!group.points.length) continue;
      const bot = Boolean(group.player.bot) || /^\d+$/.test(String(group.player.id));
      const path = svgElement('path', { d: group.points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), fill: 'none', stroke: bot ? '#f2b879' : '#68d8c0', 'stroke-width': Math.max(2.3, imageSize.width / 420), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': bot ? `${imageSize.width / 105} ${imageSize.width / 125}` : '', opacity: activeData.length > 1 ? 0.43 : 0.82, 'vector-effect': 'non-scaling-stroke' });
      const title = svgElement('title'); title.textContent = `${bot ? 'Bot' : 'Human'} ${group.player.id} · match ${group.matchId}`; path.append(title); ui.paths.append(path);
    }
    for (const e of eventStream) {
      if (e.t > cursor || !EVENT_LABELS[e.type] || !finite(e.x) || !finite(e.z)) continue;
      const p = normalizedPoint([e.t, e.x, e.z], mapId), node = createEventMarker(e, p);
      ui.events.append(node); eventNodes.push({ node, event: e, point: p });
    }
    ui.outside.textContent = outside ? `${outside} out-of-map sample${outside === 1 ? '' : 's'} clipped` : '';
    ui.caption.textContent = `${MAPS[mapId].label} · ${activeData.length} ${activeData.length === 1 ? 'match' : 'matches'}`;
    updateTimelineCounts(eventStream);
  }
  function createEventMarker(e, p) {
    const color = EVENT_COLORS[e.type] || '#fff';
    let node;
    if (e.type === 'Loot') node = svgElement('rect', { x: p.x - 5, y: p.y - 5, width: 10, height: 10, transform: `rotate(45 ${p.x} ${p.y})`, fill: color, stroke: '#0b1117', 'stroke-width': 2, class: 'event-marker' });
    else if (e.type === 'Killed' || e.type === 'BotKilled') node = svgElement('circle', { cx: p.x, cy: p.y, r: 6, fill: '#111820', stroke: color, 'stroke-width': 3, class: 'event-marker' });
    else if (e.type === 'KilledByStorm') { node = svgElement('g', { class: 'event-marker' }); node.append(svgElement('circle', { cx: p.x, cy: p.y, r: 7, fill: '#111820', stroke: color, 'stroke-width': 2 }), svgElement('path', { d: `M${p.x - 4},${p.y - 4}L${p.x + 4},${p.y + 4}M${p.x + 4},${p.y - 4}L${p.x - 4},${p.y + 4}`, stroke: color, 'stroke-width': 2 })); }
    else node = svgElement('circle', { cx: p.x, cy: p.y, r: 5, fill: color, stroke: '#111820', 'stroke-width': 2, class: 'event-marker' });
    node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button'); node.setAttribute('aria-label', `${EVENT_LABELS[e.type]} by ${e.player.id} at ${fmtExact(e.t)}`);
    const title = svgElement('title'); title.textContent = `${EVENT_LABELS[e.type]} · ${e.player.id} · ${fmtExact(e.t)}`; node.append(title);
    node.addEventListener('pointerenter', (event) => showTooltip(event, e)); node.addEventListener('pointermove', placeTooltip); node.addEventListener('pointerleave', hideTooltip);
    node.addEventListener('focus', () => showTooltip(null, e)); node.addEventListener('blur', hideTooltip); node.addEventListener('click', () => setCursor(e.t));
    return node;
  }
  function showTooltip(pointer, event) {
    ui.tooltip.innerHTML = `<strong>${escapeHtml(EVENT_LABELS[event.type] || event.type)}</strong><br>${escapeHtml(event.player.id)} · ${escapeHtml(event.matchId)}<br>${fmtExact(event.t)} from match start`;
    ui.tooltip.hidden = false; placeTooltip(pointer);
  }
  function placeTooltip(event) {
    if (!event || !Number.isFinite(event.clientX)) return;
    const box = ui.mapViewport.getBoundingClientRect(); ui.tooltip.style.left = `${Math.min(box.width - 230, Math.max(8, event.clientX - box.left + 12))}px`; ui.tooltip.style.top = `${Math.min(box.height - 75, Math.max(8, event.clientY - box.top - 12))}px`;
  }
  function hideTooltip() { ui.tooltip.hidden = true; }
  function updateSummary() {
    if (!activeData.length) { ui.summary.innerHTML = '<p class="muted">Select a match to see its overview.</p>'; return; }
    const allPlayers = activeData.flatMap((item) => item.match.players || []);
    const humans = allPlayers.filter((p) => !(Boolean(p.bot) || /^\d+$/.test(String(p.id)))).length;
    const bots = allPlayers.length - humans;
    const events = playerEventStream().filter((e) => EVENT_LABELS[e.type]);
    const kills = events.filter((e) => e.type === 'Kill' || e.type === 'BotKill').length;
    const deaths = events.filter((e) => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.type)).length;
    const matchLabel = activeData.length === 1 ? activeData[0].id : `${activeData.length} matches selected`;
    ui.summary.innerHTML = `<div class="summary-id">${escapeHtml(matchLabel)}</div><div class="summary-stats"><div class="stat"><strong>${allPlayers.length}</strong><span>PLAYERS</span></div><div class="stat"><strong>${kills}</strong><span>KILLS</span></div><div class="stat"><strong>${deaths}</strong><span>DEATHS</span></div></div><div class="summary-meta"><span><strong>${humans}</strong> humans</span><span><strong>${bots}</strong> bots</span><span>longest <strong>${fmtTime(maxDuration)}</strong></span></div><span class="summary-badge">${escapeHtml(formatDate(ui.date.value))}${ui.date.value === '2026-02-14' ? ' · PARTIAL DAY' : ''}</span>`;
  }
  function updateEvents(render = true) {
    const events = cachedDiscrete;
    let low = 0, high = events.length;
    while (low < high) { const mid = (low + high) >> 1; if (events[mid].t <= cursor) low = mid + 1; else high = mid; }
    ui.eventCount.textContent = `${low} / ${events.length}`;
    if (!render) return;
    if (!events.length) { ui.eventList.innerHTML = '<p class="muted">No recorded combat, loot, or storm events for this selection.</p>'; return; }
    ui.eventList.innerHTML = events.map((e, i) => `<button type="button" class="event-row${e.t <= cursor && cursor - e.t < 0.15 ? ' is-current' : ''}" data-event-index="${i}" title="Jump to ${fmtExact(e.t)}"><span class="event-time">${fmtExact(e.t)}</span><i class="event-symbol ${escapeHtml(e.type)}" aria-hidden="true"></i><span><span class="event-title">${escapeHtml(EVENT_LABELS[e.type])}</span><span class="event-sub">${escapeHtml(e.player.id)}${activeData.length > 1 ? ` · ${escapeHtml(e.matchId.slice(0, 13))}…` : ''}</span></span></button>`).join('');
    ui.eventList.querySelectorAll('.event-row').forEach((row, i) => row.addEventListener('click', () => setCursor(events[i].t)));
  }
  function updateTimeline() {
    ui.timeline.max = String(maxDuration); ui.timeline.value = String(Math.min(cursor, maxDuration)); ui.timeline.disabled = !activeData.length; ui.play.disabled = !activeData.length || maxDuration <= 0;
    ui.current.textContent = fmtExact(cursor); ui.duration.textContent = `/ ${fmtTime(maxDuration)}`;
    ui.context.textContent = activeData.length > 1 ? `All matches · shared elapsed-time cursor; each journey starts at 00:00.` : activeData.length ? `Match ${activeData[0].id} · recorded time relative to match start.` : 'Choose a match to scrub through recorded time.';
    const events = matchesEvents().filter((e) => EVENT_LABELS[e.type]);
    ui.ticks.replaceChildren();
    for (const e of events) { const tick = document.createElement('i'); tick.style.left = `${maxDuration ? e.t / maxDuration * 100 : 0}%`; tick.title = `${EVENT_LABELS[e.type]} at ${fmtExact(e.t)}`; ui.ticks.append(tick); }
    ui.timeline.style.setProperty('--progress', `${maxDuration ? cursor / maxDuration * 100 : 0}%`);
    updateTimelineCounts(matchesEvents());
  }
  function updateTimelineCounts() {
    let low = 0, high = cachedDiscrete.length;
    while (low < high) { const mid = (low + high) >> 1; if (cachedDiscrete[mid].t <= cursor) low = mid + 1; else high = mid; }
    ui.tickCount.textContent = `${low} / ${cachedDiscrete.length} events shown`;
  }
  function setCursor(time) { cursor = Math.max(0, Math.min(maxDuration, Number(time) || 0)); ui.timeline.value = String(cursor); ui.current.textContent = fmtExact(cursor); ui.timeline.style.setProperty('--progress', `${maxDuration ? cursor / maxDuration * 100 : 0}%`); draw(); updateEvents(false); }
  function stopPlayback() { playing = false; cancelAnimationFrame(raf); raf = 0; ui.playIcon.textContent = '▶'; ui.play.setAttribute('aria-label', 'Play timeline'); }
  function playFrame(now) {
    if (!playing) return;
    if (!lastFrame) lastFrame = now;
    const elapsed = Math.min(0.2, (now - lastFrame) / 1000); lastFrame = now;
    cursor += elapsed * Number(ui.speed.value || 1);
    if (cursor >= maxDuration) { cursor = maxDuration; setCursor(cursor); stopPlayback(); return; }
    setCursor(cursor); raf = requestAnimationFrame(playFrame);
  }
  function startPlayback() { if (!activeData.length || maxDuration <= 0) return; if (cursor >= maxDuration) setCursor(0); playing = true; lastFrame = 0; ui.playIcon.textContent = 'Ⅱ'; ui.play.setAttribute('aria-label', 'Pause timeline'); raf = requestAnimationFrame(playFrame); }
  function fitView() { view = { x: 0, y: 0, width: imageSize.width, height: imageSize.height }; applyView(); }
  function applyView() { if (view) ui.mapSvg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`); ui.zoomIn.disabled = !imageLoaded; ui.zoomOut.disabled = !imageLoaded; ui.fit.disabled = !imageLoaded; }
  function zoom(factor, centerX, centerY) {
    if (!view || !imageLoaded) return;
    const width = Math.max(imageSize.width / 6, Math.min(imageSize.width * 2.5, view.width * factor));
    const height = width * imageSize.height / imageSize.width;
    const cx = centerX ?? view.x + view.width / 2, cy = centerY ?? view.y + view.height / 2;
    const ratio = width / view.width; view = { x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio, width, height }; applyView();
  }
  function pointerToImage(event) {
    const matrix = ui.mapSvg.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: view.x, y: view.y };
  }
  function updateHeatNote() {
    const descriptions = {
      traffic: 'Traffic grid counts Position and BotPosition telemetry samples.',
      kills: 'Kill grid counts Kill and BotKill event telemetry.',
      deaths: 'Death grid counts Killed, BotKilled, and KilledByStorm event telemetry (storm included).'
    };
    ui.heatNote.textContent = heatMode === 'off' ? '' : `${descriptions[heatMode]} Event attribution is unverified. Raw square-cell counts; no smoothing, interpolation, or prediction.`;
    ui.heatNote.hidden = heatMode === 'off';
  }
  function setupMapInteractions() {
    ui.zoomIn.addEventListener('click', () => zoom(.78)); ui.zoomOut.addEventListener('click', () => zoom(1.28)); ui.fit.addEventListener('click', fitView);
    ui.mapViewport.addEventListener('wheel', (event) => { if (!imageLoaded) return; event.preventDefault(); const p = pointerToImage(event); zoom(event.deltaY < 0 ? .88 : 1.14, p.x, p.y); }, { passive: false });
    ui.mapViewport.addEventListener('pointerdown', (event) => { if (!imageLoaded || event.target.closest('.event-marker')) return; const matrix = ui.mapSvg.getScreenCTM(); if (!matrix) return; ui.mapViewport.setPointerCapture(event.pointerId); ui.mapViewport.classList.add('is-dragging'); ui.mapViewport.dataset.drag = `${event.pointerId},${event.clientX},${event.clientY},${view.x},${view.y},${1 / matrix.a},${1 / matrix.d}`; });
    ui.mapViewport.addEventListener('pointermove', (event) => { const drag = ui.mapViewport.dataset.drag; if (!drag) return; const [id, x, y, ox, oy, scaleX, scaleY] = drag.split(',').map(Number); if (id !== event.pointerId) return; view.x = ox - (event.clientX - x) * scaleX; view.y = oy - (event.clientY - y) * scaleY; applyView(); });
    const endDrag = (event) => { if (ui.mapViewport.dataset.drag) { delete ui.mapViewport.dataset.drag; ui.mapViewport.classList.remove('is-dragging'); } }; ui.mapViewport.addEventListener('pointerup', endDrag); ui.mapViewport.addEventListener('pointercancel', endDrag);
  }
  function refreshAll() { updateMatches(); }
  ui.map.addEventListener('change', () => { updateDates(); refreshAll(); });
  ui.date.addEventListener('change', refreshAll);
  ui.match.addEventListener('change', loadSelection);
  ui.timeline.addEventListener('input', () => { if (playing) stopPlayback(); setCursor(Number(ui.timeline.value)); });
  ui.play.addEventListener('click', () => playing ? stopPlayback() : startPlayback());
  ui.heatMode.addEventListener('change', () => { heatMode = ui.heatMode.value; updateHeatNote(); draw(); });
  ui.reset.addEventListener('click', () => { fitView(); ui.heatMode.value = 'off'; heatMode = 'off'; updateHeatNote(); setCursor(maxDuration); });
  setupMapInteractions();
  fetch('data/manifest.json').then((response) => { if (!response.ok) throw new Error(`Could not load data/manifest.json (${response.status}).`); return response.json(); }).then((data) => {
    if (!data || !Array.isArray(data.datasets)) throw new Error('The manifest is missing its datasets list.');
    manifest = data; initFilters(); ui.heatMode.disabled = false; setStatus(`${datasetsForFilters().length} map/date datasets indexed`, true);
  }).catch((error) => { setStatus('Index unavailable'); setNotice(`${error.message} Serve the viewer over HTTP so relative JSON data can be fetched.`, true); ui.map.innerHTML = '<option>Unavailable</option>'; ui.date.innerHTML = '<option>Unavailable</option>'; ui.match.innerHTML = '<option>Unavailable</option>'; emptyState('Match index is unavailable.'); });
})();
