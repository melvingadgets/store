type AssistantTimingSource = "model" | "fallback";

export type AssistantTimingMark = {
  stage: string;
  durationMs: number;
};

export type AssistantTimingSnapshot = {
  sessionId: string;
  intent: string;
  source: AssistantTimingSource;
  usedTools: string[];
  totalMs: number;
  marks: AssistantTimingMark[];
  createdAt: string;
};

type AssistantTimingStats = {
  count: number;
  avgMs: number;
  maxMs: number;
  p95Ms: number;
  totalMs: number;
  shareOfAvgTotal: number;
};

export type AssistantTimingStageNode = {
  key: string;
  label: string;
  stats: AssistantTimingStats;
  children: AssistantTimingStageNode[];
};

export type AssistantTimingSummary = {
  overview: {
    totalRequests: number;
    avgTotalMs: number;
    p95TotalMs: number;
    maxTotalMs: number;
    modelCount: number;
    fallbackCount: number;
  };
  stageHierarchy: AssistantTimingStageNode[];
  recentSlowRequests: AssistantTimingSnapshot[];
};

const MAX_TIMING_SNAPSHOTS = 300;

const timingSnapshots: AssistantTimingSnapshot[] = [];

const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(2));
};

const total = (values: number[]) => Number(values.reduce((sum, value) => sum + value, 0).toFixed(2));

const buildStats = (durations: number[], avgTotalMs: number): AssistantTimingStats => ({
  count: durations.length,
  avgMs: average(durations),
  maxMs: Number((durations.length ? Math.max(...durations) : 0).toFixed(2)),
  p95Ms: percentile(durations, 0.95),
  totalMs: total(durations),
  shareOfAvgTotal: avgTotalMs > 0 ? Number(((average(durations) / avgTotalMs) * 100).toFixed(2)) : 0,
});

const getStageGroup = (stage: string) => {
  if (stage.startsWith("session_")) {
    return { key: "session", label: "Session" };
  }

  if (stage.startsWith("provider_")) {
    return { key: "model", label: "Model" };
  }

  if (stage.startsWith("tool_")) {
    return { key: "tools", label: "Tools" };
  }

  return { key: "other", label: "Other" };
};

export const recordAssistantTiming = (snapshot: Omit<AssistantTimingSnapshot, "createdAt">) => {
  timingSnapshots.push({
    ...snapshot,
    createdAt: new Date().toISOString(),
  });

  if (timingSnapshots.length > MAX_TIMING_SNAPSHOTS) {
    timingSnapshots.splice(0, timingSnapshots.length - MAX_TIMING_SNAPSHOTS);
  }
};

export const getAssistantTimingSummary = (): AssistantTimingSummary => {
  const totalDurations = timingSnapshots.map((entry) => entry.totalMs);
  const avgTotalMs = average(totalDurations);
  const groupedMarks = new Map<string, number[]>();
  const groupedChildren = new Map<string, Map<string, number[]>>();

  timingSnapshots.forEach((entry) => {
    entry.marks.forEach((mark) => {
      const group = getStageGroup(mark.stage);
      const groupDurations = groupedMarks.get(group.key) ?? [];
      groupDurations.push(mark.durationMs);
      groupedMarks.set(group.key, groupDurations);

      const children = groupedChildren.get(group.key) ?? new Map<string, number[]>();
      const childDurations = children.get(mark.stage) ?? [];
      childDurations.push(mark.durationMs);
      children.set(mark.stage, childDurations);
      groupedChildren.set(group.key, children);
    });
  });

  const stageHierarchy = [...groupedMarks.entries()]
    .map(([groupKey, durations]) => {
      const groupMeta =
        groupKey === "session"
          ? { label: "Session" }
          : groupKey === "model"
            ? { label: "Model" }
            : groupKey === "tools"
              ? { label: "Tools" }
              : { label: "Other" };
      const children = [...(groupedChildren.get(groupKey)?.entries() ?? [])]
        .map(([stage, childDurations]) => ({
          key: stage,
          label: stage.replace(/^tool_/, "").replace(/^provider_/, "").replace(/^session_/, "").replace(/_/g, " "),
          stats: buildStats(childDurations, avgTotalMs),
          children: [],
        }))
        .sort((left, right) => right.stats.avgMs - left.stats.avgMs);

      return {
        key: groupKey,
        label: groupMeta.label,
        stats: buildStats(durations, avgTotalMs),
        children,
      };
    })
    .sort((left, right) => right.stats.avgMs - left.stats.avgMs);

  return {
    overview: {
      totalRequests: timingSnapshots.length,
      avgTotalMs,
      p95TotalMs: percentile(totalDurations, 0.95),
      maxTotalMs: Number((totalDurations.length ? Math.max(...totalDurations) : 0).toFixed(2)),
      modelCount: timingSnapshots.filter((entry) => entry.source === "model").length,
      fallbackCount: timingSnapshots.filter((entry) => entry.source === "fallback").length,
    },
    stageHierarchy,
    recentSlowRequests: [...timingSnapshots]
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 12),
  };
};

export const clearAssistantTimingSummary = () => {
  timingSnapshots.splice(0, timingSnapshots.length);
};
