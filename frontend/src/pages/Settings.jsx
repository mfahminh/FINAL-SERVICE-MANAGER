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
import { Upload, Printer, AlertTriangle, Trash2, MessageCircle, Send, Ruler, Usb } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pickPrinter, getSavedPrinterInfo, clearSavedPrinter, sendRaw, buildPOSReceipt, buildServiceIntakeReceipt } from "@/lib/escpos";

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
  const [waTestPhone, setWaTestPhone] = useState("");
  const [waTesting, setWaTesting] = useState(false);
  const [usbInfo, setUsbInfo] = useState(getSavedPrinterInfo());
  const [usbSupported] = useState(typeof navigator !== "undefined" && !!navigator.usb);

  const pickUsbPrinter = async () => {
    try {
      const dev = await pickPrinter();
      setUsbInfo({ vendorId: dev.vendorId, productId: dev.productId, productName: dev.productName, manufacturerName: dev.manufacturerName });
      toast.success(`Printer terpilih: ${dev.productName || "Unknown"}`);
    } catch (e) { toast.error(e.message || "Gagal memilih printer"); }
  };
  const testUsbPrint = async () => {
    try {
      await sendRaw(buildPOSReceipt({
        sale_number: "TEST-001", created_at: new Date().toISOString(),
        items: [{ name: "Test Printer", qty: 1, price: 1000 }],
        total: 1000, paid: 1000,
      }, s));
      toast.success("Test print terkirim");
    } catch (e) { toast.error(e.message || "Gagal test print"); }
  };
  const forgetUsbPrinter = () => { clearSavedPrinter(); setUsbInfo(null); toast.info("Printer USB dihapus dari memori"); };

  const doWaTest = async () => {
    if (!waTestPhone) return toast.error("Isi nomor HP dulu");
    setWaTesting(true);
    try {
      // Save current settings first so token/provider terpakai
      await api.patch("/settings", s);
      const r = await api.post("/whatsapp/test", { phone: waTestPhone });
      if (r.data.ok) {
        toast.success(`Terkirim via ${r.data.provider}${r.data.provider === "mock" ? " (token belum di-set)" : ""}`);
      } else {
        toast.error(`Gagal: ${r.data.error || JSON.stringify(r.data.result)}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal test WA");
    } finally { setWaTesting(false); }
  };

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

      {/* Thermal Printer Configuration */}
      <Card className="p-5 border border-border space-y-4" data-testid="thermal-printer-card">
        <div className="flex items-center gap-2">
          <Ruler className="size-5 text-primary" />
          <h3 className="font-display font-bold text-lg">Thermal Printer</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Atur ukuran kertas per jenis cetakan supaya <b>tidak overflow ke halaman berikutnya</b>.
          Setingan ini otomatis mengatur <code className="text-[10px] px-1 bg-muted rounded">@page size</code> dan lebar konten saat kamu klik Cetak.
          Untuk printer thermal 58mm/80mm, pilih ukuran yang sama; untuk kertas biasa pilih A4.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Nota (Struk Service & POS)</Label>
            <Select value={s.printer_nota_width || "80mm"} onValueChange={(v) => setS({ ...s, printer_nota_width: v })}>
              <SelectTrigger data-testid="printer-nota-width"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm (thermal kecil)</SelectItem>
                <SelectItem value="80mm">80mm (thermal standar)</SelectItem>
                <SelectItem value="100mm">100mm (thermal lebar)</SelectItem>
                <SelectItem value="A4">A4 (printer biasa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Label Service Tag</Label>
            <Select value={s.printer_label_width || "58mm"} onValueChange={(v) => setS({ ...s, printer_label_width: v })}>
              <SelectTrigger data-testid="printer-label-width"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="40mm">40mm (label kecil)</SelectItem>
                <SelectItem value="50mm">50mm</SelectItem>
                <SelectItem value="58mm">58mm (default)</SelectItem>
                <SelectItem value="80mm">80mm</SelectItem>
                <SelectItem value="100mm">100mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>QR / Tanda Terima</Label>
            <Select value={s.printer_qr_width || "58mm"} onValueChange={(v) => setS({ ...s, printer_qr_width: v })}>
              <SelectTrigger data-testid="printer-qr-width"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm</SelectItem>
                <SelectItem value="80mm">80mm</SelectItem>
                <SelectItem value="100mm">100mm</SelectItem>
                <SelectItem value="A4">A4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Margin (mm)</Label>
            <Input type="number" step="0.5" min={0} max={20}
              value={s.printer_margin_mm ?? 2}
              onChange={(e) => setS({ ...s, printer_margin_mm: Number(e.target.value) })}
              data-testid="printer-margin"
            />
          </div>
          <div>
            <Label>Gap Bawah (mm)</Label>
            <Input type="number" step="0.5" min={0} max={20}
              value={s.printer_gap_mm ?? 4}
              onChange={(e) => setS({ ...s, printer_gap_mm: Number(e.target.value) })}
              data-testid="printer-gap"
              placeholder="Untuk area cutter"
            />
          </div>
          <div>
            <Label>Font Size (pt)</Label>
            <Input type="number" step="0.5" min={6} max={14}
              value={s.printer_font_size_pt ?? 9}
              onChange={(e) => setS({ ...s, printer_font_size_pt: Number(e.target.value) })}
              data-testid="printer-font-size"
            />
          </div>
          <div>
            <Label>Line Height</Label>
            <Input type="number" step="0.05" min={1} max={2}
              value={s.printer_line_height ?? 1.25}
              onChange={(e) => setS({ ...s, printer_line_height: Number(e.target.value) })}
              data-testid="printer-line-height"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Font Family</Label>
            <Select value={s.printer_font_family || "mono"} onValueChange={(v) => setS({ ...s, printer_font_family: v })}>
              <SelectTrigger data-testid="printer-font-family"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mono">Monospace (Courier — cocok thermal)</SelectItem>
                <SelectItem value="sans">Sans-serif (Modern)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
            <Switch
              checked={s.printer_hide_borders !== false}
              onCheckedChange={(v) => setS({ ...s, printer_hide_borders: v })}
              data-testid="printer-hide-borders"
            />
            <div className="flex-1">
              <div className="font-semibold text-sm">Sembunyikan Border saat Cetak</div>
              <div className="text-xs text-muted-foreground">Hemat tinta thermal. Off jika pakai kertas biasa dengan garis kotak.</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-primary/5 border border-primary/20 rounded-md">
          <div className="font-semibold text-foreground mb-1">Tips supaya print pas 1 halaman:</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Pilih paper size yang <b>sama dengan printer thermal</b> Anda (biasanya 58mm atau 80mm)</li>
            <li>Di dialog print browser, set <b>Margins = None/Minimum</b>, <b>Scale = 100%</b>, matikan Headers &amp; Footers</li>
            <li>Kalau tetap 2 halaman, kurangi Font Size ke 8pt atau Line Height ke 1.1</li>
            <li>Chrome/Edge → <b>More settings → Paper size → Pilih ukuran custom</b> (kalau printer thermal tidak muncul default)</li>
          </ul>
        </div>

        {/* USB Direct Print */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Usb className="size-5 text-primary" />
            <h4 className="font-display font-bold text-base">Direct USB Print (ESC/POS)</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Print langsung ke printer thermal via kabel USB — tanpa dialog print browser, tanpa driver. Cepat & konsisten.
            Butuh Chrome/Edge di Windows/Mac/Linux. Colok printer, klik "Pilih Printer" satu kali, izinkan di popup Chrome.
          </p>
          {!usbSupported ? (
            <div className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-800 dark:text-yellow-300 p-3 rounded-md">
              Browser ini tidak support Web USB. Pakai <b>Chrome/Edge</b> desktop. Untuk HP/tablet, gunakan tombol Cetak biasa.
            </div>
          ) : (
            <div className="space-y-3">
              {usbInfo ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs uppercase">Terhubung</div>
                      <div className="text-sm font-medium">{usbInfo.productName || "Unknown printer"}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        VID: {usbInfo.vendorId?.toString(16).padStart(4, "0")} · PID: {usbInfo.productId?.toString(16).padStart(4, "0")}
                        {usbInfo.manufacturerName && ` · ${usbInfo.manufacturerName}`}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted border border-border rounded-md text-xs text-muted-foreground">
                  Belum ada printer USB terpilih.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button variant="outline" onClick={pickUsbPrinter} className="gap-2" data-testid="usb-pick-btn">
                  <Usb className="size-4" />
                  {usbInfo ? "Ganti Printer" : "Pilih Printer USB"}
                </Button>
                <Button variant="secondary" onClick={testUsbPrint} disabled={!usbInfo} className="gap-2" data-testid="usb-test-btn">
                  <Printer className="size-4" />Test Print
                </Button>
                {usbInfo && (
                  <Button variant="ghost" onClick={forgetUsbPrinter} className="gap-2 text-muted-foreground" data-testid="usb-forget-btn">
                    <Trash2 className="size-4" />Lupakan
                  </Button>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                💡 <b>Tips</b>: Kalau muncul "no device", pastikan driver <b>USB Printing Support</b> aktif di Device Manager, atau install driver generic (Zadig di Windows) untuk expose USB endpoint ke browser.
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* WhatsApp Notifications (Fonnte) */}
      <Card className="p-5 border border-border space-y-4" data-testid="wa-notifications-card">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5 text-primary" />
          <h3 className="font-display font-bold text-lg">Notifikasi WhatsApp Otomatis</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Kirim WA otomatis ke pelanggan setiap perubahan status service, via <b>Fonnte</b>.
          Dapatkan token di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-primary underline">fonnte.com</a> → menu <b>Device</b>.
          Kalau token kosong, notifikasi jadi mode <b>mock</b> (hanya di-log, tidak dikirim).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label>Fonnte Device Token</Label>
            <Input
              type="password"
              value={s.fonnte_token || ""}
              onChange={(e) => setS({ ...s, fonnte_token: e.target.value })}
              placeholder="Tempel token dari fonnte.com..."
              data-testid="fonnte-token-input"
            />
          </div>
          <div>
            <Label>Kode Negara</Label>
            <Input
              value={s.fonnte_country_code || "62"}
              onChange={(e) => setS({ ...s, fonnte_country_code: e.target.value })}
              placeholder="62"
              data-testid="fonnte-country-code-input"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
          <Switch
            checked={(s.wa_provider || "mock") === "fonnte"}
            onCheckedChange={(v) => setS({ ...s, wa_provider: v ? "fonnte" : "mock" })}
            data-testid="wa-provider-switch"
          />
          <div className="flex-1">
            <div className="font-semibold text-sm">Aktifkan Fonnte</div>
            <div className="text-xs text-muted-foreground">
              {(s.wa_provider || "mock") === "fonnte" ? "Kirim asli via Fonnte" : "Mode MOCK — pesan hanya di-log"}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pemicu Notifikasi Otomatis</div>
          {[
            ["wa_notif_on_create", "Saat service dibuat", "Setelah pelanggan mendaftar service baru"],
            ["wa_notif_on_diagnose", "Setelah diagnosa selesai", "Teknisi/admin selesai input diagnosa & biaya"],
            ["wa_notif_on_ready", "Saat siap diambil", "Lulus QC — device sudah selesai"],
            ["wa_notif_on_pickup", "Setelah pickup", "Konfirmasi pickup + info garansi"],
          ].map(([key, title, desc]) => (
            <div key={key} className="flex items-center gap-3 py-1.5">
              <Switch
                checked={s[key] !== false}
                onCheckedChange={(v) => setS({ ...s, [key]: v })}
                data-testid={`toggle-${key}`}
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-3 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Template Pesan (placeholder: {"{customer_name}, {service_number}, {brand}, {model}, {complaint}, {estimated_cost}, {final_cost}, {total_paid}, {remaining}, {diagnosis}, {damage}, {action}, {warranty_days}, {warranty_until}, {tracking_url}, {shop_name}"})
          </div>
          <div>
            <Label>Template — Service Baru</Label>
            <Textarea rows={5} value={s.wa_template_create || ""}
              onChange={(e) => setS({ ...s, wa_template_create: e.target.value })}
              data-testid="wa-template-create" />
          </div>
          <div>
            <Label>Template — Diagnosa Selesai</Label>
            <Textarea rows={5} value={s.wa_template_diagnose || ""}
              onChange={(e) => setS({ ...s, wa_template_diagnose: e.target.value })}
              data-testid="wa-template-diagnose" />
          </div>
          <div>
            <Label>Template — Siap Diambil</Label>
            <Textarea rows={5} value={s.wa_template_ready || ""}
              onChange={(e) => setS({ ...s, wa_template_ready: e.target.value })}
              data-testid="wa-template-ready" />
          </div>
          <div>
            <Label>Template — Setelah Pickup</Label>
            <Textarea rows={4} value={s.wa_template_pickup || ""}
              onChange={(e) => setS({ ...s, wa_template_pickup: e.target.value })}
              data-testid="wa-template-pickup" />
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <Label>Test Koneksi Fonnte</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="Nomor HP Anda, cth: 081234567890"
              value={waTestPhone}
              onChange={(e) => setWaTestPhone(e.target.value)}
              data-testid="wa-test-phone-input"
            />
            <Button onClick={doWaTest} disabled={waTesting} data-testid="wa-test-send-btn">
              <Send className="size-4 mr-1.5" />
              {waTesting ? "Mengirim..." : "Kirim Test"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Simpan settings dulu → lalu klik "Kirim Test". Cek WhatsApp Anda.
          </p>
        </div>
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

