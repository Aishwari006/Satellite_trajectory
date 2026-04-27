import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MissionLayout } from "@/components/MissionLayout";
import { Gauge, Route, Timer, Zap, TrendingUp, Flag, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import DashboardCharts from "./DashboardCharts"; // Ensure this path is correct

const fmtNum = (n: number, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDuration = (h: number) => {
  if (!h) return "--";
  const days = Math.floor(h / 24);
  const hrs = Math.floor(h % 24);
  const mins = Math.floor((h * 60) % 60);
  return `${days}d ${hrs}h ${mins}m`;
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  delay = 0,
  accent = "primary",
}: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="glass-panel relative overflow-hidden p-5"
  >
    <div
      className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl ${
        accent === "primary" ? "bg-primary" : "bg-secondary"
      }`}
    />
    <div className="flex items-center justify-between">
      <span className="label-mono">{label}</span>
      <Icon className={`h-4 w-4 ${accent === "primary" ? "text-primary" : "text-secondary"}`} />
    </div>
    <div className="mt-3 flex items-baseline gap-1.5">
      <span className="stat-value">{value}</span>
      <span className="font-mono text-xs text-muted-foreground">{unit}</span>
    </div>
    {trend && (
      <div className="mt-2 flex items-center gap-1 text-[11px]">
        <TrendingUp className="h-3 w-3 text-success" />
        <span className="font-mono text-success">{trend}</span>
      </div>
    )}
  </motion.div>
);

const Dashboard = () => {
  const { id } = useParams();
  
  const [missions, setMissions] = useState<any[]>([]);
  const [selectedMission, setSelectedMission] = useState<string>("");
  
  const [trajectory, setTrajectory] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch("/api/v1/trajectory/missions")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch missions list");
        return res.json();
      })
      .then((data) => {
        setMissions(data);
        const storedId = localStorage.getItem("mission_id");
        
        // Properly initialize selected mission
        if (id) {
          setSelectedMission(id);
        } else if (storedId && data.some((m: any) => String(m.id) === storedId)) {
          setSelectedMission(storedId);
        } else if (data.length > 0) {
          setSelectedMission(String(data[0].id));
        }
      })
      .catch((err) => console.warn("Could not load missions dropdown:", err));
  }, [id]);

  useEffect(() => {
    // 🔥 FIX: Cleaned up active ID resolution to prevent state conflicts
    const activeId = selectedMission;
    
    if (!activeId) {
      return; // Silently wait until the mission list populates the activeId
    }

    const fetchData = async () => {
      try {
        const trajRes = await fetch(`/api/v1/trajectory/${activeId}`);
        if (!trajRes.ok) throw new Error("Failed to fetch trajectory");
        const trajJson = await trajRes.json();

        let cumulative = 0;
        const t0 = trajJson.time?.[0] ?? 0;

        const formatted = (trajJson.time || [])
          .map((t: number, i: number) => {
            const x = trajJson.positions[i]?.x ?? 0;
            const y = trajJson.positions[i]?.y ?? 0;
            const z = trajJson.positions[i]?.z ?? 0;

            if (i > 0) {
              const dx = x - (trajJson.positions[i - 1]?.x ?? 0);
              const dy = y - (trajJson.positions[i - 1]?.y ?? 0);
              const dz = z - (trajJson.positions[i - 1]?.z ?? 0);

              const stepDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              cumulative += stepDist;
            }

            return {
              t: (t - t0) / 3600,
              x,
              y,
              z,
              speed: trajJson.speed[i] ?? 0,
              phase: trajJson.mission_phase[i] ?? "Unknown",
              event_flag: trajJson.events[i] ?? false,
              body: trajJson.body?.[i] ?? "spacecraft",
              altitude: trajJson.distance_from_earth?.[i] ?? 0,
              cumulative_distance: cumulative,
              acceleration:
                i > 0
                  ? Math.abs((trajJson.speed[i] ?? 0) - (trajJson.speed[i - 1] ?? 0))
                  : 0,
            };
          })
          .filter((d: any) => d.body === "spacecraft");

        console.log("Trajectory length:", formatted.length);
        setTrajectory(formatted);

        const analyticsRes = await fetch(`/api/v1/analytics/${activeId}`);
        if (analyticsRes.ok) {
          const analyticsJson = await analyticsRes.json();
          setMetrics(analyticsJson);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setTrajectory([]); 
      }
    };

    fetchData();
  }, [selectedMission]); // Dependency on selectedMission instead of id + selectedMission

  const m = metrics || {};
  const stats = {
    total_distance: m.total_distance_km,
    max_speed: m.max_speed_km_s,
    avg_speed: m.avg_speed_km_s,
    duration: m.mission_duration_s ? m.mission_duration_s / 3600 : null,
  };

  const sampled = trajectory; 

  const missionEvents = trajectory
    .map((d) => ({
      t: d.t,
      label: d.phase,
      type: d.event_flag ? "critical" : "normal",
    }))
    .filter((e) => e.type === "critical");

  return (
    <MissionLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label-mono">Mission Insights</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Flight <span className="text-gradient">Analytics</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {missions.length > 0 && (
              <div className="relative">
                <select
                  value={selectedMission}
                  onChange={(e) => {
                    setSelectedMission(e.target.value);
                    localStorage.setItem("mission_id", e.target.value);
                  }}
                  className="appearance-none rounded-md border border-primary/30 bg-primary/10 pl-3 pr-8 py-1.5 font-mono text-xs text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {missions.map((mission: any) => (
                    <option key={mission.id} value={mission.id} className="bg-background text-foreground">
                      {/* 🔥 FIXED: Clean mission-based selection using ID-first format */}
                      Mission {mission.id} — {mission.name || "Unnamed"} ({mission.mission_type})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-primary" />
              </div>
            )}

            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-blink rounded-full bg-primary" />
              <span className="font-mono text-[11px] text-muted-foreground">
                Live data · updated 2s ago
              </span>
            </div>
          </div>
        </div>

        {trajectory.length === 0 ? (
          <div className="glass-panel mt-12 flex flex-col items-center justify-center p-16 text-center shadow-glow-primary/10">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
              <Route className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">No telemetry data available</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select a valid mission from the dropdown or upload a new trajectory dataset.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                icon={Route}
                label="Total Distance"
                value={stats.total_distance ? fmtNum(stats.total_distance / 1000, 1) : "--"}
                unit="× 10³ km"
                delay={0}
              />
              <StatCard
                icon={Zap}
                label="Max Speed"
                value={stats.max_speed ? fmtNum(stats.max_speed, 2) : "--"}
                unit="km/s"
                delay={0.05}
                accent="secondary"
              />
              <StatCard
                icon={Gauge}
                label="Avg Speed"
                value={stats.avg_speed ? fmtNum(stats.avg_speed, 2) : "--"}
                unit="km/s"
                delay={0.1}
              />
              <StatCard
                icon={Timer}
                label="Mission Duration"
                value={stats.duration ? fmtDuration(stats.duration) : "--"}
                unit=""
                delay={0.15}
                accent="secondary"
              />
            </div>

            <DashboardCharts data={sampled} />

            <div className="glass-panel mt-6 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Mission Event Timeline</h3>
                  <div className="label-mono mt-1">Critical milestones · color-coded</div>
                </div>
                <Flag className="h-4 w-4 text-secondary" />
              </div>
              <div className="relative">
                <div className="absolute left-0 right-0 top-3 h-[2px] bg-gradient-to-r from-primary/40 via-secondary/40 to-primary/40" />
                <div className="flex justify-between gap-4 overflow-x-auto pb-4 pt-1">
                  {missionEvents.length > 0 ? (
                    missionEvents.map((e, i) => (
                      <motion.div
                        key={`${e.label}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative flex min-w-[80px] flex-col items-center text-center"
                      >
                        <span
                          className={`relative z-10 h-3 w-3 rounded-full ring-4 ring-background ${
                            e.type === "critical"
                              ? "bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.7)]"
                              : "bg-primary shadow-glow-primary"
                          }`}
                        />
                        <div className="mt-3 font-mono text-[10px] text-muted-foreground">
                          T+{e.t.toFixed(1)}h
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium">{e.label}</div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="w-full text-center text-sm text-muted-foreground pt-4">
                      No critical events detected in this trajectory
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MissionLayout>
  );
};

export default Dashboard;