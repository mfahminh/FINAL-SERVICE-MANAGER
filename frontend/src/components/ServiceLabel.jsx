import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServiceLabel({ service, shopName = "Service HP", trackingBase, onClose }) {
  const trackUrl = `${trackingBase || window.location.origin}/track/${service.service_number}`;
  const imeiTail = service.imei1 ? service.imei1.slice(-4) : "----";
  return (
    <div className="space-y-3">
      <div id="label-print" className="bg-white text-zinc-900 p-4 border border-zinc-300 rounded-md font-mono" style={{ width: 280 }}>
        <div className="text-center border-b border-zinc-300 pb-2 mb-2">
          <div className="font-display font-black text-base uppercase tracking-tight">{shopName}</div>
          <div className="text-[10px]">Service Tag</div>
        </div>
        <div className="text-center mb-1"><Barcode value={service.service_number} width={1.4} height={36} fontSize={10} margin={0} /></div>
        <div className="text-center my-2"><QRCodeSVG value={trackUrl} size={84} /></div>
        <div className="text-[11px] leading-tight space-y-0.5">
          <div className="font-bold text-sm text-center">{service.service_number}</div>
          <div>Cust: <b>{service.customer_name}</b></div>
          <div>{service.brand} {service.model}</div>
          <div>IMEI: ****{imeiTail}</div>
          <div>Masuk: {new Date(service.created_at).toLocaleDateString("id-ID")}</div>
          {service.assigned_technician_name && <div>Teknisi: {service.assigned_technician_name}</div>}
          <div className="border-t border-zinc-300 mt-1 pt-1">Status: <b>{service.status}</b></div>
        </div>
      </div>
      <Button onClick={() => window.print()} className="w-full gap-2" data-testid="print-label-btn"><Printer className="size-4" />Cetak Label</Button>
    </div>
  );
}
