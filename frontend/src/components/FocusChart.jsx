import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const FocusChart = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

      {/* Show XAxis so you can see the 24-hour timeline */}
      <XAxis
        dataKey="time"
        tick={{ fontSize: 12, fill: "#9ca3af" }}
        axisLine={false}
        tickLine={false}
        minTickGap={20}
      />

      <YAxis domain={[0, 100]} hide />

      <Tooltip
        contentStyle={{
          borderRadius: "12px",
          border: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      />

      <Area
        type="monotone"
        dataKey="score"
        stroke="#6366f1"
        fillOpacity={1}
        fill="url(#colorFocus)"
        strokeWidth={3}
      />
    </AreaChart>
  </ResponsiveContainer>
);

export default FocusChart;
