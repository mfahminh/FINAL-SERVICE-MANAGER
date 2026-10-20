import { getPrintoutConfig } from "@/lib/printoutSettings";

export function PrintoutHeader({ settings, type, documentTitle, subtitle }) {
  const config = getPrintoutConfig(settings, type);
  const design = config.design || "professional";
  const title = settings?.print_header_title || settings?.shop_name || settings?.app_name || "SERVICE HP MANAGER";
  const address = settings?.print_header_address || settings?.address;
  const phone = settings?.print_header_phone || settings?.whatsapp;

  return (
    <div className={`printout-header printout-header-${design} text-center`}>
      {config.showLogo && settings?.logo && (
        <img src={settings.logo} alt="Logo toko" className="print-logo mx-auto mb-1 max-h-12 max-w-24 object-contain" />
      )}
      {config.showShopName && <div className="font-display font-black text-lg">{title}</div>}
      {settings?.print_header_subtitle && <div className="text-[10px] text-zinc-500">{settings.print_header_subtitle}</div>}
      {config.showAddress && address && <div className="text-[10px] text-zinc-500">{address}</div>}
      {config.showPhone && phone && <div className="text-[10px] text-zinc-500">Telp/WA: {phone}</div>}
      {documentTitle && <div className="text-xs font-semibold mt-1 uppercase tracking-wider">{documentTitle}</div>}
      {subtitle && <div className="text-[10px] text-zinc-500">{subtitle}</div>}
    </div>
  );
}

export function PrintoutFooter({ settings, type, fallback }) {
  const config = getPrintoutConfig(settings, type);
  if (!config.showFooter) return null;

  const typeFooter = type === "service_label"
    ? settings?.label_footer_text
    : type === "service_intake"
      ? settings?.qr_footer_text
      : "";
  const text = config.footer || typeFooter || settings?.print_footer_text || fallback;
  if (!text) return null;

  return (
    <div className="printout-footer text-center text-[10px] text-zinc-500 mt-3 border-t border-dashed border-zinc-300 pt-2">
      {text}
    </div>
  );
}
