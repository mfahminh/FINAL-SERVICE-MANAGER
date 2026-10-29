import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPrintoutConfig, PRINTOUT_TYPES } from "@/lib/printoutSettings";

export default function PrintoutSettings({ settings, onChange, onSave }) {
  const [activeType, setActiveType] = useState("service_intake");
  const definition = PRINTOUT_TYPES[activeType];
  const config = getPrintoutConfig(settings, activeType);
  const shopName = settings.print_header_title || settings.shop_name || settings.app_name || "Nama Toko";
  const title = activeType === "service_label"
    ? settings.label_header_title || "SERVICE TAG"
    : activeType === "service_intake"
      ? settings.qr_header_title || "Tanda Terima Service"
      : definition.title;
  const address = settings.print_header_address || settings.address;
  const phone = settings.print_header_phone || settings.whatsapp;
  const footer = config.footer
    || (activeType === "service_label" ? settings.label_footer_text : "")
    || (activeType === "service_intake" ? settings.qr_footer_text : "")
    || settings.print_footer_text
    || "Terima kasih telah menggunakan layanan kami.";

  const updateConfig = (type, changes) => {
    const current = settings.printout_settings || {};
    onChange({
      ...settings,
      printout_settings: {
        ...current,
        [type]: { ...getPrintoutConfig(settings, type), ...changes },
      },
    });
  };

  return (
    <Card className="p-5 border border-border space-y-4" data-testid="printout-settings-card">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Pusat Cetakan</div>
        <h3 className="font-display font-bold text-xl">Pengaturan Semua Printout</h3>
        <p className="text-xs text-muted-foreground mt-1">Atur isi dan tampilan cetakan. Pengaturan disimpan ke server dan berlaku setelah aplikasi dimuat ulang.</p>
      </div>

      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto flex-nowrap">
          {Object.entries(PRINTOUT_TYPES).map(([key, item]) => (
            <TabsTrigger key={key} value={key} className="shrink-0" data-testid={`printout-tab-${key}`}>{item.title}</TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(PRINTOUT_TYPES).map(([key, item]) => {
          const itemConfig = getPrintoutConfig(settings, key);
          const itemTitle = key === "service_label"
            ? settings.label_header_title || "SERVICE TAG"
            : key === "service_intake"
              ? settings.qr_header_title || "Tanda Terima Service"
              : item.title;
          return (
            <TabsContent key={key} value={key} className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <div>
                    <Label>Gaya desain</Label>
                    <Select value={itemConfig.design || "professional"} onValueChange={(design) => updateConfig(key, { design })}>
                      <SelectTrigger data-testid={`printout-design-${key}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Profesional</SelectItem>
                        <SelectItem value="classic">Klasik</SelectItem>
                        <SelectItem value="minimal">Minimalis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    {item.fields.map(([field, label]) => (
                      <div key={field} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                        <Label htmlFor={`${key}-${field}`} className="text-sm leading-tight cursor-pointer">{label}</Label>
                        <Switch id={`${key}-${field}`} checked={itemConfig[field] !== false}
                          onCheckedChange={(checked) => updateConfig(key, { [field]: checked })}
                          data-testid={`printout-field-${key}-${field}`} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label htmlFor={`printout-footer-${key}`}>Teks footer khusus</Label>
                    <Input id={`printout-footer-${key}`} value={itemConfig.footer || ""}
                      onChange={(event) => updateConfig(key, { footer: event.target.value })}
                      placeholder="Kosongkan untuk menggunakan footer umum" data-testid={`printout-footer-${key}`} />
                  </div>
                </div>
                <div className={`printout-header-${itemConfig.design} rounded-lg border border-dashed border-border bg-muted/30 p-4`}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pratinjau</div>
                  <div className="mx-auto max-w-sm rounded-md bg-white text-zinc-900 shadow-sm p-4 text-xs">
                    <div className="text-center border-b border-zinc-200 pb-2 mb-2">
                      {itemConfig.showLogo && settings.logo && <img src={settings.logo} alt="Logo toko" className="print-logo mx-auto mb-1 max-h-12 max-w-24 object-contain" />}
                      {itemConfig.showShopName && <div className="font-bold text-base">{shopName}</div>}
                      {itemConfig.showAddress && address && <div className="text-[10px] text-zinc-500">{address}</div>}
                      {itemConfig.showPhone && phone && <div className="text-[10px] text-zinc-500">{phone}</div>}
                      <div className="font-semibold mt-1 uppercase tracking-wide">{itemTitle}</div>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {itemConfig.showCustomer && <div className="flex justify-between"><span>Pelanggan</span><span>Andi Saputra</span></div>}
                      {itemConfig.showDevice && <div className="flex justify-between"><span>Perangkat</span><span>Samsung A54</span></div>}
                      {itemConfig.showImei && <div className="flex justify-between"><span>IMEI</span><span>•••• 1234</span></div>}
                      {itemConfig.showDate && <div className="flex justify-between"><span>Tanggal</span><span>20 Okt 2026</span></div>}
                      {itemConfig.showComplaint && <div>Keluhan / tindakan: contoh</div>}
                      {itemConfig.showEstimate && <div className="flex justify-between"><span>Estimasi</span><span>Rp 450.000</span></div>}
                      {itemConfig.showTechnician && <div className="flex justify-between"><span>Teknisi</span><span>Budi</span></div>}
                      {itemConfig.showStatus && <div className="flex justify-between"><span>Status</span><span>Dalam proses</span></div>}
                      {itemConfig.showCashier && <div className="flex justify-between"><span>Kasir</span><span>Andi</span></div>}
                      {itemConfig.showItems && <div className="flex justify-between"><span>Rincian</span><span>LCD × 1</span></div>}
                      {itemConfig.showCosts && <div className="flex justify-between font-bold"><span>TOTAL</span><span>Rp 450.000</span></div>}
                      {itemConfig.showPeriod && <div>Periode komisi: 1–20 Okt 2026</div>}
                      {itemConfig.showQc && <div>Quality control: Lulus</div>}
                      {itemConfig.showWarranty && <div>Garansi: 30 hari</div>}
                      {itemConfig.showReason && <div>Alasan pembatalan: contoh</div>}
                      {itemConfig.showQr && <div className="mx-auto my-2 size-16 border-2 border-zinc-800 grid place-items-center font-bold">QR</div>}
                      {itemConfig.showBarcode && <div className="mx-auto my-2 h-8 w-36 border-y-4 border-zinc-800" />}
                      {itemConfig.showSignature && <div className="mt-5 border-t border-dashed border-zinc-300 pt-2">Tanda tangan</div>}
                    </div>
                    {itemConfig.showFooter && <div className="text-center text-[10px] border-t border-dashed border-zinc-300 mt-2 pt-2">{itemConfig.footer || (key === "service_label" ? settings.label_footer_text : "") || (key === "service_intake" ? settings.qr_footer_text : "") || settings.print_footer_text || footer}</div>}
                  </div>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      <Button onClick={onSave} className="w-full" data-testid="save-printout-settings-btn">Simpan Pengaturan Cetakan</Button>
    </Card>
  );
}
