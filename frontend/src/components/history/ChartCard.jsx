import { useState } from "react";
import { viz } from "./chartTheme";

// The table twin of a chart: same numbers, no colour needed. Every chart has one so
// nothing is gated behind hover or hue.
export const DataTable = ({ caption, columns, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={`py-2 pr-4 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 whitespace-nowrap ${c.numeric ? "text-right" : ""}`}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-slate-100 last:border-0">
            {columns.map((c) => (
              <td
                key={c.key}
                className={`py-2 pr-4 whitespace-nowrap text-slate-700 ${c.numeric ? "text-right tabular-nums" : "font-medium"}`}
              >
                {row[c.key] ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Legend for 2+ series. A swatch mirrors the mark (rect for bars, short line for lines);
// the text stays in a text colour, never the series colour.
export const ChartLegend = ({ items }) => (
  <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4 text-xs font-semibold" style={{ color: viz.ink.secondary }}>
    {items.map((item) => (
      <li key={item.label} className="flex items-center gap-2">
        {item.kind === "line" ? (
          <span aria-hidden="true" className="inline-block w-4 rounded-full" style={{ height: 2, background: item.color }} />
        ) : (
          <span aria-hidden="true" className="inline-block w-3 h-3 rounded-[3px]" style={{ background: item.color }} />
        )}
        {item.label}
      </li>
    ))}
  </ul>
);

// Tooltip shell + row. Values lead (strong), the label follows (secondary), and a short
// stroke of the series colour keys the row. React escapes text, so labels are safe.
export const TooltipCard = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-lg px-3.5 py-2.5 text-xs min-w-[150px]">
    {title && (
      <p className="font-bold mb-1.5" style={{ color: viz.ink.primary }}>
        {title}
      </p>
    )}
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);

export const TooltipRow = ({ color, value, label }) => (
  <div className="flex items-center gap-2">
    {color && (
      <span aria-hidden="true" className="inline-block w-3 rounded-full shrink-0" style={{ height: 3, background: color }} />
    )}
    <span className="font-bold tabular-nums" style={{ color: viz.ink.primary }}>
      {value}
    </span>
    <span style={{ color: viz.ink.secondary }}>{label}</span>
  </div>
);

const ChartCard = ({ title, subtitle, legend, table, children, className = "" }) => {
  const [mode, setMode] = useState("chart");
  const showTable = mode === "table" && table;

  return (
    <section
      className={`bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-[32px] border border-white/40 shadow-xl ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold text-[var(--aura-dark)] tracking-tight">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>}
        </div>
        {table && (
          <div role="group" aria-label={`${title}: view`} className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-bold shrink-0">
            {[
              ["chart", "Chart"],
              ["table", "Table"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={`px-3 py-1.5 rounded-[10px] transition-colors ${
                  mode === key ? "bg-white text-[var(--aura-dark)] shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {showTable ? <DataTable caption={title} {...table} /> : (
        <>
          {legend}
          {children}
        </>
      )}
    </section>
  );
};

export default ChartCard;
