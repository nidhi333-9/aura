import useResource from "../../hooks/useResource";
import { browserTimeZone } from "../../utils/timezone";
import { formatDay } from "../../utils/format";
import DailyFocusChart from "./DailyFocusChart";
import FocusHeatmap from "./FocusHeatmap";
import SummaryStrip from "./SummaryStrip";
import TimeBreakdownChart from "./TimeBreakdownChart";
import WeekdayChart from "./WeekdayChart";

const REFRESH_MS = 5 * 60 * 1000; // history changes slowly; the sensor adds ~6 samples a minute
const RETRY_MS = 30 * 1000; // after a failure (or a deliberate 503), look again sooner

const Skeleton = () => (
  <div className="flex flex-col gap-8 animate-pulse" aria-hidden="true">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 rounded-3xl bg-white/60 border border-white/40" />
      ))}
    </div>
    <div className="h-80 rounded-[32px] bg-white/60 border border-white/40" />
    <div className="h-72 rounded-[32px] bg-white/60 border border-white/40" />
  </div>
);

const Notice = ({ children, action }) => (
  <div className="bg-white/60 backdrop-blur-xl p-10 rounded-[32px] border border-white/40 shadow-xl text-center">
    <p className="text-slate-500 font-medium">{children}</p>
    {action}
  </div>
);

const HistoryView = ({ range, onInstallClick }) => {
  const res = useResource(
    `/api/history?range=${range}&tz=${encodeURIComponent(browserTimeZone())}`,
    REFRESH_MS,
    { errorIntervalMs: RETRY_MS },
  );
  const h = res.data;

  // 503 is the server saying "not yet" on purpose (long ranges need the rollups). Say that
  // plainly: it isn't a failed load and retrying can't help. This takes priority over any
  // previous range's data still in memory, which would otherwise sit on screen under the wrong
  // tab with a vague "couldn't refresh" line.
  if (res.errorStatus === 503) {
    return <Notice>{res.error}</Notice>;
  }

  if (!h && res.error) {
    return (
      <Notice
        action={
          <button
            type="button"
            onClick={res.retry}
            className="mt-4 px-5 py-2 rounded-xl bg-[var(--aura-dark)] text-white text-sm font-bold hover:opacity-90"
          >
            Try again
          </button>
        }
      >
        Couldn't load your history ({res.error}).
      </Notice>
    );
  }

  if (!h) {
    return (
      <>
        {res.slow && (
          <p role="status" className="mb-6 text-sm font-medium text-sky-800">
            Waking up the server. The first load after a quiet period can take up to a minute.
          </p>
        )}
        <Skeleton />
      </>
    );
  }

  const { days, summary, by_weekday, heatmap, meta } = h;
  const minDay = meta.min_active_minutes_per_day;
  const period = `${formatDay(h.range.from, { month: "short", day: "numeric" })} – ${formatDay(h.range.to, { month: "short", day: "numeric" })}`;

  return (
    // Switching range keeps this frame: the previous render dims while the new one loads.
    <div
      aria-busy={res.refreshing}
      className={`flex flex-col gap-8 transition-opacity duration-200 ${res.refreshing ? "opacity-50" : ""}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-2xl font-extrabold text-[var(--aura-dark)] tracking-tight">
          Last {h.range.days} days
        </h2>
        <p className="text-slate-500 font-medium">{period}</p>
        {res.refreshing && (
          <p role="status" className="text-sm font-semibold text-slate-500">
            Loading…
          </p>
        )}
        {res.error && (
          <p role="status" className="text-sm font-semibold text-amber-700">
            Couldn't refresh. Showing the last data we received.{" "}
            <button type="button" onClick={res.retry} className="underline underline-offset-4 hover:opacity-80">
              Try again
            </button>
          </p>
        )}
      </div>

      {summary.tracked_days === 0 ? (
        <Notice
          action={
            onInstallClick && (
              <button
                type="button"
                onClick={onInstallClick}
                className="mt-4 underline underline-offset-4 font-bold text-[var(--aura-dark)] hover:opacity-80"
              >
                Install the sensor
              </button>
            )
          }
        >
          No day in this period has {minDay}+ minutes tracked yet. Keep the sensor running and your
          history will fill in here.
        </Notice>
      ) : (
        <>
          <SummaryStrip summary={summary} days={h.range.days} minDayMinutes={minDay} />
          <DailyFocusChart days={days} bestDate={summary.best_day?.date} minDayMinutes={minDay} />
          {summary.best_weekday ? (
            <WeekdayChart byWeekday={by_weekday} best={summary.best_weekday} minDays={meta.min_days_per_weekday} />
          ) : (
            h.range.days >= 30 && (
              <Notice>
                Your best weekday shows up here once at least two weekdays have {meta.min_days_per_weekday}+
                counted days of {minDay}+ minutes each.
              </Notice>
            )
          )}
          <FocusHeatmap heatmap={heatmap} peak={summary.peak_hour} />
          <TimeBreakdownChart days={days} />
        </>
      )}
    </div>
  );
};

export default HistoryView;
