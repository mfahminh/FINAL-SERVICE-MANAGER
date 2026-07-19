import { useEffect, useState } from "react";
import api, { fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export default function UserApprovals() {
  const [items, setItems] = useState([]);
  const load = async () => { try { setItems((await api.get("/user-change-requests")).data); } catch(e){} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const act = async (id, action) => {
    try { await api.post(`/user-change-requests/${id}/${action}`); toast.success(action); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <div className="space-y-5" data-testid="approvals-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Approval</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Persetujuan Perubahan User</h1>
      </div>
      <Card className="border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Aksi</TableHead><TableHead>Diminta Oleh</TableHead><TableHead>Detail</TableHead><TableHead className="w-32"></TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Tidak ada permintaan</TableCell></TableRow>}
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{fmtDate(r.requested_at)}</TableCell>
                <TableCell className="font-semibold uppercase">{r.action}</TableCell>
                <TableCell>{r.requested_by}</TableCell>
                <TableCell className="text-xs font-mono truncate max-w-xs">{JSON.stringify(r.payload)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => act(r.id, "approve")} data-testid={`approve-${r.id}`}><Check className="size-4 text-emerald-600" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => act(r.id, "reject")} data-testid={`reject-${r.id}`}><X className="size-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
