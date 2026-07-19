import { useEffect, useState } from "react";
import api, { fmtDate, fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText, Printer, Receipt, Users, Wrench, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import PrintStyle from "@/components/PrintStyle";

const GROUP_LABELS = { item: "Per Item", day: "Per Hari", month: "Per Bulan" };

function ExportButtons({ type, params }) {
  const download = async (fmt) => {
    try {
      const qs = new URLSearchParams({ type, format: fmt, ...params }).toString();
      const r = await api.get(`/reports/export?${qs}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      const ext = fmt === "pdf" ? "pdf" : "xlsx";
      a.download = `${type}_${params.start || ""}_${params.end || ""}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${fmt.toUpperCase()}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal export");
    }
  };
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => download("xlsx")} className="gap-2" data-testid={`export-xlsx-${type}`}>
        <FileSpreadsheet className="size-4 text-emerald-600" />Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => download("pdf")} className="gap-2" data-testid={`export-pdf-${type}`}>
        <FileText className="size-4 text-red-600" />PDF
      </Button>
    </div>
  );
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(today);
  const [revenueGroup, setRevenueGroup] = useState("item");
  const [serviceGroup, setServiceGroup] = useState("item");
  const [revenue, setRevenue] = useState(null);
  const [services, setServices] = useState(null);
  const [parts, setParts] = useState(null);
  const [techsProfit, setTechsProfit] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const [slipTech, setSlipTech] = useState(null);
  const [slipRange, setSlipRange] = useState({ start: monthStart, end: today });
  const [slipData, setSlipData] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [purchaseGroup, setPurchaseGroup] = useState("item");
  const [spSales, setSpSales] = useState(null);
  const [spSalesGroup, setSpSalesGroup] = useState("item");
  const [spSalesSource, setSpSalesSource] = useState("all");

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get("/technicians").then((r) => setTechnicians(r.data)).catch(() => {});
  }, []);

  const loadRevenue = async () => {
    const r = await api.get(`/reports/revenue?start=${start}&end=${end}&group=${revenueGroup}`);
    setRevenue(r.data);
  };
  const loadServices = async () => {
    const r = await api.get(`/reports/services?start=${start}&end=${end}&group=${serviceGroup}`);
    setServices(r.data);
  };
  const loadParts = async () => setParts((await api.get("/reports/spareparts")).data);
  const loadTechsProfit = async () => {
    const r = await api.get(`/reports/technicians-profit?start=${start}&end=${end}`);
    setTechsProfit(r.data);
  };
  const loadPurchases = async () => {
    const r = await api.get(`/reports/purchases?start=${start}&end=${end}&group=${purchaseGroup}`);
    setPurchases(r.data);
  };
  const loadSpSales = async () => {
    const r = await api.get(`/reports/sparepart-sales?start=${start}&end=${end}&source=${spSalesSource}&group=${spSalesGroup}`);
    setSpSales(r.data);
  };

  const openSlip = (tech) => {
    setSlipTech(tech);
    setSlipRange({ start, end });
    setSlipData(null);
    setSlipOpen(true);
  };

  const loadSlip = async () => {
    if (!slipTech) return;
    try {
      const r = await api.get(`/reports/technician/${slipTech.id}/slip?start=${slipRange.start}&end=${slipRange.end}`);
      setSlipData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal memuat slip");
    }
  };

  const downloadSlipPdf = async () => {
    if (!slipTech) return;
    try {
      const qs = new URLSearchParams({ type: "salary-slip", format: "pdf", start: slipRange.start, end: slipRange.end, technician_id: slipTech.id }).toString();
      const r = await api.get(`/reports/export?${qs}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slip_gaji_${slipTech.name.replace(/\s+/g, "_")}_${slipRange.start}_${slipRange.end}.pdf`;
      a.click();
    } catch (e) { toast.error("Gagal download"); }
  };

  return (
    <div className="space-y-5" data-testid="reports-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Analytics</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Laporan</h1>
        <p className="text-sm text-muted-foreground mt-1">Ringkasan pendapatan, service, sparepart, dan laba/komisi teknisi.</p>
      </div>

      <Card className="p-4 border border-border flex flex-wrap gap-3 items-end">
        <div><Label>Dari</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="report-start" /></div>
        <div><Label>Sampai</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="report-end" /></div>
      </Card>

      <Tabs defaultValue="revenue">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="revenue" onClick={loadRevenue} data-testid="tab-revenue"><Receipt className="size-4 mr-1" />Pendapatan</TabsTrigger>
          <TabsTrigger value="services" onClick={loadServices} data-testid="tab-services"><Wrench className="size-4 mr-1" />Service</TabsTrigger>
          <TabsTrigger value="parts" onClick={loadParts} data-testid="tab-parts"><Package className="size-4 mr-1" />Sparepart</TabsTrigger>
          <TabsTrigger value="techs" onClick={loadTechsProfit} data-testid="tab-techs"><Users className="size-4 mr-1" />Laba Teknisi</TabsTrigger>
          <TabsTrigger value="purchases" onClick={loadPurchases} data-testid="tab-purchases"><ShoppingCart className="size-4 mr-1" />Pembelian</TabsTrigger>
          <TabsTrigger value="sp-sales" onClick={loadSpSales} data-testid="tab-sp-sales"><TrendingUp className="size-4 mr-1" />Penjualan Sparepart</TabsTrigger>
        </TabsList>

        {/* PENDAPATAN */}
        <TabsContent value="revenue">
          <Card className="border border-border">
            <div className="p-4 flex flex-wrap justify-between items-end gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Pendapatan</div>
                <div className="font-display font-black text-2xl font-mono">{fmtIDR(revenue?.total || 0)}</div>
                {revenue && <div className="text-xs text-muted-foreground">Grouping: {GROUP_LABELS[revenue.group] || "Per Item"} • {revenue.items?.length || 0} baris</div>}
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">Grouping</Label>
                  <Select value={revenueGroup} onValueChange={(v) => { setRevenueGroup(v); }}>
                    <SelectTrigger className="w-40" data-testid="revenue-group"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">Per Item Transaksi</SelectItem>
                      <SelectItem value="day">Per Hari</SelectItem>
                      <SelectItem value="month">Per Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={loadRevenue} data-testid="revenue-apply">Terapkan</Button>
                <ExportButtons type="revenue" params={{ start, end, group: revenueGroup }} />
              </div>
            </div>
            <Table>
              {revenueGroup === "item" ? (
                <>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No Service</TableHead><TableHead>Pelanggan</TableHead><TableHead>Metode</TableHead><TableHead>Tipe</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {!revenue && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Klik "Terapkan" untuk muat data</TableCell></TableRow>}
                    {revenue?.items?.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.service_number}</TableCell>
                        <TableCell>{r.customer_name}</TableCell>
                        <TableCell className="capitalize">{r.method}</TableCell>
                        <TableCell className="text-xs capitalize">{r.type}</TableCell>
                        <TableCell className="text-right font-mono">{fmtIDR(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader><TableRow><TableHead>{revenueGroup === "day" ? "Tanggal" : "Bulan"}</TableHead><TableHead className="text-right">Jumlah Transaksi</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {revenue?.items?.map((r) => (
                      <TableRow key={r.period}>
                        <TableCell className="font-mono">{r.period}</TableCell>
                        <TableCell className="text-right font-mono">{r.count}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </Card>
        </TabsContent>

        {/* SERVICES */}
        <TabsContent value="services">
          <Card className="border border-border">
            <div className="p-4 flex flex-wrap justify-between items-end gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Service</div>
                <div className="font-display font-black text-2xl">{services?.count || 0}</div>
                {services && <div className="text-xs text-muted-foreground">Grouping: {GROUP_LABELS[services.group] || "Per Service"} • {services.items?.length || 0} baris</div>}
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">Grouping</Label>
                  <Select value={serviceGroup} onValueChange={setServiceGroup}>
                    <SelectTrigger className="w-40" data-testid="service-group"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">Per Service</SelectItem>
                      <SelectItem value="day">Per Hari</SelectItem>
                      <SelectItem value="month">Per Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={loadServices} data-testid="service-apply">Terapkan</Button>
                <ExportButtons type="services" params={{ start, end, group: serviceGroup }} />
              </div>
            </div>
            <Table>
              {serviceGroup === "item" ? (
                <>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No</TableHead><TableHead>Pelanggan</TableHead><TableHead>Device</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Biaya Jasa</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {!services && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Klik "Terapkan" untuk muat data</TableCell></TableRow>}
                    {services?.items?.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{fmtDate(s.created_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{s.service_number}</TableCell>
                        <TableCell>{s.customer_name}</TableCell>
                        <TableCell>{s.brand} {s.model}</TableCell>
                        <TableCell className="text-xs">{s.status}</TableCell>
                        <TableCell className="text-right font-mono">{fmtIDR(s.service_fee || s.estimated_cost || 0)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(s.final_cost || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader><TableRow><TableHead>{serviceGroup === "day" ? "Tanggal" : "Bulan"}</TableHead><TableHead className="text-right">Jumlah Service</TableHead><TableHead className="text-right">Pendapatan</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {services?.items?.map((r) => (
                      <TableRow key={r.period}>
                        <TableCell className="font-mono">{r.period}</TableCell>
                        <TableCell className="text-right font-mono">{r.count}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(r.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </Card>
        </TabsContent>

        {/* SPAREPARTS */}
        <TabsContent value="parts">
          <Card className="border border-border">
            <div className="p-4 flex justify-end gap-2">
              <ExportButtons type="spareparts" params={{ start, end }} />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead className="text-right">Stok</TableHead><TableHead className="text-right">Modal</TableHead><TableHead className="text-right">Jual</TableHead></TableRow></TableHeader>
              <TableBody>
                {!parts && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Klik tab untuk muat data</TableCell></TableRow>}
                {parts?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right font-mono">{p.stock}</TableCell>
                    <TableCell className="text-right font-mono">{fmtIDR(p.cost_price)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtIDR(p.sell_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* LABA TEKNISI */}
        <TabsContent value="techs">
          <Card className="border border-border">
            <div className="p-4 flex flex-wrap justify-between items-end gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Laba & Komisi Teknisi</div>
                <div className="text-xs text-muted-foreground mt-1">Komisi = % teknisi × Biaya Jasa (dari service Selesai / Sudah Diambil pada periode)</div>
              </div>
              <div className="flex gap-2 items-end">
                <Button variant="outline" size="sm" onClick={loadTechsProfit} data-testid="techs-apply">Terapkan</Button>
                <ExportButtons type="technicians-profit" params={{ start, end }} />
              </div>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Teknisi</TableHead>
                <TableHead className="text-right">% Komisi</TableHead>
                <TableHead className="text-right">Jumlah Job</TableHead>
                <TableHead className="text-right">Total Biaya Jasa</TableHead>
                <TableHead className="text-right">Total Komisi</TableHead>
                <TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {!techsProfit && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Klik "Terapkan" untuk muat data</TableCell></TableRow>}
                {techsProfit?.technicians?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada data pada periode ini</TableCell></TableRow>}
                {techsProfit?.technicians?.map((t) => (
                  <TableRow key={t.id} data-testid={`tech-row-${t.id}`}>
                    <TableCell className="font-semibold">{t.name}</TableCell>
                    <TableCell className="text-right font-mono">{t.commission_percent}%</TableCell>
                    <TableCell className="text-right font-mono">{t.job_count}</TableCell>
                    <TableCell className="text-right font-mono">{fmtIDR(t.total_service_fee)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{fmtIDR(t.total_commission)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openSlip(t)} data-testid={`slip-btn-${t.id}`}>
                        <Receipt className="size-3" />Slip Gaji
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        {/* PEMBELIAN */}
        <TabsContent value="purchases">
          <Card className="border border-border">
            <div className="p-4 flex flex-wrap justify-between items-end gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Pembelian</div>
                <div className="font-display font-black text-2xl font-mono">{fmtIDR(purchases?.total || 0)}</div>
                {purchases && <div className="text-xs text-muted-foreground">Grouping: {GROUP_LABELS[purchases.group] || "Per PO"} • {purchases.items?.length || 0} baris</div>}
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">Grouping</Label>
                  <Select value={purchaseGroup} onValueChange={setPurchaseGroup}>
                    <SelectTrigger className="w-40" data-testid="purchase-group"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">Per PO</SelectItem>
                      <SelectItem value="day">Per Hari</SelectItem>
                      <SelectItem value="month">Per Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={loadPurchases} data-testid="purchase-apply">Terapkan</Button>
                <ExportButtons type="purchases" params={{ start, end, group: purchaseGroup }} />
              </div>
            </div>
            <Table>
              {purchaseGroup === "item" ? (
                <>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No PO</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Item</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {!purchases && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Klik "Terapkan"</TableCell></TableRow>}
                    {purchases?.items?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{fmtDate(p.created_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.purchase_number}</TableCell>
                        <TableCell>{p.supplier_name}</TableCell>
                        <TableCell className="text-right">{p.items?.length || 0}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(p.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader><TableRow><TableHead>{purchaseGroup === "day" ? "Tanggal" : "Bulan"}</TableHead><TableHead className="text-right">Jumlah PO</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {purchases?.items?.map((r) => (
                      <TableRow key={r.period}>
                        <TableCell className="font-mono">{r.period}</TableCell>
                        <TableCell className="text-right font-mono">{r.count}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </Card>
        </TabsContent>

        {/* PENJUALAN SPAREPART */}
        <TabsContent value="sp-sales">
          <Card className="border border-border">
            <div className="p-4 flex flex-wrap justify-between items-end gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Penjualan Sparepart</div>
                <div className="font-display font-black text-2xl font-mono">{fmtIDR(spSales?.total_amount || 0)}</div>
                {spSales && <div className="text-xs text-muted-foreground">Sumber: {spSales.source === "all" ? "Semua" : spSales.source === "direct" ? "Direct Sale" : "Sparepart di Service"} • Qty {spSales.total_qty || 0}</div>}
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">Sumber</Label>
                  <Select value={spSalesSource} onValueChange={setSpSalesSource}>
                    <SelectTrigger className="w-44" data-testid="sp-source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="service">Dipakai di Service</SelectItem>
                      <SelectItem value="direct">Direct Sale (POS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Grouping</Label>
                  <Select value={spSalesGroup} onValueChange={setSpSalesGroup}>
                    <SelectTrigger className="w-40" data-testid="sp-group"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">Per Transaksi</SelectItem>
                      <SelectItem value="sparepart">Per Sparepart</SelectItem>
                      <SelectItem value="day">Per Hari</SelectItem>
                      <SelectItem value="month">Per Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={loadSpSales} data-testid="sp-apply">Terapkan</Button>
                <ExportButtons type="sparepart-sales" params={{ start, end, group: spSalesGroup }} />
              </div>
            </div>
            <Table>
              {spSalesGroup === "item" ? (
                <>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Sumber</TableHead><TableHead>Ref</TableHead><TableHead>Pelanggan</TableHead><TableHead>Sparepart</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {!spSales && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Klik "Terapkan"</TableCell></TableRow>}
                    {spSales?.items?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>}
                    {spSales?.items?.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{(e.date || "").slice(0, 10)}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${e.source === "service" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" : "bg-purple-500/10 text-purple-700 dark:text-purple-400"}`}>
                            {e.source === "service" ? "Service" : "Direct"}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.ref}</TableCell>
                        <TableCell className="text-xs">{e.customer_name}</TableCell>
                        <TableCell className="text-xs">{e.name}</TableCell>
                        <TableCell className="text-right font-mono">{e.qty}</TableCell>
                        <TableCell className="text-right font-mono">{fmtIDR(e.price)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(e.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : spSalesGroup === "sparepart" ? (
                <>
                  <TableHeader><TableRow><TableHead>Sparepart</TableHead><TableHead className="text-right">Total Qty</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {spSales?.items?.map((r) => (
                      <TableRow key={r.sparepart_id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-right font-mono">{r.qty}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader><TableRow><TableHead>{spSalesGroup === "day" ? "Tanggal" : "Bulan"}</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {spSales?.items?.map((r) => (
                      <TableRow key={r.period}>
                        <TableCell className="font-mono">{r.period}</TableCell>
                        <TableCell className="text-right font-mono">{r.qty}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmtIDR(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SLIP GAJI Dialog */}<Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Slip Gaji — {slipTech?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Periode Dari</Label><Input type="date" value={slipRange.start} onChange={(e) => setSlipRange({ ...slipRange, start: e.target.value })} data-testid="slip-start" /></div>
              <div><Label>Periode Sampai</Label><Input type="date" value={slipRange.end} onChange={(e) => setSlipRange({ ...slipRange, end: e.target.value })} data-testid="slip-end" /></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadSlip} className="flex-1" data-testid="slip-load-btn">Muat Data</Button>
              <Button onClick={downloadSlipPdf} className="flex-1 gap-2" data-testid="slip-pdf-btn"><FileText className="size-4" />Download PDF</Button>
            </div>

            {slipData && (
              <div id="slip-print" className="border border-border rounded-md p-5 bg-white text-zinc-900 text-sm">
                {slipOpen && <PrintStyle targetId="slip-print" kind="nota" />}
                <div className="text-center mb-3">
                  <div className="font-display font-black text-lg">{slipData.shop.name}</div>
                  {slipData.shop.address && <div className="text-[10px] text-zinc-500">{slipData.shop.address}</div>}
                  <div className="text-xs font-bold mt-1 uppercase tracking-wider border-t border-b border-dashed border-zinc-300 py-1">SLIP GAJI TEKNISI</div>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-xs mb-3">
                  <div><span className="text-zinc-500">Nama:</span> <b>{slipData.technician.name}</b></div>
                  <div><span className="text-zinc-500">% Komisi:</span> <b>{slipData.technician.commission_percent}%</b></div>
                  <div><span className="text-zinc-500">Periode:</span> <b>{slipData.period.start} s/d {slipData.period.end}</b></div>
                  <div><span className="text-zinc-500">Jumlah Job:</span> <b>{slipData.job_count}</b></div>
                </div>

                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">Rincian Service</div>
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="text-left border border-zinc-300 px-1 py-0.5">Tgl</th>
                      <th className="text-left border border-zinc-300 px-1 py-0.5">No Service</th>
                      <th className="text-left border border-zinc-300 px-1 py-0.5">Pelanggan</th>
                      <th className="text-left border border-zinc-300 px-1 py-0.5">Device</th>
                      <th className="text-right border border-zinc-300 px-1 py-0.5">B. Jasa</th>
                      <th className="text-right border border-zinc-300 px-1 py-0.5">Komisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slipData.services.length === 0 && (
                      <tr><td colSpan={6} className="border border-zinc-300 text-center py-2 text-zinc-400">Tidak ada service pada periode ini</td></tr>
                    )}
                    {slipData.services.map((s, i) => (
                      <tr key={i}>
                        <td className="border border-zinc-300 px-1">{(s.date || "").slice(0, 10)}</td>
                        <td className="border border-zinc-300 px-1 font-mono">{s.service_number}</td>
                        <td className="border border-zinc-300 px-1">{s.customer_name}</td>
                        <td className="border border-zinc-300 px-1">{s.brand_model}</td>
                        <td className="border border-zinc-300 px-1 text-right font-mono">{fmtIDR(s.service_fee)}</td>
                        <td className="border border-zinc-300 px-1 text-right font-mono">{fmtIDR(s.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-bold">
                    <tr>
                      <td colSpan={4} className="border border-zinc-300 px-1 text-right">TOTAL</td>
                      <td className="border border-zinc-300 px-1 text-right font-mono">{fmtIDR(slipData.total_service_fee)}</td>
                      <td className="border border-zinc-300 px-1 text-right font-mono">{fmtIDR(slipData.total_commission)}</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="mt-4 p-2 rounded bg-emerald-50 border border-emerald-200 flex justify-between font-bold">
                  <span>TOTAL KOMISI (GAJI)</span>
                  <span className="font-mono">{fmtIDR(slipData.total_commission)}</span>
                </div>

                <div className="mt-4 pt-2 border-t border-dashed border-zinc-300 grid grid-cols-2 text-[10px] text-zinc-600">
                  <div>
                    <div>Diterbitkan oleh: <b>{slipData.generated_by}</b></div>
                    <div>{fmtDate(slipData.generated_at)}</div>
                  </div>
                  <div className="text-right">
                    Tanda Tangan Teknisi
                    <div className="mt-8 border-b border-zinc-400 w-32 ml-auto"></div>
                    <div className="mt-1">{slipData.technician.name}</div>
                  </div>
                </div>
              </div>
            )}

            {slipData && (
              <Button onClick={() => window.print()} className="w-full gap-2" data-testid="slip-print-btn"><Printer className="size-4" />Cetak</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
