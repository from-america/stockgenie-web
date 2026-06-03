import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSignalMetrics } from '../js/signal-quality.mjs';

test('computeSignalMetrics summarizes daily win rate versus SPY', () => {
  const metrics = computeSignalMetrics({
    dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04'],
    strategy: {
      points: [
        { date: '2025-01-01', value: 100 },
        { date: '2025-01-02', value: 102 },
        { date: '2025-01-03', value: 101 },
        { date: '2025-01-04', value: 103 },
      ],
    },
    benchmark: {
      points: [
        { date: '2025-01-01', value: 100 },
        { date: '2025-01-02', value: 101 },
        { date: '2025-01-03', value: 102 },
        { date: '2025-01-04', value: 103 },
      ],
    },
  });

  assert.equal(metrics.totalSessions, 3);
  assert.equal(metrics.wins, 2);
  assert.equal(metrics.losses, 1);
  assert.equal(Number(metrics.winRatePct.toFixed(1)), 66.7);
  assert.equal(Number(metrics.medianEdgePct.toFixed(2)), 1.00);
  assert.equal(metrics.maxWinStreak, 1);
  assert.equal(metrics.latestDate, '2025-01-04');
});
