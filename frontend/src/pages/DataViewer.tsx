import { useMemo, useState, useEffect } from "react";
import { MissionLayout } from "@/components/MissionLayout";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

const PAGE_SIZE = 20;

const DataViewer = () => {
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<string>("all");
  const [page, setPage] = useState(0);

  // ✅ NEW: missions list
  const [missions, setMissions] = useState<any[]>([]);
  const [selectedMission, setSelectedMission] = useState<string>("");

  // ✅ trajectory data
  const [data, setData] = useState<any[]>([]);

  // 🔹 1. Fetch ALL missions
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const res = await fetch(
          "http://127.0.0.1:8000/api/v1/trajectory/missions"
        );
        const json = await res.json();

        setMissions(json);

        // auto-select first mission
        if (json.length > 0) {
          setSelectedMission(String(json[0].id));
        }
      } catch (err) {
        console.error("Error fetching missions:", err);
      }
    };

    fetchMissions();
  }, []);

  // 🔹 2. Fetch trajectory WHEN mission changes
  useEffect(() => {
    if (!selectedMission) return;

    const fetchData = async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/v1/trajectory/${selectedMission}`
        );

        const json = await res.json();

        const formatted = json.time.map((t: number, i: number) => ({
          t,
          x: json.positions[i].x,
          y: json.positions[i].y,
          z: json.positions[i].z,
          speed: json.speed[i],
          phase: json.mission_phase[i],
          altitude: 0,
        }));

        setData(formatted);
        setPage(0); // reset pagination
      } catch (err) {
        console.error("Error fetching trajectory:", err);
      }
    };

    fetchData();
  }, [selectedMission]);

  // 🔹 filtering
  const phases = useMemo(
    () => Array.from(new Set(data.map((d) => d.phase))),
    [data]
  );

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (phase !== "all" && d.phase !== phase) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          d.t.toFixed(2).includes(s) ||
          d.phase.toLowerCase().includes(s) ||
          d.speed.toFixed(2).includes(s)
        );
      }
      return true;
    });
  }, [search, phase, data]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <MissionLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* HEADER */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label-mono">Telemetry Stream</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Data <span className="text-gradient">Viewer</span>
            </h1>
          </div>

          <Button variant="outline" className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        <div className="glass-panel overflow-hidden">

          {/* 🔥 NEW: Mission Selector */}
          <div className="p-4 border-b border-border/50 flex gap-3 items-center">
            <span className="text-sm font-mono text-muted-foreground">
              Select Mission:
            </span>

            <Select
              value={selectedMission}
              onValueChange={(v) => setSelectedMission(v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select mission" />
              </SelectTrigger>

              <SelectContent>
                {missions.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {/* 🔥 FIXED: ID-based mission selection */}
                    Mission {m.id} ({m.mission_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FILTER BAR */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border/50 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9 text-xs"
              />
            </div>

            <Select
              value={phase}
              onValueChange={(v) => {
                setPhase(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter phase" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {phases.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-xs text-muted-foreground">
              {filtered.length} rows
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {["#", "T", "X", "Y", "Z", "Speed", "Altitude", "Phase"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pageData.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{page * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-2">{row.t.toFixed(2)}</td>
                    <td className="px-4 py-2">{row.x.toFixed(0)}</td>
                    <td className="px-4 py-2">{row.y.toFixed(0)}</td>
                    <td className="px-4 py-2">{row.z.toFixed(0)}</td>
                    <td className="px-4 py-2">{row.speed.toFixed(3)}</td>
                    <td className="px-4 py-2">{row.altitude.toFixed(0)}</td>
                    <td className="px-4 py-2">{row.phase}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </MissionLayout>
  );
};

export default DataViewer;