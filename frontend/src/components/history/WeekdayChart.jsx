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
import ChartCard, { TooltipCard, TooltipRow } from "./ChartCard";
import { topRoundedPath, viz } from "./chartTheme";
import { DOW_LONG, DOW_SHORT, formatDuration } from "../../utils/format";

const WeekdayTooltip = ({ active, payload, minDays }) => {
  if (!active || !payload?.length) return null;
  const w = payload[0].payload;
  return (
    <TooltipCard title={DOW_LONG[w.dow - 1]}>
      {w.focus === null ? (
        <TooltipRow value="No data" label="no counted days" />
      ) : (
        <>
          <TooltipRow color={viz.productive} value={`${w.focus}%`} label="average focus" />
          <TooltipRow value={String(w.days)} label={w.days === 1 ? "counted day" : "counted days"} />
          <TooltipRow value={formatDuration(w.avg_active_min)} label="tracked per day" />
          {w.days < minDays && (
            <p className="mt-1" style={{ color: viz.ink.secondary }}>
              Under {minDays} days, so too few to compare
            </p>
          )}
        </>
      )}
    </TooltipCard>
  );
};

// Emphasis form: one weekday in the accent, the rest in the de-emphasis gray, because the
// question is "which day am I best?". Weekdays with too few counted days are faded.
const WeekdayChart = memo(function WeekdayChart({ byWeekday, best, minDays }) {
  const data = useMemo(
    () => byWeekday.map((w) => ({ ...w, label: DOW_SHORT[w.dow - 1] })),
    [byWeekday],
  );

  const renderBar = ({ x, y, width, height, payload }) => {
    if (!height || payload.focus === null) return null;
    const isBest = payload.dow === best.dow;
    return (
      <g>
        <path
          d={topRoundedPath(x, y, width, height)}
          fill={isBest ? viz.productive : viz.neutral}
          fillOpacity={payload.days < minDays ? 0.45 : 1}
        />
        {isBest && (
          <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill={viz.ink.primary}>
            {payload.focus}%
          </text>
        )}
      </g>
    );
  };

  const table = {
    columns: [
      { key: "day", label: "Weekday" },
      { key: "focus", label: "Average focus", numeric: true },
      { key: "days", label: "Counted days", numeric: true },
      { key: "tracked", label: "Tracked per day", numeric: true },
    ],
    rows: byWeekday.map((w) => ({
      day: DOW_LONG[w.dow - 1],
      focus: w.focus === null ? "—" : `${w.focus}%`,
      days: String(w.days),
      tracked: w.days ? formatDuration(w.avg_active_min) : "—",
    })),
  };

  return (
    <ChartCard
      title="Focus by weekday"
      subtitle={`You focus best on ${DOW_LONG[best.dow - 1]}s: ${best.focus}% on average across ${best.days} days. Weighted by time tracked, counted days only.`}
      table={table}
    >
      <div
        role="img"
        aria-label={`Average focus by weekday. Best: ${DOW_LONG[best.dow - 1]} at ${best.focus} percent.`}
        style={{ height: 240 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={viz.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: viz.ink.secondary }}
              axisLine={{ stroke: viz.baseline }}
              tickLine={false}
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
              content={<WeekdayTooltip minDays={minDays} />}
              cursor={{ fill: viz.grid, fillOpacity: 0.5 }}
            />
            <Bar dataKey="focus" maxBarSize={24} shape={renderBar} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
});

export default WeekdayChart;
