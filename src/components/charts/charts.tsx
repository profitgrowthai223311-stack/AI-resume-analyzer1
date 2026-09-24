"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

export function ChartEmpty({ text = "No data yet" }: { text?: string }) {
  return (
    <div className="text-muted-foreground flex h-full min-h-40 items-center justify-center text-sm">
      {text}
    </div>
  );
}

export function ScoreTrendChart({
  data,
}: {
  data: { date: string; score: number }[];
}) {
  if (!data.length)
    return <ChartEmpty text="Run an analysis to see your score trend" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
      >
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={axis}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--chart-1)"
          strokeWidth={3}
          fill="url(#scoreFill)"
          name="ATS score"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ActivityChart({
  data,
}: {
  data: { label: string; ready: number; failed: number }[];
}) {
  if (!data.some((d) => d.ready || d.failed))
    return <ChartEmpty text="Generate a resume to see activity" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis
          allowDecimals={false}
          tick={axis}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar
          dataKey="ready"
          stackId="a"
          fill="var(--chart-3)"
          name="Ready"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="failed"
          stackId="a"
          fill="var(--chart-2)"
          name="Failed"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={3}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HistogramChart({
  data,
}: {
  data: { range: string; count: number }[];
}) {
  if (!data.some((d) => d.count)) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis dataKey="range" tick={axis} tickLine={false} axisLine={false} />
        <YAxis
          allowDecimals={false}
          tick={axis}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="count" name="Analyses" radius={[8, 8, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={
                [
                  "var(--chart-2)",
                  "var(--chart-4)",
                  "var(--chart-5)",
                  "var(--chart-1)",
                  "var(--chart-3)",
                ][i % 5]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KeywordBarChart({
  data,
  color,
}: {
  data: { keyword: string; count: number }[];
  color: string;
}) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          horizontal={false}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={axis}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="keyword"
          width={110}
          tick={axis}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="count" fill={color} name="Jobs" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
