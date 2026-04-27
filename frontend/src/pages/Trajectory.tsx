import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { MissionLayout } from "@/components/MissionLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, RotateCcw, Target, Zap, Loader2 } from "lucide-react";

const missionEvents: any[] = []; 

// 🔥 FIX 2: Earth now takes scale dynamically
const Earth = ({ scale }: { scale: number }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.001;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[6371 * scale, 48, 48]} />
        <meshStandardMaterial color="#1e40af" emissive="#0c2d6b" emissiveIntensity={0.4} roughness={0.8} />
      </mesh>
      <mesh>
        <sphereGeometry args={[6371 * scale * 1.05, 32, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} />
      </mesh>
      <Html distanceFactor={20} position={[0, 6371 * scale * 1.4, 0]} center>
        <div className="pointer-events-none whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-primary">
          ◉ Earth
        </div>
      </Html>
    </group>
  );
};

// 🔥 FIX 2: Moon now takes scale dynamically
const Moon = ({ moonData, index, trajectoryData, scale }: { moonData: any[]; index: number; trajectoryData: any[]; scale: number }) => {
  if (moonData.length === 0 || trajectoryData.length === 0) return null;

  const currentTime = trajectoryData[index]?.t ?? 0;
  const i = moonData.findIndex((m) => {
    const mt = m?.t ?? 0;
    return mt >= currentTime;
  });

  const safeIndex = i >= 0 ? i : moonData.length - 1;
  const p = moonData[safeIndex];
  
  const pos = new THREE.Vector3(p.x * scale, p.z * scale, p.y * scale);
  const moonOrbit = useMemo(() => {
    return moonData.map((pt) => new THREE.Vector3(pt.x * scale, pt.z * scale, pt.y * scale));
  }, [moonData, scale]);

  return (
    <group>
      <Line points={moonOrbit} color="#a855f7" lineWidth={1} dashed dashSize={0.5} gapSize={0.5} opacity={0.4} transparent />
      <group position={pos}>
        <mesh>
          <sphereGeometry args={[1737 * scale, 32, 32]} />
          <meshStandardMaterial color="#cbd5e1" emissive="#9ca3af" emissiveIntensity={0.2} roughness={1} />
        </mesh>
        <Html distanceFactor={20} position={[0, 1737 * scale * 1.8, 0]} center>
          <div className="pointer-events-none whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            ◐ Moon
          </div>
        </Html>
      </group>
    </group>
  );
};

const Spacecraft = ({ index, points }: { index: number; points: THREE.Vector3[] }) => {
  if (points.length === 0) return null;
  const p = points[Math.min(index, points.length - 1)];
  return (
    <group position={p}>
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.2} />
      </mesh>
    </group>
  );
};

const TrajectoryLine = ({ index, points }: { index: number; points: THREE.Vector3[] }) => {
  if (points.length === 0) return null;
  const traveled = useMemo(() => points.slice(0, Math.max(2, index + 1)), [index, points]);

  return (
    <Line points={traveled} color="#22d3ee" lineWidth={2} />
  );
};

