import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const BrandingContext = createContext({ settings: {}, reload: () => {} });

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
    if (settings.primary_color) {
      // Convert hex to HSL (approximate) - use raw hex via CSS var override
      document.documentElement.style.setProperty("--brand-primary", settings.primary_color);
    }
  }, [settings.app_name, settings.primary_color]);

  return <BrandingContext.Provider value={{ settings, reload: load }}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
