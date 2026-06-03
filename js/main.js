const DASHBOARD_BASE_URL = 'https://api.stockgenie.app/api/what-if-invested';
const DEFAULT_CONTRIBUTION_AMOUNT = 1;
const DEFAULT_BASKET_SIZE = 3;
const DEFAULT_WEIGHTING_MODE = 'confidence';
const FETCH_TIMEOUT_MS = 4500;

function buildDashboardApiUrl({
  mode = 'dca',
  strategyType = 'basket',
  weighting = 'equal',
  basketSize = 5,
  contribution = 1,
  startDate = '2025-12-02',
  benchmark = 'SPY',
} = {}) {
  const params = new URLSearchParams({
    mode,
    strategyType,
    weighting,
    basketSize: String(basketSize),
    contribution: String(contribution),
    startDate,
    benchmark,
  });

  return `${DASHBOARD_BASE_URL}?${params.toString()}`;
}

const DASHBOARD_API_URL = buildDashboardApiUrl({
  strategyType: 'basket',
  weighting: 'equal',
  basketSize: 5,
});

const COMPARISON_API_URL = buildDashboardApiUrl({
  strategyType: 'single',
  weighting: 'equal',
  basketSize: 1,
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const axisFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const rangeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const generatedFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatMoney(value) {
  const number = toFiniteNumber(value, 0);
  return currencyFormatter.format(number);
}

function formatSignedMoney(value) {
  const number = toFiniteNumber(value, 0);
  const prefix = number >= 0 ? '+' : '-';
  return `${prefix}${currencyFormatter.format(Math.abs(number))}`;
}

function formatPercent(value) {
  const number = toFiniteNumber(value, 0);
  const prefix = number >= 0 ? '+' : '';
  return `${prefix}${number.toFixed(1)}%`;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T12:00:00Z`);
  return axisFormatter.format(date);
}

function formatRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) return '';
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  return `${rangeFormatter.format(start)} - ${rangeFormatter.format(end)}`;
}

function formatGeneratedAt(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return generatedFormatter.format(date);
}

function buildStrategyLabel(strategyType, weightingMode, basketSize) {
  if (String(strategyType || 'single').toLowerCase() === 'basket') {
    const size = Number.isFinite(Number(basketSize)) && Number(basketSize) > 0
      ? Math.max(1, Math.floor(Number(basketSize)))
      : DEFAULT_BASKET_SIZE;
    const normalizedWeightingMode = String(weightingMode || DEFAULT_WEIGHTING_MODE).toLowerCase();
    const prefix = normalizedWeightingMode === 'confidence'
      ? 'Confidence-weighted '
      : 'Equal-weight ';
    return `${prefix}top ${size} basket`;
  }

  return 'Daily pick';
}

function buildSampleDashboard() {
  const pointCount = 27;
  const now = new Date();
  const baseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  const dates = [];
  const strategyPoints = [];
  const benchmarkPoints = [];
  let strategyValue = DEFAULT_CONTRIBUTION_AMOUNT;
  let benchmarkValue = DEFAULT_CONTRIBUTION_AMOUNT;

  for (let index = pointCount - 1; index >= 0; index -= 1) {
    const step = pointCount - 1 - index;
    const date = new Date(baseDate);
    date.setUTCDate(date.getUTCDate() - index * 7);
    const dateStr = date.toISOString().split('T')[0];

    if (step > 0) {
      const strategyGrowth = 0.0038 + Math.sin(step / 2.4) * 0.0026 + Math.cos(step / 5.2) * 0.0013;
      const benchmarkGrowth = 0.0002 + Math.cos(step / 4.1) * 0.0009 - Math.sin(step / 6.3) * 0.0003;
      strategyValue = strategyValue * (1 + strategyGrowth) + DEFAULT_CONTRIBUTION_AMOUNT;
      benchmarkValue = benchmarkValue * (1 + benchmarkGrowth) + DEFAULT_CONTRIBUTION_AMOUNT;
    }

    dates.push(dateStr);
    strategyPoints.push({ date: dateStr, value: strategyValue });
    benchmarkPoints.push({ date: dateStr, value: benchmarkValue });
  }

  const strategyLabel = buildStrategyLabel('basket', 'equal', 5);

  return {
    dates,
    strategy: { points: strategyPoints },
    benchmark: { points: benchmarkPoints },
    summary: {
      initialAmount: DEFAULT_CONTRIBUTION_AMOUNT,
      contributionAmount: DEFAULT_CONTRIBUTION_AMOUNT,
      totalContributed: DEFAULT_CONTRIBUTION_AMOUNT * dates.length,
      comparisonBaseAmount: DEFAULT_CONTRIBUTION_AMOUNT * dates.length,
      strategyMode: 'dca',
      strategyType: 'basket',
      weightingMode: 'equal',
      basketSize: 5,
      strategyLabel,
      strategyEndValue: strategyValue,
      benchmarkEndValue: benchmarkValue,
      strategyReturnPct: ((strategyValue - (DEFAULT_CONTRIBUTION_AMOUNT * dates.length)) / (DEFAULT_CONTRIBUTION_AMOUNT * dates.length)) * 100,
      benchmarkReturnPct: ((benchmarkValue - (DEFAULT_CONTRIBUTION_AMOUNT * dates.length)) / (DEFAULT_CONTRIBUTION_AMOUNT * dates.length)) * 100,
      alpha: strategyValue - benchmarkValue,
      strategyGain: strategyValue - (DEFAULT_CONTRIBUTION_AMOUNT * dates.length),
      benchmarkGain: benchmarkValue - (DEFAULT_CONTRIBUTION_AMOUNT * dates.length),
    },
    meta: {
      generatedAt: new Date().toISOString(),
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      windowMonths: 6,
      benchmarkTicker: 'SPY',
      initialAmount: DEFAULT_CONTRIBUTION_AMOUNT,
      contributionAmount: DEFAULT_CONTRIBUTION_AMOUNT,
      strategyMode: 'dca',
      strategyType: 'basket',
      weightingMode: 'equal',
      basketSize: 5,
      strategyLabel,
      tradingDays: dates.length,
      uniqueTickers: 5,
      source: 'local-sample',
    },
  };
}

function coercePoint(point) {
  if (!point || typeof point.date !== 'string') return null;
  const value = toFiniteNumber(point.value, null);
  if (value === null) return null;
  return { ...point, value };
}

function normalizeDashboardPayload(payload) {
  const dates = Array.isArray(payload?.dates)
    ? payload.dates.filter((date) => typeof date === 'string' && date.trim().length > 0)
    : [];
  const strategyPoints = Array.isArray(payload?.strategy?.points)
    ? payload.strategy.points.map(coercePoint).filter(Boolean)
    : [];
  const benchmarkPoints = Array.isArray(payload?.benchmark?.points)
    ? payload.benchmark.points.map(coercePoint).filter(Boolean)
    : [];

  const pointCount = Math.min(dates.length, strategyPoints.length, benchmarkPoints.length);
  if (pointCount < 2) {
    throw new Error('dashboard payload does not include enough points');
  }

  const summary = payload?.summary || {};
  const meta = payload?.meta || {};
  const strategyType = typeof summary.strategyType === 'string'
    ? summary.strategyType
    : (typeof meta.strategyType === 'string' ? meta.strategyType : 'single');
  const weightingMode = strategyType === 'basket'
    ? (typeof summary.weightingMode === 'string'
      ? summary.weightingMode
      : (typeof meta.weightingMode === 'string' ? meta.weightingMode : DEFAULT_WEIGHTING_MODE))
    : 'equal';
  const basketSizeValue = toFiniteNumber(summary.basketSize ?? meta.basketSize, strategyType === 'basket' ? DEFAULT_BASKET_SIZE : 1);
  const basketSize = Math.max(1, Math.floor(Number.isFinite(basketSizeValue) ? basketSizeValue : (strategyType === 'basket' ? DEFAULT_BASKET_SIZE : 1)));
  const strategyLabel = typeof summary.strategyLabel === 'string'
    ? summary.strategyLabel
    : (typeof meta.strategyLabel === 'string'
      ? meta.strategyLabel
      : buildStrategyLabel(strategyType, weightingMode, basketSize));
  const normalizedSummary = {
    initialAmount: toFiniteNumber(summary.initialAmount, DEFAULT_CONTRIBUTION_AMOUNT),
    strategyEndValue: toFiniteNumber(summary.strategyEndValue, null),
    benchmarkEndValue: toFiniteNumber(summary.benchmarkEndValue, null),
    strategyReturnPct: toFiniteNumber(summary.strategyReturnPct, null),
    benchmarkReturnPct: toFiniteNumber(summary.benchmarkReturnPct, null),
    alpha: toFiniteNumber(summary.alpha, null),
    totalContributed: toFiniteNumber(summary.totalContributed, null),
    strategyMode: typeof summary.strategyMode === 'string' ? summary.strategyMode : 'lump_sum',
    strategyType,
    weightingMode,
    basketSize,
    strategyLabel,
  };

  if (
    normalizedSummary.strategyEndValue === null ||
    normalizedSummary.benchmarkEndValue === null ||
    normalizedSummary.strategyReturnPct === null ||
    normalizedSummary.benchmarkReturnPct === null ||
    normalizedSummary.alpha === null
  ) {
    throw new Error('dashboard summary is incomplete');
  }

  return {
    ...payload,
    dates: dates.slice(0, pointCount),
    strategy: { points: strategyPoints.slice(0, pointCount) },
    benchmark: { points: benchmarkPoints.slice(0, pointCount) },
    summary: normalizedSummary,
  };
}

async function fetchDashboardPayload(url = DASHBOARD_API_URL) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`dashboard API returned ${response.status}`);
    }

    const payload = await response.json();
    return { payload: normalizeDashboardPayload(payload), source: 'live' };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchDashboardData() {
  const [primaryResult, comparisonResult] = await Promise.allSettled([
    fetchDashboardPayload(DASHBOARD_API_URL),
    fetchDashboardPayload(COMPARISON_API_URL),
  ]);

  if (primaryResult.status !== 'fulfilled') {
    throw primaryResult.reason;
  }

  return {
    payload: primaryResult.value.payload,
    source: primaryResult.value.source,
    comparisonPayload: comparisonResult.status === 'fulfilled' ? comparisonResult.value.payload : null,
  };
}

function buildAxisTicks(minValue, maxValue, tickCount) {
  const ticks = [];
  const span = maxValue - minValue;
  for (let index = 0; index < tickCount; index += 1) {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
    const value = maxValue - span * ratio;
    ticks.push({ value, ratio });
  }
  return ticks;
}

function buildSvgMarkup(payload) {
  const dates = payload.dates || [];
  const strategyPoints = payload.strategy?.points || [];
  const benchmarkPoints = payload.benchmark?.points || [];
  const pointCount = Math.min(dates.length, strategyPoints.length, benchmarkPoints.length);

  if (pointCount < 2) {
    return `
      <svg viewBox="0 0 1000 420" role="img" aria-label="Dashboard chart unavailable" preserveAspectRatio="none">
        <rect x="0" y="0" width="1000" height="420" rx="24" fill="rgba(255,255,255,0.02)"></rect>
        <text x="500" y="210" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-size="20" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif">No chart data available</text>
      </svg>
    `;
  }

  const width = 1000;
  const height = 420;
  const padding = { top: 28, right: 56, bottom: 56, left: 74 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const allValues = [
    ...strategyPoints.slice(0, pointCount),
    ...benchmarkPoints.slice(0, pointCount),
  ]
    .map((point) => point.value)
    .filter((value) => Number.isFinite(value));

  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const spread = Math.max(1, maxValue - minValue);
  const yMin = minValue - spread * 0.08;
  const yMax = maxValue + spread * 0.12;

  const xForIndex = (index) => padding.left + (pointCount === 1 ? plotWidth / 2 : (plotWidth * index) / (pointCount - 1));
  const yForValue = (value) => padding.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const baseY = padding.top + plotHeight;

  const buildLinePath = (points) =>
    points
      .slice(0, pointCount)
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xForIndex(index).toFixed(1)} ${yForValue(point.value).toFixed(1)}`)
      .join(' ');

  const buildAreaPath = (points) => {
    if (points.length === 0) return '';
    const trimmed = points.slice(0, pointCount);
    const path = trimmed
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xForIndex(index).toFixed(1)} ${yForValue(point.value).toFixed(1)}`)
      .join(' ');
    const lastX = xForIndex(trimmed.length - 1).toFixed(1);
    const firstX = xForIndex(0).toFixed(1);
    return `${path} L ${lastX} ${baseY.toFixed(1)} L ${firstX} ${baseY.toFixed(1)} Z`;
  };

  const yTicks = buildAxisTicks(yMin, yMax, 5);
  const xTickIndexes = [0, Math.floor((pointCount - 1) / 2), pointCount - 1]
    .filter((index, position, all) => all.indexOf(index) === position);

  const strategyPath = buildLinePath(strategyPoints);
  const benchmarkPath = buildLinePath(benchmarkPoints);
  const areaPath = buildAreaPath(strategyPoints);
  const latestStrategy = strategyPoints[pointCount - 1];
  const latestBenchmark = benchmarkPoints[pointCount - 1];
  const latestDate = dates[pointCount - 1];
  const strategyLabel = payload.summary?.strategyLabel || payload.meta?.strategyLabel || 'StockGenie basket';
  const benchmarkLabel = payload.meta?.benchmarkTicker || 'benchmark';
  const chartLabel = `${strategyLabel} versus ${benchmarkLabel} from ${dates[0]} to ${latestDate}`;

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(chartLabel)}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="strategyStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc"></stop>
          <stop offset="55%" stop-color="#8b5cf6"></stop>
          <stop offset="100%" stop-color="#38bdf8"></stop>
        </linearGradient>
        <linearGradient id="strategyFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="0.34"></stop>
          <stop offset="68%" stop-color="#7c3aed" stop-opacity="0.08"></stop>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="benchmarkStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"></stop>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
      <g aria-hidden="true">
        ${yTicks
          .map(
            (tick) => `
              <line x1="${padding.left}" y1="${yForValue(tick.value).toFixed(1)}" x2="${width - padding.right}" y2="${yForValue(tick.value).toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-width="1"></line>
              <text x="${padding.left - 12}" y="${(yForValue(tick.value) + 4).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,0.52)" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif">${escapeXml(formatMoney(tick.value))}</text>
            `
          )
          .join('')}
      </g>
      <g aria-hidden="true">
        <line x1="${padding.left}" y1="${baseY.toFixed(1)}" x2="${width - padding.right}" y2="${baseY.toFixed(1)}" stroke="rgba(255,255,255,0.18)" stroke-width="1.4"></line>
        ${xTickIndexes
          .map(
            (index) => `
              <line x1="${xForIndex(index).toFixed(1)}" y1="${padding.top}" x2="${xForIndex(index).toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"></line>
              <text x="${xForIndex(index).toFixed(1)}" y="${height - 20}" text-anchor="middle" fill="rgba(255,255,255,0.58)" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif">${escapeXml(formatDateLabel(dates[index]))}</text>
            `
          )
          .join('')}
      </g>
      <path d="${areaPath}" fill="url(#strategyFill)"></path>
      <path d="${benchmarkPath}" fill="none" stroke="url(#benchmarkStroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 8" opacity="0.75"></path>
      <path d="${strategyPath}" fill="none" stroke="url(#strategyStroke)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="${xForIndex(pointCount - 1).toFixed(1)}" cy="${yForValue(latestBenchmark.value).toFixed(1)}" r="5.5" fill="rgba(255,255,255,0.95)" stroke="rgba(255,255,255,0.4)" stroke-width="2"></circle>
      <circle cx="${xForIndex(pointCount - 1).toFixed(1)}" cy="${yForValue(latestStrategy.value).toFixed(1)}" r="6.5" fill="#ffffff" stroke="url(#strategyStroke)" stroke-width="3"></circle>
    </svg>
  `;
}

function renderDashboard(root, payload, source, comparisonPayload = null) {
  const statusEl = root.querySelector('[data-role="dashboard-status"]');
  const noteEl = root.querySelector('[data-role="dashboard-note"]');
  const kickerEl = root.querySelector('[data-role="dashboard-kicker"]');
  const strategyValueEl = root.querySelector('[data-role="strategy-value"]');
  const benchmarkValueEl = root.querySelector('[data-role="benchmark-value"]');
  const alphaValueEl = root.querySelector('[data-role="alpha-value"]');
  const returnValueEl = root.querySelector('[data-role="return-value"]');
  const rangeEl = root.querySelector('[data-role="dashboard-range"]');
  const sourceEl = root.querySelector('[data-role="dashboard-source"]');
  const chartEl = root.querySelector('[data-role="dashboard-chart"]');

  if (!strategyValueEl || !benchmarkValueEl || !alphaValueEl || !returnValueEl || !rangeEl || !sourceEl || !chartEl) {
    return;
  }

  const summary = payload.summary;
  const meta = payload.meta || {};
  const strategyMode = String(meta.strategyMode || summary.strategyMode || 'lump_sum').toLowerCase();
  const strategyType = String(summary.strategyType || meta.strategyType || 'single').toLowerCase();
  const weightingMode = String(summary.weightingMode || meta.weightingMode || 'equal').toLowerCase();
  const basketSize = Math.max(1, Math.floor(toFiniteNumber(summary.basketSize ?? meta.basketSize, strategyType === 'basket' ? DEFAULT_BASKET_SIZE : 1)));
  const strategyLabel = summary.strategyLabel || meta.strategyLabel || buildStrategyLabel(strategyType, weightingMode, basketSize);
  const sourceLabel = source === 'live' ? 'Live data from api.stockgenie.app' : 'Local sample data loaded';
  const updatedLabel = meta.generatedAt ? `Updated ${formatGeneratedAt(meta.generatedAt)}` : '';
  const tradingDaysLabel = meta.tradingDays ? `${meta.tradingDays} trading days` : '';
  const contributedLabel = toFiniteNumber(summary.totalContributed, null) !== null
    ? `${formatMoney(summary.totalContributed)} contributed`
    : '';
  const basketLabel = strategyType === 'basket'
    ? `${basketSize} picks per day${weightingMode === 'confidence' ? ', confidence-weighted' : ', equal-weight'}`
    : 'Single pick';
  const extraLabel = [updatedLabel, tradingDaysLabel].filter(Boolean).join(' - ');

  if (statusEl) {
    const labels = [sourceLabel, extraLabel, contributedLabel, basketLabel].filter(Boolean);
    statusEl.textContent = labels.join(' - ');
  }

  if (kickerEl) {
    kickerEl.textContent = strategyLabel;
  }

  if (noteEl) {
    if (strategyMode === 'dca' && strategyType === 'basket') {
      const totalContributed = toFiniteNumber(summary.totalContributed, null);
      const totalText = totalContributed !== null ? `, ${formatMoney(totalContributed)} total contributed` : '';
      const comparisonEndValue = toFiniteNumber(comparisonPayload?.summary?.strategyEndValue, null);
      const comparisonLabelRaw = comparisonPayload?.summary?.strategyLabel || comparisonPayload?.meta?.strategyLabel || 'free daily pick';
      const comparisonLabel = String(comparisonLabelRaw).toLowerCase() === 'daily pick'
        ? 'the free daily pick'
        : comparisonLabelRaw;
      const comparisonDelta = comparisonEndValue !== null ? summary.strategyEndValue - comparisonEndValue : null;
      const comparisonText = comparisonDelta !== null
        ? ` Compared with ${comparisonLabel}, this basket is ${comparisonDelta >= 0 ? 'ahead' : 'behind'} by ${formatMoney(Math.abs(comparisonDelta))} over the same period.`
        : '';
      noteEl.textContent = `This view uses StockGenie's ${strategyLabel}, investing $1 per trading day since Dec 2, 2025${totalText}, and compares it with SPY using the same cash flow.${comparisonText} It is based on actual open-to-open moves, not a promise or forecast.`;
    } else if (strategyMode === 'dca') {
      const contributionAmount = toFiniteNumber(meta.contributionAmount || summary.initialAmount, 1);
      const totalContributed = toFiniteNumber(summary.totalContributed, null);
      const contributionText = contributionAmount ? `${formatMoney(contributionAmount)} per trading day` : 'daily contributions';
      const totalText = totalContributed !== null ? `, ${formatMoney(totalContributed)} total contributed` : '';
      noteEl.textContent = `This view assumes ${contributionText} since Dec 2, 2025${totalText}. It is here for context, not investment advice.`;
    } else {
      noteEl.textContent = 'These numbers are hypothetical and use open-to-open price moves. They are here for context, not investment advice.';
    }
  }

  strategyValueEl.textContent = formatMoney(summary.strategyEndValue);
  benchmarkValueEl.textContent = formatMoney(summary.benchmarkEndValue);
  alphaValueEl.textContent = formatSignedMoney(summary.alpha);
  returnValueEl.textContent = formatPercent(summary.strategyReturnPct);
  rangeEl.textContent = `Range: ${formatRangeLabel(meta.startDate || payload.dates[0], meta.endDate || payload.dates[payload.dates.length - 1])}`;
  sourceEl.textContent = `Source: ${source === 'live' ? 'api.stockgenie.app' : 'local sample'}${tradingDaysLabel ? ` - ${tradingDaysLabel}` : ''}${contributedLabel ? ` - ${contributedLabel}` : ''}${basketLabel ? ` - ${basketLabel}` : ''}`;
  chartEl.innerHTML = buildSvgMarkup(payload);
}

async function initDashboard() {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const root = document.querySelector('[data-dashboard-root]');
  if (!root) {
    return;
  }

  let payload;
  let source = 'live';
  let comparisonPayload = null;

  try {
    const result = await fetchDashboardData();
    payload = result.payload;
    source = result.source;
    comparisonPayload = result.comparisonPayload;
  } catch (error) {
    console.warn('[StockGenie] Falling back to local sample dashboard data:', error);
    payload = buildSampleDashboard();
    source = 'demo';
  }

  renderDashboard(root, payload, source, comparisonPayload);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard, { once: true });
} else {
  initDashboard();
}
