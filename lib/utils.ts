import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date?: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export const ESTADO_COLORS: Record<string, string> = {
  coordinado:   "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  en_transito:  "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  entregado:    "text-green-400 bg-green-400/10 border-green-400/30",
  cancelado:    "text-red-400 bg-red-400/10 border-red-400/30",
  pendiente:    "text-purple-400 bg-purple-400/10 border-purple-400/30",
  confirmada:   "text-blue-400 bg-blue-400/10 border-blue-400/30",
  procesando:   "text-orange-400 bg-orange-400/10 border-orange-400/30",
  completada:   "text-green-400 bg-green-400/10 border-green-400/30",
  disponible:   "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  parcial:      "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  vendida:      "text-dim bg-white/5 border-white/10",
};

export const ESTADO_LABELS: Record<string, string> = {
  coordinado:   "Coordinated",
  en_transito:  "In Transit",
  entregado:    "Delivered",
  cancelado:    "Cancelled",
  pendiente:    "Pending",
  confirmada:   "Confirmed",
  procesando:   "Processing",
  completada:   "Completed",
  disponible:   "Available",
  parcial:      "Partial",
  vendida:      "Sold",
};
