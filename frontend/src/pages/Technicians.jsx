import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const NO_USER = "__none__";
const empty = { user_id: NO_USER, name: "", phone: "", address: "", specialization: "", commission_percent: 10, active: true };

export default function Technicians() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setItems((await api.get("/technicians")).data);
    try { setUsers((await api.get("/users")).data.filter(u => u.role === "teknisi")); } catch (e) { /* ignore */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const startEdit = (t) => {
    setForm({
      user_id: t.user_id || NO_USER,
      name: t.name || "",
      phone: t.phone || "",
      address: t.address || "",
      specialization: t.specialization || "",
      commission_percent: t.commission_percent ?? 0,
      active: t.active !== false,
    });
    setEditingId(t.id);
    setOpen(true);
  };

  const save = async () => {
    try {
      if (!form.name || !form.name.trim()) { toast.error("Nama wajib diisi"); return; }
      const payload = {
        ...form,
        user_id: form.user_id === NO_USER ? "" : form.user_id,
        commission_percent: Number(form.commission_percent) || 0,
      };
      if (editingId) await api.patch(`/technicians/${editingId}`, payload);
      else await api.post("/technicians", payload);
      toast.success("Tersimpan"); setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus teknisi?")) return;
    try { await api.delete(`/technicians/${id}`); toast.success("Dihapus"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-5" data-testid="technicians-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Tim</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Teknisi</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(empty); setEditingId(null); } }}>
          <DialogTrigger asChild><Button className="gap-2" data-testid="add-tech-btn"><Plus className="size-4" />Teknisi</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit" : "Tambah"} Teknisi</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Link ke User Account (opsional)</Label>
                <Select value={form.user_id || NO_USER} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih user dengan role teknisi..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_USER}>-- Tanpa Akun --</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="tech-name" /></div>
                <div><Label>HP</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Spesialisasi</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Hardware/Software" /></div>
                <div><Label>Komisi (%)</Label><Input type="number" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} data-testid="tech-commission" /></div>
              </div>
              <div><Label>Alamat</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <Button onClick={save} className="w-full" data-testid="save-tech-btn">Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>HP</TableHead><TableHead>Spesialisasi</TableHead><TableHead className="text-right">Komisi</TableHead><TableHead>Status</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Belum ada teknisi</TableCell></TableRow>}
            {items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold">{t.name}</TableCell>
                <TableCell className="font-mono text-xs">{t.phone || "-"}</TableCell>
                <TableCell className="text-sm">{t.specialization || "-"}</TableCell>
                <TableCell className="text-right font-mono font-bold">{t.commission_percent}%</TableCell>
                <TableCell><Badge variant={t.active ? "default" : "outline"}>{t.active ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(t)} data-testid={`edit-tech-${t.id}`}><Edit3 className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(t.id)} data-testid={`del-tech-${t.id}`}><Trash2 className="size-4 text-destructive" /></Button>
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
