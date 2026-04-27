import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Activity, Clock } from "lucide-react";

export function MissionLayout({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(new Date());

  // ⏱️ Set your mission launch time here (UTC format recommended)
  const launchTime = new Date("2026-04-25T00:00:00Z");

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // 🚀 Calculate Mission Elapsed Time (T+)
  const diff = Math.floor((now.getTime() - launchTime.getTime()) / 1000);
  const hrs = String(Math.floor(diff / 3600)).padStart(3, "0");
  const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
  const secs = String(diff % 60).padStart(2, "0");

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/70 px-4 backdrop-blur-xl">
            
            {/* Left Section */}
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-primary" />
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Mission&nbsp;Status
                </span>
                <span className="font-mono text-[11px] text-success">NOMINAL</span>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              
              {/* Mission Timer */}
              <div className="hidden items-center gap-1.5 md:flex">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[11px] text-muted-foreground">
                  T+ <span className="text-foreground">{hrs}:{mins}:{secs}</span>
                </span>
              </div>

              {/* IST Clock */}
              <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-surface/60 px-2.5 py-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-[11px] text-muted-foreground">
                  IST{" "}
                  {now.toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour12: false,
                  })}
                </span>
              </div>

            </div>
          </header>

          <main className="flex-1 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}