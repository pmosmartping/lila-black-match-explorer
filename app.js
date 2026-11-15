(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ui = {
    status: $('statusText'), map: $('mapSelect'), date: $('dateSelect'), customDateBtn: $('customDateBtn'),
    match: $('matchSelect'), customMatchBtn: $('customMatchBtn'), reset: $('resetButton'), notice: $('notice'),
    mapHeading: $('mapHeading'), mapViewport: $('mapViewport'), mapSvg: $('mapSvg'), mapImage: $('mapImage'), heatImage: $('heatImage'),
    mapEmpty: $('mapEmpty'), heat: $('heatLayer'), paths: $('pathLayer'), events: $('eventLayer'), caption: $('mapCaption'), outside: $('outsideCount'), tooltip: $('mapTooltip'),
    zoomIn: $('zoomIn'), zoomOut: $('zoomOut'), fit: $('fitButton'),
    chipTraffic: $('chipTraffic'), chipKills: $('chipKills'), chipDeaths: $('chipDeaths'),
    chipClearHeat: $('chipClearHeat'), heatStatusBadge: $('heatStatusBadge'),
    heatNote: $('heatNote'), summary: $('summaryContent'),
    // Section 05: Level Intelligence & Smart Analysis
    tabInsights: $('tabInsights'), tabSmart: $('tabSmart'), tabCombat: $('tabCombat'), tabAll: $('tabAll'),
    viewInsights: $('viewInsights'), viewSmart: $('viewSmart'), viewCombat: $('viewCombat'), viewAll: $('viewAll'),
    insightContainer: $('insightContainer'),
    // Smart Analysis UI & Modal
    openSmartModalBtn: $('openSmartModalBtn'),
    expandSmartModalBtn: $('expandSmartModalBtn'),
    smartAnalysisModal: $('smartAnalysisModal'),
    closeSmartModal: $('closeSmartModal'),
    closeSmartModalBtn: $('closeSmartModalBtn'),
    smartModalFocusSelect: $('smartModalFocusSelect'),
    aiModalStatusPill: $('aiModalStatusPill'),
    aiModalStatusLabel: $('aiModalStatusLabel'),
    aiModalNoticeBanner: $('aiModalNoticeBanner'),
    runSmartModalAnalysis: $('runSmartModalAnalysis'),
    smartModalStreamingWrap: $('smartModalStreamingWrap'),
    smartModalStreamTitle: $('smartModalStreamTitle'),
    smartModalStreamModel: $('smartModalStreamModel'),
    smartModalTextDisplay: $('smartModalTextDisplay'),
    smartModalScopeInfo: $('smartModalScopeInfo'),
    copySmartModalAnalysis: $('copySmartModalAnalysis'),
    rerunSmartModalAnalysis: $('rerunSmartModalAnalysis'),
    aiStatusPill: $('aiStatusPill'), aiStatusLabel: $('aiStatusLabel'), aiNoticeBanner: $('aiNoticeBanner'),
    smartFocusSelect: $('smartFocusSelect'), runSmartAnalysis: $('runSmartAnalysis'),
    smartEmptyState: $('smartEmptyState'), smartStreamingWrap: $('smartStreamingWrap'),
    smartStreamTitle: $('smartStreamTitle'), smartStreamModel: $('smartStreamModel'),
    smartTextDisplay: $('smartTextDisplay'), smartStreamFooter: $('smartStreamFooter'),
    copySmartAnalysis: $('copySmartAnalysis'), rerunSmartAnalysis: $('rerunSmartAnalysis'),
    combatFeedCount: $('combatFeedCount'), combatFeedList: $('combatFeedList'),
    allSignalsFilter: $('allSignalsFilter'), eventList: $('eventList'), eventCount: $('eventCount'),
    timeline: $('timeline'), play: $('playButton'), playIcon: $('playIcon'), current: $('currentTime'), duration: $('durationLabel'),
    context: $('timelineContext'), ticks: $('timelineTicks'), tickCount: $('timelineEventCount'), speed: $('speedSelect'),
    // Modals
    dateModal: $('datePickerModal'), closeDateModal: $('closeDatePicker'), dateList: $('modalDateList'), dateCount: $('modalDateCount'),
    selectAllDates: $('selectAllDates'), clearAllDates: $('clearAllDates'), applyDates: $('applyDateSelection'),
    matchModal: $('matchPickerModal'), closeMatchModal: $('closeMatchPicker'), matchSearch: $('matchSearch'),
    matchList: $('modalMatchList'), matchCount: $('modalSelectedCount'),
    selectAllMatches: $('selectAllMatches'), clearAllMatches: $('clearAllMatches'), applyMatches: $('applyMatchSelection')
  };
  const MAPS = {
    AmbroseValley: { label: 'Ambrose Valley', originX: -370, originZ: -473, scale: 900, asset: 'assets/minimaps/AmbroseValley.webp' },
    GrandRift: { label: 'Grand Rift', originX: -290, originZ: -290, scale: 581, asset: 'assets/minimaps/GrandRift.webp' },
    Lockdown: { label: 'Lockdown', originX: -500, originZ: -500, scale: 1000, asset: 'assets/minimaps/Lockdown.webp' }
  };
  const EVENT_COLORS = { Kill: '#ff7281', BotKill: '#f39a8f', Killed: '#f7edf0', BotKilled: '#ffc178', Loot: '#72b7ff', KilledByStorm: '#bba1ff' };
  const EVENT_LABELS = { Kill: 'Kill · record', BotKill: 'BotKill · bot-tagged record', Killed: 'Killed · death record', BotKilled: 'BotKilled · bot-tagged death', Loot: 'Loot · record', KilledByStorm: 'KilledByStorm · storm death' };
  const dataCache = new Map();
  let manifest = null, activeData = [], maxDuration = 0, cursor = 0, playing = false, raf = 0, lastFrame = 0, view = null, imageSize = { width: 1024, height: 1024 }, imageLoaded = false, selectionToken = 0, eventNodes = [], mapKey = '', cachedStream = [], cachedDiscrete = [], cachedCombatEvents = [];
  
  // Filter & comparison state
  let selectedDates = [];
  let isAllDates = false;
  let selectedMatchIds = '*'; // '*' or Set of string match IDs or single match string
  let activeHeatModes = new Set(); // Set of 'traffic', 'kills', 'deaths'
  let activeIntelTab = 'insights'; // 'insights' | 'smart' | 'combat' | 'all'
  let ollamaConnected = false;
  let ollamaModel = 'llama3.2:latest';
  let isAnalyzing = false;
  let typewriterInterval = null;
  let typewriterQueue = [];
  let isTypewriterActive = false;
  let currentRawAiOutput = '';

  const svgNS = 'http://www.w3.org/2000/svg';
  const finite = (n) => Number.isFinite(Number(n));
  const fmtTime = (s) => { const value = Math.max(0, Math.floor(Number(s) || 0)); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; };
  const fmtExact = (s) => `${fmtTime(s)}${Math.floor((Number(s) || 0) % 1 * 10) ? `.${Math.floor((Number(s) || 0) % 1 * 10)}` : ''}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const setNotice = (message, error = false) => { ui.notice.textContent = message; ui.notice.hidden = !message; ui.notice.classList.toggle('is-error', error); };
  function setStatus(text, ready = false) { ui.status.textContent = text; document.querySelector('.status-dot').classList.toggle('ready', ready); }
  function svgElement(tag, attrs = {}) { const el = document.createElementNS(svgNS, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; }
  function datasetsForFilters() { return manifest.datasets.filter((entry) => entry && entry.map && entry.date && entry.file && MAPS[entry.map]); }

  function availableDatesForMap() {
    return [...new Set(datasetsForFilters().filter((d) => d.map === ui.map.value).map((d) => d.date))].sort();
  }

  function initFilters() {
    const entries = datasetsForFilters();
    const maps = [...new Set(entries.map((d) => d.map))].sort((a, b) => a.localeCompare(b));
    ui.map.innerHTML = maps.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(MAPS[id].label)}</option>`).join('');
    ui.map.disabled = !maps.length;
    if (!maps.length) throw new Error('The manifest contains no supported map datasets.');
    ui.map.value = maps.includes('AmbroseValley') ? 'AmbroseValley' : maps[0];
    ui.date.disabled = false; ui.customDateBtn.disabled = false; ui.match.disabled = false; ui.customMatchBtn.disabled = false; ui.reset.disabled = false;
    selectedDates = [];
    isAllDates = false;
    selectedMatchIds = '*';
    updateDates();
    updateMatches();
  }

  function updateDates() {
    const dates = availableDatesForMap();
    if (!dates.length) {
      ui.date.innerHTML = '<option value="">No dates available</option>';
      ui.customDateBtn.disabled = true;
      selectedDates = [];
      return;
    }
    ui.customDateBtn.disabled = false;
    
    // Validate current selection
    if (!selectedDates.length || (!isAllDates && !selectedDates.some((d) => dates.includes(d)))) {
      // Default to latest date
      selectedDates = [dates[dates.length - 1]];
      isAllDates = false;
    }

    let dateOptions = '';
    const allLabel = `All recorded dates (${dates.length} days · Feb 10 — 14)`;
    dateOptions += `<option value="*"${isAllDates ? ' selected' : ''}>${escapeHtml(allLabel)}</option>`;

    if (!isAllDates && selectedDates.length > 1) {
      dateOptions += `<option value="custom" selected>Custom (${selectedDates.length} dates selected)</option>`;
    }

    dateOptions += dates.slice().reverse().map((date) => {
      const isSel = !isAllDates && selectedDates.length === 1 && selectedDates[0] === date;
      const formatted = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `<option value="${escapeHtml(date)}"${isSel ? ' selected' : ''}>${escapeHtml(formatted)}${date === '2026-02-14' ? ' · partial' : ''}</option>`;
    }).join('');

    ui.date.innerHTML = dateOptions;
  }

  function matchingEntries() {
    const entries = datasetsForFilters().filter((d) => d.map === ui.map.value);
    if (isAllDates) return entries;
    const dateSet = new Set(selectedDates);
    return entries.filter((d) => dateSet.has(d.date));
  }

  function matchesForCurrentSelection() {
    const found = new Map();
    for (const entry of matchingEntries()) {
      for (const match of (entry.matches || [])) {
        if (match && match.id != null) {
          found.set(String(match.id), { ...match, id: String(match.id), file: entry.file, date: entry.date });
        }
      }
    }
    return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  function updateMatches() {
    const matches = matchesForCurrentSelection();
    ui.customMatchBtn.disabled = !matches.length;
    
    // Check if selected match is still valid
    if (selectedMatchIds instanceof Set) {
      const availableIds = new Set(matches.map((m) => m.id));
      const valid = new Set([...selectedMatchIds].filter((id) => availableIds.has(id)));
      if (!valid.size) selectedMatchIds = '*';
      else selectedMatchIds = valid;
    } else if (selectedMatchIds !== '*' && !matches.some((m) => m.id === selectedMatchIds)) {
      selectedMatchIds = '*';
    }

    let matchOptions = '';
    const isMultiDate = isAllDates || selectedDates.length > 1;

    if (selectedMatchIds === '*') {
      matchOptions += `<option value="*" selected>All matches · ${matches.length}</option>`;
    } else {
      matchOptions += `<option value="*">All matches · ${matches.length}</option>`;
    }

    if (selectedMatchIds instanceof Set) {
      matchOptions += `<option value="custom" selected>Custom selection (${selectedMatchIds.size} matches)</option>`;
    }

    matchOptions += matches.map((match) => {
      const isSel = (selectedMatchIds instanceof Set) ? false : selectedMatchIds === match.id;
      const label = isMultiDate ? `${match.id.slice(0, 14)}… (${match.date.slice(5)})` : match.id;
      return `<option value="${escapeHtml(match.id)}"${isSel ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');

    ui.match.innerHTML = matchOptions;
    ui.match.disabled = !matches.length;
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
    activeData = []; cachedStream = []; cachedDiscrete = []; cachedCombatEvents = []; cursor = 0; maxDuration = 0; resetLayer(); setNotice('');
    currentRawAiOutput = '';
    if (ui.smartEmptyState) ui.smartEmptyState.hidden = false;
    if (ui.smartStreamingWrap) ui.smartStreamingWrap.hidden = true;
    if (ui.smartModalStreamingWrap) ui.smartModalStreamingWrap.hidden = true;
    if (ui.smartTextDisplay) ui.smartTextDisplay.innerHTML = '';
    if (ui.smartModalTextDisplay) ui.smartModalTextDisplay.innerHTML = '';

    const mapLabel = MAPS[ui.map.value]?.label || 'Match';
    const datesLabel = isAllDates ? 'All recorded dates (Feb 10 — 14)' : selectedDates.map(formatDate).join(', ');
    ui.mapHeading.textContent = `${mapLabel} · ${datesLabel}`;

    const allMatches = matchesForCurrentSelection();
    if (!allMatches.length) {
      emptyState('No matches available for this date selection.');
      updateSummary(); updateInsights(); updateCombatFeed(); updateEvents(); updateTimeline(); return;
    }

    setStatus('Loading match data…');
    ui.mapEmpty.hidden = false;
    ui.mapEmpty.innerHTML = '<span class="empty-symbol" aria-hidden="true">◌</span><strong>Loading recorded journeys</strong><span>Preparing map and player events…</span>';

    try {
      let targetIds;
      if (selectedMatchIds === '*') {
        targetIds = new Set(allMatches.map((m) => m.id));
      } else if (selectedMatchIds instanceof Set) {
        targetIds = selectedMatchIds;
      } else {
        targetIds = new Set([String(selectedMatchIds)]);
      }

      const entries = matchingEntries();
      const neededEntries = entries.filter((entry) => (entry.matches || []).some((m) => targetIds.has(String(m.id))));
      const files = [...new Set(neededEntries.map((e) => e.file))];
      const loaded = await Promise.all(files.map(async (file) => [file, await getFile(neededEntries.find((e) => e.file === file))]));
      if (token !== selectionToken) return;

      const byFile = new Map(loaded);
      for (const [file, payload] of byFile) {
        const sourceMatches = payload?.matches;
        if (!sourceMatches || typeof sourceMatches !== 'object') continue;
        for (const [id, match] of Object.entries(sourceMatches)) {
          if (targetIds.has(String(id)) && validMatch(match)) {
            activeData.push({ id: String(id), match, file });
          }
        }
      }
      activeData.sort((a, b) => a.id.localeCompare(b.id));
      cachedStream = playerEventStream();
      cachedDiscrete = cachedStream.filter((e) => EVENT_LABELS[e.type]);
      cachedCombatEvents = cachedDiscrete.filter((e) => ['Kill', 'BotKill', 'Killed', 'BotKilled', 'KilledByStorm'].includes(e.type));
      maxDuration = activeData.reduce((longest, item) => Math.max(longest, Number(item.match.duration) || 0), 0);
      cursor = maxDuration;
      await loadMapImage(ui.map.value);
      if (token !== selectionToken) return;

      if (!activeData.length) {
        setStatus('No journey data');
        setNotice('The selected criteria contained no valid match records.', true);
        emptyState('No journey data found.');
      } else {
        setStatus(`${activeData.length} ${activeData.length === 1 ? 'match' : 'matches'} ready`, true);
        ui.mapSvg.removeAttribute('hidden');
        ui.mapEmpty.hidden = true;
      }
      updateSummary(); updateInsights(); updateCombatFeed(); updateEvents(); updateTimeline(); draw();
    } catch (error) {
      if (token !== selectionToken) return;
      setStatus('Unable to load data');
      setNotice(`${error.message} Check that data/manifest.json and files are reachable.`, true);
      emptyState('Data could not be loaded.');
      updateSummary(); updateInsights(); updateCombatFeed(); updateEvents(); updateTimeline();
    }
  }

  function formatDate(date) {
    if (!date) return 'No date';
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function emptyState(text) {
    ui.mapSvg.setAttribute('hidden', '');
    ui.mapEmpty.hidden = false;
    ui.mapEmpty.innerHTML = `<span class="empty-symbol" aria-hidden="true">⌖</span><strong>${escapeHtml(text)}</strong><span>Try another date or match selection.</span>`;
  }
  function loadMapImage(mapId) {
    const map = MAPS[mapId]; if (!map) return Promise.reject(new Error(`Unsupported map: ${mapId}`));
    if (mapKey === mapId && imageLoaded) return Promise.resolve();
    mapKey = mapId; imageLoaded = false;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageSize = { width: img.naturalWidth, height: img.naturalHeight };
        imageLoaded = true;
        ui.mapSvg.setAttribute('viewBox', `0 0 ${imageSize.width} ${imageSize.height}`);
        ui.mapImage.setAttribute('href', map.asset);
        ui.mapImage.setAttribute('width', imageSize.width);
        ui.mapImage.setAttribute('height', imageSize.height);
        if (ui.heatImage) {
          ui.heatImage.setAttribute('width', imageSize.width);
          ui.heatImage.setAttribute('height', imageSize.height);
        }
        fitView();
        resolve();
      };
      img.onerror = () => { mapKey = ''; reject(new Error(`Could not load minimap ${map.asset}.`)); };
      img.src = map.asset;
    });
  }
  function resetLayer() {
    if (ui.heatImage) {
      ui.heatImage.removeAttribute('href');
      ui.heatImage.setAttribute('display', 'none');
    }
    ui.paths.replaceChildren();
    ui.events.replaceChildren();
    eventNodes = [];
    ui.outside.textContent = '';
  }

  // --- Smooth Multi-Layer Heatmap Engine ---
  const HEAT_RES = 512;
  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = HEAT_RES;
  heatCanvas.height = HEAT_RES;
  const heatCtx = heatCanvas.getContext('2d', { willReadFrequently: true });

  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = HEAT_RES;
  layerCanvas.height = HEAT_RES;
  const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true });

  const brushCache = new Map();
  function getBrush(radius) {
    if (brushCache.has(radius)) return brushCache.get(radius);
    const brush = document.createElement('canvas');
    const size = radius * 2;
    brush.width = size;
    brush.height = size;
    const bctx = brush.getContext('2d');
    const grad = bctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.2, 'rgba(0,0,0,0.75)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0.35)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(radius, radius, radius, 0, Math.PI * 2);
    bctx.fill();
    brushCache.set(radius, brush);
    return brush;
  }

  const paletteCache = {};
  function getPalette(mode) {
    if (paletteCache[mode]) return paletteCache[mode];
    const pcanvas = document.createElement('canvas');
    pcanvas.width = 256;
    pcanvas.height = 1;
    const pctx = pcanvas.getContext('2d');
    const grad = pctx.createLinearGradient(0, 0, 256, 0);

    if (mode === 'traffic') {
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.10, 'rgba(18, 70, 68, 0.28)');
      grad.addColorStop(0.28, 'rgba(35, 140, 130, 0.58)');
      grad.addColorStop(0.52, 'rgba(64, 210, 195, 0.80)');
      grad.addColorStop(0.76, 'rgba(92, 240, 224, 0.94)');
      grad.addColorStop(0.92, 'rgba(195, 255, 248, 0.98)');
      grad.addColorStop(1.00, 'rgba(255, 255, 255, 1.0)');
    } else if (mode === 'kills') {
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.10, 'rgba(120, 20, 35, 0.28)');
      grad.addColorStop(0.28, 'rgba(195, 45, 65, 0.62)');
      grad.addColorStop(0.52, 'rgba(255, 95, 105, 0.84)');
      grad.addColorStop(0.74, 'rgba(255, 160, 60, 0.94)');
      grad.addColorStop(0.90, 'rgba(255, 225, 90, 0.98)');
      grad.addColorStop(1.00, 'rgba(255, 255, 230, 1.0)');
    } else if (mode === 'deaths') {
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.10, 'rgba(65, 25, 105, 0.28)');
      grad.addColorStop(0.28, 'rgba(125, 65, 195, 0.62)');
      grad.addColorStop(0.52, 'rgba(175, 125, 255, 0.84)');
      grad.addColorStop(0.74, 'rgba(215, 175, 255, 0.94)');
      grad.addColorStop(0.90, 'rgba(245, 220, 255, 0.98)');
      grad.addColorStop(1.00, 'rgba(255, 255, 255, 1.0)');
    }
    pctx.fillStyle = grad;
    pctx.fillRect(0, 0, 256, 1);
    paletteCache[mode] = pctx.getImageData(0, 0, 256, 1).data;
    return paletteCache[mode];
  }

  function drawLayerPoints(targetCtx, points, mode) {
    targetCtx.clearRect(0, 0, HEAT_RES, HEAT_RES);
    if (!points || !points.length) return false;
    const scale = HEAT_RES / imageSize.width;
    const isTraffic = mode === 'traffic';
    const radius = isTraffic ? 22 : 30;
    const baseAlpha = isTraffic
      ? (points.length > 3000 ? 0.045 : points.length > 800 ? 0.085 : 0.16)
      : (points.length > 250 ? 0.20 : points.length > 50 ? 0.32 : 0.48);

    const brush = getBrush(radius);
    targetCtx.globalAlpha = baseAlpha;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      targetCtx.drawImage(brush, p.x * scale - radius, p.y * scale - radius);
    }
    const imgData = targetCtx.getImageData(0, 0, HEAT_RES, HEAT_RES);
    const pixels = imgData.data;
    const palette = getPalette(mode);
    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i + 3];
      if (a > 0) {
        const offset = a * 4;
        pixels[i] = palette[offset];
        pixels[i + 1] = palette[offset + 1];
        pixels[i + 2] = palette[offset + 2];
        pixels[i + 3] = palette[offset + 3];
      }
    }
    targetCtx.putImageData(imgData, 0, 0);
    return true;
  }

  function renderMultiHeatmap(layers) {
    if (!ui.heatImage) return;
    const activeLayersCount = (layers.traffic ? 1 : 0) + (layers.kills ? 1 : 0) + (layers.deaths ? 1 : 0);
    if (activeLayersCount === 0) {
      ui.heatImage.removeAttribute('href');
      ui.heatImage.setAttribute('display', 'none');
      return;
    }
    heatCtx.clearRect(0, 0, HEAT_RES, HEAT_RES);

    // 1. Base traffic layer
    if (layers.traffic && layers.traffic.length) {
      if (drawLayerPoints(layerCtx, layers.traffic, 'traffic')) {
        heatCtx.drawImage(layerCanvas, 0, 0);
      }
    }
    // 2. Kills layer (composited with punchy highlight)
    if (layers.kills && layers.kills.length) {
      if (drawLayerPoints(layerCtx, layers.kills, 'kills')) {
        heatCtx.drawImage(layerCanvas, 0, 0);
      }
    }
    // 3. Deaths layer
    if (layers.deaths && layers.deaths.length) {
      if (drawLayerPoints(layerCtx, layers.deaths, 'deaths')) {
        heatCtx.drawImage(layerCanvas, 0, 0);
      }
    }

    ui.heatImage.setAttribute('href', heatCanvas.toDataURL('image/png'));
    ui.heatImage.removeAttribute('display');
  }

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

  function draw() {
    resetLayer();
    if (!activeData.length || !imageLoaded) return;
    const mapId = ui.map.value, eventStream = matchesEvents();
    let outside = 0;

    const needTraffic = activeHeatModes.has('traffic');
    const needKills = activeHeatModes.has('kills');
    const needDeaths = activeHeatModes.has('deaths');

    const trafficPoints = [];
    const killPoints = [];
    const deathPoints = [];

    for (const e of eventStream) {
      if (e.t > cursor || !finite(e.x) || !finite(e.z)) continue;
      const p = normalizedPoint([e.t, e.x, e.z], mapId);
      if (p.x < 0 || p.y < 0 || p.x > imageSize.width || p.y > imageSize.height) {
        outside++;
        continue;
      }
      if (needTraffic && (e.type === 'Position' || e.type === 'BotPosition')) {
        trafficPoints.push(p);
      }
      if (needKills && (e.type === 'Kill' || e.type === 'BotKill')) {
        killPoints.push(p);
      }
      if (needDeaths && (e.type === 'Killed' || e.type === 'BotKilled' || e.type === 'KilledByStorm')) {
        deathPoints.push(p);
      }
    }

    renderMultiHeatmap({
      traffic: needTraffic ? trafficPoints : null,
      kills: needKills ? killPoints : null,
      deaths: needDeaths ? deathPoints : null
    });

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
    if (!activeData.length) { ui.summary.innerHTML = '<p class="muted">Select a match or date to see its overview.</p>'; return; }
    const allPlayers = activeData.flatMap((item) => item.match.players || []);
    const humans = allPlayers.filter((p) => !(Boolean(p.bot) || /^\d+$/.test(String(p.id)))).length;
    const bots = allPlayers.length - humans;
    const events = playerEventStream().filter((e) => EVENT_LABELS[e.type]);
    const kills = events.filter((e) => e.type === 'Kill' || e.type === 'BotKill').length;
    const deaths = events.filter((e) => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.type)).length;
    const matchLabel = activeData.length === 1 ? activeData[0].id : `${activeData.length} matches selected`;
    const scopeDates = isAllDates ? 'All dates (Feb 10 — 14)' : selectedDates.map(formatDate).join(', ');

    ui.summary.innerHTML = `
      <div class="summary-id">${escapeHtml(matchLabel)}</div>
      <div class="summary-stats">
        <div class="stat${activeHeatModes.has('traffic') ? ' is-active-traffic' : ''}" data-metric="traffic" title="Click to toggle traffic density heatmap">
          <strong>${allPlayers.length}</strong><span>JOURNEYS</span>
        </div>
        <div class="stat${activeHeatModes.has('kills') ? ' is-active-kills' : ''}" data-metric="kills" title="Click to toggle combat kills heatmap">
          <strong>${kills}</strong><span>KILL RECORDS</span>
        </div>
        <div class="stat${activeHeatModes.has('deaths') ? ' is-active-deaths' : ''}" data-metric="deaths" title="Click to toggle casualty deaths heatmap">
          <strong>${deaths}</strong><span>DEATH RECORDS</span>
        </div>
      </div>
      <div class="summary-meta">
        <span><strong>${humans}</strong> human</span>
        <span><strong>${bots}</strong> bot</span>
        <span>longest <strong>${fmtTime(maxDuration)}</strong></span>
      </div>
      <div class="summary-scope">
        <span class="scope-label">VIEW SCOPE</span>
        <strong>${escapeHtml(scopeDates)}</strong>
      </div>
    `;

    ui.summary.querySelectorAll('.stat').forEach((card) => {
      card.addEventListener('click', () => {
        const metric = card.dataset.metric;
        if (!metric) return;
        if (activeHeatModes.has(metric)) activeHeatModes.delete(metric);
        else activeHeatModes.add(metric);
        syncHeatControls();
      });
    });
  }

  function updateInsights() {
    if (!ui.insightContainer) return;
    if (!activeData.length) {
      ui.insightContainer.innerHTML = '<p class="muted">Select a match or date to view level pacing and combat insights.</p>';
      return;
    }

    const events = cachedDiscrete;
    const combatEvents = cachedCombatEvents;
    const killEvents = combatEvents.filter((e) => e.type === 'Kill' || e.type === 'BotKill');
    const deathEvents = combatEvents.filter((e) => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.type));
    const stormEvents = combatEvents.filter((e) => e.type === 'KilledByStorm');
    const lootEvents = events.filter((e) => e.type === 'Loot');

    // 1. Pacing & First Contact
    const firstCombat = combatEvents.length ? combatEvents[0] : null;
    const firstKill = killEvents.length ? killEvents[0] : null;
    const firstBloodTime = firstKill ? firstKill.t : (firstCombat ? firstCombat.t : null);

    // Peak Combat Minute
    const minuteCounts = new Map();
    for (const e of combatEvents) {
      const min = Math.floor(e.t / 60);
      minuteCounts.set(min, (minuteCounts.get(min) || 0) + 1);
    }
    let peakMin = 0;
    let peakCount = 0;
    for (const [min, count] of minuteCounts.entries()) {
      if (count > peakCount) {
        peakCount = count;
        peakMin = min;
      }
    }
    const peakMinFormatted = peakCount > 0 ? `Min ${String(peakMin).padStart(2, '0')}–${String(peakMin + 1).padStart(2, '0')}` : '—';
    const peakJumpTime = peakCount > 0 ? (peakMin * 60 + 30) : null;

    // Last combat event for final showdown
    const lastCombat = combatEvents.length ? combatEvents[combatEvents.length - 1] : null;

    // Combat Tempo
    const durationMinutes = Math.max(0.5, maxDuration / 60);
    const tempoRate = (killEvents.length / durationMinutes).toFixed(1);

    // 2. Phase Breakdown (Early: 0-3m, Mid: 3-8m, Late: 8m+)
    let earlyCount = 0, midCount = 0, lateCount = 0;
    for (const e of combatEvents) {
      if (e.t < 180) earlyCount++;
      else if (e.t < 480) midCount++;
      else lateCount++;
    }
    const totalCombat = combatEvents.length;
    const earlyPct = totalCombat > 0 ? Math.round((earlyCount / totalCombat) * 100) : 0;
    const midPct = totalCombat > 0 ? Math.round((midCount / totalCombat) * 100) : 0;
    const latePct = totalCombat > 0 ? Math.max(0, 100 - earlyPct - midPct) : 0;

    // 3. Lethality Breakdown
    const humanKills = killEvents.filter((e) => e.type === 'Kill').length;
    const botKills = killEvents.filter((e) => e.type === 'BotKill').length;
    const stormCasualties = stormEvents.length;
    const totalDeaths = deathEvents.length;
    const stormPct = totalDeaths > 0 ? Math.round((stormCasualties / totalDeaths) * 100) : 0;

    ui.insightContainer.innerHTML = `
      <div class="insight-card">
        <div class="insight-card-header">
          <span class="insight-card-title">PACING &amp; FIRST CONTACT</span>
          <span class="view-bar-count">${tempoRate} kills / min</span>
        </div>
        <div class="insight-pacing-row">
          <div class="pacing-stat">
            <span class="pacing-val">${firstBloodTime !== null ? fmtExact(firstBloodTime) : 'None'}</span>
            <span class="pacing-lbl">First Blood</span>
            ${firstBloodTime !== null ? `<button type="button" class="pacing-jump-btn" data-jump="${firstBloodTime}" title="Jump to first kill">⌖ Jump</button>` : ''}
          </div>
          <div class="pacing-stat">
            <span class="pacing-val">${peakMinFormatted}</span>
            <span class="pacing-lbl">Peak Clash (${peakCount})</span>
            ${peakJumpTime !== null ? `<button type="button" class="pacing-jump-btn" data-jump="${peakJumpTime}" title="Jump to peak intensity">⌖ Jump</button>` : ''}
          </div>
          <div class="pacing-stat">
            <span class="pacing-val">${lastCombat ? fmtExact(lastCombat.t) : 'None'}</span>
            <span class="pacing-lbl">Final Contact</span>
            ${lastCombat ? `<button type="button" class="pacing-jump-btn" data-jump="${lastCombat.t}" title="Jump to final elimination">⌖ Jump</button>` : ''}
          </div>
        </div>
      </div>

      <div class="insight-card">
        <div class="insight-card-header">
          <span class="insight-card-title">COMBAT DISTRIBUTION BY PHASE</span>
          <span class="view-bar-count">${totalCombat} total events</span>
        </div>
        <div class="phase-progress-bar" role="progressbar" aria-label="Combat distribution by match phase">
          <div class="phase-seg early" style="width: ${earlyPct}%" title="Early Phase: ${earlyCount} events (${earlyPct}%)"></div>
          <div class="phase-seg mid" style="width: ${midPct}%" title="Mid Phase: ${midCount} events (${midPct}%)"></div>
          <div class="phase-seg late" style="width: ${latePct}%" title="Late Phase: ${lateCount} events (${latePct}%)"></div>
        </div>
        <div class="phase-legend">
          <div class="phase-legend-item">
            <span class="phase-legend-label"><i class="phase-legend-dot early"></i> EARLY (0–3m)</span>
            <strong>${earlyCount} (${earlyPct}%)</strong>
          </div>
          <div class="phase-legend-item">
            <span class="phase-legend-label"><i class="phase-legend-dot mid"></i> MID (3–8m)</span>
            <strong>${midCount} (${midPct}%)</strong>
          </div>
          <div class="phase-legend-item">
            <span class="phase-legend-label"><i class="phase-legend-dot late"></i> LATE (8m+)</span>
            <strong>${lateCount} (${latePct}%)</strong>
          </div>
        </div>
      </div>

      <div class="insight-card">
        <div class="insight-card-header">
          <span class="insight-card-title">LETHALITY &amp; THREAT DYNAMICS</span>
        </div>
        <div class="threat-grid">
          <div class="threat-item">
            <span class="threat-title">Combat Attrition</span>
            <div class="threat-val">${humanKills} <small style="font-size:10px;font-weight:400;color:#c7a9ff">human</small> · ${botKills} <small style="font-size:10px;font-weight:400;color:#ffc178">bot</small></div>
            <span class="threat-sub">${botKills + humanKills > 0 ? Math.round(botKills / (botKills + humanKills) * 100) : 0}% bot kill ratio</span>
          </div>
          <div class="threat-item">
            <span class="threat-title">Storm Zone Threat</span>
            <div class="threat-val">${stormCasualties} <small style="font-size:10px;font-weight:400;color:#c7a9ff">deaths</small></div>
            <span class="threat-sub">${stormPct}% of all match casualties</span>
          </div>
        </div>
      </div>

      <div class="smart-teaser-card">
        <div class="smart-teaser-left">
          <span class="smart-teaser-pill">✦ AI LEVEL CO-PILOT</span>
          <strong>Analyze match telemetry with AI</strong>
          <span class="smart-teaser-sub">Generate tactical pacing, choke point, and spawn insights.</span>
        </div>
        <button type="button" class="button button-small button-primary" id="btnGoToSmart">
          Analyze ➔
        </button>
      </div>
    `;

    ui.insightContainer.querySelectorAll('.pacing-jump-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = Number(btn.dataset.jump);
        if (Number.isFinite(t)) setCursor(t);
      });
    });

    const teaserBtn = ui.insightContainer.querySelector('#btnGoToSmart');
    if (teaserBtn) {
      teaserBtn.addEventListener('click', () => {
        openSmartModal();
      });
    }
  }

  function updateCombatFeed(render = true) {
    if (!ui.combatFeedList) return;
    const events = cachedCombatEvents;
    let low = 0, high = events.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (events[mid].t <= cursor) low = mid + 1;
      else high = mid;
    }
    if (ui.combatFeedCount) {
      ui.combatFeedCount.textContent = `${low} / ${events.length} events`;
    }
    if (!render) {
      const rows = ui.combatFeedList.querySelectorAll('.event-row');
      rows.forEach((row, i) => {
        const e = events[i];
        if (!e) return;
        const isCurrent = e.t <= cursor && cursor - e.t < 0.2;
        row.classList.toggle('is-current', isCurrent);
      });
      return;
    }
    if (!events.length) {
      ui.combatFeedList.innerHTML = '<p class="muted">No combat engagements or casualty records found for this selection.</p>';
      return;
    }
    ui.combatFeedList.innerHTML = events.map((e, i) => {
      const isCurrent = e.t <= cursor && cursor - e.t < 0.2;
      return `
        <button type="button" class="event-row${isCurrent ? ' is-current' : ''}" data-event-index="${i}" title="Jump to ${fmtExact(e.t)}">
          <span class="event-time">${fmtExact(e.t)}</span>
          <i class="event-symbol ${escapeHtml(e.type)}" aria-hidden="true"></i>
          <span>
            <span class="event-title">${escapeHtml(EVENT_LABELS[e.type])}</span>
            <span class="event-sub">${escapeHtml(e.player.id)}${activeData.length > 1 ? ` · ${escapeHtml(e.matchId.slice(0, 13))}…` : ''}</span>
          </span>
        </button>
      `;
    }).join('');

    ui.combatFeedList.querySelectorAll('.event-row').forEach((row, i) => {
      row.addEventListener('click', () => setCursor(events[i].t));
    });
  }

  function updateEvents(render = true) {
    if (!ui.eventList) return;
    const filter = ui.allSignalsFilter ? ui.allSignalsFilter.value : 'all';
    let filtered = cachedDiscrete;
    if (filter === 'combat') {
      filtered = cachedDiscrete.filter((e) => ['Kill', 'BotKill', 'Killed', 'BotKilled'].includes(e.type));
    } else if (filter === 'Loot') {
      filtered = cachedDiscrete.filter((e) => e.type === 'Loot');
    } else if (filter === 'KilledByStorm') {
      filtered = cachedDiscrete.filter((e) => e.type === 'KilledByStorm');
    }

    let low = 0, high = filtered.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (filtered[mid].t <= cursor) low = mid + 1;
      else high = mid;
    }
    if (ui.eventCount) {
      ui.eventCount.textContent = `${low} / ${filtered.length}`;
    }
    if (!render) {
      const rows = ui.eventList.querySelectorAll('.event-row');
      rows.forEach((row, i) => {
        const e = filtered[i];
        if (!e) return;
        const isCurrent = e.t <= cursor && cursor - e.t < 0.15;
        row.classList.toggle('is-current', isCurrent);
      });
      return;
    }
    if (!filtered.length) {
      ui.eventList.innerHTML = '<p class="muted">No events match the selected signal filter.</p>';
      return;
    }
    ui.eventList.innerHTML = filtered.map((e, i) => `<button type="button" class="event-row${e.t <= cursor && cursor - e.t < 0.15 ? ' is-current' : ''}" data-event-index="${i}" title="Jump to ${fmtExact(e.t)}"><span class="event-time">${fmtExact(e.t)}</span><i class="event-symbol ${escapeHtml(e.type)}" aria-hidden="true"></i><span><span class="event-title">${escapeHtml(EVENT_LABELS[e.type])}</span><span class="event-sub">${escapeHtml(e.player.id)}${activeData.length > 1 ? ` · ${escapeHtml(e.matchId.slice(0, 13))}…` : ''}</span></span></button>`).join('');
    ui.eventList.querySelectorAll('.event-row').forEach((row, i) => row.addEventListener('click', () => setCursor(filtered[i].t)));
  }

  function switchIntelTab(tabId) {
    activeIntelTab = tabId;
    if (ui.tabInsights) {
      ui.tabInsights.classList.toggle('is-active', tabId === 'insights');
      ui.tabInsights.setAttribute('aria-selected', String(tabId === 'insights'));
    }
    if (ui.viewInsights) ui.viewInsights.hidden = tabId !== 'insights';

    if (ui.tabSmart) {
      ui.tabSmart.classList.toggle('is-active', tabId === 'smart');
      ui.tabSmart.setAttribute('aria-selected', String(tabId === 'smart'));
    }
    if (ui.viewSmart) ui.viewSmart.hidden = tabId !== 'smart';

    if (ui.tabCombat) {
      ui.tabCombat.classList.toggle('is-active', tabId === 'combat');
      ui.tabCombat.setAttribute('aria-selected', String(tabId === 'combat'));
    }
    if (ui.viewCombat) ui.viewCombat.hidden = tabId !== 'combat';

    if (ui.tabAll) {
      ui.tabAll.classList.toggle('is-active', tabId === 'all');
      ui.tabAll.setAttribute('aria-selected', String(tabId === 'all'));
    }
    if (ui.viewAll) ui.viewAll.hidden = tabId !== 'all';

    if (tabId === 'insights') {
      updateInsights();
    } else if (tabId === 'smart') {
      checkOllamaStatus();
      if (!currentRawAiOutput && !isAnalyzing) {
        triggerSmartAnalysis();
      }
    } else if (tabId === 'combat') {
      updateCombatFeed(true);
    } else if (tabId === 'all') {
      updateEvents(true);
    }
  }

  // --- Smart Analysis & Ollama Integration ---
  async function checkOllamaStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m) => m.name);
        ollamaConnected = true;
        ollamaModel = models.find((m) => m.includes('llama3.2')) || models[0] || 'llama3.2';
        
        const pillTitle = `Ollama active at http://127.0.0.1:11434 (${ollamaModel})`;
        const labelText = `Ollama: ${ollamaModel}`;

        if (ui.aiStatusPill) {
          ui.aiStatusPill.className = 'ai-status-pill is-online';
          ui.aiStatusPill.title = pillTitle;
        }
        if (ui.aiStatusLabel) ui.aiStatusLabel.textContent = labelText;
        if (ui.aiNoticeBanner) ui.aiNoticeBanner.hidden = true;
        if (ui.smartStreamModel) ui.smartStreamModel.textContent = ollamaModel;

        if (ui.aiModalStatusPill) {
          ui.aiModalStatusPill.className = 'ai-status-pill is-online';
          ui.aiModalStatusPill.title = pillTitle;
        }
        if (ui.aiModalStatusLabel) ui.aiModalStatusLabel.textContent = labelText;
        if (ui.aiModalNoticeBanner) ui.aiModalNoticeBanner.hidden = true;
        if (ui.smartModalStreamModel) ui.smartModalStreamModel.textContent = ollamaModel;
        return true;
      }
    } catch (_) {}

    ollamaConnected = false;
    const offlineTitle = 'Local Ollama not detected. Connect Ollama (http://localhost:11434) to run local models on private telemetry.';
    const offlineLabel = 'Deployed (Simulated)';

    if (ui.aiStatusPill) {
      ui.aiStatusPill.className = 'ai-status-pill is-offline';
      ui.aiStatusPill.title = offlineTitle;
    }
    if (ui.aiStatusLabel) ui.aiStatusLabel.textContent = offlineLabel;
    if (ui.aiNoticeBanner) ui.aiNoticeBanner.hidden = false;
    if (ui.smartStreamModel) ui.smartStreamModel.textContent = 'simulated-engine';

    if (ui.aiModalStatusPill) {
      ui.aiModalStatusPill.className = 'ai-status-pill is-offline';
      ui.aiModalStatusPill.title = offlineTitle;
    }
    if (ui.aiModalStatusLabel) ui.aiModalStatusLabel.textContent = offlineLabel;
    if (ui.aiModalNoticeBanner) ui.aiModalNoticeBanner.hidden = false;
    if (ui.smartModalStreamModel) ui.smartModalStreamModel.textContent = 'simulated-engine';
    return false;
  }

  function startTypewriter(targets, onComplete) {
    stopTypewriter();
    const targetList = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    for (const t of targetList) {
      t.innerHTML = '<span class="typewriter-content"></span><span class="typewriter-cursor">▌</span>';
    }
    typewriterQueue = [];
    currentRawAiOutput = '';
    isTypewriterActive = true;

    typewriterInterval = setInterval(() => {
      if (typewriterQueue.length > 0) {
        const take = Math.min(3, typewriterQueue.length);
        for (let i = 0; i < take; i++) {
          currentRawAiOutput += typewriterQueue.shift();
        }
        for (const t of targetList) {
          const contentSpan = t.querySelector('.typewriter-content');
          if (contentSpan) contentSpan.textContent = currentRawAiOutput;
          t.scrollTop = t.scrollHeight;
        }
      } else if (!isTypewriterActive) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
        const rendered = renderMarkdown(currentRawAiOutput);
        for (const t of targetList) {
          t.innerHTML = rendered;
          t.scrollTop = t.scrollHeight;
        }
        if (onComplete) onComplete();
      }
    }, 12);
  }

  function pushTypewriterText(text) {
    if (!text) return;
    for (let i = 0; i < text.length; i++) {
      typewriterQueue.push(text[i]);
    }
  }

  function finishTypewriter() {
    isTypewriterActive = false;
  }

  function stopTypewriter() {
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
    isTypewriterActive = false;
    typewriterQueue = [];
  }

  function renderMarkdown(text) {
    let escaped = escapeHtml(text);
    const lines = escaped.split('\n');
    let inList = false;
    const outputLines = [];
    for (let rawLine of lines) {
      let line = rawLine;
      const h3Match = line.match(/^###\s+(.*)$/);
      const h4Match = line.match(/^####\s+(.*)$/);
      const bulletMatch = line.match(/^\s*[\*\-]\s+(.*)$/);

      if (bulletMatch) {
        if (!inList) { outputLines.push('<ul class="smart-ul">'); inList = true; }
        outputLines.push(`<li class="smart-li">${formatInlineMarkdown(bulletMatch[1])}</li>`);
      } else {
        if (inList) { outputLines.push('</ul>'); inList = false; }
        if (h3Match) {
          outputLines.push(`<h4 class="smart-h3">${formatInlineMarkdown(h3Match[1])}</h4>`);
        } else if (h4Match) {
          outputLines.push(`<h4 class="smart-h4">${formatInlineMarkdown(h4Match[1])}</h4>`);
        } else if (line.trim()) {
          outputLines.push(`<p class="smart-p">${formatInlineMarkdown(line)}</p>`);
        }
      }
    }
    if (inList) outputLines.push('</ul>');
    return `<div class="smart-formatted">${outputLines.join('')}</div>`;
  }

  function formatInlineMarkdown(str) {
    return str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  async function triggerSmartAnalysis() {
    if (isAnalyzing) return;
    if (!activeData.length) {
      alert('Please select a match or date first.');
      return;
    }

    isAnalyzing = true;
    const btnLoadingHtml = '<span class="empty-symbol" style="animation:spin 1s linear infinite;display:inline-block">◌</span> Analyzing…';
    if (ui.runSmartAnalysis) {
      ui.runSmartAnalysis.disabled = true;
      ui.runSmartAnalysis.innerHTML = btnLoadingHtml;
    }
    if (ui.runSmartModalAnalysis) {
      ui.runSmartModalAnalysis.disabled = true;
      ui.runSmartModalAnalysis.innerHTML = btnLoadingHtml;
    }
    if (ui.rerunSmartAnalysis) ui.rerunSmartAnalysis.disabled = true;
    if (ui.rerunSmartModalAnalysis) ui.rerunSmartModalAnalysis.disabled = true;

    if (ui.smartEmptyState) ui.smartEmptyState.hidden = true;
    if (ui.smartStreamingWrap) ui.smartStreamingWrap.hidden = false;
    if (ui.smartModalStreamingWrap) ui.smartModalStreamingWrap.hidden = false;
    if (ui.smartStreamFooter) ui.smartStreamFooter.hidden = true;
    if (ui.smartTextDisplay) ui.smartTextDisplay.innerHTML = '';
    if (ui.smartModalTextDisplay) ui.smartModalTextDisplay.innerHTML = '';
    if (ui.smartStreamTitle) ui.smartStreamTitle.textContent = 'Analyzing telemetry…';
    if (ui.smartModalStreamTitle) ui.smartModalStreamTitle.textContent = 'Analyzing telemetry…';

    const isLive = await checkOllamaStatus();
    const focus = (ui.smartModalFocusSelect && ui.smartAnalysisModal && !ui.smartAnalysisModal.hidden)
      ? ui.smartModalFocusSelect.value
      : (ui.smartFocusSelect ? ui.smartFocusSelect.value : 'comprehensive');

    // Build match telemetry summary context
    const mapName = MAPS[ui.map.value]?.label || ui.map.value;
    if (ui.smartModalScopeInfo) {
      const count = activeData.length;
      ui.smartModalScopeInfo.textContent = `${mapName} · ${count} ${count === 1 ? 'match' : 'matches'} analyzed`;
    }
    const allPlayers = activeData.flatMap((item) => item.match.players || []);
    const humans = allPlayers.filter((p) => !(Boolean(p.bot) || /^\d+$/.test(String(p.id)))).length;
    const bots = allPlayers.length - humans;
    const combatEvents = cachedCombatEvents;
    const killEvents = combatEvents.filter((e) => e.type === 'Kill' || e.type === 'BotKill');
    const deathEvents = combatEvents.filter((e) => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.type));
    const stormEvents = combatEvents.filter((e) => e.type === 'KilledByStorm');
    const firstKill = killEvents.length ? killEvents[0] : null;
    const firstBloodTime = firstKill ? fmtExact(firstKill.t) : 'None';
    
    // Minute counts
    const minuteCounts = new Map();
    for (const e of combatEvents) {
      const min = Math.floor(e.t / 60);
      minuteCounts.set(min, (minuteCounts.get(min) || 0) + 1);
    }
    let peakMin = 0, peakCount = 0;
    for (const [min, count] of minuteCounts.entries()) {
      if (count > peakCount) { peakCount = count; peakMin = min; }
    }
    const peakMinFormatted = peakCount > 0 ? `Minute ${peakMin}–${peakMin + 1} (${peakCount} kills)` : 'None';

    let earlyCount = 0, midCount = 0, lateCount = 0;
    for (const e of combatEvents) {
      if (e.t < 180) earlyCount++;
      else if (e.t < 480) midCount++;
      else lateCount++;
    }
    const totalCombat = combatEvents.length;
    const earlyPct = totalCombat > 0 ? Math.round((earlyCount / totalCombat) * 100) : 0;
    const midPct = totalCombat > 0 ? Math.round((midCount / totalCombat) * 100) : 0;
    const latePct = totalCombat > 0 ? Math.max(0, 100 - earlyPct - midPct) : 0;
    const stormCasualties = stormEvents.length;
    const totalDeaths = deathEvents.length;
    const stormPct = totalDeaths > 0 ? Math.round((stormCasualties / totalDeaths) * 100) : 0;
    const humanKills = killEvents.filter((e) => e.type === 'Kill').length;
    const botKills = killEvents.filter((e) => e.type === 'BotKill').length;

    // Start typewriter effect targeting both views
    const displayTargets = [ui.smartTextDisplay, ui.smartModalTextDisplay];
    startTypewriter(displayTargets, () => {
      isAnalyzing = false;
      if (ui.runSmartAnalysis) {
        ui.runSmartAnalysis.disabled = false;
        ui.runSmartAnalysis.innerHTML = '<span class="btn-icon">✦</span> Re-analyze';
      }
      if (ui.runSmartModalAnalysis) {
        ui.runSmartModalAnalysis.disabled = false;
        ui.runSmartModalAnalysis.innerHTML = '<span class="btn-icon">✦</span> Re-analyze';
      }
      if (ui.rerunSmartAnalysis) ui.rerunSmartAnalysis.disabled = false;
      if (ui.rerunSmartModalAnalysis) ui.rerunSmartModalAnalysis.disabled = false;
      const titleText = isLive ? 'Ollama Level Intelligence' : 'Simulated Level Intelligence';
      if (ui.smartStreamTitle) ui.smartStreamTitle.textContent = titleText;
      if (ui.smartModalStreamTitle) ui.smartModalStreamTitle.textContent = titleText;
      if (ui.smartStreamFooter) ui.smartStreamFooter.hidden = false;
    });

    if (isLive) {
      try {
        const prompt = `You are a senior game level designer analyzing tactical shooter telemetry for map "${mapName}".
Telemetry Data:
- Map: ${mapName} (${activeData.length} matches, ${allPlayers.length} journeys, max duration ${fmtTime(maxDuration)})
- Spawns & Infiltration: First blood recorded at ${firstBloodTime}.
- Peak Combat Window: ${peakMinFormatted}.
- Combat Phase Distribution: Early (0-3m): ${earlyPct}%, Mid (3-8m): ${midPct}%, Late (8m+): ${latePct}%. Total combat events: ${totalCombat}.
- Combat Attrition: ${humanKills} human kills, ${botKills} bot kills (${botKills + humanKills > 0 ? Math.round(botKills / (botKills + humanKills) * 100) : 0}% bot kill ratio).
- Zone Threat: ${stormCasualties} storm casualties (${stormPct}% of all deaths).
Focus: ${focus}.

Provide 4 concise level design takeaways:
1. Spawn Proximity & Early Engagement (analyze first blood timing: ${firstBloodTime})
2. Mid-Game Rotations & Choke Points (analyze mid phase: ${midPct}% and peak: ${peakMinFormatted})
3. Storm Zone Impact (analyze zone deaths: ${stormPct}%)
4. Actionable Level Layout Recommendations
Format with markdown headers and bullet points. Keep it professional, concise, and under 200 words. No intro filler.`;

        const res = await fetch('http://127.0.0.1:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: prompt,
            stream: true
          })
        });

        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                pushTypewriterText(parsed.response);
              }
            } catch (_) {}
          }
        }
        finishTypewriter();
        return;
      } catch (err) {
        console.warn('Ollama streaming error, falling back to simulated summary:', err);
      }
    }

    // Simulated / Deployed Mode Fallback with Typewriter Streaming
    let earlyInsight = firstBloodTime !== 'None' && parseFloat(firstBloodTime) < 45
      ? 'Early firefight occurred before 00:45, indicating spawn vectors or drop pods are clustered too close to high-tier loot nodes.'
      : 'Initial contact pacing provided players adequate uncontested looting buffer before converging.';
    let stormInsight = stormPct > 20
      ? `High storm mortality (${stormPct}%) indicates players are being bottlenecked along steep topography or late rotation routes.`
      : `Moderate storm attrition (${stormPct}%) confirms circle timers allow sufficient traversal across elevation thresholds.`;

    const dummyText = `### 🎯 Level Design Intelligence · ${mapName}

* **Spawn Spacing & Early Pacing**: First blood recorded at **${firstBloodTime}**. ${earlyInsight} Early phase accounted for **${earlyPct}%** of all firefights.
* **Mid-Game Rotations & Choke Points**: Combat peaked at **${peakMinFormatted}**, with **${midPct}%** of total engagements concentrated in the mid-game (03:00–08:00). Arterial rotation corridors exhibit heavy combat clustering.
* **Environmental Ring Danger**: Recorded **${stormCasualties}** storm casualties (**${stormPct}%** of total deaths). ${stormInsight}
* **Lethality Distribution**: **${humanKills}** human kills vs **${botKills}** bot kills (${botKills + humanKills > 0 ? Math.round(botKills / (botKills + humanKills) * 100) : 0}% bot attrition rate).

### 🛠️ Recommended Level Adjustments
* **Stagger West & Central Spawns**: Introduce 40m additional separation between contested drop corridors to reduce sub-minute spawn wiping.
* **Widen Choke Geometry**: Add secondary low-ground flank paths around the primary river bridge to alleviate multi-squad mid-game congestion.
* **Zone Pacing Calibration**: Adjust 2nd circle contraction time by +15 seconds to allow players retreating from southern cliffs to escape the ring.`;

    pushTypewriterText(dummyText);
    finishTypewriter();
  }

  // --- Smart Analysis Modal Control ---
  function openSmartModal() {
    if (!ui.smartAnalysisModal) return;
    ui.smartAnalysisModal.hidden = false;

    const mapName = MAPS[ui.map.value]?.label || ui.map.value;
    const count = activeData.length;
    if (ui.smartModalScopeInfo) {
      ui.smartModalScopeInfo.textContent = `${mapName} · ${count} ${count === 1 ? 'match' : 'matches'} analyzed`;
    }

    if (ui.smartModalFocusSelect && ui.smartFocusSelect) {
      ui.smartModalFocusSelect.value = ui.smartFocusSelect.value;
    }

    checkOllamaStatus();

    // If analysis hasn't run yet or active selection changed, auto trigger streaming
    if (!currentRawAiOutput && !isAnalyzing) {
      triggerSmartAnalysis();
    } else if (currentRawAiOutput && ui.smartModalTextDisplay && !ui.smartModalTextDisplay.innerHTML.trim()) {
      ui.smartModalTextDisplay.innerHTML = renderMarkdown(currentRawAiOutput);
      if (ui.smartModalStreamingWrap) ui.smartModalStreamingWrap.hidden = false;
    }
  }

  function closeSmartModal() {
    if (!ui.smartAnalysisModal) return;
    ui.smartAnalysisModal.hidden = true;
  }

  function setupSmartModal() {
    if (ui.openSmartModalBtn) {
      ui.openSmartModalBtn.addEventListener('click', openSmartModal);
    }
    if (ui.expandSmartModalBtn) {
      ui.expandSmartModalBtn.addEventListener('click', openSmartModal);
    }
    if (ui.closeSmartModal) {
      ui.closeSmartModal.addEventListener('click', closeSmartModal);
    }
    if (ui.closeSmartModalBtn) {
      ui.closeSmartModalBtn.addEventListener('click', closeSmartModal);
    }
    if (ui.smartAnalysisModal) {
      ui.smartAnalysisModal.addEventListener('click', (e) => {
        if (e.target === ui.smartAnalysisModal) closeSmartModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ui.smartAnalysisModal && !ui.smartAnalysisModal.hidden) {
        closeSmartModal();
      }
    });

    if (ui.runSmartModalAnalysis) {
      ui.runSmartModalAnalysis.addEventListener('click', () => {
        if (ui.smartModalFocusSelect && ui.smartFocusSelect) {
          ui.smartFocusSelect.value = ui.smartModalFocusSelect.value;
        }
        triggerSmartAnalysis();
      });
    }
    if (ui.rerunSmartModalAnalysis) {
      ui.rerunSmartModalAnalysis.addEventListener('click', () => {
        if (ui.smartModalFocusSelect && ui.smartFocusSelect) {
          ui.smartFocusSelect.value = ui.smartModalFocusSelect.value;
        }
        triggerSmartAnalysis();
      });
    }
    if (ui.smartModalFocusSelect) {
      ui.smartModalFocusSelect.addEventListener('change', () => {
        if (ui.smartFocusSelect) ui.smartFocusSelect.value = ui.smartModalFocusSelect.value;
        triggerSmartAnalysis();
      });
    }
    if (ui.copySmartModalAnalysis) {
      ui.copySmartModalAnalysis.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(currentRawAiOutput);
          const orig = ui.copySmartModalAnalysis.textContent;
          ui.copySmartModalAnalysis.textContent = '✓ Copied!';
          setTimeout(() => { ui.copySmartModalAnalysis.textContent = orig; }, 1800);
        } catch (_) {}
      });
    }
  }

  function updateTimeline() {
    ui.timeline.max = String(maxDuration); ui.timeline.value = String(Math.min(cursor, maxDuration)); ui.timeline.disabled = !activeData.length; ui.play.disabled = !activeData.length || maxDuration <= 0;
    ui.current.textContent = fmtExact(cursor); ui.duration.textContent = `/ ${fmtTime(maxDuration)}`;
    ui.context.textContent = activeData.length > 1 ? `Multiple journeys · shared elapsed cursor relative to each match start.` : activeData.length ? `Match ${activeData[0].id} · recorded time from match start.` : 'Choose a match to scrub through recorded time.';
    const events = matchesEvents().filter((e) => EVENT_LABELS[e.type]);
    ui.ticks.replaceChildren();
    for (const e of events) { const tick = document.createElement('i'); tick.style.left = `${maxDuration ? e.t / maxDuration * 100 : 0}%`; tick.title = `${EVENT_LABELS[e.type]} at ${fmtExact(e.t)}`; ui.ticks.append(tick); }
    ui.timeline.style.setProperty('--progress', `${maxDuration ? cursor / maxDuration * 100 : 0}%`);
    updateTimelineCounts();
  }
  function updateTimelineCounts() {
    let low = 0, high = cachedDiscrete.length;
    while (low < high) { const mid = (low + high) >> 1; if (cachedDiscrete[mid].t <= cursor) low = mid + 1; else high = mid; }
    ui.tickCount.textContent = `${low} / ${cachedDiscrete.length} events shown`;
  }

  function setCursor(time) {
    cursor = Math.max(0, Math.min(maxDuration, Number(time) || 0));
    ui.timeline.value = String(cursor);
    ui.current.textContent = fmtExact(cursor);
    ui.timeline.style.setProperty('--progress', `${maxDuration ? cursor / maxDuration * 100 : 0}%`);
    draw();
    if (activeIntelTab === 'combat') updateCombatFeed(false);
    else if (activeIntelTab === 'all') updateEvents(false);
  }
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
  function clampView() {
    if (!view || !imageLoaded) return;
    const minW = imageSize.width / 6;
    const maxW = imageSize.width * 1.1;
    view.width = Math.max(minW, Math.min(maxW, view.width));
    view.height = view.width * imageSize.height / imageSize.width;
    if (view.width >= imageSize.width) {
      view.x = (imageSize.width - view.width) / 2;
      view.y = (imageSize.height - view.height) / 2;
    } else {
      const slackX = view.width * 0.2;
      const slackY = view.height * 0.2;
      view.x = Math.max(-slackX, Math.min(imageSize.width - view.width + slackX, view.x));
      view.y = Math.max(-slackY, Math.min(imageSize.height - view.height + slackY, view.y));
    }
  }
  function applyView() {
    if (!view) return;
    ui.mapSvg.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`);
    const minW = imageSize.width / 6;
    const maxW = imageSize.width * 1.1;
    ui.zoomIn.disabled = !imageLoaded || view.width <= minW + 1;
    ui.zoomOut.disabled = !imageLoaded || view.width >= maxW - 1;
    ui.fit.disabled = !imageLoaded;
  }
  function zoom(factor, centerX, centerY) {
    if (!view || !imageLoaded) return;
    const minW = imageSize.width / 6;
    const maxW = imageSize.width * 1.1;
    const targetWidth = Math.max(minW, Math.min(maxW, view.width * factor));
    if (Math.abs(targetWidth - view.width) < 0.1) {
      applyView();
      return;
    }
    const ratio = targetWidth / view.width;
    const cx = centerX ?? view.x + view.width / 2;
    const cy = centerY ?? view.y + view.height / 2;
    view.width = targetWidth;
    view.height = targetWidth * imageSize.height / imageSize.width;
    view.x = cx - (cx - view.x) * ratio;
    view.y = cy - (cy - view.y) * ratio;
    clampView();
    applyView();
  }
  function pointerToImage(event) {
    const matrix = ui.mapSvg.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: view.x, y: view.y };
  }

  // --- Heatmap Controls & Sync ---
  function syncHeatControls() {
    ui.chipTraffic.classList.toggle('is-active', activeHeatModes.has('traffic'));
    ui.chipTraffic.setAttribute('aria-pressed', String(activeHeatModes.has('traffic')));
    ui.chipKills.classList.toggle('is-active', activeHeatModes.has('kills'));
    ui.chipKills.setAttribute('aria-pressed', String(activeHeatModes.has('kills')));
    ui.chipDeaths.classList.toggle('is-active', activeHeatModes.has('deaths'));
    ui.chipDeaths.setAttribute('aria-pressed', String(activeHeatModes.has('deaths')));

    if (ui.chipClearHeat) {
      ui.chipClearHeat.disabled = activeHeatModes.size === 0;
    }

    if (ui.heatStatusBadge) {
      if (activeHeatModes.size === 0) {
        ui.heatStatusBadge.hidden = true;
        ui.heatStatusBadge.textContent = '';
        ui.heatStatusBadge.className = 'heat-compare-badge';
      } else if (activeHeatModes.size === 1) {
        ui.heatStatusBadge.hidden = false;
        const mode = [...activeHeatModes][0];
        const label = mode === 'traffic' ? 'Traffic' : mode === 'kills' ? 'Kills' : 'Deaths';
        ui.heatStatusBadge.textContent = `${label} active`;
        ui.heatStatusBadge.className = 'heat-compare-badge is-single';
      } else {
        ui.heatStatusBadge.hidden = false;
        ui.heatStatusBadge.textContent = `⚡ Comparing ${activeHeatModes.size} layers`;
        ui.heatStatusBadge.className = 'heat-compare-badge is-comparing';
      }
    }

    updateHeatNote();
    updateSummary();
    draw();
  }

  function updateHeatNote() {
    const active = [...activeHeatModes];
    if (!active.length) {
      ui.heatNote.textContent = '';
      ui.heatNote.hidden = true;
      return;
    }
    if (active.length === 1) {
      const descriptions = {
        traffic: 'Traffic density shows smooth gradient flows of Position and BotPosition telemetry samples.',
        kills: 'Kill density shows combat engagement hotspots and firefight concentrations.',
        deaths: 'Death density shows casualty locations and storm deaths.'
      };
      ui.heatNote.textContent = `${descriptions[active[0]]} Continuous multi-stop thermal gradients.`;
    } else {
      const names = active.map((m) => m === 'traffic' ? 'TRAFFIC (teal)' : m === 'kills' ? 'KILLS (coral)' : 'DEATHS (violet)').join(' + ');
      ui.heatNote.textContent = `Comparative overlay [${names}]: Correlate player rotation paths with combat lethality to identify safe travel corridors vs contested kill zones.`;
    }
    ui.heatNote.hidden = false;
  }

  function setupMapInteractions() {
    ui.zoomIn.addEventListener('click', () => zoom(.78)); ui.zoomOut.addEventListener('click', () => zoom(1.28)); ui.fit.addEventListener('click', fitView);
    ui.mapViewport.addEventListener('wheel', (event) => { if (!imageLoaded) return; event.preventDefault(); const p = pointerToImage(event); zoom(event.deltaY < 0 ? .88 : 1.14, p.x, p.y); }, { passive: false });
    ui.mapViewport.addEventListener('pointerdown', (event) => { if (!imageLoaded || event.target.closest('.event-marker')) return; const matrix = ui.mapSvg.getScreenCTM(); if (!matrix) return; ui.mapViewport.setPointerCapture(event.pointerId); ui.mapViewport.classList.add('is-dragging'); ui.mapViewport.dataset.drag = `${event.pointerId},${event.clientX},${event.clientY},${view.x},${view.y},${1 / matrix.a},${1 / matrix.d}`; });
    ui.mapViewport.addEventListener('pointermove', (event) => { const drag = ui.mapViewport.dataset.drag; if (!drag) return; const [id, x, y, ox, oy, scaleX, scaleY] = drag.split(',').map(Number); if (id !== event.pointerId) return; view.x = ox - (event.clientX - x) * scaleX; view.y = oy - (event.clientY - y) * scaleY; clampView(); applyView(); });
    const endDrag = (event) => { if (ui.mapViewport.dataset.drag) { delete ui.mapViewport.dataset.drag; ui.mapViewport.classList.remove('is-dragging'); } }; ui.mapViewport.addEventListener('pointerup', endDrag); ui.mapViewport.addEventListener('pointercancel', endDrag);

    // Heatmap chips
    ui.chipTraffic.addEventListener('click', () => {
      if (activeHeatModes.has('traffic')) activeHeatModes.delete('traffic');
      else activeHeatModes.add('traffic');
      syncHeatControls();
    });
    ui.chipKills.addEventListener('click', () => {
      if (activeHeatModes.has('kills')) activeHeatModes.delete('kills');
      else activeHeatModes.add('kills');
      syncHeatControls();
    });
    ui.chipDeaths.addEventListener('click', () => {
      if (activeHeatModes.has('deaths')) activeHeatModes.delete('deaths');
      else activeHeatModes.add('deaths');
      syncHeatControls();
    });

    if (ui.chipClearHeat) {
      ui.chipClearHeat.addEventListener('click', () => {
        activeHeatModes.clear();
        syncHeatControls();
      });
    }
  }

  // --- Multi-Date Modal Logic ---
  function openDateModal() {
    const dates = availableDatesForMap();
    const currentSet = new Set(isAllDates ? dates : selectedDates);
    ui.dateList.innerHTML = dates.slice().reverse().map((date) => {
      const checked = currentSet.has(date);
      const formatted = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const entry = datasetsForFilters().find((d) => d.map === ui.map.value && d.date === date);
      const matchCount = (entry?.matches || []).length;
      return `
        <label class="modal-item-label">
          <input type="checkbox" value="${escapeHtml(date)}"${checked ? ' checked' : ''}>
          <div class="modal-item-info">
            <span class="modal-item-primary">${escapeHtml(formatted)}${date === '2026-02-14' ? ' (partial day)' : ''}</span>
            <span class="modal-item-secondary">${matchCount} recorded match${matchCount === 1 ? '' : 'es'} · ${date}</span>
          </div>
        </label>
      `;
    }).join('');

    function updateModalDateCount() {
      const count = ui.dateList.querySelectorAll('input:checked').length;
      ui.dateCount.textContent = `${count} of ${dates.length} dates selected`;
    }
    ui.dateList.querySelectorAll('input').forEach((cb) => cb.addEventListener('change', updateModalDateCount));
    updateModalDateCount();
    ui.dateModal.hidden = false;
  }

  function setupDateModal() {
    ui.customDateBtn.addEventListener('click', openDateModal);
    ui.closeDateModal.addEventListener('click', () => { ui.dateModal.hidden = true; });
    ui.dateModal.addEventListener('click', (e) => { if (e.target === ui.dateModal) ui.dateModal.hidden = true; });
    ui.selectAllDates.addEventListener('click', () => {
      ui.dateList.querySelectorAll('input').forEach((cb) => { cb.checked = true; });
      ui.dateCount.textContent = `${ui.dateList.querySelectorAll('input:checked').length} dates selected`;
    });
    ui.clearAllDates.addEventListener('click', () => {
      ui.dateList.querySelectorAll('input').forEach((cb) => { cb.checked = false; });
      ui.dateCount.textContent = `0 dates selected`;
    });
    ui.applyDates.addEventListener('click', () => {
      const checked = [...ui.dateList.querySelectorAll('input:checked')].map((cb) => cb.value);
      const allDates = availableDatesForMap();
      if (!checked.length) {
        selectedDates = [allDates[allDates.length - 1]];
        isAllDates = false;
      } else if (checked.length === allDates.length) {
        isAllDates = true;
        selectedDates = allDates;
      } else {
        isAllDates = false;
        selectedDates = checked.sort();
      }
      ui.dateModal.hidden = true;
      selectedMatchIds = '*';
      updateDates();
      updateMatches();
    });
  }

  // --- Multi-Match Modal Logic ---
  function openMatchModal() {
    const matches = matchesForCurrentSelection();
    let currentSet;
    if (selectedMatchIds === '*') {
      currentSet = new Set(matches.map((m) => m.id));
    } else if (selectedMatchIds instanceof Set) {
      currentSet = selectedMatchIds;
    } else {
      currentSet = new Set([String(selectedMatchIds)]);
    }

    ui.matchSearch.value = '';
    renderMatchList(matches, currentSet, '');
    ui.matchModal.hidden = false;
  }

  function renderMatchList(matches, currentSet, query) {
    const q = (query || '').toLowerCase().trim();
    const filtered = q ? matches.filter((m) => m.id.toLowerCase().includes(q) || (m.date && m.date.includes(q))) : matches;

    ui.matchList.innerHTML = filtered.map((match) => {
      const checked = currentSet.has(match.id);
      const playerCount = typeof match.players === 'number' ? match.players : (Array.isArray(match.players) ? match.players.length : 1);
      return `
        <label class="modal-item-label" data-id="${escapeHtml(match.id)}">
          <input type="checkbox" value="${escapeHtml(match.id)}"${checked ? ' checked' : ''}>
          <div class="modal-item-info">
            <span class="modal-item-primary">${escapeHtml(match.id)}</span>
            <span class="modal-item-secondary">${match.date || ''} · ${playerCount} ${playerCount === 1 ? 'journey' : 'journeys'} · duration ${fmtTime(match.duration)}</span>
          </div>
        </label>
      `;
    }).join('');

    function updateModalMatchCount() {
      const checkedCount = ui.matchList.querySelectorAll('input:checked').length;
      ui.matchCount.textContent = `${checkedCount} of ${matches.length} matches selected`;
    }
    ui.matchList.querySelectorAll('input').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) currentSet.add(cb.value);
        else currentSet.delete(cb.value);
        updateModalMatchCount();
      });
    });
    updateModalMatchCount();
  }

  function setupMatchModal() {
    ui.customMatchBtn.addEventListener('click', openMatchModal);
    ui.closeMatchModal.addEventListener('click', () => { ui.matchModal.hidden = true; });
    ui.matchModal.addEventListener('click', (e) => { if (e.target === ui.matchModal) ui.matchModal.hidden = true; });
    
    ui.matchSearch.addEventListener('input', () => {
      const matches = matchesForCurrentSelection();
      const currentChecked = new Set([...ui.matchList.querySelectorAll('input:checked')].map((cb) => cb.value));
      renderMatchList(matches, currentChecked, ui.matchSearch.value);
    });

    ui.selectAllMatches.addEventListener('click', () => {
      ui.matchList.querySelectorAll('.modal-item-label:not([style*="display: none"]) input').forEach((cb) => { cb.checked = true; });
      ui.matchCount.textContent = `${ui.matchList.querySelectorAll('input:checked').length} matches selected`;
    });
    ui.clearAllMatches.addEventListener('click', () => {
      ui.matchList.querySelectorAll('input').forEach((cb) => { cb.checked = false; });
      ui.matchCount.textContent = `0 matches selected`;
    });
    ui.applyMatches.addEventListener('click', () => {
      const matches = matchesForCurrentSelection();
      const checked = [...ui.matchList.querySelectorAll('input:checked')].map((cb) => cb.value);
      if (!checked.length || checked.length === matches.length) {
        selectedMatchIds = '*';
      } else {
        selectedMatchIds = new Set(checked);
      }
      ui.matchModal.hidden = true;
      updateMatches();
    });
  }

  // --- Filter Event Listeners ---
  ui.map.addEventListener('change', () => {
    selectedDates = [];
    isAllDates = false;
    selectedMatchIds = '*';
    updateDates();
    updateMatches();
  });

  ui.date.addEventListener('change', () => {
    const val = ui.date.value;
    if (val === '*') {
      isAllDates = true;
      selectedDates = availableDatesForMap();
    } else if (val === 'custom') {
      openDateModal();
      return;
    } else {
      isAllDates = false;
      selectedDates = [val];
    }
    selectedMatchIds = '*';
    updateMatches();
  });

  ui.match.addEventListener('change', () => {
    const val = ui.match.value;
    if (val === 'custom') {
      openMatchModal();
      return;
    }
    selectedMatchIds = val;
    loadSelection();
  });

  ui.timeline.addEventListener('input', () => { if (playing) stopPlayback(); setCursor(Number(ui.timeline.value)); });
  ui.play.addEventListener('click', () => playing ? stopPlayback() : startPlayback());

  ui.reset.addEventListener('click', () => {
    fitView();
    activeHeatModes.clear();
    syncHeatControls();
    isAllDates = false;
    const dates = availableDatesForMap();
    selectedDates = dates.length ? [dates[dates.length - 1]] : [];
    selectedMatchIds = '*';
    updateDates();
    updateMatches();
  });

  function setupIntelTabs() {
    if (ui.tabInsights) ui.tabInsights.addEventListener('click', () => switchIntelTab('insights'));
    if (ui.tabSmart) ui.tabSmart.addEventListener('click', () => switchIntelTab('smart'));
    if (ui.tabCombat) ui.tabCombat.addEventListener('click', () => switchIntelTab('combat'));
    if (ui.tabAll) ui.tabAll.addEventListener('click', () => switchIntelTab('all'));
    if (ui.allSignalsFilter) {
      ui.allSignalsFilter.addEventListener('change', () => updateEvents(true));
    }
    if (ui.runSmartAnalysis) ui.runSmartAnalysis.addEventListener('click', triggerSmartAnalysis);
    if (ui.rerunSmartAnalysis) ui.rerunSmartAnalysis.addEventListener('click', triggerSmartAnalysis);
    if (ui.copySmartAnalysis) {
      ui.copySmartAnalysis.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(currentRawAiOutput);
          const orig = ui.copySmartAnalysis.textContent;
          ui.copySmartAnalysis.textContent = '✓ Copied!';
          setTimeout(() => { ui.copySmartAnalysis.textContent = orig; }, 1800);
        } catch (_) {}
      });
    }
    checkOllamaStatus();
  }

  setupMapInteractions();
  setupDateModal();
  setupMatchModal();
  setupIntelTabs();
  setupSmartModal();

  fetch('data/manifest.json').then((response) => {
    if (!response.ok) throw new Error(`Could not load data/manifest.json (${response.status}).`);
    return response.json();
  }).then((data) => {
    if (!data || !Array.isArray(data.datasets)) throw new Error('The manifest is missing its datasets list.');
    manifest = data;
    initFilters();
    setStatus(`${datasetsForFilters().length} map/date datasets indexed`, true);
  }).catch((error) => {
    setStatus('Index unavailable');
    setNotice(`${error.message} Serve the viewer over HTTP so relative JSON data can be fetched.`, true);
    ui.map.innerHTML = '<option>Unavailable</option>';
    ui.date.innerHTML = '<option>Unavailable</option>';
    ui.match.innerHTML = '<option>Unavailable</option>';
    emptyState('Match index is unavailable.');
  });
})();
