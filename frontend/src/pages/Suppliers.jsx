import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", address: "", whatsapp: "", email: "", pic: "" };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  const load = async () => setItems((await api.get("/suppliers")).data);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async () => {
    try {
      if (editingId) await api.patch(`/suppliers/${editingId}`, form);
      else await api.post("/suppliers", form);
      toast.success("Tersimpan"); setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus supplier?")) return;
    await api.delete(`/suppliers/${id}`); toast.success("Dihapus"); load();
  };

  return (
    <div className="space-y-5" data-testid="suppliers-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Mitra</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Supplier</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(empty); setEditingId(null); } }}>
          <DialogTrigger asChild><Button className="gap-2" data-testid="add-supplier-btn"><Plus className="size-4" />Tambah</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit" : "Tambah"} Supplier</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="sup-name" /></div>
              <div><Label>PIC</Label><Input value={form.pic} onChange={(e) => setForm({ ...form, pic: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>Alamat</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <Button onClick={save} className="w-full" data-testid="save-supplier-btn">Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border border-border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nama</TableHead><TableHead>PIC</TableHead><TableHead>Kontak</TableHead><TableHead className="hidden md:table-cell">Alamat</TableHead><TableHead className="w-20"></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Belum ada supplier</TableCell></TableRow>}
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-semibold">{s.name}</TableCell>
                <TableCell>{s.pic}</TableCell>
                <TableCell className="font-mono text-xs">{s.whatsapp}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{s.address}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(s); setEditingId(s.id); setOpen(true); }}><Edit3 className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
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
