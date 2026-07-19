import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { fmtDate, fmtIDR, STATUS_COLORS } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wrench, Search } from "lucide-react";

export default function PublicTrack() {
  const { sn } = useParams();
  const navigate = useNavigate();
  const [number, setNumber] = useState(sn || "");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const search = async (n) => {
    setErr(""); setData(null);
    try {
      const r = await api.get(`/track/${n}`);
      setData(r.data);
    } catch (e) { setErr("Nomor service tidak ditemukan"); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => { if (sn) { setNumber(sn); search(sn); }  }, [sn]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Wrench className="size-5" /></div>
          <div className="font-display font-black text-base">SERVICE HP MANAGER</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/login")} data-testid="login-link">Login Admin</Button>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold mt-6">Public</div>
        <h1 className="font-display font-black text-4xl tracking-tight mb-2">Cek Status Service</h1>
        <p className="text-muted-foreground text-sm mb-6">Masukkan nomor service Anda untuk melihat status terkini.</p>

        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="SV20260213XXXX" className="pl-9 font-mono" value={number} onChange={(e) => setNumber(e.target.value)} data-testid="track-input" />
          </div>
          <Button onClick={() => search(number)} data-testid="track-btn">Cek</Button>
        </div>

        {err && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 p-3 rounded-md">{err}</div>}

        {data && (
          <Card className="p-5 border border-border space-y-4" data-testid="track-result">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nomor Service</div>
                <div className="font-mono font-bold text-xl">{data.service_number}</div>
              </div>
              <span className={`status-pill ${STATUS_COLORS[data.status]}`}>{data.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-border">
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Pelanggan</div><div>{data.customer_name}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Device</div><div>{data.brand} {data.model}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Tanggal Masuk</div><div>{fmtDate(data.created_at)}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Biaya</div><div className="font-mono font-bold">{fmtIDR(data.final_cost)}</div></div>
            </div>
            {data.diagnosis && (
              <div className="p-3 bg-muted/50 rounded-md border border-border">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Diagnosa</div>
                <div className="text-sm">{data.diagnosis}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Riwayat Status</div>
              <div className="space-y-2">
                {data.status_history?.map((h, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="size-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <div className="font-semibold">{h.status}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(h.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
