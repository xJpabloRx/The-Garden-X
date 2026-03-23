"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDisplay(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function DatePicker({ value, onChange, placeholder, minDate }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value + "T00:00:00");
    return new Date();
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = fmt(new Date());

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }

  function isDisabled(iso: string): boolean {
    if (!minDate) return false;
    return iso < minDate;
  }

  function pick(day: number) {
    const d = new Date(year, month, day);
    const iso = fmt(d);
    if (isDisabled(iso)) return;
    onChange(iso);
    setOpen(false);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Quick action dates
  const dayAfterTomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 2); return fmt(d); })();
  const nextWeek = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return fmt(d); })();

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:border-white/20 focus:outline-none focus:border-accent">
        <Calendar size={14} className="text-cyan-400 flex-shrink-0" />
        {value
          ? <span className="text-white">{fmtDisplay(value)}</span>
          : <span className="text-dim">{placeholder || "Select date..."}</span>}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-72 bg-panel border border-white/10 rounded-xl shadow-2xl p-3 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-dim hover:text-white hover:bg-white/5 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-white">{MONTHS[month]} {year}</span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-dim hover:text-white hover:bg-white/5 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] text-dim uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const iso = fmt(new Date(year, month, day));
              const disabled = isDisabled(iso);
              const isSelected = iso === value;
              const isToday = iso === today;
              return (
                <button key={idx} type="button" onClick={() => pick(day)} disabled={disabled}
                  className={`w-full aspect-square flex items-center justify-center rounded-lg text-xs transition-all
                    ${disabled
                      ? "text-white/15 cursor-not-allowed"
                      : isSelected
                        ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold"
                        : isToday
                          ? "border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10"
                          : "text-white/80 hover:bg-white/5"}`}>
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
            <button type="button"
              onClick={() => { if (!isDisabled(dayAfterTomorrow)) { onChange(dayAfterTomorrow); setOpen(false); } }}
              disabled={isDisabled(dayAfterTomorrow)}
              className="flex-1 text-xs text-cyan-400 hover:text-cyan-300 py-1.5 rounded-lg border border-cyan-400/20 hover:border-cyan-400/40 transition-all text-center disabled:opacity-30 disabled:cursor-not-allowed">
              In 2 days
            </button>
            <button type="button"
              onClick={() => { onChange(nextWeek); setOpen(false); }}
              className="flex-1 text-xs text-dim hover:text-white py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all text-center">
              +1 Week
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
