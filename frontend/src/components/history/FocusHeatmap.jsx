import { memo, useRef, useState } from "react";
import ChartCard, { TooltipCard, TooltipRow } from "./ChartCard";
import { HEAT_STEPS, heatColor, viz } from "./chartTheme";
import { DOW_LONG, DOW_SHORT, formatDuration, formatHour, formatHourRange } from "../../utils/format";

const LOW_DATA_MINUTES = 15; // cells under this are drawn as a smaller square: one stray sample isn't a pattern
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DAYS = [1, 2, 3, 4, 5, 6, 7];

const describe = (cell) =>
  cell.focus === null
    ? `${DOW_LONG[cell.dow - 1]}, ${formatHourRange(cell.hour)}: no data`
    : `${DOW_LONG[cell.dow - 1]}, ${formatHourRange(cell.hour)}: ${cell.focus}% focus, ${formatDuration(cell.active_min)} tracked`;

const FocusHeatmap = memo(function FocusHeatmap({ heatmap, peak }) {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null); // { cell, left, top }
  const [roving, setRoving] = useState({ r: 0, c: 0 }); // the one cell in the tab order

  const byKey = new Map(heatmap.map((c) => [`${c.dow}-${c.hour}`, c]));
  const cellAt = (dow, hour) => byKey.get(`${dow}-${hour}`);

  const show = (cell, el) => {
    const wrap = wrapRef.current.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const left = box.left - wrap.left + box.width / 2;
    setTip({ cell, left: Math.min(Math.max(left, 90), wrap.width - 90), top: box.top - wrap.top });
  };

  // Arrow keys move between cells; focusing a cell shows the same tooltip as hovering it.
  const onKeyDown = (e, r, c) => {
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    let next = null;
    if (moves[e.key]) next = [r + moves[e.key][0], c + moves[e.key][1]];
    else if (e.key === "Home") next = [r, 0];
    else if (e.key === "End") next = [r, 23];
    if (!next || next[0] < 0 || next[0] > 6 || next[1] < 0 || next[1] > 23) return;
    e.preventDefault();
    wrapRef.current.querySelector(`[data-r="${next[0]}"][data-c="${next[1]}"]`)?.focus();
  };

  const table = {
    columns: [
      { key: "day", label: "Weekday" },
      ...HOURS.map((h) => ({ key: `h${h}`, label: formatHour(h), numeric: true })),
    ],
    rows: DAYS.map((dow) => ({
      day: DOW_LONG[dow - 1],
      ...Object.fromEntries(
        HOURS.map((h) => {
          const cell = cellAt(dow, h);
          return [`h${h}`, cell.focus === null ? "—" : `${cell.focus}%`];
        }),
      ),
    })),
  };

  return (
    <ChartCard
      title="When you focus"
      subtitle={
        peak
          ? `Your best hour is ${formatHourRange(peak.hour)}: ${peak.focus}% focus over ${formatDuration(peak.active_min)} tracked. Each square is a weekday and hour, summed across the period.`
          : "Each square is a weekday and hour, summed across the period. Your best hour shows up once there is enough tracked time."
      }
      table={table}
    >
      {/* The tooltip lives on this outer wrapper, not inside the scroller: overflow-x clips
          vertically too, which cut the tooltip's title off for the top rows. */}
      <div ref={wrapRef} className="relative" onPointerLeave={() => setTip(null)}>
        <div className="overflow-x-auto">
          <div className="min-w-[620px] max-w-4xl">
            <div role="grid" aria-label="Focus by weekday and hour of day" aria-rowcount={7} aria-colcount={24}>
              <div className="flex items-end ml-11 mb-1" aria-hidden="true">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex-1 min-w-0 text-[11px] leading-none"
                    style={{ color: viz.ink.secondary }}
                  >
                    {h % 3 === 0 ? formatHour(h).replace(" ", "") : ""}
                  </div>
                ))}
              </div>
              {DAYS.map((dow, r) => (
                <div key={dow} role="row" className="flex items-center mb-[2px]">
                  <div
                    role="rowheader"
                    className="w-11 shrink-0 text-xs font-semibold"
                    style={{ color: viz.ink.secondary }}
                  >
                    {DOW_SHORT[dow - 1]}
                  </div>
                  <div className="flex flex-1 gap-[2px] min-w-0">
                    {HOURS.map((h) => {
                      const cell = cellAt(dow, h);
                      const empty = cell.focus === null;
                      const weak = !empty && cell.active_min < LOW_DATA_MINUTES;
                      return (
                        <div
                          key={h}
                          role="gridcell"
                          data-r={r}
                          data-c={h}
                          tabIndex={roving.r === r && roving.c === h ? 0 : -1}
                          aria-label={describe(cell)}
                          onPointerEnter={(e) => show(cell, e.currentTarget)}
                          onFocus={(e) => {
                            setRoving({ r, c: h });
                            show(cell, e.currentTarget);
                          }}
                          onBlur={() => setTip(null)}
                          onKeyDown={(e) => onKeyDown(e, r, h)}
                          className="group relative flex-1 min-w-0 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--aura-dark)]"
                          style={{
                            aspectRatio: "1",
                            // Empty and weak cells sit in a hairline slot so the grid still reads as a grid.
                            background: empty || weak ? viz.surface : undefined,
                            boxShadow: empty || weak ? `inset 0 0 0 1px ${viz.grid}` : undefined,
                          }}
                        >
                          {!empty && (
                            // Colour is the true focus value; a smaller square (not a fade, which would
                            // read as a different step on the ramp) means little data behind it.
                            <span
                              aria-hidden="true"
                              className="absolute rounded-[2px] pointer-events-none group-hover:brightness-90"
                              style={{ inset: weak ? "26%" : 0, background: heatColor(cell.focus) }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {tip && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{ left: tip.left, top: tip.top, transform: "translate(-50%, calc(-100% - 8px))" }}
          >
            <TooltipCard title={`${DOW_LONG[tip.cell.dow - 1]}, ${formatHourRange(tip.cell.hour)}`}>
              {tip.cell.focus === null ? (
                <TooltipRow value="No data" label="nothing tracked" />
              ) : (
                <>
                  <TooltipRow color={heatColor(tip.cell.focus)} value={`${tip.cell.focus}%`} label="focus" />
                  <TooltipRow value={formatDuration(tip.cell.active_min)} label="tracked" />
                  {tip.cell.active_min < LOW_DATA_MINUTES && (
                    <p className="mt-1" style={{ color: viz.ink.secondary }}>
                      Under {LOW_DATA_MINUTES} min, so a weak signal
                    </p>
                  )}
                </>
              )}
            </TooltipCard>
          </div>
        )}
      </div>

      {/* scale legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-xs font-semibold" style={{ color: viz.ink.secondary }}>
        <div className="flex items-center gap-2">
          <span>Less focused</span>
          <div className="flex gap-[2px]" aria-hidden="true">
            {HEAT_STEPS.map((c) => (
              <span key={c} className="w-5 h-3 rounded-[2px]" style={{ background: c }} />
            ))}
          </div>
          <span>More focused</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="w-5 h-3 rounded-[2px]"
            style={{ background: viz.surface, boxShadow: `inset 0 0 0 1px ${viz.grid}` }}
          />
          <span>No data</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="relative w-3 h-3 rounded-[2px]"
            style={{ background: viz.surface, boxShadow: `inset 0 0 0 1px ${viz.grid}` }}
          >
            <span className="absolute rounded-[1px]" style={{ inset: "26%", background: HEAT_STEPS[3] }} />
          </span>
          <span>Small square: under {LOW_DATA_MINUTES} min tracked</span>
        </div>
      </div>
    </ChartCard>
  );
});

export default FocusHeatmap;
