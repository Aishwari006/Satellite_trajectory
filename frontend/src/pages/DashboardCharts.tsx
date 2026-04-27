import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TooltipBox = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel border-primary/30 px-3 py-2 text-xs shadow-glow-primary">
      <div className="label-mono">T+ {Number(label).toFixed(1)}h</div>
      <div className="font-mono text-foreground">
        {payload[0].value.toFixed(2)} {unit}
      </div>
    </div>
  );
};

const ChartCard = ({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  badge?: string;
}) => (
  <div className="glass-panel p-5">
    <div className="mb-4 flex items-start justify-between">
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <div className="label-mono mt-1">{subtitle}</div>
      </div>
      {badge && (
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
          {badge}
        </span>
      )}
    </div>
    <div className="h-56 w-full">{children}</div>
  </div>
);

interface DashboardChartsProps {
  data: any[];
}

export default function DashboardCharts({ data }: DashboardChartsProps) {
    console.log("DATA SAMPLE:", data.slice(0, 5));
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <ChartCard title="Velocity Profile" subtitle="Speed vs. Mission Elapsed Time" badge="km/s">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="grad-speed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(186 100% 55%)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(186 100% 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              dataKey="t"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v)}h`}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
            />
            <Tooltip content={<TooltipBox unit="km/s" />} />
            <Area
              type="monotone"
              dataKey="speed"
              stroke="hsl(186 100% 55%)"
              strokeWidth={2}
              fill="url(#grad-speed)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cumulative Distance" subtitle="Path traveled since launch" badge="×10³ km">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="grad-dist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(270 80% 65%)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(270 80% 65%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              dataKey="t"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v)}h`}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
              // 🔥 FIX 1: Format from raw data scale
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            {/* The tooltip can just show raw numbers, or also scale / 1000 if you alter TooltipBox logic.
                Currently it shows raw values so I've updated the unit badge to signify raw km */}
            <Tooltip content={<TooltipBox unit="km" />} />
            <Area
              type="monotone"
              // 🔥 FIX 2: Bind specifically to the new cumulative_distance data key
              dataKey="cumulative_distance"
              stroke="hsl(270 80% 65%)"
              strokeWidth={2}
              fill="url(#grad-dist)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Acceleration" subtitle="Δv per timestep — burn detection" badge="m/s²">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              dataKey="t"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v)}h`}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
            />
            <Tooltip content={<TooltipBox unit="m/s²" />} />
            <Line
              type="monotone"
              dataKey="acceleration"
              stroke="hsl(38 100% 60%)"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Altitude Profile" subtitle="Distance from origin point" badge="×10³ km">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="grad-alt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(186 100% 55%)" stopOpacity={0.5} />
                <stop offset="50%" stopColor="hsl(270 80% 65%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(270 80% 65%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              dataKey="t"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v)}h`}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }}
              // 🔥 FIX 1: Format from raw data scale
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<TooltipBox unit="km" />} />
            <Area
              type="monotone"
              dataKey="altitude"
              stroke="hsl(186 100% 55%)"
              strokeWidth={2}
              fill="url(#grad-alt)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}