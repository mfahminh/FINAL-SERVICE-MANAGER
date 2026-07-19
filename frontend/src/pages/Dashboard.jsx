import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtIDR, fmtDate, STATUS_COLORS } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone, CheckCircle2, Clock, Package, Wallet, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";

const StatCard = ({ icon: Icon, label, value, accent, sub, testid }) => (
  <Card className="p-4 border border-border" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">{label}</div>
        <div className="font-display font-black text-3xl mt-2 tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </div>
      <div className={`size-9 rounded-md flex items-center justify-center ${accent}`}>
        <Icon className="size-4" strokeWidth={2} />
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
  }, []);

  if (!stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {["a", "b", "c", "d"].map((k) => <Skeleton key={k} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Control Room</div>
          <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight">Dashboard</h1>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {new Date().toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard icon={Smartphone} label="Service Hari Ini" value={stats.services_today} accent="bg-orange-500/10 text-orange-600" testid="stat-services-today" />
        <StatCard icon={Clock} label="Dalam Proses" value={stats.in_progress} accent="bg-blue-500/10 text-blue-600" testid="stat-in-progress" />
        <StatCard icon={CheckCircle2} label="Selesai (Belum Diambil)" value={stats.not_picked} accent="bg-emerald-500/10 text-emerald-600" testid="stat-done" />
        <StatCard icon={AlertTriangle} label="Sparepart Menipis" value={stats.low_stock_count} accent="bg-red-500/10 text-red-600" testid="stat-low-stock" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        <StatCard icon={Wallet} label="Pendapatan Hari Ini" value={fmtIDR(stats.revenue_today)} accent="bg-orange-500/10 text-orange-600" testid="stat-revenue-today" />
        <StatCard icon={TrendingUp} label="Laba Hari Ini" value={fmtIDR(stats.profit_today || 0)} accent="bg-emerald-500/10 text-emerald-600" testid="stat-profit-today" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        <StatCard icon={Wallet} label="Pendapatan Bulan Ini" value={fmtIDR(stats.revenue_month)} accent="bg-orange-500/10 text-orange-600" testid="stat-revenue-month" />
        <StatCard icon={TrendingUp} label="Laba Bulan Ini" value={fmtIDR(stats.profit_month || 0)} accent="bg-emerald-500/10 text-emerald-600" testid="stat-profit-month" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 border border-border">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Trend</div>
              <h3 className="font-display font-bold text-lg tracking-tight">Pendapatan 7 Hari Terakhir</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={stats.chart_revenue}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(20 90% 55%)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(20 90% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtIDR(v)} />
              <Area type="monotone" dataKey="total" stroke="hsl(20 90% 50%)" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 border border-border">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Volume</div>
            <h3 className="font-display font-bold text-lg tracking-tight">Service per Hari</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.chart_services}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 border border-border">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display font-bold text-lg tracking-tight">Service Terbaru</h3>
            <Link to="/services" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </div>
          <div className="space-y-2">
            {stats.recent_services.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Belum ada service</div>}
            {stats.recent_services.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`} className="flex items-center justify-between p-3 rounded-md border border-border hover:border-primary/40 hover:bg-accent/50 transition-colors" data-testid={`recent-service-${s.service_number}`}>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold truncate">{s.service_number}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.customer_name} • {s.brand} {s.model}</div>
                </div>
                <span className={`status-pill ${STATUS_COLORS[s.status] || ""}`}>{s.status}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="size-4 text-primary" />
            <h3 className="font-display font-bold text-lg tracking-tight">Aktivitas Terbaru</h3>
          </div>
          <div className="space-y-2">
            {stats.recent_activity.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Belum ada aktivitas</div>}
            {stats.recent_activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm py-2 border-b border-border/50 last:border-0">
                <div className="size-2 rounded-full bg-primary mt-2" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm"><span className="font-semibold">{a.user_name}</span> <span className="text-muted-foreground">{a.action}</span> <span className="font-mono text-xs">{a.entity}</span></div>
                  <div className="text-[11px] text-muted-foreground">{fmtDate(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
