import { useEffect, useState, Fragment } from "react";
import api, { fmtDate, fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const emptyForm = { supplier_id: "", items: [], note: "" };

export default function Purchases() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [spareparts, setSpareparts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setItems((await api.get("/purchases")).data);
    setSuppliers((await api.get("/suppliers")).data);
    setSpareparts((await api.get("/spareparts")).data);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load();  }, []);

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { _key: crypto.randomUUID(), sparepart_id: "", name: "", qty: 1, price: 0 }] }));
  const updateItem = (i, key, val) => {
    const list = [...form.items];
    list[i][key] = val;
    if (key === "sparepart_id") {
      const sp = spareparts.find((s) => s.id === val);
      if (sp) { list[i].name = sp.name; if (!list[i].price) list[i].price = sp.cost_price; }
    }
    setForm({ ...form, items: list });
  };
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditId(p.id);
    setForm({
      supplier_id: p.supplier_id,
      note: p.note || "",
      items: (p.items || []).map((it) => ({ ...it, _key: crypto.randomUUID() })),
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (!form.supplier_id || form.items.length === 0) return toast.error("Lengkapi supplier & item");
      const cleanItems = form.items.map((i) => ({
        sparepart_id: i.sparepart_id, name: i.name, qty: Number(i.qty), price: Number(i.price)
      }));
      if (cleanItems.some((i) => !i.sparepart_id || i.qty <= 0)) return toast.error("Item tidak valid");
      if (editId) {
        await api.patch(`/purchases/${editId}`, { supplier_id: form.supplier_id, items: cleanItems, note: form.note });
        toast.success("Pembelian diperbarui, stok disesuaikan");
      } else {
        await api.post("/purchases", { supplier_id: form.supplier_id, items: cleanItems, note: form.note });
        toast.success("Pembelian tercatat, stok bertambah");
      }
      setOpen(false); setForm(emptyForm); setEditId(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Hapus pembelian ${p.purchase_number}? Stok akan dikurangi kembali.`)) return;
    try {
      await api.delete(`/purchases/${p.id}`);
      toast.success("Pembelian dihapus");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal hapus"); }
  };

  const total = form.items.reduce((acc, i) => acc + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);

  return (
    <div className="space-y-5" data-testid="purchases-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Pengadaan</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Pembelian</h1>
          <p className="text-sm text-muted-foreground mt-1">Klik baris untuk lihat detail item, atau gunakan tombol edit untuk merevisi PO.</p>
        </div>
        <Button className="gap-2" onClick={openCreate} data-testid="add-purchase-btn"><Plus className="size-4" />Pembelian Baru</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editId ? "Edit Pembelian" : "Pembelian Sparepart Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger data-testid="pur-supplier"><SelectValue placeholder="Pilih supplier..." /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Item Dibeli</Label><Button size="sm" variant="outline" onClick={addItem} data-testid="add-item-btn"><Plus className="size-3 mr-1" />Tambah Item</Button></div>
              {form.items.length === 0 && <div className="text-center py-4 text-muted-foreground text-xs border border-dashed border-border rounded-md">Belum ada item. Klik "Tambah Item".</div>}
              {form.items.map((it, i) => (
                <div key={it._key} className="grid grid-cols-12 gap-2 items-end p-2 rounded-md bg-muted/30">
                  <div className="col-span-6">
                    <Label className="text-[10px]">Sparepart</Label>
                    <Select value={it.sparepart_id} onValueChange={(v) => updateItem(i, "sparepart_id", v)}>
                      <SelectTrigger data-testid={`part-select-${i}`}><SelectValue placeholder="Pilih sparepart" /></SelectTrigger>
                      <SelectContent>{spareparts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} <span className="text-muted-foreground text-xs">({s.code})</span></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label className="text-[10px]">Qty</Label><Input type="number" value={it.qty} onChange={(e) => updateItem(i, "qty", e.target.value)} data-testid={`qty-${i}`} /></div>
                  <div className="col-span-3"><Label className="text-[10px]">Harga (Modal)</Label><Input type="number" value={it.price} onChange={(e) => updateItem(i, "price", e.target.value)} data-testid={`price-${i}`} /></div>
                  <Button size="icon" variant="ghost" onClick={() => removeItem(i)} className="col-span-1" data-testid={`remove-${i}`}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Catatan pembelian (opsional)" />
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="font-semibold">Total Pembelian</span>
              <span className="font-mono font-bold text-lg text-primary">{fmtIDR(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Batal</Button>
              <Button onClick={save} className="flex-1" data-testid="save-purchase-btn">{editId ? "Simpan Perubahan" : "Simpan Pembelian"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border border-border">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-6" />
            <TableHead>No PO</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="hidden md:table-cell">Item</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden md:table-cell">Tanggal</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Belum ada pembelian</TableCell></TableRow>}
            {items.map((p) => {
              const isOpen = !!expanded[p.id];
              return (
                <Fragment key={p.id}>
                  <TableRow className="hover:bg-accent/40 cursor-pointer" onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })} data-testid={`purchase-row-${p.purchase_number}`}>
                    <TableCell>{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-primary">{p.purchase_number}</TableCell>
                    <TableCell>{p.supplier_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{p.items?.length || 0} item • {(p.items || []).reduce((a, i) => a + (i.qty || 0), 0)} unit</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmtIDR(p.total)}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(p)} data-testid={`edit-${p.purchase_number}`}><Pencil className="size-3.5" /></Button>
                        {user?.role === "owner" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => remove(p)} data-testid={`delete-${p.purchase_number}`}><Trash2 className="size-3.5" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={7} className="p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Detail Item ({p.items?.length || 0})</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="border-b border-border">
                              <tr>
                                <th className="text-left py-1 px-2">Sparepart</th>
                                <th className="text-right py-1 px-2">Qty</th>
                                <th className="text-right py-1 px-2">Harga Satuan</th>
                                <th className="text-right py-1 px-2">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(p.items || []).map((it, i) => (
                                <tr key={i} className="border-b border-border/40">
                                  <td className="py-1 px-2">{it.name}</td>
                                  <td className="py-1 px-2 text-right font-mono">{it.qty}</td>
                                  <td className="py-1 px-2 text-right font-mono">{fmtIDR(it.price)}</td>
                                  <td className="py-1 px-2 text-right font-mono font-bold">{fmtIDR(it.qty * it.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {p.note && <div className="mt-2 text-xs italic text-muted-foreground">Catatan: {p.note}</div>}
                        {p.updated_at && <div className="mt-1 text-[10px] text-muted-foreground">Terakhir diedit: {fmtDate(p.updated_at)} oleh {p.updated_by}</div>}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
