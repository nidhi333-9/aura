import { viz } from "./chartTheme";
import { formatDay, formatDuration, formatHourRange } from "../../utils/format";

// delta = signed points vs the previous period. Colour follows direction x "up is good",
// and is always paired with an arrow and a signed number, never colour alone.
const Delta = ({ delta, versus }) => {
  if (delta === null) return null;
  if (delta === 0) {
    return (
      <p className="mt-1 text-sm font-semibold" style={{ color: viz.ink.secondary }}>
        No change {versus}
      </p>
    );
  }
  const up = delta > 0;
  return (
    <p className="mt-1 text-sm font-semibold" style={{ color: viz.ink.secondary }}>
      <span style={{ color: up ? viz.good : viz.critical }}>
        {up ? "▲ +" : "▼ −"}
        {Math.abs(delta)} pts
      </span>{" "}
      {versus}
    </p>
  );
};

const Tile = ({ label, value, children, hero = false }) => (
  <div className="bg-white/70 backdrop-blur-md rounded-3xl p-6 border border-white/40 shadow-md">
    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
    <p
      className={hero ? "text-5xl font-extrabold leading-tight mt-1" : "text-2xl font-bold mt-1"}
      style={{ color: viz.ink.primary }}
    >
      {value}
    </p>
    {children}
  </div>
);

const Sub = ({ children }) => (
  <p className="mt-1 text-sm font-medium" style={{ color: viz.ink.secondary }}>
    {children}
  </p>
);

const SummaryStrip = ({ summary, days, minDayMinutes }) => {
  const { avg_focus, delta, best_day, peak_hour, total_active_min, total_productive_min, tracked_days } = summary;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <Tile label="Average focus" value={avg_focus === null ? "—" : `${avg_focus}%`} hero>
        <Delta delta={delta} versus={`vs the previous ${days} days`} />
        {avg_focus === null && <Sub>Needs a day with {minDayMinutes}+ min tracked</Sub>}
      </Tile>

      <Tile
        label="Best day"
        value={best_day ? formatDay(best_day.date, { weekday: "short", month: "short", day: "numeric" }) : "—"}
      >
        <Sub>
          {best_day
            ? `${best_day.focus}% focus over ${formatDuration(best_day.active_min)}`
            : `Needs a day with ${minDayMinutes}+ min tracked`}
        </Sub>
      </Tile>

      <Tile label="Peak hour" value={peak_hour ? formatHourRange(peak_hour.hour) : "—"}>
        <Sub>
          {peak_hour
            ? `${peak_hour.focus}% focus over ${formatDuration(peak_hour.active_min)}`
            : "Needs 20+ min tracked in an hour of the day"}
        </Sub>
      </Tile>

      <Tile label="Time tracked" value={formatDuration(total_active_min)}>
        <Sub>
          {formatDuration(total_productive_min)} productive · {tracked_days} of {days} days counted
        </Sub>
      </Tile>
    </div>
  );
};

export default SummaryStrip;
