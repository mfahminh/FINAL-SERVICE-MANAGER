import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { fmtDate, fmtIDR, STATUS_COLORS, SERVICE_STATUSES, maskPhone } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

export default function Services() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const navigate = useNavigate();

  const load = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    const r = await api.get(`/services?${params.toString()}`);
    setItems(r.data);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load();  }, [q, status]);

  return (
    <div className="space-y-5" data-testid="services-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Workflow</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Service</h1>
        </div>
        <Button data-testid="new-service-btn" onClick={() => navigate("/services/new")} className={`gap-2 ${user?.role === "teknisi" ? "hidden" : ""}`}>
          <Plus className="size-4" /> Penerimaan Baru
        </Button>
      </div>

      <Card className="border border-border">
        <div className="p-4 border-b border-border flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari nomor / IMEI / nama..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} data-testid="services-search-input" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]" data-testid="status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {SERVICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Service</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead className="hidden md:table-cell">Device</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Estimasi</TableHead>
              <TableHead className="hidden md:table-cell">Tanggal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Belum ada service</TableCell></TableRow>}
            {items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/services/${s.id}`)} data-testid={`service-row-${s.service_number}`}>
                <TableCell className="font-mono text-sm font-semibold text-primary">{s.service_number}</TableCell>
                <TableCell>
                  <div className="font-semibold">{s.customer_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{maskPhone(s.customer_phone, user?.role)}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{s.brand} {s.model}<div className="text-xs text-muted-foreground font-mono">{s.imei1}</div></TableCell>
                <TableCell><span className={`status-pill ${STATUS_COLORS[s.status] || ""}`}>{s.status}</span></TableCell>
                <TableCell className="hidden lg:table-cell font-mono">{fmtIDR(s.estimated_cost)}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmtDate(s.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
