const express = require('express');
const { Feedback, OptimizationEvent, Trial, User } = require('../mongodb/schemas');
const { BehaviorLog } = require('./behavior');

const router = express.Router();

const OPTIMIZATION_EVENT_TYPES = [
  'optimization_applied',
  'rl_suggestion_applied',
  'manual_override',
  'optimization_rejected',
  'optimization_triggered'
];

const SUCCESS_EVENT_TYPES = [
  'optimization_applied',
  'rl_suggestion_applied',
  'manual_override'
];

const GUEST_USER_IDS = new Set(['guest', 'anonymous', 'anon', 'unknown']);

const parseOptionalDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseBoolean = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const buildRangeCondition = (start, end) => {
  const condition = {};

  if (start) {
    condition.$gte = start;
  }

  if (end) {
    condition.$lt = end;
  }

  return Object.keys(condition).length > 0 ? condition : null;
};

const average = (values) => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const safeDivide = (numerator, denominator) => {
  if (!denominator) return null;
  return numerator / denominator;
};

const relativeChange = (before, after) => {
  if (before == null || after == null || before === 0) return null;
  return (after - before) / before;
};

const round = (value, digits = 4) => {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
};

const formatSignedPercent = (value) => {
  if (value == null) return null;
  const percent = (value * 100).toFixed(2);
  return `${value > 0 ? '+' : ''}${percent}%`;
};

const formatRatioPercent = (value) => {
  if (value == null) return null;
  return `${(value * 100).toFixed(2)}%`;
};

const formatRating = (value) => {
  if (value == null) return null;
  return value.toFixed(2);
};

