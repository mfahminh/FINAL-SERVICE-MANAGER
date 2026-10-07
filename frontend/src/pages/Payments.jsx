import { useCallback, useEffect, useState } from "react";
import api, { fmtDate, fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Payments() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [editingPayment, setEditingPayment] = useState(null);
  const [amount, setAmount] = useState("");
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = ["kasir", "admin", "owner"].includes(user?.role);

  const loadPayments = useCallback(async () => {
    const response = await api.get("/payments");
    setItems(response.data);
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const closeEdit = () => {
    setEditingPayment(null);
    setAmount("");
    setSupervisorPassword("");
  };

  const openEdit = (payment) => {
    setEditingPayment(payment);
    setAmount(String(payment.amount));
    setSupervisorPassword("");
  };

  const saveAmount = async (event) => {
    event.preventDefault();
    const newAmount = Number(amount);
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      toast.error("Jumlah pembayaran harus lebih dari 0");
      return;
    }
    if (!supervisorPassword) {
      toast.error("Masukkan password owner atau admin");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/payments/${editingPayment.id}/amount`, {
        amount: newAmount,
        supervisor_password: supervisorPassword,
      });
      toast.success("Nominal pembayaran berhasil dikoreksi");
      closeEdit();
      await loadPayments();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal mengoreksi pembayaran");
    } finally {
      setSupervisorPassword("");
      setSaving(false);
    }
  };

  const total = items.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

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
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>No Service</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead className="hidden md:table-cell">Metode</TableHead>
              <TableHead className="hidden md:table-cell">Tipe</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              {canEdit && <TableHead className="w-16 text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center py-10 text-muted-foreground">Belum ada pembayaran</TableCell></TableRow>}
            {items.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(payment.created_at)}</TableCell>
                <TableCell className="font-mono text-sm font-semibold">{payment.service_number}</TableCell>
                <TableCell>{payment.customer_name}</TableCell>
                <TableCell className="hidden md:table-cell capitalize">{payment.method}</TableCell>
                <TableCell className="hidden md:table-cell capitalize">{payment.type}</TableCell>
                <TableCell className="text-right font-mono font-bold">{fmtIDR(payment.amount)}</TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(payment)}
                      aria-label={`Edit nominal pembayaran ${payment.service_number}`}
                      data-testid={`edit-payment-${payment.id}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editingPayment} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Koreksi Nominal Pembayaran</DialogTitle></DialogHeader>
          {editingPayment && (
            <form onSubmit={saveAmount} className="space-y-4">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <div>Service <span className="font-mono font-semibold">{editingPayment.service_number}</span></div>
                <div className="text-muted-foreground">Nominal saat ini: {fmtIDR(editingPayment.amount)}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="corrected-payment-amount">Nominal yang benar</Label>
                <Input
                  id="corrected-payment-amount"
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  data-testid="corrected-payment-amount"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor-password">Password owner/admin</Label>
                <Input
                  id="supervisor-password"
                  type="password"
                  autoComplete="current-password"
                  value={supervisorPassword}
                  onChange={(event) => setSupervisorPassword(event.target.value)}
                  data-testid="payment-supervisor-password"
                  required
                />
                <p className="text-xs text-muted-foreground">Masukkan password akun owner atau admin untuk menyetujui koreksi ini.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeEdit}>Batal</Button>
                <Button type="submit" className="flex-1" disabled={saving} data-testid="save-payment-correction">
                  {saving ? "Menyimpan..." : "Simpan Koreksi"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
