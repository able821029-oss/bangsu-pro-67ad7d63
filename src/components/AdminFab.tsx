import { Shield } from "lucide-react";

export function AdminFab() {
  return (
    <button
      onClick={() => { window.location.hash = "#/admin"; }}
      aria-label="관리자 모드"
      className="fixed top-3 right-3 z-[60] w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 bg-black/30 text-white/60 hover:text-white hover:bg-black/50 transition-all active:scale-90"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }}
    >
      <Shield className="w-4 h-4" />
    </button>
  );
}
