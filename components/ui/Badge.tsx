import { cn, ESTADO_COLORS, ESTADO_LABELS } from "@/lib/utils";

export function Badge({ estado }: { estado: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
      ESTADO_COLORS[estado] ?? "text-dim bg-white/5 border-white/10"
    )}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}
