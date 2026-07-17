import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtDate, fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Payments() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/payments").then((r) => setItems(r.data)); }, []);
  const total = items.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-5" data-testid="payments-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Keuangan</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Pembayaran</h1>
      </div>
      <Card className="p-5 border border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Penerimaan</div>
        <div className="font-display font-black text-3xl font-mono">{fmtIDR(total)}</div>
      </Card>
      <Card className="border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No Service</TableHead><TableHead>Pelanggan</TableHead><TableHead className="hidden md:table-cell">Metode</TableHead><TableHead className="hidden md:table-cell">Tipe</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Belum ada pembayaran</TableCell></TableRow>}
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                <TableCell className="font-mono text-sm font-semibold">{p.service_number}</TableCell>
                <TableCell>{p.customer_name}</TableCell>
                <TableCell className="hidden md:table-cell capitalize">{p.method}</TableCell>
                <TableCell className="hidden md:table-cell capitalize">{p.type}</TableCell>
                <TableCell className="text-right font-mono font-bold">{fmtIDR(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
