import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtDate, fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, ClipboardCheck } from "lucide-react";

export default function QCQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/qc-queue");
      setItems(r.data);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5" data-testid="qc-queue-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Quality Control</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Antrian QC</h1>
          <p className="text-sm text-muted-foreground mt-1">HP yang sudah selesai dikerjakan teknisi, menunggu pemeriksaan akhir.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
          <ShieldCheck className="size-5 text-primary" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">Total Antrian</div>
            <div className="font-display font-black text-2xl leading-none">{items.length}</div>
          </div>
        </div>
      </div>

      <Card className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Service</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead className="hidden md:table-cell">Device</TableHead>
              <TableHead className="hidden md:table-cell">Teknisi</TableHead>
              <TableHead className="hidden lg:table-cell">Selesai Kerja</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Memuat...</TableCell></TableRow>}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                <ShieldCheck className="size-8 mx-auto mb-2 opacity-40" />
                Tidak ada antrian QC saat ini.
              </TableCell></TableRow>
            )}
            {items.map((s) => (
              <TableRow key={s.id} className="hover:bg-accent/40" data-testid={`qc-row-${s.service_number}`}>
                <TableCell className="font-mono text-sm font-semibold text-primary">{s.service_number}</TableCell>
                <TableCell>
                  <div className="font-semibold">{s.customer_name}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">{s.brand} {s.model}<div className="text-xs text-muted-foreground font-mono">{s.imei1}</div></TableCell>
                <TableCell className="hidden md:table-cell text-sm">{s.assigned_technician_name || <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{fmtDate(s.finished_at)}</TableCell>
                <TableCell className="text-right font-mono">{fmtIDR(s.final_cost || 0)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" className="gap-1" onClick={() => navigate(`/services/${s.id}?tab=qc`)} data-testid={`qc-start-${s.service_number}`}>
                    <ClipboardCheck className="size-4" /> Mulai QC
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
