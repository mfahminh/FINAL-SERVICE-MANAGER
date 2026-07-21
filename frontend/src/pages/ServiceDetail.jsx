import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import api, { fmtDate, fmtIDR, STATUS_COLORS, SERVICE_STATUSES, maskPhone } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Stethoscope, Wrench, Package, Receipt, CheckSquare, QrCode as QrIcon, Send, Printer, Hand, UserCog, Tag, X, Pencil, ClipboardCheck, ShieldCheck, ShieldAlert, FileText, Check, Bluetooth } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import ServiceLabel from "@/components/ServiceLabel";
import PrintStyle from "@/components/PrintStyle";
import { sendRaw, buildFinalServiceNota, buildServiceIntakeReceipt } from "@/lib/escpos";
import { printBluetoothRaw, isBluetoothAvailable } from "@/lib/bluetooth";
import { QC_CHECKLIST, QC_ITEMS_FLAT } from "@/constants/qcChecklist";

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { settings } = useBranding();
  const [svc, setSvc] = useState(null);
  const [spareparts, setSpareparts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [labelOpen, setLabelOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diag, setDiag] = useState({ diagnosis: "", damage: "", action: "", estimated_cost: 0, estimated_days: 1, internal_notes: "" });
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: 0, method: "cash", type: "pelunasan", note: "" });
  const [partOpen, setPartOpen] = useState(false);
  const [part, setPart] = useState({ sparepart_id: "", qty: 1 });
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickup, setPickup] = useState({ unit_ok: false, paid: false, warranty_explained: false, warranty_days: 30 });
  const [qrOpen, setQrOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [feeValue, setFeeValue] = useState(0);
  const [cancelItem, setCancelItem] = useState(null);
  const [cancelState, setCancelState] = useState({ open: false, reason: "", action: "return" });
  const [notaOpen, setNotaOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [qcItems, setQcItems] = useState({});
  const [qcNotes, setQcNotes] = useState({});
  const [qcOverall, setQcOverall] = useState("");
  const [notaFinalOpen, setNotaFinalOpen] = useState(false);

  const usbPrint = async (builderFn) => {
    try {
      const bytesData = builderFn();
      await sendRaw(bytesData);
      toast.success("Terkirim ke printer USB");
    } catch (e) {
      toast.error(e.message || "Gagal print via USB");
    }
  };

  const btPrint = async (builderFn) => {
    try {
      const bytesData = builderFn();
      await printBluetoothRaw(bytesData);
      toast.success("Terkirim ke printer Bluetooth");
    } catch (e) {
      toast.error(e.message || "Gagal print via Bluetooth");
    }
  };

  const canEditFee = user?.role === "owner" || user?.role === "admin";
  const canCancelPart = ["owner", "admin", "teknisi"].includes(user?.role);
  const isCancelled = svc?.status === "Dibatalkan";
  const canUpdateStatus = user?.role === "owner" || user?.role === "admin";
  const canDoQC = user?.role === "owner" || user?.role === "admin";

  const load = async () => {
    const r = await api.get(`/services/${id}`);
    setSvc(r.data);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); api.get("/spareparts").then(r => setSpareparts(r.data)); api.get("/technicians").then(r => setTechnicians(r.data)).catch(()=>{});  }, [id]);

  // Auto-open QC dialog when navigated with ?tab=qc
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (svc && searchParams.get("tab") === "qc" && svc.status === "Quality Control" && canDoQC) {
      openQC();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc?.id, svc?.status]);

  if (!svc) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;

  const claimJob = async () => {
    try { await api.post(`/services/${id}/claim`); toast.success("Pekerjaan diambil"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  const assignTech = async (technician_id) => {
    try { await api.post(`/services/${id}/assign`, { technician_id }); toast.success("Teknisi di-assign"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const updateStatus = async (status) => {
    try {
      await api.patch(`/services/${id}/status`, { status, note: "" });
      toast.success(`Status: ${status}`); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const handleStatusSelect = (status) => {
    if (status === svc.status) return;
    if (status === "Dibatalkan") {
      // Buka dialog konfirmasi
      setCancelState({
        open: true,
        reason: "",
        action: (svc.items_used || []).length > 0 ? "return" : "none",
      });
      return;
    }
    updateStatus(status);
  };

  const confirmCancel = async () => {
    try {
      const payload = { status: "Dibatalkan", note: cancelState.reason || "" };
      if ((svc.items_used || []).length > 0) {
        payload.sparepart_action = cancelState.action;
      }
      const r = await api.patch(`/services/${id}/status`, payload);
      toast.success("Service dibatalkan");
      const updated = r.data;
      const shouldPrintNota = (svc.items_used || []).length > 0 && cancelState.action === "charge";
      setCancelState({ open: false, reason: "", action: "return" });
      // Reload lalu tampilkan nota bila charge
      if (shouldPrintNota) {
        setSvc(updated);
        setNotaOpen(true);
      } else {
        load();
      }
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal membatalkan"); }
  };

  const submitDiag = async () => {
    try {
      await api.post(`/services/${id}/diagnose`, { ...diag, estimated_cost: Number(diag.estimated_cost), estimated_days: Number(diag.estimated_days) });
      toast.success("Diagnosa tersimpan"); setDiagOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const finishWork = async () => {
    try {
      await api.post(`/services/${id}/finish-work`);
      toast.success("Pekerjaan selesai, menunggu QC");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const openQC = () => {
    // Pre-populate from previous qc_result if any so re-QC keeps state
    const prev = svc?.qc_result;
    const seedItems = {};
    const seedNotes = {};
    QC_ITEMS_FLAT.forEach((it) => {
      const found = (prev?.items || []).find((p) => p.key === it.key);
      seedItems[it.key] = found ? found.ok : true;
      seedNotes[it.key] = found?.note || "";
    });
    setQcItems(seedItems);
    setQcNotes(seedNotes);
    setQcOverall(prev?.overall_note || "");
    setQcOpen(true);
  };

  const submitQC = async () => {
    try {
      const payload = {
        items: QC_ITEMS_FLAT.map((it) => ({
          key: it.key,
          name: it.name,
          ok: !!qcItems[it.key],
          note: qcNotes[it.key] || "",
        })),
        overall_note: qcOverall || "",
      };
      await api.post(`/services/${id}/qc`, payload);
      const allOk = payload.items.every((x) => x.ok);
      toast.success(allOk ? "QC PASS — Service siap diambil" : "QC FAIL — Dikembalikan ke teknisi");
      setQcOpen(false);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal simpan QC"); }
  };

  const markAll = (ok) => {
    const next = {};
    QC_ITEMS_FLAT.forEach((it) => { next[it.key] = ok; });
    setQcItems(next);
  };

  const submitPay = async () => {
    try {
      await api.post("/payments", { ...pay, service_id: id, amount: Number(pay.amount) });
      toast.success("Pembayaran tercatat"); setPayOpen(false); setPay({ amount: 0, method: "cash", type: "pelunasan", note: "" }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const usePart = async () => {
    try {
      const sp = spareparts.find((s) => s.id === part.sparepart_id);
      if (!sp) return toast.error("Pilih sparepart");
      await api.post(`/services/${id}/use-sparepart`, {
        sparepart_id: sp.id, name: sp.name, qty: Number(part.qty), price: sp.sell_price
      });
      toast.success("Sparepart digunakan"); setPartOpen(false); setPart({ sparepart_id: "", qty: 1 }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const submitCancelPart = async () => {
    if (!cancelItem) return;
    try {
      await api.delete(`/services/${id}/items/${cancelItem.id}`);
      toast.success("Penggunaan sparepart dibatalkan, stok dikembalikan");
      setCancelItem(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal membatalkan"); }
  };

  const submitFee = async () => {
    try {
      await api.patch(`/services/${id}/service-fee`, { service_fee: Number(feeValue) });
      toast.success("Biaya jasa diperbarui");
      setFeeOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const openFeeDialog = () => {
    setFeeValue(svc.service_fee ?? svc.estimated_cost ?? 0);
    setFeeOpen(true);
  };

  const doPickup = async () => {
    try {
      await api.post(`/services/${id}/pickup`, pickup);
      toast.success("Unit diserahkan"); setPickupOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Checklist belum lengkap"); }
  };

  const sendWA = async (template) => {
    const messages = {
      diagnose: `Halo ${svc.customer_name},\n\nHasil pengecekan HP ${svc.brand} ${svc.model} Anda:\n\nKerusakan: ${svc.diagnosis?.damage || "-"}\nEstimasi biaya: ${fmtIDR(svc.estimated_cost)}\nEstimasi selesai: ${svc.diagnosis?.estimated_days || "-"} hari\n\nBalas YA untuk setuju.`,
      done: `Halo ${svc.customer_name},\n\nService ${svc.service_number} sudah SELESAI dan siap diambil.\nTotal: ${fmtIDR(svc.final_cost)}\n\nTerima kasih.`,
      reminder: `Halo ${svc.customer_name},\n\nReminder: HP Anda (${svc.service_number}) sudah selesai. Mohon segera diambil ya.\n\nTerima kasih.`,
    };
    try {
      const r = await api.post("/whatsapp/send", { phone: svc.customer_phone, message: messages[template], service_id: id });
      if (r.data?.ok) {
        const prov = r.data.provider || "mock";
        toast.success(prov === "fonnte" ? "Pesan WA terkirim via Fonnte" : "Pesan WA (mode mock — atur token di Settings)");
      } else {
        toast.error(`Gagal kirim: ${r.data?.error || "unknown"}`);
      }
    } catch (e) { toast.error("Gagal kirim"); }
  };

  const trackUrl = `${window.location.origin}/track/${svc.service_number}`;
  const sisaRaw = (svc.final_cost || 0) - (svc.total_paid || 0);
  const sisa = Math.max(0, sisaRaw);
  const kembali = Math.max(0, -sisaRaw);

  return (
    <div className="space-y-5" data-testid="service-detail-page">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/services")} className="gap-1 -ml-3"><ArrowLeft className="size-4" /> Kembali</Button>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold mt-2">{svc.brand} {svc.model}</div>
          <h1 className="font-display font-black text-3xl tracking-tight font-mono">{svc.service_number}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`status-pill ${STATUS_COLORS[svc.status]}`}>{svc.status}</span>
            <span className="text-xs text-muted-foreground">{fmtDate(svc.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={labelOpen} onOpenChange={setLabelOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2" data-testid="label-btn"><Tag className="size-4" />Label</Button></DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Label Service</DialogTitle></DialogHeader>
              <ServiceLabel service={svc} shopName={settings.shop_name || settings.app_name || "Service HP"} />
            </DialogContent>
          </Dialog>
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2" data-testid="qr-btn"><QrIcon className="size-4" />QR / Cetak</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Tanda Terima Service</DialogTitle></DialogHeader>
              <div id="receipt-print" className="border border-border rounded-md p-5 text-center bg-white text-zinc-900">
                {qrOpen && <PrintStyle targetId="receipt-print" kind="qr" />}
                <div className="font-display font-black text-lg">SERVICE HP MANAGER</div>
                <div className="text-xs">Tanda Terima Service</div>
                <div className="my-3 flex justify-center"><QRCodeSVG value={trackUrl} size={140} /></div>
                <div className="font-mono font-bold text-lg">{svc.service_number}</div>
                <div className="text-xs mt-2">{svc.customer_name} • {maskPhone(svc.customer_phone, user?.role)}</div>
                <div className="text-xs">{svc.brand} {svc.model} • {svc.color}</div>
                <div className="text-xs mt-2">Estimasi: {fmtIDR(svc.estimated_cost)}</div>
                <div className="text-[10px] text-zinc-500 mt-3">Scan untuk tracking status</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => window.print()} className="gap-2" data-testid="qr-print-btn"><Printer className="size-4" />Cetak Biasa</Button>
                <Button variant="outline" onClick={() => usbPrint(() => buildServiceIntakeReceipt(svc, settings, trackUrl))} className="gap-2" data-testid="qr-usb-print-btn" title="Print langsung via USB (ESC/POS)"><Printer className="size-4" />USB</Button>
                {isBluetoothAvailable() && <Button variant="secondary" onClick={() => btPrint(() => buildServiceIntakeReceipt(svc, settings, trackUrl))} className="gap-2 col-span-2" data-testid="qr-bt-print-btn" title="Print langsung via Bluetooth"><Bluetooth className="size-4" />Bluetooth</Button>}
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => sendWA("diagnose")} data-testid="send-wa-btn"><Send className="size-4" />Kirim WA</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 border border-border">
            <h3 className="font-display font-bold text-lg mb-3">Informasi</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Pelanggan</div><div className="font-semibold">{svc.customer_name}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">No HP</div><div className="font-mono" data-testid="customer-phone-display">{maskPhone(svc.customer_phone, user?.role)}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Device</div><div>{svc.brand} {svc.model}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">IMEI 1</div><div className="font-mono text-xs">{svc.imei1 || "-"}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Warna</div><div>{svc.color || "-"}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Kelengkapan</div><div className="text-xs">{svc.accessories?.join(", ") || "-"}</div></div>
              <div className="col-span-full"><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Keluhan</div><div>{svc.complaint}</div></div>
            </div>
          </Card>

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
              <TabsTrigger value="diagnose" data-testid="tab-diagnose" disabled={isCancelled}>Diagnosa</TabsTrigger>
              <TabsTrigger value="parts" data-testid="tab-parts" disabled={isCancelled}>Sparepart</TabsTrigger>
              <TabsTrigger value="payments" data-testid="tab-payments" disabled={isCancelled}>Pembayaran</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card className="p-5 border border-border">
                <div className="space-y-3">
                  {svc.status_history?.map((h, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`size-3 rounded-full ${i === svc.status_history.length - 1 ? "bg-primary" : "bg-emerald-500"}`} />
                        {i < svc.status_history.length - 1 && <div className="flex-1 w-px bg-border my-1" />}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="text-sm font-semibold">{h.status}</div>
                        <div className="text-xs text-muted-foreground">{h.by} • {fmtDate(h.at)}</div>
                        {h.note && <div className="text-xs mt-1 text-muted-foreground">{h.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="diagnose">
              <Card className="p-5 border border-border">
                {svc.diagnosis ? (
                  <div className="space-y-3 text-sm">
                    <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Hasil Diagnosa</div><div>{svc.diagnosis.diagnosis}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Kerusakan</div><div>{svc.diagnosis.damage}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Tindakan</div><div>{svc.diagnosis.action}</div></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Estimasi Biaya</div><div className="font-mono font-bold">{fmtIDR(svc.diagnosis.estimated_cost)}</div></div>
                      <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Estimasi Waktu</div><div>{svc.diagnosis.estimated_days} hari</div></div>
                    </div>
                    <div className="text-xs text-muted-foreground">Oleh {svc.diagnosis.by} • {fmtDate(svc.diagnosis.at)}</div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">Belum ada diagnosa</div>
                )}
                {(user?.role === "teknisi" || user?.role === "owner" || user?.role === "admin") && (
                  <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
                    <DialogTrigger asChild><Button className="mt-4 w-full gap-2" data-testid="add-diagnose-btn"><Stethoscope className="size-4" />{svc.diagnosis ? "Update" : "Buat"} Diagnosa</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Diagnosa Teknisi</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>Hasil Diagnosa</Label><Textarea rows={2} value={diag.diagnosis} onChange={(e) => setDiag({ ...diag, diagnosis: e.target.value })} data-testid="diag-result" /></div>
                        <div><Label>Kerusakan</Label><Input value={diag.damage} onChange={(e) => setDiag({ ...diag, damage: e.target.value })} data-testid="diag-damage" /></div>
                        <div><Label>Tindakan</Label><Input value={diag.action} onChange={(e) => setDiag({ ...diag, action: e.target.value })} data-testid="diag-action" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Estimasi Biaya</Label><Input type="number" value={diag.estimated_cost} onChange={(e) => setDiag({ ...diag, estimated_cost: e.target.value })} data-testid="diag-cost" /></div>
                          <div><Label>Hari</Label><Input type="number" value={diag.estimated_days} onChange={(e) => setDiag({ ...diag, estimated_days: e.target.value })} data-testid="diag-days" /></div>
                        </div>
                        <div><Label>Catatan Internal</Label><Textarea rows={2} value={diag.internal_notes} onChange={(e) => setDiag({ ...diag, internal_notes: e.target.value })} /></div>
                        <Button onClick={submitDiag} className="w-full" data-testid="submit-diag-btn">Simpan</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="parts">
              <Card className="p-5 border border-border">
                <div className="space-y-2">
                  {svc.items_used?.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">Belum ada sparepart</div>}
                  {svc.items_used?.map((it, i) => (
                    <div key={it.id || i} className="flex items-center justify-between p-3 border border-border rounded-md text-sm gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {it.qty}
                          {it.used_by && <> • Oleh {it.used_by}</>}
                        </div>
                      </div>
                      <div className="font-mono font-bold whitespace-nowrap">{fmtIDR(it.price * it.qty)}</div>
                      {canCancelPart && it.id && svc.status !== "Sudah Diambil" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                          onClick={() => setCancelItem(it)}
                          data-testid={`cancel-part-btn-${it.id}`}
                          title="Batalkan penggunaan sparepart"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Dialog open={partOpen} onOpenChange={setPartOpen}>
                  <DialogTrigger asChild><Button variant="outline" className="mt-4 w-full gap-2" data-testid="use-part-btn"><Package className="size-4" />Pakai Sparepart</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Pakai Sparepart</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Select value={part.sparepart_id} onValueChange={(v) => setPart({ ...part, sparepart_id: v })}>
                        <SelectTrigger data-testid="part-select"><SelectValue placeholder="Pilih sparepart..." /></SelectTrigger>
                        <SelectContent>{spareparts.map((s) => <SelectItem key={s.id} value={s.id} disabled={s.stock <= 0}>{s.name} • Stok: {s.stock} • {fmtIDR(s.sell_price)}</SelectItem>)}</SelectContent>
                      </Select>
                      <div><Label>Qty</Label><Input type="number" value={part.qty} onChange={(e) => setPart({ ...part, qty: e.target.value })} data-testid="part-qty" /></div>
                      <Button onClick={usePart} className="w-full" data-testid="submit-part-btn">Gunakan</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card className="p-5 border border-border">
                <div className="space-y-2">
                  {svc.payments?.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">Belum ada pembayaran</div>}
                  {svc.payments?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-md text-sm">
                      <div>
                        <div className="font-semibold capitalize">{p.type} - {p.method}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(p.created_at)} • {p.by}</div>
                      </div>
                      <div className="font-mono font-bold">{fmtIDR(p.amount)}</div>
                    </div>
                  ))}
                </div>
                {(user?.role === "kasir" || user?.role === "owner" || user?.role === "admin") && (
                  <Dialog open={payOpen} onOpenChange={setPayOpen}>
                    <DialogTrigger asChild><Button className="mt-4 w-full gap-2" data-testid="add-payment-btn"><Receipt className="size-4" />Catat Pembayaran</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Catat Pembayaran</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>Jumlah</Label><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} data-testid="pay-amount" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Metode</Label>
                            <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}>
                              <SelectTrigger data-testid="pay-method"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="transfer">Transfer</SelectItem>
                                <SelectItem value="qris">QRIS</SelectItem>
                                <SelectItem value="ewallet">E-Wallet</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div><Label>Tipe</Label>
                            <Select value={pay.type} onValueChange={(v) => setPay({ ...pay, type: v })}>
                              <SelectTrigger data-testid="pay-type"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dp">DP</SelectItem>
                                <SelectItem value="pelunasan">Pelunasan</SelectItem>
                                <SelectItem value="full">Lunas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button onClick={submitPay} className="w-full" data-testid="submit-pay-btn">Simpan</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          <Card className="p-5 border border-border">
            <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2"><UserCog className="size-4 text-primary" />Teknisi</h3>
            {svc.assigned_technician_name ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold">{svc.assigned_technician_name}</div>
                <div className="text-xs text-muted-foreground">Diambil {fmtDate(svc.assigned_at)}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mb-2">Belum ada teknisi</div>
            )}
            {isCancelled && (
              <div className="mt-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs">
                Service dibatalkan — tidak dapat diambil / di-assign.
              </div>
            )}
            {user?.role === "teknisi" && !svc.assigned_technician_id && !isCancelled && (
              <Button onClick={claimJob} className="w-full gap-2 mt-2" data-testid="claim-job-btn"><Hand className="size-4" />Ambil Pekerjaan</Button>
            )}
            {(user?.role === "owner" || user?.role === "admin") && technicians.length > 0 && !isCancelled && (
              <Select value={svc.assigned_technician_id || ""} onValueChange={assignTech}>
                <SelectTrigger className="mt-2" data-testid="assign-tech-select"><SelectValue placeholder="Assign teknisi..." /></SelectTrigger>
                <SelectContent>{technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Card>

          <Card className="p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-base">Ringkasan Biaya</h3>
              {canEditFee && svc.status !== "Sudah Diambil" && !isCancelled && (
                <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={openFeeDialog} data-testid="edit-fee-btn">
                  <Pencil className="size-3" /> Edit Jasa
                </Button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Biaya Jasa</span><span className="font-mono">{fmtIDR(svc.service_fee ?? svc.estimated_cost ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Sparepart</span><span className="font-mono">{fmtIDR((svc.items_used || []).reduce((a, it) => a + (it.price || 0) * (it.qty || 0), 0))}</span></div>
              <div className="flex justify-between pt-1 border-t border-border"><span className="text-muted-foreground">Total Tagihan</span><span className="font-mono font-bold">{fmtIDR(svc.final_cost)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sudah Dibayar</span><span className="font-mono">{fmtIDR(svc.total_paid)}</span></div>
              {(user?.role === "owner" || user?.role === "admin") && (
                <>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Modal Sparepart</span><span className="font-mono">{fmtIDR(svc.sparepart_cost || 0)}</span></div>
                  <div className="flex justify-between text-sm pt-1 border-t border-border">
                    <span className="text-muted-foreground">Laba Bersih</span>
                    <span className="font-mono font-bold text-emerald-600">{fmtIDR(svc.profit || 0)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-lg pt-2 border-t border-border">
                <span className="font-semibold">{sisa > 0 ? "Sisa Bayar" : "Kembali"}</span>
                <span className={`font-mono font-bold ${sisa > 0 ? "text-orange-600" : "text-emerald-600"}`}>{fmtIDR(sisa > 0 ? sisa : kembali)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 border border-border">
            <h3 className="font-display font-bold text-base mb-3">Status Service</h3>
            {canUpdateStatus ? (
              <Select value={svc.status} onValueChange={handleStatusSelect}>
                <SelectTrigger data-testid="status-select"><SelectValue /></SelectTrigger>
                <SelectContent>{SERVICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className={`status-pill ${STATUS_COLORS[svc.status] || ""} text-sm px-3 py-2 inline-flex`} data-testid="status-readonly">
                {svc.status}
              </div>
            )}

            {/* Teknisi: Selesai Mengerjakan button */}
            {user?.role === "teknisi" && svc.assigned_technician_id && !isCancelled &&
              ["Sedang Diagnosa", "Menunggu Persetujuan", "Menunggu Sparepart", "Sedang Dikerjakan"].includes(svc.status) && (
                <Button onClick={finishWork} className="w-full gap-2 mt-3" data-testid="finish-work-btn">
                  <Check className="size-4" />
                  Selesai Mengerjakan
                </Button>
            )}

            {/* QC FAIL banner for teknisi */}
            {svc.qc_failed && svc.status === "Sedang Dikerjakan" && (user?.role === "teknisi" || canDoQC) && (
              <div className="mt-3 p-3 rounded-md bg-red-500/10 border border-red-500/30" data-testid="qc-fail-banner">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm mb-1">
                  <ShieldAlert className="size-4" /> QC GAGAL
                </div>
                {svc.qc_result?.failed_items?.length > 0 && (
                  <ul className="text-xs text-red-700/90 dark:text-red-400/90 list-disc list-inside space-y-0.5">
                    {svc.qc_result.failed_items.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                )}
                {svc.qc_result?.overall_note && (
                  <div className="text-xs mt-2 italic">Catatan QC: {svc.qc_result.overall_note}</div>
                )}
              </div>
            )}
          </Card>

          {/* QC Action Card - visible to owner/admin when status = QC */}
          {canDoQC && svc.status === "Quality Control" && (
            <Card className="p-5 border border-primary/40 bg-primary/5">
              <h3 className="font-display font-bold text-base mb-2 flex items-center gap-2"><ClipboardCheck className="size-4 text-primary" />Quality Control</h3>
              <p className="text-xs text-muted-foreground mb-3">Lakukan pemeriksaan checklist fungsi HP sebelum diserahkan ke pelanggan.</p>
              <Button onClick={openQC} className="w-full gap-2" data-testid="start-qc-btn"><ClipboardCheck className="size-4" />Mulai QC</Button>
            </Card>
          )}

          {svc.qc_passed && svc.qc_result && (
            <Card className="p-5 border border-emerald-500/40 bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="size-5 text-emerald-600" />
                <h3 className="font-display font-bold text-base">QC Lulus</h3>
              </div>
              <div className="text-xs text-muted-foreground">Oleh {svc.qc_result.by} • {fmtDate(svc.qc_result.at)}</div>
              {canDoQC && (
                <Button variant="ghost" size="sm" className="mt-2 gap-1 h-8 px-2 text-xs" onClick={openQC} data-testid="reQC-btn">
                  <ClipboardCheck className="size-3" /> Lihat / QC Ulang
                </Button>
              )}
            </Card>
          )}

          {svc.status === "Selesai" && ["kasir", "admin", "owner"].includes(user?.role) && (
            <Card className="p-5 border border-border">
              <h3 className="font-display font-bold text-base mb-3">Pengambilan Unit</h3>
              <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
                <DialogTrigger asChild><Button className="w-full gap-2" data-testid="pickup-btn"><CheckSquare className="size-4" />Proses Pengambilan</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Checklist Pengambilan</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={pickup.unit_ok} onCheckedChange={(v) => setPickup({ ...pickup, unit_ok: !!v })} data-testid="cb-unit" />Unit sesuai dan berfungsi normal</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={pickup.paid} onCheckedChange={(v) => setPickup({ ...pickup, paid: !!v })} data-testid="cb-paid" />Pembayaran sudah lunas</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={pickup.warranty_explained} onCheckedChange={(v) => setPickup({ ...pickup, warranty_explained: !!v })} data-testid="cb-warranty" />Garansi sudah dijelaskan</label>
                    <div><Label>Garansi (hari)</Label>
                      <Select value={String(pickup.warranty_days)} onValueChange={(v) => setPickup({ ...pickup, warranty_days: Number(v) })}>
                        <SelectTrigger data-testid="warranty-days"><SelectValue /></SelectTrigger>
                        <SelectContent>{[7, 14, 30, 60, 90].map(d => <SelectItem key={d} value={String(d)}>{d} Hari</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button onClick={doPickup} className="w-full" data-testid="confirm-pickup-btn">Konfirmasi</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          )}

          {svc.status === "Sudah Diambil" && (
            <Card className="p-5 border border-border">
              <h3 className="font-display font-bold text-base mb-3">Nota Service</h3>
              <p className="text-xs text-muted-foreground mb-3">Nota service final berisi data pelanggan, HP, biaya, dan hasil QC.</p>
              <Button onClick={() => setNotaFinalOpen(true)} className="w-full gap-2" data-testid="open-nota-final-btn"><FileText className="size-4" />Cetak Nota Service</Button>
            </Card>
          )}

          {svc.warranty_until && (
            <Card className="p-5 border border-border bg-emerald-500/5">
              <h3 className="font-display font-bold text-base mb-2">Garansi Aktif</h3>
              <div className="text-sm">{svc.warranty_days} hari</div>
              <div className="text-xs text-muted-foreground">Hingga {fmtDate(svc.warranty_until)}</div>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Biaya Jasa Dialog */}
      <Dialog open={feeOpen} onOpenChange={setFeeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Biaya Jasa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Biaya Jasa (Rp)</Label>
              <Input
                type="number"
                min="0"
                value={feeValue}
                onChange={(e) => setFeeValue(e.target.value)}
                data-testid="fee-input"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Total tagihan akan dihitung ulang: Biaya Jasa + Total Sparepart.
              </p>
            </div>
            <div className="text-sm p-3 rounded-md bg-muted/50 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Biaya Jasa Baru</span><span className="font-mono">{fmtIDR(Number(feeValue) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Sparepart</span><span className="font-mono">{fmtIDR((svc.items_used || []).reduce((a, it) => a + (it.price || 0) * (it.qty || 0), 0))}</span></div>
              <div className="flex justify-between pt-1 border-t border-border font-bold"><span>Total Tagihan</span><span className="font-mono">{fmtIDR((Number(feeValue) || 0) + (svc.items_used || []).reduce((a, it) => a + (it.price || 0) * (it.qty || 0), 0))}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFeeOpen(false)} className="flex-1" data-testid="fee-cancel-btn">Batal</Button>
              <Button onClick={submitFee} className="flex-1" data-testid="fee-submit-btn">Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel sparepart usage confirmation */}
      <Dialog open={!!cancelItem} onOpenChange={(o) => !o && setCancelItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Batalkan Penggunaan Sparepart</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Anda akan membatalkan penggunaan sparepart:
            </p>
            <div className="p-3 rounded-md bg-muted/50">
              <div className="font-semibold">{cancelItem?.name}</div>
              <div className="text-xs text-muted-foreground">Qty: {cancelItem?.qty} • {fmtIDR((cancelItem?.price || 0) * (cancelItem?.qty || 0))}</div>
            </div>
            <p className="text-muted-foreground text-xs">
              Stok sparepart akan dikembalikan sebanyak {cancelItem?.qty} unit dan total tagihan akan dihitung ulang.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCancelItem(null)} className="flex-1" data-testid="cancel-part-back-btn">Tidak</Button>
              <Button variant="destructive" onClick={submitCancelPart} className="flex-1" data-testid="cancel-part-confirm-btn">Ya, Batalkan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Service (status → Dibatalkan) confirmation */}
      <Dialog open={cancelState.open} onOpenChange={(o) => setCancelState((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Batalkan Service?</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs">
              Status service akan diubah menjadi <strong>Dibatalkan</strong>. Aksi ini akan dicatat pada timeline dan audit log.
            </div>

            {(svc.items_used || []).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Sparepart Sudah Terpakai ({(svc.items_used || []).length})</div>
                <div className="max-h-32 overflow-auto space-y-1 border border-border rounded-md p-2">
                  {svc.items_used.map((it, i) => (
                    <div key={it.id || i} className="flex justify-between text-xs">
                      <span>{it.name} × {it.qty}</span>
                      <span className="font-mono">{fmtIDR((it.price || 0) * (it.qty || 0))}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground pt-2">Pilihan Sparepart</div>
                <div className="grid grid-cols-1 gap-2">
                  <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${cancelState.action === "return" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}>
                    <input
                      type="radio"
                      name="cancel-action"
                      value="return"
                      checked={cancelState.action === "return"}
                      onChange={() => setCancelState((s) => ({ ...s, action: "return" }))}
                      className="mt-1"
                      data-testid="cancel-action-return"
                    />
                    <div>
                      <div className="font-semibold">Kembalikan ke Stok Sparepart</div>
                      <div className="text-xs text-muted-foreground">Semua sparepart terpakai akan dikembalikan ke gudang. Tagihan menjadi biaya jasa saja.</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${cancelState.action === "charge" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}>
                    <input
                      type="radio"
                      name="cancel-action"
                      value="charge"
                      checked={cancelState.action === "charge"}
                      onChange={() => setCancelState((s) => ({ ...s, action: "charge" }))}
                      className="mt-1"
                      data-testid="cancel-action-charge"
                    />
                    <div>
                      <div className="font-semibold">Bebankan ke Pelanggan</div>
                      <div className="text-xs text-muted-foreground">Sparepart tetap dihitung sebagai tagihan. Nota pembatalan akan otomatis dibuka untuk dicetak.</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div>
              <Label>Alasan Pembatalan <span className="text-muted-foreground font-normal">(opsional)</span></Label>
              <Textarea
                rows={2}
                value={cancelState.reason}
                onChange={(e) => setCancelState((s) => ({ ...s, reason: e.target.value }))}
                placeholder="Contoh: Pelanggan urung, harga tidak setuju, dsb."
                data-testid="cancel-reason"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCancelState((s) => ({ ...s, open: false }))} className="flex-1" data-testid="cancel-svc-back-btn">Tidak Jadi</Button>
              <Button variant="destructive" onClick={confirmCancel} className="flex-1" data-testid="cancel-svc-confirm-btn">Ya, Batalkan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nota Pembatalan (dibebankan ke pelanggan) */}
      <Dialog open={notaOpen} onOpenChange={(o) => { setNotaOpen(o); if (!o) load(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nota Pembatalan Service</DialogTitle></DialogHeader>
          <div id="nota-cancel-print" className="border border-border rounded-md p-5 bg-white text-zinc-900 text-sm">
            {notaOpen && <PrintStyle targetId="nota-cancel-print" kind="nota" />}
            <div className="text-center">
              <div className="font-display font-black text-lg">{settings?.print_header_title || settings?.shop_name || settings?.app_name || "SERVICE HP MANAGER"}</div>
              {settings?.print_header_subtitle && <div className="text-[10px] text-zinc-500">{settings.print_header_subtitle}</div>}
              {(settings?.print_header_address || settings?.address) && <div className="text-[10px] text-zinc-500">{settings?.print_header_address || settings?.address}</div>}
              {(settings?.print_header_phone || settings?.whatsapp) && <div className="text-[10px] text-zinc-500">Telp: {settings?.print_header_phone || settings?.whatsapp}</div>}
              <div className="text-xs font-semibold mt-1 uppercase tracking-wider">Nota Pembatalan</div>
            </div>
            <div className="border-t border-b border-dashed border-zinc-300 my-3 py-2 space-y-1 text-xs">
              <div className="flex justify-between"><span>No. Service</span><span className="font-mono font-bold">{svc.service_number}</span></div>
              <div className="flex justify-between"><span>Tanggal</span><span>{fmtDate(new Date().toISOString())}</span></div>
              <div className="flex justify-between"><span>Pelanggan</span><span>{svc.customer_name}</span></div>
              <div className="flex justify-between"><span>Device</span><span>{svc.brand} {svc.model}</span></div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Detail Biaya</div>
              {(svc.items_used || []).map((it, i) => (
                <div key={it.id || i} className="flex justify-between text-xs">
                  <span>{it.name} × {it.qty}</span>
                  <span className="font-mono">{fmtIDR((it.price || 0) * (it.qty || 0))}</span>
                </div>
              ))}
              {Number(svc.service_fee || 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span>Biaya Jasa</span>
                  <span className="font-mono">{fmtIDR(svc.service_fee || 0)}</span>
                </div>
              )}
            </div>
            <div className="border-t border-dashed border-zinc-300 mt-3 pt-2 text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span>TOTAL TAGIHAN</span>
                <span className="font-mono">{fmtIDR(svc.final_cost || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sudah Dibayar</span>
                <span className="font-mono">{fmtIDR(svc.total_paid || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600">
                <span>SISA HARUS DIBAYAR</span>
                <span className="font-mono">{fmtIDR(Math.max(0, (svc.final_cost || 0) - (svc.total_paid || 0)))}</span>
              </div>
            </div>
            {cancelState.reason && (
              <div className="mt-3 pt-2 border-t border-dashed border-zinc-300 text-[10px]">
                <div className="text-zinc-500">Alasan: {cancelState.reason}</div>
              </div>
            )}
            <div className="text-center text-[10px] text-zinc-500 mt-4">
              Terima kasih atas pengertiannya.
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => { setNotaOpen(false); load(); }} className="flex-1" data-testid="nota-close-btn">Tutup</Button>
            <Button onClick={() => window.print()} className="flex-1 gap-2" data-testid="nota-print-btn"><Printer className="size-4" />Cetak</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quality Control checklist dialog */}
      <Dialog open={qcOpen} onOpenChange={setQcOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" />Quality Control Checklist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
              <div className="text-sm">
                <div className="font-semibold">{svc.brand} {svc.model} — {svc.service_number}</div>
                <div className="text-xs text-muted-foreground">Teknisi: {svc.assigned_technician_name || "-"}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => markAll(true)} data-testid="qc-mark-all-ok">Semua Normal</Button>
                <Button variant="outline" size="sm" onClick={() => markAll(false)} data-testid="qc-mark-all-fail">Reset (Error)</Button>
              </div>
            </div>

            <div className="space-y-4">
              {QC_CHECKLIST.map((cat) => (
                <div key={cat.category}>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold mb-2">{cat.category}</div>
                  <div className="space-y-1">
                    {cat.items.map((it) => {
                      const ok = !!qcItems[it.key];
                      return (
                        <div key={it.key} className={`border rounded-md p-3 transition ${ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"}`}>
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              <Checkbox
                                checked={ok}
                                onCheckedChange={(v) => setQcItems({ ...qcItems, [it.key]: !!v })}
                                data-testid={`qc-item-${it.key}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{it.name}</div>
                                {ok ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Normal</span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Error</span>
                                )}
                              </div>
                              {!ok && (
                                <Input
                                  className="mt-2 h-8 text-xs"
                                  placeholder="Catatan error (opsional)"
                                  value={qcNotes[it.key] || ""}
                                  onChange={(e) => setQcNotes({ ...qcNotes, [it.key]: e.target.value })}
                                  data-testid={`qc-note-${it.key}`}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label>Catatan QC Keseluruhan (opsional)</Label>
              <Textarea rows={2} value={qcOverall} onChange={(e) => setQcOverall(e.target.value)} placeholder="Contoh: unit siap serah terima, atau catatan khusus untuk pelanggan..." data-testid="qc-overall-note" />
            </div>

            <div className="p-3 rounded-md bg-muted/50 text-xs">
              <div className="flex justify-between">
                <span>Total item</span><span className="font-mono">{QC_ITEMS_FLAT.length}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Normal</span>
                <span className="font-mono">{QC_ITEMS_FLAT.filter((x) => qcItems[x.key]).length}</span>
              </div>
              <div className="flex justify-between text-red-700 dark:text-red-400">
                <span>Error</span>
                <span className="font-mono">{QC_ITEMS_FLAT.filter((x) => !qcItems[x.key]).length}</span>
              </div>
            </div>

            <div className="flex gap-2 sticky bottom-0 bg-background pt-2">
              <Button variant="outline" onClick={() => setQcOpen(false)} className="flex-1" data-testid="qc-cancel-btn">Batal</Button>
              <Button onClick={submitQC} className="flex-1 gap-2" data-testid="qc-submit-btn">
                <ShieldCheck className="size-4" />Simpan Hasil QC
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nota Service Final (after pickup) */}
      <Dialog open={notaFinalOpen} onOpenChange={setNotaFinalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nota Service</DialogTitle></DialogHeader>
          <div id="nota-final-print" className="border border-border rounded-md p-5 bg-white text-zinc-900 text-sm">
            {notaFinalOpen && <PrintStyle targetId="nota-final-print" kind="nota" />}
            <div className="text-center">
              <div className="font-display font-black text-lg">{settings?.print_header_title || settings?.shop_name || settings?.app_name || "SERVICE HP MANAGER"}</div>
              {settings?.print_header_subtitle && <div className="text-[10px] text-zinc-500">{settings.print_header_subtitle}</div>}
              {(settings?.print_header_address || settings?.address) && <div className="text-[10px] text-zinc-500">{settings?.print_header_address || settings?.address}</div>}
              {(settings?.print_header_phone || settings?.whatsapp) && <div className="text-[10px] text-zinc-500">Telp: {settings?.print_header_phone || settings?.whatsapp}</div>}
              <div className="text-xs font-semibold mt-1 uppercase tracking-wider">NOTA SERVICE</div>
            </div>

            {/* Data pelanggan & device */}
            <div className="border-t border-b border-dashed border-zinc-300 my-3 py-2 space-y-1 text-xs">
              <div className="flex justify-between"><span>No. Service</span><span className="font-mono font-bold">{svc.service_number}</span></div>
              <div className="flex justify-between"><span>Tanggal Selesai</span><span>{fmtDate(svc.pickup?.at || svc.updated_at)}</span></div>
              <div className="flex justify-between"><span>Pelanggan</span><span>{svc.customer_name}</span></div>
              <div className="flex justify-between"><span>No HP</span><span className="font-mono">{svc.customer_phone}</span></div>
              <div className="flex justify-between"><span>Device</span><span>{svc.brand} {svc.model}</span></div>
              {svc.imei1 && <div className="flex justify-between"><span>IMEI</span><span className="font-mono text-[10px]">{svc.imei1}</span></div>}
              {svc.color && <div className="flex justify-between"><span>Warna</span><span>{svc.color}</span></div>}
              <div className="flex justify-between"><span>Keluhan</span><span className="text-right max-w-[60%]">{svc.complaint}</span></div>
              {svc.diagnosis?.action && <div className="flex justify-between"><span>Tindakan</span><span className="text-right max-w-[60%]">{svc.diagnosis.action}</span></div>}
              {svc.assigned_technician_name && <div className="flex justify-between"><span>Teknisi</span><span>{svc.assigned_technician_name}</span></div>}
            </div>

            {/* Ringkasan biaya */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Ringkasan Biaya</div>
              <div className="space-y-1 mt-1">
                <div className="flex justify-between text-xs"><span>Biaya Jasa</span><span className="font-mono">{fmtIDR(svc.service_fee ?? svc.estimated_cost ?? 0)}</span></div>
                {(svc.items_used || []).map((it, i) => (
                  <div key={it.id || i} className="flex justify-between text-xs">
                    <span>{it.name} × {it.qty}</span>
                    <span className="font-mono">{fmtIDR((it.price || 0) * (it.qty || 0))}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-zinc-300 mt-2 pt-1 space-y-0.5 text-xs">
                <div className="flex justify-between font-bold"><span>TOTAL</span><span className="font-mono">{fmtIDR(svc.final_cost || 0)}</span></div>
                <div className="flex justify-between"><span>Dibayar</span><span className="font-mono">{fmtIDR(svc.total_paid || 0)}</span></div>
                <div className="flex justify-between font-bold"><span>Kembali/Sisa</span><span className="font-mono">{fmtIDR(Math.max(0, (svc.total_paid || 0) - (svc.final_cost || 0)))}</span></div>
              </div>
            </div>

            {/* Hasil QC */}
            {svc.qc_result && (
              <div className="mt-3">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
                  <ShieldCheck className="size-3" /> Hasil Quality Control
                  <span className="ml-auto">Oleh {svc.qc_result.by}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[10px]">
                  {svc.qc_result.items?.map((it) => (
                    <div key={it.key} className="flex justify-between">
                      <span className="truncate pr-1">{it.name.length > 24 ? it.name.slice(0, 22) + "…" : it.name}</span>
                      <span className={it.ok ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>{it.ok ? "OK" : "✗"}</span>
                    </div>
                  ))}
                </div>
                {svc.qc_result.overall_note && (
                  <div className="mt-2 text-[10px] italic text-zinc-600">Catatan: {svc.qc_result.overall_note}</div>
                )}
              </div>
            )}

            {/* Garansi */}
            {svc.warranty_until && (
              <div className="mt-3 pt-2 border-t border-dashed border-zinc-300 text-[10px]">
                <div className="font-semibold">Garansi: {svc.warranty_days} hari</div>
                <div className="text-zinc-500">Berlaku hingga {fmtDate(svc.warranty_until)}</div>
                <div className="text-zinc-500 mt-1">Garansi berlaku untuk kerusakan yang sama, tidak berlaku kena air, jatuh, atau kerusakan fisik.</div>
              </div>
            )}

            <div className="text-center text-[10px] text-zinc-500 mt-4 border-t border-dashed border-zinc-300 pt-2">
              {settings?.print_footer_text || "Terima kasih telah menggunakan layanan kami."}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setNotaFinalOpen(false)} className="flex-1" data-testid="nota-final-close">Tutup</Button>
            <Button onClick={() => window.print()} className="flex-1 gap-2" data-testid="nota-final-print"><Printer className="size-4" />Cetak Biasa</Button>
            <Button variant="secondary" onClick={() => usbPrint(() => buildFinalServiceNota(svc, settings))} className="flex-1 gap-2" data-testid="nota-final-usb-print" title="Print langsung via USB (ESC/POS thermal)"><Printer className="size-4" />USB</Button>
            {isBluetoothAvailable() && <Button variant="secondary" onClick={() => btPrint(() => buildFinalServiceNota(svc, settings))} className="flex-1 gap-2" data-testid="nota-final-bt-print" title="Print langsung via Bluetooth"><Bluetooth className="size-4" />Bluetooth</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
