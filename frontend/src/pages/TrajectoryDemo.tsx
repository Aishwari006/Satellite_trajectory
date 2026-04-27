import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { MissionLayout } from "@/components/MissionLayout";
import { Button } from "@/components/ui/button";
import { Rocket, Satellite, ChevronDown } from "lucide-react";

const SCALE = 1 / 20000;

// Minimal Mock Earth for Demo
const DemoEarth = () => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.001;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[6371 * SCALE, 48, 48]} />
        <meshStandardMaterial color="#1e40af" emissive="#0c2d6b" emissiveIntensity={0.4} roughness={0.8} />
      </mesh>
      <mesh>
        <sphereGeometry args={[6371 * SCALE * 1.05, 32, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} />
      </mesh>
    </group>
  );
};

// Fake orbital ring for visual flavor
const DemoOrbit = () => {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * 2, Math.sin(angle) * 0.5, Math.sin(angle) * 2));
    }
    return pts;
  }, []);
  return <Line points={points} color="#a855f7" lineWidth={1} dashed dashSize={0.1} gapSize={0.1} opacity={0.4} transparent />;
};

const TrajectoryDemo = () => {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<any[]>([]);
  const [missionId, setMissionId] = useState("");
  const [missionType, setMissionType] = useState("moon");

  // Fetch available missions for the dropdown
  useEffect(() => {
    fetch("/api/v1/trajectory/missions")
      .then((res) => res.json())
      .then((data) => {
        setMissions(data);
        if (data.length > 0) {
          setMissionId(String(data[0].id));
          setMissionType(data[0].mission_type || "moon");
        }
      })
      .catch((err) => console.warn("Could not load missions:", err));
  }, []);

  const handleLoad = () => {
    if (!missionId) return;
    navigate(`/trajectory/${missionId}?type=${missionType}`);
  };

  return (
    <MissionLayout>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Flight <span className="text-gradient">Trajectory</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Select a mission payload to initialize the 3D telemetry visualization engine.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Controls Panel */}
          <div className="glass-panel flex flex-col justify-center p-8">
            <div className="space-y-6">
              <div>
                <label className="label-mono mb-2 block">Select Mission ID</label>
                <div className="relative">
                  <select
                    value={missionId}
                    onChange={(e) => {
                      setMissionId(e.target.value);
                      // 🔥 KEEP ONLY THIS LOGIC
                      const m = missions.find((x) => String(x.id) === e.target.value);
                      if (m) setMissionType(m.mission_type);
                    }}
                    className="w-full appearance-none rounded-md border border-primary/30 bg-primary/5 p-3 font-mono text-sm text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {missions.length === 0 ? (
                      <option value="">Loading missions...</option>
                    ) : (
                      missions.map((m: any) => (
                        <option key={m.id} value={m.id} className="bg-background text-foreground">
                          {/* 🔥 FIXED: ID-based mission selection */}
                          Mission {m.id} ({m.mission_type})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                </div>
              </div>

              {/* 🔥 REMOVED THE REDUNDANT MISSION PROFILE TYPE DROPDOWN */}

              <Button
                size="lg"
                onClick={handleLoad}
                disabled={!missionId}
                className="group w-full overflow-hidden bg-gradient-aurora text-background shadow-glow-primary hover:shadow-glow-secondary"
              >
                {missionType === "moon" ? <Rocket className="mr-2 h-4 w-4" /> : <Satellite className="mr-2 h-4 w-4" />}
                Initialize Render Engine
              </Button>
            </div>
          </div>

          {/* Demo 3D Canvas */}
          <div className="glass-panel relative h-[400px] overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-30" />
            <Canvas camera={{ position: [5, 3, 5], fov: 50 }} className="relative z-10">
              <ambientLight intensity={0.3} />
              <pointLight position={[10, 10, 10]} intensity={1.2} color="#22d3ee" />
              <Stars radius={50} depth={20} count={1000} factor={4} fade />
              <DemoEarth />
              <DemoOrbit />
              <OrbitControls autoRotate autoRotateSpeed={1} enableZoom={false} enablePan={false} />
            </Canvas>
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 text-center">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Interactive Preview Engine Offline
              </span>
            </div>
          </div>
        </div>
      </div>
    </MissionLayout>
  );
};

export default TrajectoryDemo;