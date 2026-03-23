"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Cliente } from "@/lib/types";
import {
  LayoutDashboard, Package, ShoppingCart,
  QrCode, LogOut, Leaf, Truck, Users, DollarSign,
  UserCircle, ClipboardList, ChevronDown, ChevronRight,
  Menu, X,
} from "lucide-react";

const CLIENT_NAV = [
  { href: "/dashboard",            label: "Shipments",  icon: LayoutDashboard },
  { href: "/dashboard/inventory",  label: "Inventory",  icon: Package },
  { href: "/dashboard/sales",      label: "Sales",      icon: DollarSign },
  { href: "/dashboard/sell",       label: "Sell",       icon: ClipboardList },
  { href: "/dashboard/clients",    label: "Clients",    icon: UserCircle },
  { href: "/dashboard/orders",     label: "Orders",     icon: ShoppingCart },
  { href: "/dashboard/qr",         label: "QR Scanner", icon: QrCode },
];

const ADMIN_NAV = [
  { href: "/dashboard/admin/shipments", label: "Shipments",  icon: Truck },
  { href: "/dashboard/admin/orders",    label: "Orders",     icon: ShoppingCart },
  { href: "/dashboard/admin/clients",   label: "Clients",    icon: Users },
  { href: "/dashboard/admin/varieties", label: "Varieties",  icon: Leaf },
];

export default function Sidebar({ cliente, userEmail, isAdmin }: {
  cliente: Cliente | null; userEmail: string; isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [clientNavOpen, setClientNavOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <div>
          <span className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            THE GARDEN X
          </span>
          <p className="text-dim text-xs font-mono mt-0.5">{isAdmin ? "Admin Panel" : "Client Portal"}</p>
        </div>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-dim hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* Account */}
      <div className="px-6 py-3 border-b border-white/5">
        <p className="text-xs text-dim uppercase tracking-wider mb-1">Account</p>
        <p className="text-sm font-semibold text-white truncate">{cliente?.nombre ?? userEmail}</p>
        {cliente?.empresa && <p className="text-xs text-dim truncate">{cliente.empresa}</p>}
        {isAdmin && (
          <span className="inline-block mt-1 text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full">Admin</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isAdmin ? (
          <>
            <div className="pb-1 px-3">
              <p className="text-xs text-dim uppercase tracking-wider">Admin</p>
            </div>
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  pathname.startsWith(href) ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-dim hover:text-white hover:bg-white/5")}>
                <Icon size={16} /> {label}
              </Link>
            ))}
            <div className="pt-3">
              <button onClick={() => setClientNavOpen(!clientNavOpen)}
                className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-sm text-dim hover:text-white hover:bg-white/5 transition-all">
                {clientNavOpen ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} />}
                <Users size={16} /> <span>Client View</span>
              </button>
              {clientNavOpen && (
                <div className="ml-3 mt-1 space-y-1 border-l border-white/5 pl-2">
                  {CLIENT_NAV.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                      className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all",
                        pathname === href ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-dim hover:text-white hover:bg-white/5")}>
                      <Icon size={14} /> {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          CLIENT_NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                pathname === href ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-dim hover:text-white hover:bg-white/5")}>
              <Icon size={16} /> {label}
            </Link>
          ))
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/5">
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dim hover:text-red-400 hover:bg-red-400/5 transition-all w-full">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-panel border-b border-white/5 flex items-center px-4 z-50">
        <button onClick={() => setMobileOpen(true)} className="text-dim hover:text-white p-1 mr-3">
          <Menu size={22} />
        </button>
        <span className="text-lg font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
          THE GARDEN X
        </span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — desktop: fixed left, mobile: slide-in */}
      <aside className={cn(
        "fixed top-0 h-full w-64 bg-panel border-r border-white/5 flex flex-col z-50 transition-transform duration-200",
        "lg:left-0 lg:translate-x-0",
        mobileOpen ? "left-0 translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}
