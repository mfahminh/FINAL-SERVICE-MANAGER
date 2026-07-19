import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, AlertTriangle, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const empty = { category: "", code: "", name: "", brand: "", cost_price: 0, sell_price: 0, stock: 0, min_stock: 1, location: "" };

export default function Spareparts() {
  const { user: me } = useAuth();
  const isTeknisi = me?.role === "teknisi";
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [low, setLow] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const r = await api.get(`/spareparts?q=${q}&low_stock=${low}`);
    setItems(r.data);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load();  }, [q, low]);

  const save = async () => {
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price), sell_price: Number(form.sell_price),
        stock: Number(form.stock), min_stock: Number(form.min_stock)
      };
      if (editingId) await api.patch(`/spareparts/${editingId}`, payload);
      else await api.post("/spareparts", payload);
      toast.success("Tersimpan"); setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus sparepart ini?")) return;
    await api.delete(`/spareparts/${id}`); toast.success("Dihapus"); load();
  };

  return (
    <div className="space-y-5" data-testid="spareparts-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Inventory</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Sparepart</h1>
        </div>
        {!isTeknisi && <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(empty); setEditingId(null); } }}>
          <DialogTrigger asChild><Button className="gap-2" data-testid="add-sparepart-btn"><Plus className="size-4" />Tambah</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit" : "Tambah"} Sparepart</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kategori</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="sp-category" /></div>
                <div><Label>Kode</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="sp-code" /></div>
                <div className="col-span-2"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="sp-name" /></div>
                <div><Label>Merk</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
                <div><Label>Lokasi Rak</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Harga Modal</Label><Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} data-testid="sp-cost" /></div>
                <div><Label>Harga Jual</Label><Input type="number" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} data-testid="sp-sell" /></div>
                <div><Label>Stok</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="sp-stock" /></div>
                <div><Label>Min Stok</Label><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
              </div>
              <Button onClick={save} className="w-full" data-testid="save-sparepart-btn">Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>}
      </div>

      <Card className="border border-border">
        <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari nama / kode..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant={low ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setLow(!low)} data-testid="low-stock-filter">
            <AlertTriangle className="size-4" />Stok Menipis
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden md:table-cell">Kategori</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right hidden lg:table-cell">Modal</TableHead>
              <TableHead className="text-right">Jual</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Tidak ada data</TableCell></TableRow>}
            {items.map((s) => {
              const lowS = s.stock <= s.min_stock;
              return (
                <TableRow key={s.id} data-testid={`sp-row-${s.code}`}>
                  <TableCell className="font-mono text-xs font-semibold">{s.code}</TableCell>
                  <TableCell><div className="font-semibold">{s.name}</div><div className="text-xs text-muted-foreground">{s.brand}</div></TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{s.category}</TableCell>
                  <TableCell className="text-right"><span className={`font-mono font-bold ${lowS ? "text-red-600" : ""}`}>{s.stock}</span></TableCell>
                  {!isTeknisi && <TableCell className="text-right hidden lg:table-cell font-mono text-xs">{fmtIDR(s.cost_price)}</TableCell>}
                  {!isTeknisi && <TableCell className="text-right font-mono font-semibold">{fmtIDR(s.sell_price)}</TableCell>}
                  {!isTeknisi && <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setForm(s); setEditingId(s.id); setOpen(true); }} data-testid={`edit-sp-${s.id}`}><Edit3 className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del(s.id)} data-testid={`del-sp-${s.id}`}><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
