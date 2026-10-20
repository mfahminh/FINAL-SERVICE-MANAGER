import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { Printer, Usb, Bluetooth } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PrintStyle from "@/components/PrintStyle";
import { useBranding } from "@/context/BrandingContext";
import { PrintoutFooter, PrintoutHeader } from "@/components/PrintoutHeader";
import { sendRaw, buildServiceLabel } from "@/lib/escpos";
import { printBluetoothRaw, isBluetoothAvailable } from "@/lib/bluetooth";
import { getPrintoutConfig } from "@/lib/printoutSettings";

export default function ServiceLabel({ service, trackingBase }) {
  const { settings } = useBranding();
  const trackUrl = `${trackingBase || window.location.origin}/track/${service.service_number}`;
  const imeiTail = service.imei1 ? service.imei1.slice(-4) : "----";
  const config = getPrintoutConfig(settings, "service_label");

  const usbPrintLabel = async () => {
    try {
      await sendRaw(await buildServiceLabel(service, settings, trackUrl));
      toast.success("Label terkirim ke printer USB");
    } catch (e) {
      toast.error(e.message || "Gagal print USB");
    }
  };

  const btPrintLabel = async () => {
    try {
      await printBluetoothRaw(await buildServiceLabel(service, settings, trackUrl));
      toast.success("Label terkirim ke printer Bluetooth");
    } catch (e) {
      toast.error(e.message || "Gagal print Bluetooth");
    }
  };

  return (
    <div className="space-y-3">
      <PrintStyle targetId="label-print" kind="label" profileKey="service_label" />
      <div id="label-print" className="bg-white text-zinc-900 p-3 border border-zinc-300 rounded-md font-mono mx-auto" style={{ width: 240 }}>
        <PrintoutHeader settings={settings} type="service_label" documentTitle={settings?.label_header_title || "SERVICE TAG"} />
        {config.showBarcode && <div className="text-center mb-1"><Barcode value={service.service_number} width={1.2} height={30} fontSize={9} margin={0} /></div>}
        {config.showQr && <div className="text-center my-1.5"><QRCodeSVG value={trackUrl} size={72} /></div>}
        <div className="text-[10px] leading-tight space-y-0.5">
          <div className="font-bold text-xs text-center">{service.service_number}</div>
          {config.showCustomer && <div>Cust: <b>{service.customer_name}</b></div>}
          {config.showDevice && <div>{service.brand} {service.model}</div>}
          {config.showImei && service.imei1 && <div>IMEI: ****{imeiTail}</div>}
          {config.showDate && <div>Masuk: {new Date(service.created_at).toLocaleDateString("id-ID")}</div>}
          {config.showTechnician && service.assigned_technician_name && <div>Teknisi: {service.assigned_technician_name}</div>}
          {config.showStatus && <div className="border-t border-zinc-300 mt-1 pt-1">Status: <b>{service.status}</b></div>}
        </div>
        <PrintoutFooter settings={settings} type="service_label" fallback="Simpan label ini sebagai bukti." />
      </div>
      <div className="grid grid-cols-2 gap-2 no-print">
        <Button onClick={() => window.print()} className="gap-2" data-testid="print-label-btn"><Printer className="size-4" />Cetak Biasa</Button>
        <Button variant="outline" onClick={usbPrintLabel} className="gap-2" data-testid="print-label-usb-btn" title="Print thermal via USB ESC/POS"><Usb className="size-4" />USB</Button>
        {isBluetoothAvailable() && <Button variant="secondary" onClick={btPrintLabel} className="gap-2 col-span-2" data-testid="print-label-bt-btn" title="Print thermal via Bluetooth"><Bluetooth className="size-4" />Bluetooth</Button>}
      </div>
    </div>
  );
}
