import { memo, useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard, { ChartLegend, TooltipCard, TooltipRow } from "./ChartCard";
import { topRoundedPath, viz } from "./chartTheme";
import { DOW_SHORT, formatDay, formatDuration } from "../../utils/format";

// 7-day moving average over the days that count, weighted by tracked time. Needs two
// counted days in the window, otherwise there is nothing to average yet.
const withAverage = (days) =>
  days.map((d, i) => {
    const window = days.slice(Math.max(0, i - 6), i + 1).filter((x) => x.qualifies);
    const active = window.reduce((s, x) => s + x.active_min, 0);
    const productive = window.reduce((s, x) => s + x.productive_min, 0);
    return { ...d, avg7: window.length >= 2 ? Math.round((productive / active) * 100) : null };
  });

const DailyTooltip = ({ active, payload, minDayMinutes }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipCard title={formatDay(d.date, { weekday: "long", month: "short", day: "numeric" })}>
      {d.focus === null ? (
        <TooltipRow value="No data" label="nothing tracked" />
      ) : (
        <>
          <TooltipRow color={viz.productive} value={`${d.focus}%`} label="focus" />
          <TooltipRow value={formatDuration(d.active_min)} label="tracked" />
          {!d.qualifies && (
            <p className="mt-1" style={{ color: viz.ink.secondary }}>
              Under {minDayMinutes} min, so not counted in averages
            </p>
          )}
        </>
      )}
      {d.avg7 !== null && d.avg7 !== undefined && (
        <TooltipRow color={viz.ink.secondary} value={`${d.avg7}%`} label="7-day average" />
      )}
    </TooltipCard>
  );
};

// memo + useMemo: the dashboard re-renders every few seconds for live polling. A fresh `data`
// array on each of those renders makes Recharts replay its entrance animation, so the chart
// must only rebuild when `days` itself changes.
const DailyFocusChart = memo(function DailyFocusChart({ days, bestDate, minDayMinutes }) {
  const showAverage = days.length > 7;
  const data = useMemo(
    () =>
      (showAverage ? withAverage(days) : days).map((d) => ({
        ...d,
        label: showAverage
          ? formatDay(d.date, { month: "short", day: "numeric" })
          : `${DOW_SHORT[d.dow - 1]} ${Number(d.date.slice(8))}`,
      })),
    [days, showAverage],
  );

  const renderBar = ({ x, y, width, height, payload }) => {
    if (!height || payload.focus === null) return null;
    return (
      <g>
        <path
          d={topRoundedPath(x, y, width, height)}
          fill={viz.productive}
          fillOpacity={payload.qualifies ? 1 : 0.35}
        />
        {payload.date === bestDate && (
          <text
            x={x + width / 2}
            y={y - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill={viz.ink.primary}
          >
            {payload.focus}%
          </text>
        )}
      </g>
    );
  };

  const table = {
    columns: [
      { key: "date", label: "Date" },
      { key: "focus", label: "Focus", numeric: true },
      { key: "tracked", label: "Tracked", numeric: true },
      { key: "productive", label: "Productive", numeric: true },
      { key: "neutral", label: "Neutral", numeric: true },
      { key: "distraction", label: "Distraction", numeric: true },
      { key: "counted", label: "Counted" },
    ],
    rows: days.map((d) => ({
      date: formatDay(d.date, { weekday: "short", month: "short", day: "numeric" }),
      focus: d.focus === null ? "—" : `${d.focus}%`,
      tracked: formatDuration(d.active_min),
      productive: formatDuration(d.productive_min),
      neutral: formatDuration(d.neutral_min),
      distraction: formatDuration(d.distraction_min),
      counted: d.focus === null ? "—" : d.qualifies ? "Yes" : "No (under 30 min)",
    })),
  };

  return (
    <ChartCard
      title="Daily focus"
      subtitle={`Share of tracked time spent on productive apps and sites. Faded bars have under ${minDayMinutes} min tracked and are left out of averages.`}
      legend={
        showAverage ? (
          <ChartLegend
            items={[
              { label: "Daily focus", color: viz.productive, kind: "bar" },
              { label: "7-day average", color: viz.ink.secondary, kind: "line" },
            ]}
          />
        ) : null
      }
      table={table}
    >
      <div
        role="img"
        aria-label={`Daily focus for the last ${days.length} days. Open the table view for the exact values.`}
        style={{ height: 280 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={viz.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: viz.ink.secondary }}
              axisLine={{ stroke: viz.baseline }}
              tickLine={false}
              interval={showAverage ? "preserveStartEnd" : 0}
              minTickGap={14}
              dy={6}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: viz.ink.secondary }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={<DailyTooltip minDayMinutes={minDayMinutes} />}
              cursor={{ fill: viz.grid, fillOpacity: 0.5 }}
            />
            <Bar dataKey="focus" maxBarSize={24} shape={renderBar} />
            {showAverage && (
              <Line
                type="monotone"
                dataKey="avg7"
                stroke={viz.ink.secondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, fill: viz.ink.secondary, stroke: viz.surface, strokeWidth: 2 }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
});

export default DailyFocusChart;
