import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MissionLayout } from "@/components/MissionLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Camera,
  Crosshair,
  Download,
  ImageIcon,
  RotateCcw,
  Sparkles,
  Telescope,
  Upload as UploadIcon,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

type Op =
  | "grayscale"
  | "rotate"
  | "flip"
  | "resize"
  | "brightness_contrast"
  | "gaussian_blur"
  | "median_blur"
  | "sharpen"
  | "edges"
  | "threshold"
  | "adaptive_threshold"
  | "equalize"
  | "clahe"
  | "invert"
  | "hsv_adjust"
  | "sepia"
  | "colormap"
  | "morph";

type OpDef = {
  id: Op;
  label: string;
  description: string;
  defaults: Record<string, number | string>;
};

const OPERATIONS: OpDef[] = [
  { id: "grayscale", label: "Grayscale", description: "BGR → single channel intensity.", defaults: {} },
  { id: "rotate", label: "Rotate", description: "Affine rotation with bounding-box expansion.", defaults: { angle: 45, scale: 1 } },
  { id: "flip", label: "Flip", description: "Mirror horizontally / vertically.", defaults: { direction: "horizontal" } },
  { id: "resize", label: "Scale", description: "Bicubic / area resize.", defaults: { scale: 0.75 } },
  { id: "brightness_contrast", label: "Brightness / Contrast", description: "α·pixel + β linear remap.", defaults: { brightness: 20, contrast: 1.2 } },
  { id: "gaussian_blur", label: "Gaussian Blur", description: "Smooth with a Gaussian kernel.", defaults: { kernel: 7, sigma: 0 } },
  { id: "median_blur", label: "Median Blur", description: "Salt-and-pepper noise removal.", defaults: { kernel: 5 } },
  { id: "sharpen", label: "Sharpen", description: "Unsharp mask (image + α·detail).", defaults: { amount: 1.2 } },
  { id: "edges", label: "Canny Edges", description: "Gradient + non-max suppression.", defaults: { low: 80, high: 180 } },
  { id: "threshold", label: "Threshold", description: "Binary segmentation.", defaults: { value: 127 } },
  { id: "adaptive_threshold", label: "Adaptive Threshold", description: "Local Gaussian threshold.", defaults: { block: 11, c: 2 } },
  { id: "equalize", label: "Histogram Equalize", description: "YCrCb luma equalization.", defaults: {} },
  { id: "clahe", label: "CLAHE", description: "Contrast-limited adaptive histogram.", defaults: { clip: 2, tile: 8 } },
  { id: "invert", label: "Invert", description: "Bitwise color inversion.", defaults: {} },
  { id: "hsv_adjust", label: "Color (HSV)", description: "Shift hue / scale saturation & value.", defaults: { hue: 0, saturation: 1, value: 1 } },
  { id: "sepia", label: "Sepia", description: "Warm tone matrix transform.", defaults: {} },
  { id: "colormap", label: "Colormap", description: "Apply OpenCV pseudo-color LUT.", defaults: { map: "INFERNO" } },
  { id: "morph", label: "Morphology", description: "Erode / dilate / open / close.", defaults: { op: "open", kernel: 5 } },
];

const COLORMAPS = [
  "INFERNO", "JET", "VIRIDIS", "PLASMA", "MAGMA", "TURBO",
  "HOT", "COOL", "BONE", "OCEAN", "PINK", "AUTUMN",
];