const formatEventCount = (value) => {
  if (value == null) return null;
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${rounded} events`;
};

const normalizeUserId = (value) => String(value || '').trim().toLowerCase();

const isGuestUserId = (value) => GUEST_USER_IDS.has(normalizeUserId(value));

const hasStatsData = (stats) => {
  if (!stats?.samples) return false;

  return (
    (stats.samples.behaviorSessions || 0) > 0 ||
    (stats.samples.feedbackEntries || 0) > 0 ||
    (stats.samples.trials || 0) > 0 ||
    (stats.samples.optimizationEvents || 0) > 0
  );
};

const makeMetricRow = (key, label, before, after, formatter, unit) => {
  const improvement = relativeChange(before, after);

  return {
    key,
    label,
    unit,
    before: round(before),
    after: round(after),
    improvement: round(improvement),
    display: {
      before: formatter(before),
      after: formatter(after),
      improvement: formatSignedPercent(improvement)
    }
  };
};

const trialWasSuccessful = (trial) => {
  if (trial?.feedback?.type === 'like' || trial?.feedback?.type === 'manual') {
    return true;
  }

  if (trial?.feedback?.type === 'dislike') {
    return false;
  }

  return trial?.decision === 'accept';
};

const buildCommonMatch = (userId) => {
  if (!userId) return {};
  return { userId };
};

const buildSplitPayload = (splitMode, pivotAt, beforeRange, afterRange) => ({
  mode: splitMode,
  pivotAt: pivotAt ? pivotAt.toISOString() : null,
  before: {
    start: beforeRange.start ? beforeRange.start.toISOString() : null,
    end: beforeRange.end ? beforeRange.end.toISOString() : null
  },
  after: {
    start: afterRange.start ? afterRange.start.toISOString() : null,
    end: afterRange.end ? afterRange.end.toISOString() : null
  }
});

const getLatestBehaviorSessions = async (userId, range) => {
  const match = buildCommonMatch(userId);
  const timestampRange = buildRangeCondition(range.start, range.end);

  if (timestampRange) {
    match.timestamp = timestampRange;
  }

  return BehaviorLog.aggregate([
    { $match: match },
    { $sort: { sessionId: 1, timestamp: -1, _id: -1 } },
    {
      $group: {
        _id: '$sessionId',
        doc: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$doc' } }
  ]);
};

const getFeedbackDocs = async (userId, range) => {
  const match = buildCommonMatch(userId);
  const timestampRange = buildRangeCondition(range.start, range.end);

  if (timestampRange) {
    match['feedback.timestamp'] = timestampRange;
  }

  return Feedback.find(match).lean();
};

const getTrialDocs = async (userId, range) => {
  const match = buildCommonMatch(userId);
  const startTimeRange = buildRangeCondition(range.start, range.end);

  if (startTimeRange) {
    match.startTime = startTimeRange;
  }

  return Trial.find(match).lean();
};

const getOptimizationEventDocs = async (userId, range) => {
  const match = {
    ...buildCommonMatch(userId),
    eventType: { $in: OPTIMIZATION_EVENT_TYPES }
  };
  const timestampRange = buildRangeCondition(range.start, range.end);

  if (timestampRange) {
    match.timestamp = timestampRange;
  }

  return OptimizationEvent.find(match).lean();
};

const computeBehaviorStats = (logs) => {
  const sessions = logs.length;
  const totalClicks = logs.reduce((sum, log) => sum + (log.metrics?.clickCount || 0), 0);
  const totalMisclicks = logs.reduce((sum, log) => sum + (log.metrics?.misclickCount || 0), 0);
  const totalRageClicks = logs.reduce((sum, log) => sum + (log.metrics?.rageClickCount || 0), 0);
  const rageClicks = logs.map((log) => log.metrics?.rageClickCount || 0);

  return {
    sessionCount: sessions,
    totalClicks,
    totalMisclicks,
    totalRageClicks,
    misclickRate: safeDivide(totalMisclicks, totalClicks),
    avgRageClicksPerSession: average(rageClicks)
  };
};

const computeFeedbackStats = (feedbackDocs) => {
  const ratings = feedbackDocs
    .map((entry) => entry?.feedback?.rating)
    .filter((rating) => Number.isFinite(rating));

  return {
    count: ratings.length,
    totalRating: ratings.reduce((sum, rating) => sum + rating, 0),
    averageRating: average(ratings)
  };
};

const computeAdaptationStats = (trialDocs, eventDocs) => {
  const settledTrials = trialDocs.filter(
    (trial) => trial?.feedback?.given || trial?.decision === 'accept' || trial?.decision === 'revert'
  );

  if (settledTrials.length > 0) {
    const successCount = settledTrials.filter(trialWasSuccessful).length;

    return {
      source: 'trials',
      totalCount: settledTrials.length,
      successCount,
      successRate: safeDivide(successCount, settledTrials.length)
    };
  }

  const successCount = eventDocs.filter((event) => {
    if (!SUCCESS_EVENT_TYPES.includes(event.eventType)) return false;
    return event?.details?.success !== false;
  }).length;

  const rejectedCount = eventDocs.filter((event) => event.eventType === 'optimization_rejected').length;
  const totalCount = successCount + rejectedCount;

  return {
    source: 'events',
    totalCount,
    successCount,
    successRate: safeDivide(successCount, totalCount)
  };
};

const computePeriodStats = async (userId, range) => {
  const [behaviorLogs, feedbackDocs, trialDocs, eventDocs] = await Promise.all([
    getLatestBehaviorSessions(userId, range),
    getFeedbackDocs(userId, range),
    getTrialDocs(userId, range),
    getOptimizationEventDocs(userId, range)
  ]);

  return {
    behavior: computeBehaviorStats(behaviorLogs),
    feedback: computeFeedbackStats(feedbackDocs),
    adaptation: computeAdaptationStats(trialDocs, eventDocs),
    samples: {
      behaviorSessions: behaviorLogs.length,
      feedbackEntries: feedbackDocs.length,
      trials: trialDocs.length,
      optimizationEvents: eventDocs.length
    }
  };
};

const buildMetrics = (beforeStats, afterStats) => [
  makeMetricRow(
    'misclick_rate',
    'Misclick Rate',
    beforeStats.behavior.misclickRate,
    afterStats.behavior.misclickRate,
    formatRatioPercent,
    'ratio'
  ),
  makeMetricRow(
    'rage_clicks_per_session',
    'Rage Clicks (Per Session)',
    beforeStats.behavior.avgRageClicksPerSession,
    afterStats.behavior.avgRageClicksPerSession,
    formatEventCount,
    'events_per_session'
  ),
  makeMetricRow(
    'user_satisfaction',
    'User Satisfaction (1-5)',
    beforeStats.feedback.averageRating,
    afterStats.feedback.averageRating,
    formatRating,
    'rating'
  ),
  makeMetricRow(
    'successful_ui_adaptations',
    'Successful UI Adaptations',
    beforeStats.adaptation.successRate,
    afterStats.adaptation.successRate,
    formatRatioPercent,
    'ratio'
  )
];

const buildDerivedFrom = () => ({
  misclickRate: 'BehaviorLog.metrics.misclickCount / BehaviorLog.metrics.clickCount',
  rageClicksPerSession: 'SUM(BehaviorLog.metrics.rageClickCount) / COUNT(unique sessionId)',
  userSatisfaction: 'AVG(Feedback.feedback.rating)',
  successfulUiAdaptations: 'success rate from Trial, with OptimizationEvent fallback'
});

const createReportPayload = (scope, splitMode, pivotAt, beforeRange, afterRange, beforeStats, afterStats, extra = {}) => ({
  success: true,
  scope,
  split: buildSplitPayload(splitMode, pivotAt, beforeRange, afterRange),
  metrics: buildMetrics(beforeStats, afterStats),
  samples: {
    before: beforeStats.samples,
    after: afterStats.samples
  },
  derivedFrom: buildDerivedFrom(),
  notes: [
    'Behavior logs are de-duplicated by taking the latest record per sessionId inside each comparison period.',
    'Use explicit before/after date windows when you need one shared cohort definition across many users.'
  ],
  ...extra
});

const combinePeriodStats = (statsList) => {
  const combined = statsList.reduce((acc, stats) => {
    acc.behavior.sessionCount += stats.behavior.sessionCount || 0;
    acc.behavior.totalClicks += stats.behavior.totalClicks || 0;
    acc.behavior.totalMisclicks += stats.behavior.totalMisclicks || 0;
    acc.behavior.totalRageClicks += stats.behavior.totalRageClicks || 0;

    acc.feedback.count += stats.feedback.count || 0;
    acc.feedback.totalRating += stats.feedback.totalRating || 0;

    acc.adaptation.totalCount += stats.adaptation.totalCount || 0;
    acc.adaptation.successCount += stats.adaptation.successCount || 0;

    acc.samples.behaviorSessions += stats.samples.behaviorSessions || 0;
    acc.samples.feedbackEntries += stats.samples.feedbackEntries || 0;
    acc.samples.trials += stats.samples.trials || 0;
    acc.samples.optimizationEvents += stats.samples.optimizationEvents || 0;

    return acc;
  }, {
    behavior: {
      sessionCount: 0,
      totalClicks: 0,
      totalMisclicks: 0,
      totalRageClicks: 0
    },
    feedback: {
      count: 0,
      totalRating: 0
    },
    adaptation: {
      totalCount: 0,
      successCount: 0,
      source: 'mixed'
    },
    samples: {
      behaviorSessions: 0,
      feedbackEntries: 0,
      trials: 0,
      optimizationEvents: 0
    }
  });

  combined.behavior.misclickRate = safeDivide(
    combined.behavior.totalMisclicks,
    combined.behavior.totalClicks
  );
  combined.behavior.avgRageClicksPerSession = safeDivide(
    combined.behavior.totalRageClicks,
    combined.behavior.sessionCount
  );
  combined.feedback.averageRating = safeDivide(
    combined.feedback.totalRating,
    combined.feedback.count
  );
  combined.adaptation.successRate = safeDivide(
    combined.adaptation.successCount,
    combined.adaptation.totalCount
  );

  return combined;
};

const resolveComparisonRanges = async (userId, beforeStart, beforeEnd, afterStart, afterEnd, explicitPivot) => {
  let splitMode = 'manual-window';
  let pivotAt = explicitPivot;
  let beforeRange = { start: beforeStart, end: beforeEnd };
  let afterRange = { start: afterStart, end: afterEnd };

  const hasManualWindow = beforeStart || beforeEnd || afterStart || afterEnd;

  if (hasManualWindow) {
    if (!beforeEnd || !afterStart) {
      throw new Error('Manual comparison requires at least beforeEnd and afterStart.');
    }

    return {
      splitMode,
      pivotAt,
      beforeRange,
      afterRange,
      hasManualWindow
    };
  }

  if (!pivotAt) {
    pivotAt = await resolveAutoPivot(userId);
    splitMode = 'auto-pivot';
  } else {
    splitMode = 'explicit-pivot';
  }

  if (!pivotAt) {
    throw new Error('AUTO_PIVOT_UNAVAILABLE');
  }

  beforeRange = { start: null, end: pivotAt };
  afterRange = { start: pivotAt, end: null };

  return {
    splitMode,
    pivotAt,
    beforeRange,
    afterRange,
    hasManualWindow
  };
};

const buildUserReport = async (userId, comparison) => {
  const [beforeStats, afterStats] = await Promise.all([
    computePeriodStats(userId, comparison.beforeRange),
    computePeriodStats(userId, comparison.afterRange)
  ]);

  return {
    userId,
    beforeStats,
    afterStats,
    payload: createReportPayload(
      { userId },
      comparison.splitMode,
      comparison.pivotAt,
      comparison.beforeRange,
      comparison.afterRange,
      beforeStats,
      afterStats
    )
  };
};

const getAnalyticsUserIds = async () => {
  const [userIds, behaviorUserIds, feedbackUserIds, trialUserIds, eventUserIds] = await Promise.all([
    User.distinct('userId'),
    BehaviorLog.distinct('userId'),
    Feedback.distinct('userId'),
    Trial.distinct('userId'),
    OptimizationEvent.distinct('userId', { eventType: { $in: OPTIMIZATION_EVENT_TYPES } })
  ]);

  return [...new Set([
    ...userIds,
    ...behaviorUserIds,
    ...feedbackUserIds,
    ...trialUserIds,
    ...eventUserIds
  ])]
    .filter((candidate) => candidate && !isGuestUserId(candidate))
    .sort((left, right) => left.localeCompare(right));
};

const resolveAutoPivot = async (userId) => {
  if (!userId) return null;

  const eventMatch = {
    userId,
    eventType: { $in: OPTIMIZATION_EVENT_TYPES }
  };

  const [firstEvent, firstTrial] = await Promise.all([
    OptimizationEvent.findOne(eventMatch).sort({ timestamp: 1 }).lean(),
    Trial.findOne({ userId }).sort({ startTime: 1, createdAt: 1 }).lean()
  ]);

  const candidates = [firstEvent?.timestamp, firstTrial?.startTime].filter(Boolean);
  if (!candidates.length) return null;

  return candidates.sort((left, right) => left.getTime() - right.getTime())[0];
};

router.get('/optimization-impact', async (req, res) => {
  try {
    const { userId } = req.query;
    const includeAllUsers = parseBoolean(req.query.includeAllUsers) || parseBoolean(req.query.includePerUser);
    const beforeStart = parseOptionalDate(req.query.beforeStart);
    const beforeEnd = parseOptionalDate(req.query.beforeEnd);
    const afterStart = parseOptionalDate(req.query.afterStart);
    const afterEnd = parseOptionalDate(req.query.afterEnd);
    const explicitPivot = parseOptionalDate(req.query.pivotAt);
    const limit = Number.parseInt(req.query.limit, 10);
    const hasManualWindow = beforeStart || beforeEnd || afterStart || afterEnd;

    if (
      (req.query.beforeStart && !beforeStart) ||
      (req.query.beforeEnd && !beforeEnd) ||
      (req.query.afterStart && !afterStart) ||
      (req.query.afterEnd && !afterEnd) ||
      (req.query.pivotAt && !explicitPivot) ||
      (req.query.limit && (!Number.isFinite(limit) || limit <= 0))
    ) {
      return res.status(400).json({
        success: false,
        error: 'One or more query parameters are invalid.'
      });
    }

    if (hasManualWindow && (!beforeEnd || !afterStart)) {
      return res.status(400).json({
        success: false,
        error: 'Manual comparison requires at least beforeEnd and afterStart.'
      });
    }

    if (includeAllUsers) {
      const allUserIds = await getAnalyticsUserIds();
      const selectedUserIds = Number.isFinite(limit) ? allUserIds.slice(0, limit) : allUserIds;

      const reportResults = await Promise.all(selectedUserIds.map(async (candidateUserId) => {
        try {
          const comparison = await resolveComparisonRanges(
            candidateUserId,
            beforeStart,
            beforeEnd,
            afterStart,
            afterEnd,
            explicitPivot
          );

          return await buildUserReport(candidateUserId, comparison);
        } catch (error) {
          if (error.message === 'AUTO_PIVOT_UNAVAILABLE') {
            return null;
          }

          throw error;
        }
      }));

      const userReports = reportResults
        .filter(Boolean)
        .filter((entry) => hasStatsData(entry.beforeStats) || hasStatsData(entry.afterStats));

      if (!userReports.length) {
        return res.json(createReportPayload(
          { userId: null, mode: 'all-users' },
          explicitPivot ? 'explicit-pivot' : (beforeStart || beforeEnd || afterStart || afterEnd) ? 'manual-window' : 'per-user-auto-pivot',
          explicitPivot,
          { start: beforeStart, end: beforeEnd },
          { start: afterStart, end: afterEnd },
          combinePeriodStats([]),
          combinePeriodStats([]),
          {
            users: [],
            summary: {
              requestedUsers: selectedUserIds.length,
              returnedUsers: 0
            }
          }
        ));
      }

      const overallBeforeStats = combinePeriodStats(userReports.map((entry) => entry.beforeStats));
      const overallAfterStats = combinePeriodStats(userReports.map((entry) => entry.afterStats));
      const aggregateSplitMode = explicitPivot
        ? 'explicit-pivot'
        : (beforeStart || beforeEnd || afterStart || afterEnd)
          ? 'manual-window'
          : 'per-user-auto-pivot';

      return res.json(createReportPayload(
        { userId: null, mode: 'all-users' },
        aggregateSplitMode,
        explicitPivot,
        { start: beforeStart, end: beforeEnd },
        { start: afterStart, end: afterEnd },
        overallBeforeStats,
        overallAfterStats,
        {
          users: userReports.map((entry) => ({
            userId: entry.userId,
            split: entry.payload.split,
            metrics: entry.payload.metrics,
            samples: entry.payload.samples
          })),
          summary: {
            requestedUsers: selectedUserIds.length,
            returnedUsers: userReports.length
          }
        }
      ));
    }

    let comparison;

    try {
      comparison = await resolveComparisonRanges(
        userId || null,
        beforeStart,
        beforeEnd,
        afterStart,
        afterEnd,
        explicitPivot
      );
    } catch (error) {
      if (error.message === 'AUTO_PIVOT_UNAVAILABLE') {
        return res.status(400).json({
          success: false,
          error: 'Provide userId for auto pivot detection, or pass before/after windows or pivotAt explicitly.'
        });
      }

      if (error.message.includes('Manual comparison')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      throw error;
    }

    const report = await buildUserReport(userId || null, comparison);

    res.json(createReportPayload(
      { userId: userId || null },
      comparison.splitMode,
      comparison.pivotAt,
      comparison.beforeRange,
      comparison.afterRange,
      report.beforeStats,
      report.afterStats
    ));
  } catch (error) {
    console.error('[Analytics] Failed to build optimization impact report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
