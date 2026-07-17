import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Printer, AlertTriangle, Trash2 } from "lucide-react";

export default function Settings() {
  const [s, setS] = useState(null);
  const { reload } = useBranding();
  const { user } = useAuth();
  const fileRef = useRef();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetKeepUsers, setResetKeepUsers] = useState(true);
  const [resetKeepSettings, setResetKeepSettings] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);

  const save = async () => {
    try { await api.patch("/settings", s); toast.success("Pengaturan tersimpan"); reload(); }
    catch (e) { toast.error("Gagal"); }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    const reader = new FileReader();
    reader.onload = () => setS({ ...s, logo: reader.result });
    reader.readAsDataURL(file);
  };

  const doReset = async () => {
    if (resetInput !== "RESET DATABASE") {
      toast.error("Ketik 'RESET DATABASE' persis untuk mengonfirmasi");
      return;
    }
    setResetLoading(true);
    try {
      const r = await api.post("/admin/reset-database", {
        confirm_text: resetInput,
        keep_users: resetKeepUsers,
        keep_settings: resetKeepSettings,
      });
      toast.success(r.data.message || "Database di-reset");
      setResetOpen(false); setResetInput("");
      // Reload page to refresh state
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal reset");
    } finally { setResetLoading(false); }
  };

  if (!s) return <div className="p-8 text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-5 max-w-3xl" data-testid="settings-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Konfigurasi</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Pengaturan & Branding</h1>
      </div>

      <Card className="p-5 border border-border space-y-4">
        <h3 className="font-display font-bold text-lg">Branding</h3>
        <div className="flex items-center gap-4">
          {s.logo && <img src={s.logo} alt="logo" className="size-16 rounded-lg object-cover border border-border" />}
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={onUpload} data-testid="logo-upload-input" />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2" data-testid="upload-logo-btn"><Upload className="size-4" />Upload Logo</Button>
            <div className="text-xs text-muted-foreground mt-1">PNG/SVG/JPG/WEBP, max 5MB</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Nama Aplikasi</Label><Input value={s.app_name || ""} onChange={(e) => setS({ ...s, app_name: e.target.value })} data-testid="set-app-name" /></div>
          <div><Label>Nama Toko</Label><Input value={s.shop_name || ""} onChange={(e) => setS({ ...s, shop_name: e.target.value })} data-testid="set-shop-name" /></div>
          <div><Label>Warna Primer</Label><Input type="color" value={s.primary_color || "#ea7c1f"} onChange={(e) => setS({ ...s, primary_color: e.target.value })} data-testid="set-primary-color" /></div>
          <div><Label>Warna Sekunder</Label><Input type="color" value={s.secondary_color || "#1e293b"} onChange={(e) => setS({ ...s, secondary_color: e.target.value })} /></div>
          <div><Label>Ukuran Label Default</Label>
            <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={s.label_size || "58mm"} onChange={(e) => setS({ ...s, label_size: e.target.value })}>
              <option value="40x30">40 x 30 mm</option>
              <option value="50x30">50 x 30 mm</option>
              <option value="58mm">58 mm Thermal</option>
              <option value="80mm">80 mm Thermal</option>
              <option value="A4">A4</option>
            </select>
          </div>
          <div><Label>Footer Copyright</Label><Input value={s.footer_text || ""} onChange={(e) => setS({ ...s, footer_text: e.target.value })} /></div>
        </div>
      </Card>

      <Card className="p-5 border border-border space-y-4">
        <h3 className="font-display font-bold text-lg">Kontak & Identitas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>WhatsApp</Label><Input value={s.whatsapp || ""} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={s.email || ""} onChange={(e) => setS({ ...s, email: e.target.value })} /></div>
          <div><Label>Instagram</Label><Input value={s.instagram || ""} onChange={(e) => setS({ ...s, instagram: e.target.value })} /></div>
          <div><Label>Facebook</Label><Input value={s.facebook || ""} onChange={(e) => setS({ ...s, facebook: e.target.value })} /></div>
          <div><Label>Website</Label><Input value={s.website || ""} onChange={(e) => setS({ ...s, website: e.target.value })} /></div>
          <div><Label>Pajak (%)</Label><Input type="number" value={s.tax_percent || 0} onChange={(e) => setS({ ...s, tax_percent: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Alamat</Label><Textarea rows={2} value={s.address || ""} onChange={(e) => setS({ ...s, address: e.target.value })} /></div>
        <div><Label>Template WhatsApp</Label><Textarea rows={3} value={s.wa_template || ""} onChange={(e) => setS({ ...s, wa_template: e.target.value })} placeholder="Halo {nama}, service {nomor} ..." /></div>
      </Card>

      {/* Header Cetakan */}
      <Card className="p-5 border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Printer className="size-5 text-primary" />
          <h3 className="font-display font-bold text-lg">Header & Footer Cetakan</h3>
        </div>
        <p className="text-xs text-muted-foreground">Kustomisasi teks yang muncul di nota, label, dan QR cetakan. Kosongkan untuk memakai default (nama toko).</p>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">NOTA (Struk & Nota Service)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Judul Header</Label><Input value={s.print_header_title || ""} onChange={(e) => setS({ ...s, print_header_title: e.target.value })} placeholder="Cth: SERVICE HP MANAGER" data-testid="print-header-title" /></div>
            <div><Label>Sub-judul</Label><Input value={s.print_header_subtitle || ""} onChange={(e) => setS({ ...s, print_header_subtitle: e.target.value })} placeholder="Cth: Spesialis Servis HP" /></div>
            <div className="md:col-span-2"><Label>Alamat Header</Label><Input value={s.print_header_address || ""} onChange={(e) => setS({ ...s, print_header_address: e.target.value })} placeholder="Jl. Merdeka No.1, Jakarta" /></div>
            <div className="md:col-span-2"><Label>Telp/WA Header</Label><Input value={s.print_header_phone || ""} onChange={(e) => setS({ ...s, print_header_phone: e.target.value })} placeholder="0812-3456-7890" /></div>
            <div className="md:col-span-2"><Label>Footer Nota</Label><Textarea rows={2} value={s.print_footer_text || ""} onChange={(e) => setS({ ...s, print_footer_text: e.target.value })} placeholder="Terima kasih telah menggunakan layanan kami." /></div>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">LABEL (Label HP)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Judul Label</Label><Input value={s.label_header_title || ""} onChange={(e) => setS({ ...s, label_header_title: e.target.value })} placeholder="Cth: SERVICE TAG" /></div>
            <div><Label>Footer Label</Label><Input value={s.label_footer_text || ""} onChange={(e) => setS({ ...s, label_footer_text: e.target.value })} placeholder="Cth: Simpan label ini sebagai bukti" /></div>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">QR TRACKING</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Judul QR</Label><Input value={s.qr_header_title || ""} onChange={(e) => setS({ ...s, qr_header_title: e.target.value })} placeholder="Cth: LACAK SERVICE ANDA" /></div>
            <div><Label>Footer QR</Label><Input value={s.qr_footer_text || ""} onChange={(e) => setS({ ...s, qr_footer_text: e.target.value })} placeholder="Cth: Scan untuk cek status" /></div>
          </div>
        </div>
      </Card>

      <Button onClick={save} data-testid="save-settings-btn" className="w-full" size="lg">Simpan Semua Pengaturan</Button>

      {/* DANGER ZONE - Reset Database (owner only) */}
      {user?.role === "owner" && (
        <Card className="p-5 border-2 border-red-500/40 bg-red-500/5 space-y-3" data-testid="danger-zone">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="size-5" />
            <h3 className="font-display font-bold text-lg">Danger Zone</h3>
          </div>
          <div>
            <div className="font-semibold text-sm mb-1">Reset Database</div>
            <p className="text-xs text-muted-foreground mb-3">
              Menghapus <b>semua data transaksi</b> aplikasi (service, customer, sparepart, pembelian, penjualan, pembayaran, audit log, dll) dan memulai kembali dengan data default seperti fresh install. Tidak dapat dibatalkan.
            </p>
            <Button variant="destructive" onClick={() => setResetOpen(true)} className="gap-2" data-testid="reset-db-btn">
              <Trash2 className="size-4" />Reset Database Aplikasi
            </Button>
          </div>
        </Card>
      )}

      {/* RESET CONFIRMATION DIALOG */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400"><AlertTriangle className="size-5" />Konfirmasi Reset Database</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs">
              <b>PERINGATAN:</b> Aksi ini akan menghapus <b>SEMUA</b> data transaksi (service, customer, sparepart, pembelian, penjualan, pembayaran, teknisi, audit). Data default akan dibuat ulang.
            </div>

            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={resetKeepUsers} onCheckedChange={(v) => setResetKeepUsers(!!v)} data-testid="keep-users-cb" />
              Pertahankan data users/login (rekomendasi ON)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={resetKeepSettings} onCheckedChange={(v) => setResetKeepSettings(!!v)} data-testid="keep-settings-cb" />
              Pertahankan Pengaturan & Branding (rekomendasi ON)
            </label>

            <div>
              <Label className="text-xs">Ketik <b>RESET DATABASE</b> untuk mengonfirmasi</Label>
              <Input value={resetInput} onChange={(e) => setResetInput(e.target.value)} placeholder="RESET DATABASE" data-testid="reset-input" autoComplete="off" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setResetOpen(false); setResetInput(""); }} className="flex-1" data-testid="reset-cancel-btn">Batal</Button>
              <Button variant="destructive" onClick={doReset} className="flex-1 gap-2" disabled={resetInput !== "RESET DATABASE" || resetLoading} data-testid="reset-confirm-btn">
                <Trash2 className="size-4" />{resetLoading ? "Mereset..." : "Ya, Reset Sekarang"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

