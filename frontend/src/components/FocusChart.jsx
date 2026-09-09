import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
} from "recharts";

const formatLocalHour = (isoString) =>
  new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#1a1a1a] text-white rounded-2xl px-4 py-3 shadow-2xl border border-white/10">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
        {label}
      </p>
      <p className="text-lg font-extrabold text-[#818cf8]">
        {payload[0].value}% focus
      </p>
    </div>
  );
};

const ActiveDot = ({ cx, cy }) => (
  <g>
    <circle cx={cx} cy={cy} r={9} fill="#6366f1" opacity={0.15} />
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill="#ffffff"
      stroke="#6366f1"
      strokeWidth={2.5}
    />
  </g>
);

const FocusChart = ({ data }) => {
  const chartData = (data || []).map((d) => ({
    ...d,
    label: formatLocalHour(d.time),
  }));

  const now = Date.now();
  const current = chartData.reduce((closest, point) => {
    const t = new Date(point.time).getTime();
    if (Number.isNaN(t) || t > now) return closest;
    if (!closest || t > new Date(closest.time).getTime()) return point;
    return closest;
  }, null);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 6"
          vertical={false}
          stroke="#eef0f4"
        />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
          dy={8}
        />

        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tick={{ fontSize: 11, fill: "#c7cad1", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "#c7d2fe", strokeWidth: 1, strokeDasharray: "4 4" }}
        />

        <Area
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorFocus)"
          activeDot={<ActiveDot />}
          animationDuration={800}
        />

        {current && (
          <>
            <ReferenceLine
              x={current.label}
              stroke="#6366f1"
              strokeOpacity={0.4}
              strokeDasharray="4 4"
              label={{
                value: "Now",
                position: "top",
                fill: "#6366f1",
                fontSize: 10,
                fontWeight: 700,
              }}
            />
            <ReferenceDot
              x={current.label}
              y={current.score}
              r={5}
              fill="#6366f1"
              stroke="#ffffff"
              strokeWidth={2}
              isFront
            />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default FocusChart;
