import { useEffect } from "react";
import { useBranding } from "@/context/BrandingContext";

/**
 * Inject dynamic @page CSS untuk thermal printing.
 * `target` menentukan elemen mana yang di-show saat print
 * dan setting mana yang dipakai untuk ukuran kertas.
 *
 * Semua elemen lain di-hide dengan visibility:hidden supaya
 * cuma bagian target yang terprint dan tidak overflow ke 3 halaman.
 *
 * targetId : string id element yang di-cetak (mis. "nota-final-print")
 * kind     : "nota" | "label" | "qr"
 */
export default function PrintStyle({ targetId, kind = "nota" }) {
  const { settings } = useBranding();

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!targetId) return;

    const widthKey =
      kind === "label" ? "printer_label_width" :
      kind === "qr" ? "printer_qr_width" :
      "printer_nota_width";

    const paperWidth = (settings?.[widthKey] || "80mm").trim();
    const margin = Number(settings?.printer_margin_mm ?? 2);
    const gap = Number(settings?.printer_gap_mm ?? 4);
    const fontSize = Number(settings?.printer_font_size_pt ?? 9);
    const lineH = Number(settings?.printer_line_height ?? 1.25);
    const family = (settings?.printer_font_family || "mono") === "mono"
      ? '"Courier New", ui-monospace, SFMono-Regular, Menlo, monospace'
      : 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif';
    const hideBorders = settings?.printer_hide_borders !== false;

    const isA4 = paperWidth.toUpperCase() === "A4";
    const pageSize = isA4 ? "A4" : `${paperWidth} auto`;

    // Convert content width. For thermal, subtract 2*margin so content fits inside paper.
    // For A4, use auto (fill).
    const contentWidth = isA4
      ? "180mm"
      : `calc(${paperWidth} - ${margin * 2}mm)`;

    const css = `
      @media print {
        @page {
          size: ${pageSize};
          margin: ${margin}mm;
        }
        html, body {
          background: #fff !important;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body * {
          visibility: hidden !important;
        }
        #${targetId}, #${targetId} * {
          visibility: visible !important;
        }
        #${targetId} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: ${contentWidth} !important;
          max-width: ${contentWidth} !important;
          margin: 0 !important;
          padding: 0 !important;
          padding-bottom: ${gap}mm !important;
          background: #fff !important;
          color: #000 !important;
          font-family: ${family} !important;
          font-size: ${fontSize}pt !important;
          line-height: ${lineH} !important;
          box-shadow: none !important;
          overflow: visible !important;
          ${hideBorders ? "border: 0 !important;" : ""}
        }
        #${targetId} * {
          box-shadow: none !important;
          max-width: 100% !important;
          overflow: visible !important;
          word-wrap: break-word !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          ${hideBorders ? "border-color: transparent !important;" : ""}
        }
        /* Kill fixed max-w constraints on nested elements (mis. max-w-[60%]) */
        #${targetId} [class*="max-w-"] { max-width: 100% !important; }
        /* Truncate hilang saat print supaya text lengkap */
        #${targetId} .truncate {
          overflow: visible !important;
          white-space: normal !important;
          text-overflow: unset !important;
        }
        /* Tighten common spacing */
        #${targetId} .p-5, #${targetId} .p-4 { padding: 2mm !important; }
        #${targetId} .p-3 { padding: 1.5mm !important; }
        #${targetId} .my-3, #${targetId} .my-2 { margin-top: 1.5mm !important; margin-bottom: 1.5mm !important; }
        #${targetId} .mt-3, #${targetId} .mt-4 { margin-top: 1.5mm !important; }
        #${targetId} .space-y-1 > * + * { margin-top: 0.5mm !important; }
        #${targetId} .space-y-2 > * + * { margin-top: 1mm !important; }
        /* Flex row → wrap when narrow, tapi tetap right-align angka */
        #${targetId} .flex.justify-between {
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 2mm !important;
        }
        #${targetId} .flex.justify-between > *:last-child {
          text-align: right !important;
          flex-shrink: 0 !important;
          max-width: 60% !important;
        }
        #${targetId} .flex.justify-between > *:first-child {
          flex: 1 !important;
          min-width: 0 !important;
        }
        /* Grid 2-kolom (mis. QC list) → 1 kolom di kertas narrow (<80mm) */
        ${!isA4 && paperWidth.replace("mm", "") && Number(paperWidth.replace("mm", "")) <= 58 ? `
          #${targetId} .grid.grid-cols-2 {
            grid-template-columns: 1fr !important;
          }
        ` : `
          #${targetId} .grid.grid-cols-2 {
            grid-template-columns: 1fr 1fr !important;
            gap: 1mm !important;
          }
        `}
        /* Ensure no page break inside receipt for thermal auto-height */
        ${isA4 ? "" : `
          #${targetId} { page-break-inside: auto; break-inside: auto; }
          #${targetId} .p-5, #${targetId} .p-4, #${targetId} .p-3 { padding-left: 1mm !important; padding-right: 1mm !important; }
        `}
        /* Kill any element with .no-print */
        .no-print, .no-print * { display: none !important; }
        /* Compact QR + Barcode to fit thermal */
        #${targetId} svg { max-width: 100% !important; height: auto !important; }
        /* Font-mono jangan pakai variable width */
        #${targetId} .font-mono { font-family: ${family} !important; }
      }
    `;

    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-print-style", targetId);
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    return () => {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    };
  }, [targetId, kind, settings]);

  return null;
}
