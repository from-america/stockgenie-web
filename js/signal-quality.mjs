const SIGNAL_API_BASE = 'https://api.stockgenie.app/api/what-if-invested';
const SIGNAL_START_DATE = '2025-12-02';
const SIGNAL_BENCHMARK = 'SPY';
const UPDATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

function toFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatPct(value, fractionDigits = 1) {
  const number = toFiniteNumber(value, 0);
  const prefix = number >= 0 ? '+' : '';
  return `${prefix}${number.toFixed(fractionDigits)}%`;
}

function formatRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) return '';
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  return `${DATE_FORMATTER.format(start)} - ${DATE_FORMATTER.format(end)}`;
}

function formatUpdatedLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return UPDATE_FORMATTER.format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildSignalApiUrl({
  startDate = SIGNAL_START_DATE,
  benchmark = SIGNAL_BENCHMARK,
} = {}) {
  const params = new URLSearchParams({
    mode: 'dca',
    strategyType: 'single',
    weighting: 'equal',
    basketSize: '1',
    contribution: '1',
    startDate,
    benchmark,
  });

  return `${SIGNAL_API_BASE}?${params.toString()}`;
}

export function computeSignalMetrics(payload) {
  const dates = Array.isArray(payload?.dates)
    ? payload.dates.filter((date) => typeof date === 'string' && date.trim())
    : [];
  const strategyPoints = Array.isArray(payload?.strategy?.points) ? payload.strategy.points : [];
  const benchmarkPoints = Array.isArray(payload?.benchmark?.points) ? payload.benchmark.points : [];
  const pointCount = Math.min(dates.length, strategyPoints.length, benchmarkPoints.length);

  if (pointCount < 2) {
    throw new Error('signal payload does not include enough points');
  }

  const sessions = [];
  for (let index = 1; index < pointCount; index += 1) {
    const strategyPrev = toFiniteNumber(strategyPoints[index - 1]?.value, null);
    const strategyCurrent = toFiniteNumber(strategyPoints[index]?.value, null);
    const benchmarkPrev = toFiniteNumber(benchmarkPoints[index - 1]?.value, null);
    const benchmarkCurrent = toFiniteNumber(benchmarkPoints[index]?.value, null);

    if (
      strategyPrev === null || strategyPrev <= 0 ||
      strategyCurrent === null || strategyCurrent <= 0 ||
      benchmarkPrev === null || benchmarkPrev <= 0 ||
      benchmarkCurrent === null || benchmarkCurrent <= 0
    ) {
      continue;
    }

    const strategyReturnPct = ((strategyCurrent / strategyPrev) - 1) * 100;
    const benchmarkReturnPct = ((benchmarkCurrent / benchmarkPrev) - 1) * 100;
    const edgePct = strategyReturnPct - benchmarkReturnPct;
    const result = edgePct >= 0 ? 'win' : 'loss';

    sessions.push({
      date: dates[index],
      strategyReturnPct,
      benchmarkReturnPct,
      edgePct,
      result,
    });
  }

  if (sessions.length === 0) {
    throw new Error('signal payload does not include any usable sessions');
  }

  const wins = sessions.filter((session) => session.result === 'win').length;
  const losses = sessions.length - wins;
  const winRatePct = (wins / sessions.length) * 100;
  const edgeValues = sessions.map((session) => session.edgePct).sort((a, b) => a - b);
  const averageEdgePct = sessions.reduce((sum, session) => sum + session.edgePct, 0) / sessions.length;
  const medianEdgePct = edgeValues.length % 2 === 1
    ? edgeValues[(edgeValues.length - 1) / 2]
    : (edgeValues[edgeValues.length / 2 - 1] + edgeValues[edgeValues.length / 2]) / 2;

  let maxWinStreak = 0;
  let currentStreak = 0;
  for (const session of sessions) {
    if (session.result === 'win') {
      currentStreak += 1;
      if (currentStreak > maxWinStreak) {
        maxWinStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  return {
    dates: dates.slice(0, pointCount),
    sessions,
    startDate: dates[0],
    endDate: dates[pointCount - 1],
    latestDate: dates[pointCount - 1],
    generatedAt: payload?.meta?.generatedAt || null,
    tradingDays: sessions.length,
    totalSessions: sessions.length,
    wins,
    losses,
    winRatePct,
    averageEdgePct,
    medianEdgePct,
    maxWinStreak,
  };
}

export function buildSignalStripMarkup(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return '';
  }

  return sessions.map((session) => {
    const label = `${session.result === 'win' ? 'Beats' : 'Falls behind'} SPY on ${SHORT_DATE_FORMATTER.format(new Date(`${session.date}T12:00:00Z`))} (${formatPct(session.edgePct)})`;
    return `
      <span
        class="signal-cell ${session.result}"
        title="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}"
      ></span>
    `;
  }).join('');
}

function renderUnavailable(root) {
  const statusEl = root.querySelector('[data-role="signal-status"]');
  const rangeEl = root.querySelector('[data-role="signal-range"]');
  const sourceEl = root.querySelector('[data-role="signal-source"]');
  if (statusEl) {
    statusEl.textContent = 'Live data unavailable';
  }
  if (rangeEl) {
    rangeEl.textContent = 'Range: unavailable';
  }
  if (sourceEl) {
    sourceEl.textContent = 'Source: unavailable';
  }
}

export function renderSignalSection(root, metrics) {
  const headlineEl = root.querySelector('[data-role="signal-headline"]');
  const subtitleEl = root.querySelector('[data-role="signal-subtitle"]');
  const statusEl = root.querySelector('[data-role="signal-status"]');
  const winRateEl = root.querySelector('[data-role="signal-win-rate"]');
  const daysAheadEl = root.querySelector('[data-role="signal-days-ahead"]');
  const medianEdgeEl = root.querySelector('[data-role="signal-median-edge"]');
  const bestStreakEl = root.querySelector('[data-role="signal-best-streak"]');
  const noteEl = root.querySelector('[data-role="signal-note"]');
  const kickerEl = root.querySelector('[data-role="signal-kicker"]');
  const stripEl = root.querySelector('[data-role="signal-strip"]');
  const rangeEl = root.querySelector('[data-role="signal-range"]');
  const sourceEl = root.querySelector('[data-role="signal-source"]');

  if (!headlineEl || !subtitleEl || !statusEl || !winRateEl || !daysAheadEl || !medianEdgeEl || !bestStreakEl || !noteEl || !kickerEl || !stripEl || !rangeEl || !sourceEl) {
    return;
  }

  const { wins, losses, winRatePct, averageEdgePct, medianEdgePct, maxWinStreak, sessions, startDate, endDate, generatedAt, tradingDays } = metrics;
  const updatedLabel = formatUpdatedLabel(generatedAt);

  headlineEl.textContent = `StockGenie beat SPY on ${winRatePct.toFixed(1)}% of trading days`;
  subtitleEl.textContent = `Since Dec 2, 2025, the free daily pick has outperformed SPY on ${wins} out of ${tradingDays} trading days. The public site shows the pick; Premium keeps the rest of the ranked list locked in the app.`;
  statusEl.textContent = `Live results · ${wins} wins · ${losses} losses · ${maxWinStreak}-day best streak${updatedLabel ? ` · Updated ${updatedLabel}` : ''}`;
  winRateEl.textContent = `${winRatePct.toFixed(1)}%`;
  daysAheadEl.textContent = `${wins} / ${tradingDays}`;
  medianEdgeEl.textContent = formatPct(medianEdgePct, 2);
  bestStreakEl.textContent = `${maxWinStreak} days`;
  noteEl.textContent = `Open-to-open performance since Dec 2, 2025. Average daily edge: ${formatPct(averageEdgePct, 2)}. Hypothetical, not investment advice.`;
  kickerEl.textContent = 'Free pick vs SPY';
  stripEl.innerHTML = buildSignalStripMarkup(sessions);
  rangeEl.textContent = `Range: ${formatRangeLabel(startDate, endDate)}`;
  sourceEl.textContent = `Source: live public API${updatedLabel ? ` - Updated ${updatedLabel}` : ''}`;
}

export async function initSignalSection() {
  const root = document.querySelector('[data-signal-root]');
  if (!root) return;

  try {
    const response = await fetch(buildSignalApiUrl(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`signal API returned ${response.status}`);
    }

    const payload = await response.json();
    const metrics = computeSignalMetrics(payload);
    renderSignalSection(root, metrics);
  } catch (error) {
    console.warn('[StockGenie] Live signal section unavailable:', error);
    renderUnavailable(root);
  }
}
