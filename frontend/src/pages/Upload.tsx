import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Upload as UploadIcon, 
  FileCheck2, 
  FileX2, 
  Rocket, 
  Loader2, 
  Satellite, 
  AlertTriangle,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MissionLayout } from "@/components/MissionLayout";

type Status = "idle" | "valid" | "invalid" | "processing" | "error";

const Upload = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [filename, setFilename] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // 🔥 STEP 1: Added state for mission config
  const [missionType, setMissionType] = useState("moon");
  const [missionName, setMissionName] = useState("Frontend Upload");

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = (file: File) => {
    const name = file.name.toLowerCase();
    setFilename(file.name);

    if (name.endsWith(".csv")) {
      setStatus("valid");
    } else {
      setStatus("invalid");
    }
    console.log("File name:", file.name);
    console.log("File type:", file.type);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const process = async () => {
    if (!inputRef.current?.files?.[0]) return;

    const file = inputRef.current.files[0];

    setStatus("processing");
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // 🔥 STEP 3: Dynamically append user-selected values
      formData.append("mission_type", missionType);
      formData.append("mission_name", missionName);

      const res = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      console.log("Upload response:", data);

      setProgress(100);

      localStorage.setItem("mission_id", data.mission_id);

      // 🔥 STEP 4: Navigate directly to the newly uploaded trajectory
      setTimeout(() => {
        navigate(`/trajectory/${data.mission_id}`);
      }, 500);

    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const useSample = () => {
    setFilename("artemis_ii_trajectory_sample.csv");
    setMissionType("moon");
    setMissionName("Artemis II Sample");
    setStatus("valid");
  };

  return (
    <MissionLayout>
      <div className="relative mx-auto max-w-5xl px-6 py-12 lg:py-20">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1">
            <Satellite className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
              Trajectory Ingest System
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Upload <span className="text-gradient">Mission Telemetry</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Drop your spacecraft trajectory CSV to compute mission metrics, render the 3D flight
            path, and explore real-time analytics.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`glass-panel relative grid-bg cursor-pointer overflow-hidden p-12 transition-all duration-300 ${
            drag ? "border-primary/80 shadow-glow-primary" : "hover:border-primary/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 animate-float">
              <UploadIcon className="h-9 w-9 text-primary" />
            </div>
            <h2 className="text-xl font-medium">Drag &amp; drop your CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse — accepts .csv up to 50MB
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Required columns
              </span>
              <div className="flex gap-1.5">
                {["t", "x", "y", "z", "v"].map((c) => (
                  <code
                    key={c}
                    className="rounded border border-border/60 bg-surface px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                  >
                    {c}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 🔥 STEP 2: Mission Configuration UI */}
        <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="relative w-full sm:w-auto">
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value)}
              className="w-full appearance-none rounded-md border border-primary/30 bg-surface px-4 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-48"
            >
              <option value="moon">Moon Mission</option>
              <option value="satellite">Satellite Mission</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <input
            type="text"
            value={missionName}
            onChange={(e) => setMissionName(e.target.value)}
            placeholder="Mission Name"
            className="w-full rounded-md border border-primary/30 bg-surface px-4 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
          />
        </div>

        {/* Status */}
        {status !== "idle" && (
          <div className="glass-panel mt-6 flex items-center justify-between p-4 animate-scale-in">
            <div className="flex items-center gap-3">
              {status === "valid" && <FileCheck2 className="h-5 w-5 text-success" />}
              {status === "invalid" && <FileX2 className="h-5 w-5 text-destructive" />}
              {status === "error" && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {status === "processing" && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
              <div>
                <div className="font-mono text-sm">{filename}</div>
                <div className="label-mono mt-0.5">
                  {status === "valid" && "Validated · Ready to process"}
                  {status === "invalid" && "Invalid format · expected .csv"}
                  {status === "error" && "Upload failed · check backend connection"}
                  {status === "processing" && `Processing telemetry stream · ${progress}%`}
                </div>
              </div>
            </div>
            {status === "processing" && (
              <div className="ml-4 hidden h-1 w-48 overflow-hidden rounded-full bg-muted md:block">
                <div
                  className="h-full bg-gradient-aurora transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            disabled={status !== "valid"}
            onClick={process}
            className="group relative overflow-hidden bg-gradient-aurora text-background shadow-glow-primary hover:shadow-glow-secondary disabled:opacity-40"
          >
            <Rocket className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            Process Data
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={useSample}
            className="text-muted-foreground hover:text-primary"
          >
            Use Sample Mission Data →
          </Button>
        </div>

        {/* Spec footer */}
        <div className="mt-16 grid grid-cols-3 gap-4 text-center">
          {[
            { k: "Architecture", v: "Dynamic Pipeline" },
            { k: "Ingest", v: "Vectorized (Pandas)" },
            { k: "Database", v: "MySQL / SQLAlchemy" },
          ].map((s) => (
            <div key={s.k} className="glass-panel p-4">
              <div className="label-mono">{s.k}</div>
              <div className="mt-1 font-mono text-sm text-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </MissionLayout>
  );
};

export default Upload;