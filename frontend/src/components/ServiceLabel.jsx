import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { Printer, Usb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PrintStyle from "@/components/PrintStyle";
import { useBranding } from "@/context/BrandingContext";
import { sendRaw, buildServiceLabel } from "@/lib/escpos";

export default function ServiceLabel({ service, shopName = "Service HP", trackingBase }) {
  const { settings } = useBranding();
  const trackUrl = `${trackingBase || window.location.origin}/track/${service.service_number}`;
  const imeiTail = service.imei1 ? service.imei1.slice(-4) : "----";
  const title = settings?.label_header_title || settings?.print_header_title || shopName;
  const footer = settings?.label_footer_text;

  const usbPrintLabel = async () => {
    try {
      await sendRaw(buildServiceLabel(service, settings, trackUrl));
      toast.success("Label terkirim ke printer USB");
    } catch (e) {
      toast.error(e.message || "Gagal print USB");
    }
  };

  return (
    <div className="space-y-3">
      <PrintStyle targetId="label-print" kind="label" />
      <div id="label-print" className="bg-white text-zinc-900 p-3 border border-zinc-300 rounded-md font-mono mx-auto" style={{ width: 240 }}>
        <div className="text-center border-b border-zinc-300 pb-1.5 mb-1.5">
          <div className="font-display font-black text-sm uppercase tracking-tight leading-tight">{title}</div>
          <div className="text-[9px]">SERVICE TAG</div>
        </div>
        <div className="text-center mb-1"><Barcode value={service.service_number} width={1.2} height={30} fontSize={9} margin={0} /></div>
        <div className="text-center my-1.5"><QRCodeSVG value={trackUrl} size={72} /></div>
        <div className="text-[10px] leading-tight space-y-0.5">
          <div className="font-bold text-xs text-center">{service.service_number}</div>
          <div>Cust: <b>{service.customer_name}</b></div>
          <div>{service.brand} {service.model}</div>
          <div>IMEI: ****{imeiTail}</div>
          <div>Masuk: {new Date(service.created_at).toLocaleDateString("id-ID")}</div>
          {service.assigned_technician_name && <div>Teknisi: {service.assigned_technician_name}</div>}
          <div className="border-t border-zinc-300 mt-1 pt-1">Status: <b>{service.status}</b></div>
        </div>
        {footer && <div className="text-center text-[9px] text-zinc-500 mt-1.5 border-t border-zinc-300 pt-1">{footer}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 no-print">
        <Button onClick={() => window.print()} className="gap-2" data-testid="print-label-btn"><Printer className="size-4" />Cetak Biasa</Button>
        <Button variant="outline" onClick={usbPrintLabel} className="gap-2" data-testid="print-label-usb-btn" title="Print thermal via USB ESC/POS"><Usb className="size-4" />USB</Button>
      </div>
    </div>
  );
}