const ImageLab = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [processedUrl, setProcessedUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [activeOp, setActiveOp] = useState<Op>("grayscale");
  const [params, setParams] = useState<Record<string, number | string>>({});

  // Crater detection state
  const [craterBusy, setCraterBusy] = useState(false);
  const [craterImage, setCraterImage] = useState<string>("");
  const [craterCount, setCraterCount] = useState<number | null>(null);
  const [craterList, setCraterList] = useState<any[]>([]);
  const [sensitivity, setSensitivity] = useState<number>(1.0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset params when switching operations
  useEffect(() => {
    const def = OPERATIONS.find((o) => o.id === activeOp);
    setParams(def?.defaults ?? {});
  }, [activeOp]);

  // Free object URL when file changes
  useEffect(() => {
    return () => {
      if (originalUrl.startsWith("blob:")) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, TIFF, WebP).");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image exceeds 20 MB limit.");
      return;
    }
    if (originalUrl.startsWith("blob:")) URL.revokeObjectURL(originalUrl);
    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setProcessedUrl("");
    setCraterImage("");
    setCraterCount(null);
    setCraterList([]);
  }, [originalUrl]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFile(e.dataTransfer.files?.[0] ?? null);
    },
    [handleFile],
  );

  const runOperation = useCallback(async () => {
    if (!originalFile) {
      toast.error("Upload an image first.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", originalFile);
      fd.append("operation", activeOp);
      fd.append("params", JSON.stringify(params));
      const res = await fetch("/api/v1/vision/process", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Processing failed");
      }
      const blob = await res.blob();
      if (processedUrl.startsWith("blob:")) URL.revokeObjectURL(processedUrl);
      setProcessedUrl(URL.createObjectURL(blob));
      toast.success(`${activeOp.replace("_", " ")} applied.`);
    } catch (err: any) {
      toast.error(err.message ?? "Processing failed");
    } finally {
      setBusy(false);
    }
  }, [originalFile, activeOp, params, processedUrl]);

  const analyzeCraters = useCallback(async () => {
    if (!originalFile) {
      toast.error("Upload an image first.");
      return;
    }
    setCraterBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", originalFile);
      fd.append("sensitivity", String(sensitivity));
      fd.append("annotate", "true");
      const res = await fetch("/api/v1/vision/detect-craters", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Detection failed");
      }
      const json = await res.json();
      setCraterImage(json.annotated_image ?? "");
      setCraterCount(json.crater_count ?? 0);
      setCraterList(json.craters ?? []);
      toast.success(`Detected ${json.crater_count} craters.`);
    } catch (err: any) {
      toast.error(err.message ?? "Detection failed");
    } finally {
      setCraterBusy(false);
    }
  }, [originalFile, sensitivity]);

  const downloadProcessed = useCallback(() => {
    if (!processedUrl) return;
    const a = document.createElement("a");
    a.href = processedUrl;
    a.download = `artemis-${activeOp}.png`;
    a.click();
  }, [processedUrl, activeOp]);

  const downloadAnnotated = useCallback(() => {
    if (!craterImage) return;
    const a = document.createElement("a");
    a.href = craterImage;
    a.download = `artemis-craters.png`;
    a.click();
  }, [craterImage]);

  const setParam = (key: string, val: number | string) =>
    setParams((p) => ({ ...p, [key]: val }));

  const opControls = useMemo(() => renderOpControls(activeOp, params, setParam), [activeOp, params]);

  return (
    <MissionLayout>
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Surface Imaging
            </p>
            <h1 className="text-3xl font-semibold">
              Image{" "}
              <span className="bg-gradient-aurora bg-clip-text text-transparent">
                Lab
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a satellite or planetary surface image, run OpenCV transformations, and
              detect craters with Hough Circle Transform.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
              <Sparkles className="mr-1 h-3 w-3" /> OpenCV
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
              <Telescope className="mr-1 h-3 w-3" /> Hough
            </Badge>
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative overflow-hidden rounded-xl border border-dashed border-border/60 bg-surface/40 p-6"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-aurora/20 text-primary">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">
                  {originalFile ? originalFile.name : "Drag & drop a surface image"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {originalFile
                    ? `${(originalFile.size / 1024).toFixed(1)} KB`
                    : "JPG · PNG · TIFF · WebP — up to 20 MB"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon className="mr-2 h-4 w-4" /> Browse
              </Button>
              {originalFile && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOriginalFile(null);
                    if (originalUrl.startsWith("blob:")) URL.revokeObjectURL(originalUrl);
                    setOriginalUrl("");
                    setProcessedUrl("");
                    setCraterImage("");
                    setCraterCount(null);
                    setCraterList([]);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main workspace */}
        <Tabs defaultValue="process" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="process">
              <Wand2 className="mr-2 h-4 w-4" /> Image Operations
            </TabsTrigger>
            <TabsTrigger value="craters">
              <Crosshair className="mr-2 h-4 w-4" /> Crater Analysis
            </TabsTrigger>
          </TabsList>

          {/* ─── OpenCV Operations ───────────────────────────────── */}
          <TabsContent value="process" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              {/* Controls */}
              <div className="rounded-xl border border-border/50 bg-surface/40 p-4 space-y-4">
                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Operation
                  </Label>
                  <Select value={activeOp} onValueChange={(v) => setActiveOp(v as Op)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {OPERATIONS.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {OPERATIONS.find((o) => o.id === activeOp)?.description}
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">{opControls}</div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Button
                    disabled={!originalFile || busy}
                    onClick={runOperation}
                    className="w-full"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {busy ? "Processing…" : "Apply"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!processedUrl}
                    onClick={downloadProcessed}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download Result
                  </Button>
                </div>
              </div>

              {/* Image preview */}
              <div className="grid gap-4 sm:grid-cols-2">
                <ImagePanel
                  title="Original"
                  url={originalUrl}
                  empty="Upload an image to begin"
                />
                <ImagePanel
                  title="Processed"
                  url={processedUrl}
                  empty="Apply an operation to see the result"
                />
              </div>
            </div>
          </TabsContent>

          {/* ─── Crater Detection ────────────────────────────────── */}
          <TabsContent value="craters" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-border/50 bg-surface/40 p-4 space-y-4">
                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Detection Sensitivity
                  </Label>
                  <Slider
                    className="mt-3"
                    value={[sensitivity]}
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    onValueChange={(v) => setSensitivity(v[0])}
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground font-mono">
                    <span>strict · {sensitivity.toFixed(1)}x</span>
                    <span>permissive</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Lowers the Hough accumulator threshold. Higher values surface more
                    candidate craters but increase false positives.
                  </p>
                </div>

                <Separator />

                <Button
                  disabled={!originalFile || craterBusy}
                  onClick={analyzeCraters}
                  className="w-full"
                >
                  <Crosshair className="mr-2 h-4 w-4" />
                  {craterBusy ? "Analyzing…" : "Analyze Craters"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!craterImage}
                  onClick={downloadAnnotated}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" /> Download Annotated
                </Button>

                {craterCount !== null && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Craters Detected
                        </p>
                        <p className="mt-1 text-3xl font-semibold text-primary">
                          {craterCount}
                        </p>
                      </div>
                      {craterList.length > 0 && (
                        <div className="rounded-lg border border-border/50 bg-background/40 p-3 max-h-64 overflow-y-auto">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                            Top Detections
                          </p>
                          <div className="space-y-1">
                            {craterList.slice(0, 12).map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between text-xs font-mono"
                              >
                                <span className="text-muted-foreground">
                                  #{c.id} ({c.x},{c.y})
                                </span>
                                <span>
                                  r={c.radius_px}px ·{" "}
                                  <span className="text-primary">
                                    {(c.confidence * 100).toFixed(0)}%
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ImagePanel
                  title="Original"
                  url={originalUrl}
                  empty="Upload an image to begin"
                />
                <ImagePanel
                  title="Detected Craters"
                  url={craterImage}
                  empty="Run analysis to view annotated image"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MissionLayout>
  );
};

// ─── Image preview panel ────────────────────────────────────────────────────
const ImagePanel = ({
  title,
  url,
  empty,
}: {
  title: string;
  url?: string;
  empty: string;
}) => (
  <div className="rounded-xl border border-border/50 bg-surface/40 p-3">
    <div className="mb-2 flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-background/40">
      {url ? (
        <img src={url} alt={title} className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
          <ImageIcon className="h-6 w-6 opacity-40" />
          {empty}
        </div>
      )}
    </div>
  </div>
);

// ─── Per-operation parameter inputs ─────────────────────────────────────────
function renderOpControls(
  op: Op,
  params: Record<string, number | string>,
  setParam: (key: string, val: number | string) => void,
) {
  const numField = (
    key: string,
    label: string,
    opts: { min?: number; max?: number; step?: number; slider?: boolean } = {},
  ) => {
    const current = Number(params[key] ?? 0);
    return (
      <div key={key}>
        <div className="flex justify-between">
          <Label className="text-xs">{label}</Label>
          <span className="font-mono text-xs text-primary">{current}</span>
        </div>
        {opts.slider ? (
          <Slider
            className="mt-2"
            value={[current]}
            min={opts.min ?? 0}
            max={opts.max ?? 100}
            step={opts.step ?? 1}
            onValueChange={(v) => setParam(key, v[0])}
          />
        ) : (
          <Input
            type="number"
            className="mt-1"
            min={opts.min}
            max={opts.max}
            step={opts.step ?? 1}
            value={current}
            onChange={(e) => setParam(key, Number(e.target.value))}
          />
        )}
      </div>
    );
  };

  const selectField = (key: string, label: string, options: string[]) => (
    <div key={key}>
      <Label className="text-xs">{label}</Label>
      <Select value={String(params[key] ?? options[0])} onValueChange={(v) => setParam(key, v)}>
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  switch (op) {
    case "rotate":
      return (
        <>
          {numField("angle", "Angle (°)", { min: -180, max: 180, slider: true })}
          {numField("scale", "Scale", { min: 0.1, max: 3, step: 0.1, slider: true })}
        </>
      );
    case "flip":
      return selectField("direction", "Direction", ["horizontal", "vertical", "both"]);
    case "resize":
      return numField("scale", "Scale", { min: 0.1, max: 3, step: 0.1, slider: true });
    case "brightness_contrast":
      return (
        <>
          {numField("brightness", "Brightness (β)", { min: -100, max: 100, slider: true })}
          {numField("contrast", "Contrast (α)", { min: 0, max: 3, step: 0.1, slider: true })}
        </>
      );
    case "gaussian_blur":
      return (
        <>
          {numField("kernel", "Kernel", { min: 1, max: 31, step: 2, slider: true })}
          {numField("sigma", "Sigma", { min: 0, max: 10, step: 0.5, slider: true })}
        </>
      );
    case "median_blur":
      return numField("kernel", "Kernel", { min: 1, max: 31, step: 2, slider: true });
    case "sharpen":
      return numField("amount", "Amount", { min: 0, max: 4, step: 0.1, slider: true });
    case "edges":
      return (
        <>
          {numField("low", "Low threshold", { min: 0, max: 255, slider: true })}
          {numField("high", "High threshold", { min: 0, max: 255, slider: true })}
        </>
      );
    case "threshold":
      return numField("value", "Threshold", { min: 0, max: 255, slider: true });
    case "adaptive_threshold":
      return (
        <>
          {numField("block", "Block size (odd)", { min: 3, max: 51, step: 2, slider: true })}
          {numField("c", "C", { min: -20, max: 20, slider: true })}
        </>
      );
    case "clahe":
      return (
        <>
          {numField("clip", "Clip limit", { min: 1, max: 8, step: 0.5, slider: true })}
          {numField("tile", "Tile grid", { min: 2, max: 16, slider: true })}
        </>
      );
    case "hsv_adjust":
      return (
        <>
          {numField("hue", "Hue shift", { min: -90, max: 90, slider: true })}
          {numField("saturation", "Saturation", { min: 0, max: 3, step: 0.1, slider: true })}
          {numField("value", "Value", { min: 0, max: 3, step: 0.1, slider: true })}
        </>
      );
    case "colormap":
      return selectField("map", "Colormap", COLORMAPS);
    case "morph":
      return (
        <>
          {selectField("op", "Operation", [
            "open", "close", "erode", "dilate", "gradient", "tophat", "blackhat",
          ])}
          {numField("kernel", "Kernel", { min: 1, max: 31, step: 2, slider: true })}
        </>
      );
    case "grayscale":
    case "equalize":
    case "invert":
    case "sepia":
    default:
      return (
        <p className="text-xs text-muted-foreground">No parameters required.</p>
      );
  }
}

export default ImageLab;