const EventMarkers = ({ points, trajectoryData }: { points: THREE.Vector3[], trajectoryData: any[] }) => {
  if (points.length === 0 || missionEvents.length === 0) return null;
  return (
    <>
      {missionEvents.map((e) => {
        const idx = trajectoryData.findIndex((p) => p.t >= e.t);
        if (idx < 0) return null;
        const p = points[idx];
        const color = e.type === "critical" ? "#ef4444" : e.type === "highlight" ? "#a855f7" : "#22d3ee";
        return (
          <group key={e.label} position={p}>
            <mesh>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <Html distanceFactor={25} position={[0, 0.4, 0]} center>
              <div className="pointer-events-none whitespace-nowrap rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider backdrop-blur" style={{ color }}>
                {e.label}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
};

const Trajectory = () => {
  const { id } = useParams();
  const location = useLocation();
  
  const params = new URLSearchParams(location.search);
  const initialType = params.get("type") || "moon";

  const [spacecraft, setSpacecraft] = useState<any[]>([]);
  const [moon, setMoon] = useState<any[]>([]);
  const [missionType, setMissionType] = useState<string>(initialType);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const isLoading = spacecraft.length === 0;

  // 🔥 FIX 2: Separate Earth and Orbit scaling
  const earthScale = missionType === "satellite" ? 1 / 20000 : 1 / 20000;
  const orbitScale = missionType === "satellite" ? 1 / 2000 : 1 / 20000;

  useEffect(() => {
    if (!id) return;
    const activeId = id;

    const fetchData = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/trajectory/full/${activeId}`);
        const json = await res.json();

        if (json.mission_id !== Number(activeId)) {
          console.error("Wrong mission data received");
          return;
        }

        setMissionType(json.mission_type);

        const t0 = json.spacecraft.time[0] || 0;
        const sc = json.spacecraft.time.map((t: number, i: number) => ({
          x: json.spacecraft.positions[i].x,
          y: json.spacecraft.positions[i].y,
          z: json.spacecraft.positions[i].z,
          t: (t - t0) / 3600,
          speed: json.spacecraft.speed[i] || 0,
          phase: json.spacecraft.mission_phase[i] || "Unknown",
          // 🔥 FIX 1: Altitude is distance from Earth surface (r - 6371)
          altitude: Math.sqrt(
            Math.pow(json.spacecraft.positions[i].x, 2) +
            Math.pow(json.spacecraft.positions[i].y, 2) +
            Math.pow(json.spacecraft.positions[i].z, 2)
          ) - 6371
        }));

        setSpacecraft(sc);
        
        setIndex(0);
        setPlaying(true);

        if (json.mission_type === "moon" && json.moon) {
          const m = json.moon.time.map((t: number, i: number) => ({
            x: json.moon.positions[i].x,
            y: json.moon.positions[i].y,
            z: json.moon.positions[i].z,
            t: (t - t0) / 3600,
          }));
          setMoon(m);
        } else {
          setMoon([]); 
        }
      } catch (err) {
        console.error("Failed to fetch trajectory data:", err);
      }
    };

    fetchData();
  }, [id]);

  const sampled = useMemo(() => {
    return spacecraft.filter((_, i) => i % 10 === 0);
  }, [spacecraft]);

  // 🔥 Uses the dynamically calculated orbit scale to spread trajectory
  const points = useMemo(() => {
    return sampled.map((p) => new THREE.Vector3(p.x * orbitScale, p.z * orbitScale, p.y * orbitScale));
  }, [sampled, orbitScale]);

  useEffect(() => {
    if (!playing || points.length === 0) return;
    const interval = setInterval(() => {
      setIndex((i) => {
        const phase = sampled[i]?.phase;
        let step = 1;

        if (phase === "Earth Orbit") step = 0.5;
        else if (phase === "Trans-Lunar Injection") step = 5;
        else if (phase === "Cruise") step = 2;

        const jump = Math.max(1, Math.round(step * speed * 5));
        const next = i + jump;
        
        return next >= points.length ? 0 : next;
      });
    }, 60); 
    return () => clearInterval(interval);
  }, [playing, speed, points.length, sampled]);

  const current = sampled[Math.min(index, Math.max(0, sampled.length - 1))] || {
    phase: "Loading...", x: 0, y: 0, z: 0, speed: 0, altitude: 0, t: 0
  };

  return (
    <MissionLayout>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label-mono">3D Visualization</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Flight <span className="text-gradient">Trajectory</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-3 py-1.5">
            <Target className="h-3.5 w-3.5 text-secondary" />
            <span className="font-mono text-[11px] text-muted-foreground">
              Phase: <span className="text-foreground">{current.phase}</span>
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* 3D canvas */}
          <div className="glass-panel relative h-[560px] overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-30" />
            
            {isLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="mt-4 animate-pulse font-mono text-[11px] uppercase tracking-widest text-primary">
                  Ingesting Telemetry...
                </div>
              </div>
            )}

            <Canvas camera={{ position: [25, 18, 25], fov: 50 }} className="relative z-10">
              <ambientLight intensity={0.3} />
              <pointLight position={[30, 20, 30]} intensity={1.2} color="#22d3ee" />
              <pointLight position={[-30, -10, -30]} intensity={0.5} color="#a855f7" />
              <Stars radius={120} depth={60} count={3000} factor={4} fade />
              
              <Earth scale={earthScale} />
              
              {!isLoading && (
                <>
                  {missionType === "moon" && <Moon moonData={moon} index={index} trajectoryData={sampled} scale={orbitScale} />}
                  <TrajectoryLine index={index} points={points} />
                  <EventMarkers points={points} trajectoryData={sampled} />
                  <Spacecraft index={index} points={points} />
                </>
              )}
              
              <OrbitControls enablePan enableZoom enableRotate minDistance={5} maxDistance={120} />
            </Canvas>

            {/* HUD overlay */}
            <div className="pointer-events-none absolute left-4 top-4 space-y-1 z-10">
              <div className="label-mono">Telemetry</div>
              <div className="font-mono text-xs">
                <div>
                  <span className="text-muted-foreground">VEL </span>
                  <span className="text-primary">{current.speed.toFixed(2)} km/s</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ALT </span>
                  <span className="text-foreground">{(Math.max(0, current.altitude) / 1000).toFixed(1)}k km</span>
                </div>
                <div>
                  <span className="text-muted-foreground">MET </span>
                  <span className="text-foreground">{current.t.toFixed(1)}h</span>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2 py-1 backdrop-blur">
              <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? 'bg-secondary' : 'bg-primary animate-blink'}`} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                {isLoading ? 'Connecting' : 'Tracking'}
              </span>
            </div>

            {/* Playback controls */}
            <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3 rounded-lg border border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl">
              <Button size="icon" variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={isLoading} className="h-8 w-8 text-primary hover:bg-primary/10">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setIndex(0)} disabled={isLoading} className="h-8 w-8 text-muted-foreground hover:text-primary">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <div className="flex-1">
                <Slider value={[index]} max={Math.max(1, points.length - 1)} step={1} onValueChange={(v) => setIndex(v[0])} disabled={isLoading} />
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                T+{current.t.toFixed(1)}h / {sampled[sampled.length - 1]?.t.toFixed(0) || 0}h
              </div>
              <div className="flex items-center gap-1">
                {[1, 5, 10, 20].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    disabled={isLoading}
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-50 ${speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <div className="glass-panel p-4">
              <div className="label-mono">Current State</div>
              <div className="mt-3 space-y-2.5 font-mono text-xs">
                {[
                  ["Position X", `${(current.x).toFixed(0)} km`],
                  ["Position Y", `${(current.y).toFixed(0)} km`],
                  ["Position Z", `${(current.z).toFixed(0)} km`],
                  ["Velocity", `${current.speed.toFixed(3)} km/s`],
                  ["Altitude", `${Math.max(0, current.altitude).toFixed(0)} km`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground">{isLoading ? '--' : v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-secondary" />
                <div className="label-mono">Key Events</div>
              </div>
              <div className="space-y-2">
                {missionEvents.slice(0, 6).map((e) => (
                  <button
                    key={e.label}
                    onClick={() => {
                      const i = sampled.findIndex((p) => p.t >= e.t);
                      if (i >= 0) {
                        setPlaying(false);
                        setIndex(i);
                      }
                    }}
                    disabled={isLoading}
                    className="group flex w-full items-center gap-2 rounded-md border border-border/40 bg-surface/40 px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                  >
                    <span className={`h-2 w-2 rounded-full ${e.type === "critical" ? "bg-destructive" : e.type === "highlight" ? "bg-secondary" : "bg-primary"}`} />
                    <div className="flex-1">
                      <div className="text-[11px] font-medium text-foreground group-hover:text-primary">{e.label}</div>
                      <div className="font-mono text-[9px] text-muted-foreground">T+{e.t.toFixed(1)}h</div>
                    </div>
                  </button>
                ))}
                {missionEvents.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground italic py-4">
                    {isLoading ? "Awaiting telemetry data..." : "No critical events logged."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MissionLayout>
  );
};

export default Trajectory;