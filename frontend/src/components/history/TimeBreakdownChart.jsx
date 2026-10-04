import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard, { ChartLegend, TooltipCard, TooltipRow } from "./ChartCard";
import { topRoundedPath, viz } from "./chartTheme";
import { DOW_SHORT, formatDay, formatDuration } from "../../utils/format";

const GAP = 2; // surface gap between stacked segments
// Stack order, bottom to top.
const SERIES = [
  { key: "productive_h", minutes: "productive_min", label: "Productive", color: viz.productive },
  { key: "neutral_h", minutes: "neutral_min", label: "Neutral", color: viz.neutral },
  { key: "distraction_h", minutes: "distraction_min", label: "Distraction", color: viz.distraction },
];

// Draw one segment. A non-top segment gives up GAP px at its top edge so the surface shows
// between it and the next one (no stroke around marks); only the topmost visible segment
// of a day gets the 4px rounded data end.
const segmentShape = (key) => {
  const above = SERIES.slice(SERIES.findIndex((s) => s.key === key) + 1);
  return ({ x, y, width, height, payload, fill }) => {
    if (!height || height <= 0) return null;
    const isTop = !above.some((s) => payload[s.key] > 0);
    const gap = isTop ? 0 : Math.min(GAP, Math.max(0, height - 1));
    const top = y + gap;
    const h = height - gap;
    const d = isTop ? topRoundedPath(x, top, width, h) : `M${x},${top} h${width} v${h} h${-width} Z`;
    return <path d={d} fill={fill} />;
  };
};

const BreakdownTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipCard title={formatDay(d.date, { weekday: "long", month: "short", day: "numeric" })}>
      {d.active_min === 0 ? (
        <TooltipRow value="No data" label="nothing tracked" />
      ) : (
        <>
          {[...SERIES].reverse().map((s) => (
            <TooltipRow key={s.key} color={s.color} value={formatDuration(d[s.minutes])} label={s.label.toLowerCase()} />
          ))}
          <p className="mt-1 font-semibold" style={{ color: viz.ink.secondary }}>
            {formatDuration(d.active_min)} tracked in total
          </p>
        </>
      )}
    </TooltipCard>
  );
};

const TimeBreakdownChart = memo(function TimeBreakdownChart({ days }) {
  const long = days.length > 7;
  const data = useMemo(
    () =>
      days.map((d) => ({
        ...d,
        label: long
          ? formatDay(d.date, { month: "short", day: "numeric" })
          : `${DOW_SHORT[d.dow - 1]} ${Number(d.date.slice(8))}`,
        productive_h: d.productive_min / 60,
        neutral_h: d.neutral_min / 60,
        distraction_h: d.distraction_min / 60,
      })),
    [days, long],
  );

  const table = {
    columns: [
      { key: "date", label: "Date" },
      { key: "productive", label: "Productive", numeric: true },
      { key: "neutral", label: "Neutral", numeric: true },
      { key: "distraction", label: "Distraction", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ],
    rows: days.map((d) => ({
      date: formatDay(d.date, { weekday: "short", month: "short", day: "numeric" }),
      productive: formatDuration(d.productive_min),
      neutral: formatDuration(d.neutral_min),
      distraction: formatDuration(d.distraction_min),
      total: formatDuration(d.active_min),
    })),
  };

  return (
    <ChartCard
      title="Where the time went"
      subtitle="Hours tracked per day, split by what you were doing. Idle time is not counted."
      legend={<ChartLegend items={SERIES.map(({ label, color }) => ({ label, color, kind: "bar" }))} />}
      table={table}
    >
      <div
        role="img"
        aria-label={`Hours tracked per day for the last ${days.length} days, split into productive, neutral and distraction time. Open the table view for the exact values.`}
        style={{ height: 280 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={viz.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: viz.ink.secondary }}
              axisLine={{ stroke: viz.baseline }}
              tickLine={false}
              interval={long ? "preserveStartEnd" : 0}
              minTickGap={14}
              dy={6}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v * 10) / 10}h`}
              tick={{ fontSize: 11, fill: viz.ink.secondary }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<BreakdownTooltip />} cursor={{ fill: viz.grid, fillOpacity: 0.5 }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="time" fill={s.color} maxBarSize={24} shape={segmentShape(s.key)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
});

export default TimeBreakdownChart;
