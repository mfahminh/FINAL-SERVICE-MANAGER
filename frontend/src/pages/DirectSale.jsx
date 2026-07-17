import { useEffect, useState } from "react";
import api, { fmtIDR, fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ShoppingCart, Search, Plus, Minus, Trash2, Receipt, Printer, Package } from "lucide-react";
import { useBranding } from "@/context/BrandingContext";
import PrintStyle from "@/components/PrintStyle";

export default function DirectSale() {
  const { settings } = useBranding();
  const [spareparts, setSpareparts] = useState([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]); // {sparepart_id, name, code, qty, price, stock}
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState("");
  const [sales, setSales] = useState([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  const loadParts = async () => setSpareparts((await api.get("/spareparts")).data);
  const loadSales = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setSales((await api.get(`/direct-sales?start=${today.slice(0, 7)}-01&end=${today}`)).data);
  };
  useEffect(() => { loadParts(); loadSales(); }, []);

  const filtered = spareparts.filter((p) =>
    !query || p.name?.toLowerCase().includes(query.toLowerCase()) || p.code?.toLowerCase().includes(query.toLowerCase())
  );

  const addToCart = (p) => {
    if (p.stock <= 0) { toast.error(`Stok ${p.name} habis`); return; }
    setCart((prev) => {
      const existing = prev.find((x) => x.sparepart_id === p.id);
      if (existing) {
        if (existing.qty + 1 > p.stock) { toast.error("Melebihi stok"); return prev; }
        return prev.map((x) => x.sparepart_id === p.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...prev, { sparepart_id: p.id, name: p.name, code: p.code, qty: 1, price: p.sell_price, stock: p.stock }];
    });
  };
  const setQty = (id, q) => setCart((prev) => prev.map((x) => x.sparepart_id === id ? { ...x, qty: Math.max(1, Math.min(x.stock, Number(q) || 1)) } : x));
  const setPrice = (id, p) => setCart((prev) => prev.map((x) => x.sparepart_id === id ? { ...x, price: Math.max(0, Number(p) || 0) } : x));
  const removeItem = (id) => setCart((prev) => prev.filter((x) => x.sparepart_id !== id));

  const subtotal = cart.reduce((a, b) => a + b.qty * b.price, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const kembali = Math.max(0, (Number(paid) || 0) - total);
  const kurang = Math.max(0, total - (Number(paid) || 0));

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Keranjang kosong");
    if ((Number(paid) || 0) < total) return toast.error("Pembayaran kurang");
    try {
      const payload = {
        items: cart.map((c) => ({ sparepart_id: c.sparepart_id, name: c.name, qty: c.qty, price: c.price })),
        customer_name: customer.name || "Pelanggan Umum",
        customer_phone: customer.phone || "",
        method,
        paid: Number(paid),
        discount: Number(discount) || 0,
        note,
      };
      const r = await api.post("/direct-sales", payload);
      toast.success(`Sale ${r.data.sale_number} berhasil`);
      setLastSale(r.data);
      setReceiptOpen(true);
      // Reset cart
      setCart([]); setPaid(0); setDiscount(0); setNote(""); setCustomer({ name: "", phone: "" });
      loadParts(); loadSales();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal checkout"); }
  };

  const refund = async (sale) => {
    if (!window.confirm(`Refund penjualan ${sale.sale_number}? Stok akan dikembalikan.`)) return;
    try {
      await api.post(`/direct-sales/${sale.id}/refund`);
      toast.success("Refund berhasil");
      loadParts(); loadSales();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal refund"); }
  };

  const openReceipt = (sale) => { setLastSale(sale); setReceiptOpen(true); };

  return (
    <div className="space-y-5" data-testid="direct-sale-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Kasir</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Direct Sale Sparepart</h1>
          <p className="text-sm text-muted-foreground mt-1">Penjualan sparepart langsung tanpa proses service (POS).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT: Sparepart list */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="p-3 border border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Cari sparepart (nama / kode)..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" data-testid="search-part" />
            </div>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[65vh] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-10 text-muted-foreground text-sm">Tidak ada sparepart.</div>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className={`text-left p-3 rounded-md border transition ${p.stock <= 0 ? "opacity-40 cursor-not-allowed border-border" : "border-border hover:border-primary hover:bg-primary/5"}`}
                data-testid={`part-card-${p.code}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{p.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-primary">{fmtIDR(p.sell_price)}</div>
                    <div className={`text-[10px] font-mono ${p.stock <= (p.min_stock || 0) ? "text-red-600" : "text-emerald-600"}`}>stok: {p.stock}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Cart / Checkout */}
        <div className="lg:col-span-2">
          <Card className="p-4 border border-border sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-primary" />
                <h3 className="font-display font-bold text-lg">Keranjang ({cart.length})</h3>
              </div>
              {cart.length > 0 && <Button variant="ghost" size="sm" onClick={() => setCart([])} data-testid="clear-cart-btn"><Trash2 className="size-3.5" /></Button>}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
              {cart.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Package className="size-6 mx-auto mb-1 opacity-40" />
                  Belum ada item
                </div>
              )}
              {cart.map((c) => (
                <div key={c.sparepart_id} className="p-2 rounded-md border border-border" data-testid={`cart-item-${c.sparepart_id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold flex-1 min-w-0 truncate">{c.name}</div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeItem(c.sparepart_id)}><Trash2 className="size-3" /></Button>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(c.sparepart_id, c.qty - 1)}><Minus className="size-3" /></Button>
                    <Input type="number" value={c.qty} onChange={(e) => setQty(c.sparepart_id, e.target.value)} className="h-7 w-12 text-center" data-testid={`qty-${c.sparepart_id}`} />
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(c.sparepart_id, c.qty + 1)}><Plus className="size-3" /></Button>
                    <span className="text-[10px] text-muted-foreground ml-auto">×</span>
                    <Input type="number" value={c.price} onChange={(e) => setPrice(c.sparepart_id, e.target.value)} className="h-7 w-24 text-right font-mono text-xs" data-testid={`price-${c.sparepart_id}`} />
                  </div>
                  <div className="text-right text-xs font-mono font-bold mt-1">{fmtIDR(c.qty * c.price)}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nama pelanggan (opsional)" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} data-testid="customer-name" />
                <Input placeholder="No HP (opsional)" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} data-testid="customer-phone" />
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{fmtIDR(subtotal)}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Diskon</span>
                <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-7 w-32 text-right font-mono" data-testid="discount-input" />
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
                <span>Total</span><span className="font-mono">{fmtIDR(total)}</span>
              </div>
              <div>
                <Label className="text-xs">Metode</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger data-testid="method-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="qris">QRIS</SelectItem>
                    <SelectItem value="debit">Debit/Kredit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Bayar</Label>
                <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} className="text-right font-mono" data-testid="paid-input" />
                {kembali > 0 && <div className="text-xs mt-1 text-emerald-600 flex justify-between"><span>Kembalian</span><span className="font-mono">{fmtIDR(kembali)}</span></div>}
                {kurang > 0 && <div className="text-xs mt-1 text-red-600 flex justify-between"><span>Kurang</span><span className="font-mono">{fmtIDR(kurang)}</span></div>}
              </div>
              <Button onClick={checkout} className="w-full gap-2" size="lg" disabled={cart.length === 0} data-testid="checkout-btn">
                <Receipt className="size-4" />Bayar & Cetak Nota
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Riwayat Direct Sale */}
      <Card className="border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-bold text-lg">Riwayat Penjualan (Bulan Ini)</h3>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>No</TableHead><TableHead>Tanggal</TableHead><TableHead>Pelanggan</TableHead>
            <TableHead className="text-right">Item</TableHead><TableHead>Metode</TableHead>
            <TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {sales.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada penjualan</TableCell></TableRow>}
            {sales.map((s) => (
              <TableRow key={s.id} data-testid={`sale-row-${s.sale_number}`}>
                <TableCell className="font-mono text-xs font-semibold text-primary">{s.sale_number}</TableCell>
                <TableCell className="text-xs">{fmtDate(s.created_at)}</TableCell>
                <TableCell>{s.customer_name}</TableCell>
                <TableCell className="text-right">{s.items?.length || 0}</TableCell>
                <TableCell className="capitalize text-xs">{s.method}</TableCell>
                <TableCell className="text-right font-mono">{fmtIDR(s.total)}</TableCell>
                <TableCell>
                  {s.status === "refunded" ? (
                    <span className="text-[10px] font-semibold text-red-600 uppercase">Refunded</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase">Paid</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => openReceipt(s)} data-testid={`receipt-btn-${s.sale_number}`}><Receipt className="size-3.5" /></Button>
                    {s.status !== "refunded" && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => refund(s)} data-testid={`refund-btn-${s.sale_number}`}>Refund</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nota Penjualan</DialogTitle></DialogHeader>
          {lastSale && (
            <div id="ds-receipt-print" className="border border-border rounded-md p-4 bg-white text-zinc-900 text-xs">
              {receiptOpen && <PrintStyle targetId="ds-receipt-print" kind="nota" />}
              <div className="text-center">
                <div className="font-display font-black text-base">
                  {settings?.print_header_title || settings?.shop_name || settings?.app_name || "SERVICE HP MANAGER"}
                </div>
                {settings?.print_header_subtitle && <div className="text-[9px] text-zinc-500">{settings.print_header_subtitle}</div>}
                {(settings?.print_header_address || settings?.address) && <div className="text-[9px] text-zinc-500">{settings?.print_header_address || settings?.address}</div>}
                {(settings?.print_header_phone || settings?.whatsapp) && <div className="text-[9px] text-zinc-500">Telp/WA: {settings?.print_header_phone || settings?.whatsapp}</div>}
                <div className="text-[10px] font-bold mt-1 border-t border-b border-dashed border-zinc-300 py-1 uppercase tracking-wider">Nota Penjualan Sparepart</div>
              </div>
              <div className="flex justify-between text-[10px] mt-2">
                <div>{lastSale.sale_number}</div><div>{fmtDate(lastSale.created_at)}</div>
              </div>
              <div className="text-[10px]">Pelanggan: {lastSale.customer_name}</div>
              <div className="text-[10px]">Kasir: {lastSale.cashier_name}</div>
              <div className="border-t border-dashed border-zinc-300 my-2"></div>
              {lastSale.items?.map((it, i) => (
                <div key={i} className="mb-1">
                  <div className="font-semibold">{it.name}</div>
                  <div className="flex justify-between text-[10px]">
                    <span>{it.qty} × {fmtIDR(it.price)}</span>
                    <span className="font-mono">{fmtIDR(it.qty * it.price)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-dashed border-zinc-300 my-2"></div>
              <div className="flex justify-between text-[10px]"><span>Subtotal</span><span className="font-mono">{fmtIDR(lastSale.subtotal || lastSale.total)}</span></div>
              {(lastSale.discount || 0) > 0 && <div className="flex justify-between text-[10px]"><span>Diskon</span><span className="font-mono">-{fmtIDR(lastSale.discount)}</span></div>}
              <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span className="font-mono">{fmtIDR(lastSale.total)}</span></div>
              <div className="flex justify-between text-[10px]"><span>Bayar ({lastSale.method})</span><span className="font-mono">{fmtIDR(lastSale.paid)}</span></div>
              {(lastSale.paid - lastSale.total) > 0 && <div className="flex justify-between text-[10px]"><span>Kembali</span><span className="font-mono">{fmtIDR(lastSale.paid - lastSale.total)}</span></div>}
              <div className="text-center text-[9px] text-zinc-500 mt-3 border-t border-dashed border-zinc-300 pt-2">
                {settings?.print_footer_text || "Terima kasih telah berbelanja."}
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setReceiptOpen(false)} className="flex-1" data-testid="ds-receipt-close">Tutup</Button>
            <Button onClick={() => window.print()} className="flex-1 gap-2" data-testid="ds-receipt-print"><Printer className="size-4" />Cetak</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
