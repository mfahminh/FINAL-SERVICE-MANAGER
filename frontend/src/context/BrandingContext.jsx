import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const BrandingContext = createContext({ settings: {}, reload: () => {} });

function colorToHsl(color) {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color || "")) return null;
  const hex = color.length === 4
    ? color.slice(1).split("").map((digit) => digit + digit).join("")
    : color.slice(1);
  const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function foregroundFor(color) {
  const hex = color.length === 4
    ? color.slice(1).split("").map((digit) => digit + digit).join("")
    : color.slice(1);
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "0 0% 100%" : "240 10% 4%";
}

function applyBrandColors(primaryColor, secondaryColor) {
  const root = document.documentElement;
  const colors = [
    { color: primaryColor, fallback: "#ea7c1f", variable: "--primary", foreground: "--primary-foreground", primary: true },
    { color: secondaryColor, fallback: "#1e293b", variable: "--secondary", foreground: "--secondary-foreground" },
  ];

  colors.forEach(({ color: configuredColor, fallback, variable, foreground, primary }) => {
    const color = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(configuredColor || "") ? configuredColor : fallback;
    const hsl = colorToHsl(color);
    root.style.setProperty(variable, hsl);
    root.style.setProperty(foreground, foregroundFor(color));
    if (primary) {
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--chart-1", hsl);
      root.style.setProperty("--brand-primary", color);
    }
  });
}

export function BrandingProvider({ children }) {
  const [settings, setSettings] = useState({});

  const load = async () => {
    try {
      const r = await api.get("/settings");
      setSettings(r.data || {});
    } catch (e) { /* not logged in yet */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (settings.app_name) document.title = settings.app_name;
    applyBrandColors(settings.primary_color, settings.secondary_color);
  }, [settings.app_name, settings.primary_color, settings.secondary_color]);

  return <BrandingContext.Provider value={{ settings, reload: load }}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
