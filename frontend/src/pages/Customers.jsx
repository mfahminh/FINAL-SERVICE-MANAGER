import { useEffect, useState } from "react";
import api, { fmtDate, maskPhone } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Edit3, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const empty = { name: "", phone: "", whatsapp: "", address: "", email: "", notes: "" };

export default function Customers() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const r = await api.get(`/customers?q=${encodeURIComponent(q)}`);
    setItems(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  const save = async () => {
    try {
      if (editingId) {
        await api.patch(`/customers/${editingId}`, form);
        toast.success("Pelanggan diupdate");
      } else {
        await api.post("/customers", form);
        toast.success("Pelanggan ditambahkan");
      }
      setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus pelanggan ini?")) return;
    await api.delete(`/customers/${id}`);
    toast.success("Pelanggan dihapus"); load();
  };

  const edit = (c) => { setForm(c); setEditingId(c.id); setOpen(true); };

  return (
    <div className="space-y-5" data-testid="customers-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Database</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Pelanggan</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(empty); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button data-testid="add-customer-btn" className="gap-2"><Plus className="size-4" /> Pelanggan Baru</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit" : "Tambah"} Pelanggan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="customer-name-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>No HP</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="customer-phone-input" /></div>
                <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Alamat</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
              <div><Label>Catatan</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <Button onClick={save} className="w-full" data-testid="save-customer-btn">Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-border">
        <div className="p-4 border-b border-border flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari nama / nomor HP..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} data-testid="customers-search-input" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>HP / WA</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Alamat</TableHead>
              <TableHead className="hidden md:table-cell">Tanggal</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Belum ada pelanggan</TableCell></TableRow>}
            {items.map((c) => (
              <TableRow key={c.id} data-testid={`customer-row-${c.id}`}>
                <TableCell className="font-semibold">{c.name}</TableCell>
                <TableCell className="font-mono text-xs"><div className="flex items-center gap-1"><Phone className="size-3" />{maskPhone(c.phone, user?.role)}</div></TableCell>
                <TableCell className="hidden md:table-cell text-xs">{c.email || "-"}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground truncate max-w-xs">{c.address || "-"}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmtDate(c.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => edit(c)} data-testid={`edit-customer-${c.id}`}><Edit3 className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(c.id)} data-testid={`delete-customer-${c.id}`}><Trash2 className="size-4 text-destructive" /></Button>
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
