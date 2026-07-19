import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  LayoutDashboard, Users, Smartphone, Package, Truck, ShoppingCart,
  Receipt, FileBarChart2, ScrollText, Settings, LogOut, Sun, Moon,
  Menu, X, Search, ShieldCheck, Wrench, HardHat, Briefcase, Wallet, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import api, { maskPhone } from "@/lib/api";
import { useBranding } from "@/context/BrandingContext";

const ALL_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "admin", "teknisi", "kasir"] },
  { to: "/services", label: "Service", icon: Smartphone, roles: ["owner", "admin", "teknisi", "kasir"], notifKey: "services" },
  { to: "/my-jobs", label: "Pekerjaan Saya", icon: Briefcase, roles: ["teknisi", "owner", "admin"], notifKey: "my-jobs" },
  { to: "/qc", label: "Quality Control", icon: ShieldCheck, roles: ["owner", "admin"], notifKey: "qc" },
  { to: "/customers", label: "Pelanggan", icon: Users, roles: ["owner", "admin", "kasir"] },
  { to: "/technicians", label: "Teknisi", icon: HardHat, roles: ["owner", "admin"] },
  { to: "/spareparts", label: "Sparepart", icon: Package, roles: ["owner", "admin", "teknisi"], notifKey: "spareparts" },
  { to: "/direct-sale", label: "Direct Sale", icon: Receipt, roles: ["owner", "admin", "kasir"] },
  { to: "/suppliers", label: "Supplier", icon: Truck, roles: ["owner", "admin"] },
  { to: "/purchases", label: "Pembelian", icon: ShoppingCart, roles: ["owner", "admin"] },
  { to: "/payments", label: "Pembayaran", icon: Receipt, roles: ["owner", "admin", "kasir"], notifKey: "payments" },
  { to: "/financial", label: "Keuangan", icon: Wallet, roles: ["owner", "admin"] },
  { to: "/reports", label: "Laporan", icon: FileBarChart2, roles: ["owner", "admin"] },
  { to: "/approvals", label: "Persetujuan User", icon: ShieldCheck, roles: ["owner"], notifKey: "approvals" },
  { to: "/users", label: "Users", icon: ShieldCheck, roles: ["owner", "admin"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["owner", "admin"] },
  { to: "/settings", label: "Pengaturan", icon: Settings, roles: ["owner", "admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { settings } = useBranding();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState({ customers: [], services: [] });
  const [notif, setNotif] = useState({});

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await api.get("/notifications/counts");
        if (alive) setNotif(r.data || {});
      } catch (e) { /* ignore */ }
    };
    load();
    const t = setInterval(load, 30000); // refresh tiap 30 detik
    // refresh on window focus
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [user]);

  const totalNotif = Object.entries(notif).reduce((acc, [k, v]) => k !== "ready_pickup" ? acc + (Number(v) || 0) : acc, 0);

  const nav = ALL_NAV.filter((n) => n.roles.includes(user?.role));

  const handleSearch = async (val) => {
    setQ(val);
    if (!val) { setResults({ customers: [], services: [] }); return; }
    const r = await api.get(`/search?q=${encodeURIComponent(val)}`);
    setResults(r.data);
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 border-r border-border bg-card transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="h-16 px-5 flex items-center gap-2 border-b border-border">
          {settings.logo ? (
            <img src={settings.logo} alt="logo" className="size-9 rounded-lg object-cover" />
          ) : (
            <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Wrench className="size-5" />
            </div>
          )}
          <div>
            <div className="font-display font-black text-base leading-tight tracking-tight uppercase">{settings.app_name || "Service HP"}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Service Management</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const count = item.notifKey ? (notif[item.notifKey] || 0) : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                data-testid={`sidebar-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"}`
                }
              >
                <Icon className="size-4" strokeWidth={1.75} />
                <span className="flex-1 truncate">{item.label}</span>
                {count > 0 && (
                  <span
                    data-testid={`sidebar-badge-${item.notifKey}`}
                    className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none tabular-nums shadow-sm ring-2 ring-card"
                    title={`${count} butuh tindakan`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-9 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold uppercase">
              {user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{user?.role}</div>
            </div>
          </div>
          <Button
            variant="outline" size="sm" className="w-full justify-start gap-2"
            data-testid="logout-btn"
            onClick={async () => { await logout(); navigate("/login"); }}
          >
            <LogOut className="size-4" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} data-testid="mobile-menu-btn">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <div className="flex-1 max-w-md relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="global-search-input"
              placeholder="Cari nomor service / IMEI / nama / HP..."
              className="pl-9 h-9"
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            />
            {searchOpen && q && (results.customers.length + results.services.length > 0) && (
              <div className="absolute mt-2 w-full bg-popover border border-border rounded-md shadow-lg max-h-96 overflow-auto">
                {results.services.length > 0 && <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">Service</div>}
                {results.services.map((s) => (
                  <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border/50"
                    onClick={() => { navigate(`/services/${s.id}`); setQ(""); }}>
                    <div className="text-sm font-mono">{s.service_number}</div>
                    <div className="text-xs text-muted-foreground">{s.customer_name} • {s.brand} {s.model}</div>
                  </button>
                ))}
                {results.customers.length > 0 && <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">Pelanggan</div>}
                {results.customers.map((c) => (
                  <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border/50"
                    onClick={() => { navigate(`/customers`); setQ(""); }}>
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{maskPhone(c.phone, user?.role)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" data-testid="notif-bell-btn" title="Notifikasi">
                <Bell className="size-4" />
                {totalNotif > 0 && (
                  <span
                    data-testid="notif-total-badge"
                    className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none tabular-nums ring-2 ring-background"
                  >
                    {totalNotif > 99 ? "99+" : totalNotif}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0" data-testid="notif-popover">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-sm">Perlu Ditindaklanjuti</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total {totalNotif} item</div>
                </div>
                <Bell className="size-4 text-primary" />
              </div>
              <div className="max-h-80 overflow-auto">
                {[
                  { key: "services", label: "Service baru / persetujuan", to: "/services" },
                  { key: "my-jobs", label: user?.role === "teknisi" ? "Pekerjaan aktif Anda" : "Service belum di-assign", to: "/my-jobs" },
                  { key: "qc", label: "Antrian Quality Control", to: "/qc" },
                  { key: "payments", label: "Pembayaran belum lunas", to: "/payments" },
                  { key: "spareparts", label: "Sparepart stok menipis", to: "/spareparts" },
                  { key: "approvals", label: "Persetujuan user pending", to: "/approvals" },
                  { key: "ready_pickup", label: "Siap diambil (belum pickup)", to: "/services", subtle: true },
                ].map((row) => {
                  const c = notif[row.key] || 0;
                  if (c === 0) return null;
                  return (
                    <button
                      key={row.key}
                      onClick={() => navigate(row.to)}
                      data-testid={`notif-item-${row.key}`}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent border-b border-border/50 transition-colors text-left"
                    >
                      <span className="text-sm">{row.label}</span>
                      <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[11px] font-bold tabular-nums ${row.subtle ? "bg-primary/15 text-primary" : "bg-red-500 text-white"}`}>
                        {c}
                      </span>
                    </button>
                  );
                })}
                {totalNotif === 0 && (notif.ready_pickup || 0) === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <div className="inline-flex size-10 rounded-full bg-primary/10 text-primary items-center justify-center mb-2">
                      <Bell className="size-5" />
                    </div>
                    <div>Semua sudah tertangani ✨</div>
                    <div className="text-xs">Tidak ada item yang perlu tindakan.</div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle-btn">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
