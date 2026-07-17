import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtDate, fmtIDR, STATUS_COLORS } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Wrench, Hand, ShieldAlert } from "lucide-react";

export default function MyJobs() {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState([]);
  const [period, setPeriod] = useState("all");
  const navigate = useNavigate();

  const load = async () => {
    const r = await api.get(`/my-jobs?period=${period}`); setItems(r.data);
    const p = await api.get(`/services?status=Menunggu Teknisi`); setPending(p.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  const claim = async (id) => {
    try { await api.post(`/services/${id}/claim`); toast.success("Pekerjaan diambil"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const totalCommission = items.reduce((a, b) => a + (b.commission || 0), 0);
  const totalProfit = items.reduce((a, b) => a + (b.profit || 0), 0);
  const qcFailedJobs = items.filter((s) => s.qc_failed && s.status === "Sedang Dikerjakan");

  return (
    <div className="space-y-5" data-testid="my-jobs-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Teknisi</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Pekerjaan Saya</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 border border-border"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Job</div><div className="font-display font-black text-2xl">{items.length}</div></Card>
        <Card className="p-4 border border-border"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Laba</div><div className="font-display font-black text-2xl font-mono">{fmtIDR(totalProfit)}</div></Card>
        <Card className="p-4 border border-border bg-orange-500/5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Komisi Saya</div><div className="font-display font-black text-2xl font-mono text-primary">{fmtIDR(totalCommission)}</div></Card>
      </div>

      {qcFailedJobs.length > 0 && (
        <Card className="p-5 border border-red-500/40 bg-red-500/5" data-testid="qc-failed-alerts">
          <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
            <ShieldAlert className="size-5" />QC Gagal — Perlu Diperbaiki ({qcFailedJobs.length})
          </h3>
          <div className="space-y-2">
            {qcFailedJobs.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 p-3 border border-red-500/30 rounded-md bg-background hover:border-red-500/60 cursor-pointer" onClick={() => navigate(`/services/${s.id}`)} data-testid={`qc-failed-${s.service_number}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-semibold">{s.service_number}</div>
                  <div className="text-xs text-muted-foreground">{s.customer_name} • {s.brand} {s.model}</div>
                  {s.qc_result?.failed_items?.length > 0 && (
                    <div className="text-xs mt-1 text-red-700 dark:text-red-400">
                      Gagal: {s.qc_result.failed_items.slice(0, 3).join(", ")}{s.qc_result.failed_items.length > 3 ? `, +${s.qc_result.failed_items.length - 3} lagi` : ""}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider whitespace-nowrap">Perlu Perbaikan</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pending.length > 0 && (
        <Card className="p-5 border border-border">
          <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2"><Hand className="size-4 text-primary" />Antrian Tersedia (Ambil Pekerjaan)</h3>
          <div className="space-y-2">
            {pending.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-md hover:border-primary/40">
                <div onClick={() => navigate(`/services/${s.id}`)} className="flex-1 cursor-pointer">
                  <div className="font-mono text-sm font-semibold">{s.service_number}</div>
                  <div className="text-xs text-muted-foreground">{s.customer_name} • {s.brand} {s.model} • {s.complaint?.slice(0, 60)}</div>
                </div>
                <Button size="sm" onClick={() => claim(s.id)} className="gap-1" data-testid={`claim-${s.service_number}`}><Wrench className="size-3" />Ambil</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="border border-border">
        <div className="p-4 border-b border-border">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="all" data-testid="period-all">Semua</TabsTrigger>
              <TabsTrigger value="today" data-testid="period-today">Hari Ini</TabsTrigger>
              <TabsTrigger value="week" data-testid="period-week">Minggu Ini</TabsTrigger>
              <TabsTrigger value="month" data-testid="period-month">Bulan Ini</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Customer</TableHead><TableHead>Device</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Laba</TableHead><TableHead className="text-right">Komisi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Belum ada pekerjaan</TableCell></TableRow>}
            {items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/services/${s.id}`)}>
                <TableCell className="font-mono text-xs font-semibold">{s.service_number}</TableCell>
                <TableCell>{s.customer_name}</TableCell>
                <TableCell className="text-xs">{s.brand} {s.model}</TableCell>
                <TableCell><span className={`status-pill ${STATUS_COLORS[s.status]}`}>{s.status}</span></TableCell>
                <TableCell className="text-right font-mono">{fmtIDR(s.profit || 0)}</TableCell>
                <TableCell className="text-right font-mono text-primary font-bold">{fmtIDR(s.commission || 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
