import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trophy } from "lucide-react";
import { toast } from "sonner";

export default function FinancialReports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(today);
  const [fin, setFin] = useState(null);
  const [techs, setTechs] = useState(null);

  const loadFin = async () => setFin((await api.get(`/reports/financial?start=${start}&end=${end}`)).data);
  const loadTechs = async () => setTechs((await api.get("/reports/technicians")).data);

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => { loadFin(); /* eslint-disable-next-line */ }, []);

  const exportCSV = (rows, headers, filename) => {
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    toast.success("Exported");
  };

  const Stat = ({ label, value, accent }) => (
    <Card className="p-4 border border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`font-display font-black text-2xl mt-1 font-mono ${accent || ""}`}>{fmtIDR(value)}</div>
    </Card>
  );

  return (
    <div className="space-y-5" data-testid="financial-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Akuntansi</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Laporan Keuangan</h1>
      </div>
      <Card className="p-4 border border-border flex flex-wrap gap-3 items-end">
        <div><Label>Dari</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="fin-start" /></div>
        <div><Label>Sampai</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="fin-end" /></div>
        <Button onClick={loadFin} data-testid="fin-apply">Terapkan</Button>
      </Card>

      <Tabs defaultValue="fin">
        <TabsList>
          <TabsTrigger value="fin" data-testid="tab-fin">Keuangan</TabsTrigger>
          <TabsTrigger value="techs" onClick={loadTechs} data-testid="tab-techs">Produktivitas Teknisi</TabsTrigger>
        </TabsList>
        <TabsContent value="fin" className="space-y-4">
          {fin && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Omzet" value={fin.omzet} />
                <Stat label="Laba Bersih" value={fin.laba} accent="text-emerald-600" />
                <Stat label="Modal Sparepart" value={fin.modal_sparepart} />
                <Stat label="Piutang" value={fin.piutang} accent="text-orange-600" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Total DP" value={fin.total_dp} />
                <Card className="p-4 border border-border"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Jumlah Service</div><div className="font-display font-black text-2xl">{fin.service_count}</div></Card>
                <Card className="p-4 border border-border"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Belum Diambil</div><div className="font-display font-black text-2xl">{fin.belum_diambil}</div></Card>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="techs">
          <Card className="border border-border">
            <div className="p-4 flex justify-between items-center">
              <h3 className="font-display font-bold text-lg flex items-center gap-2"><Trophy className="size-4 text-primary" />Ranking Teknisi</h3>
              <Button variant="outline" size="sm" onClick={() => techs && exportCSV(techs, ["name", "total_jobs", "completed", "cancelled", "total_profit", "commission"], "technicians.csv")} className="gap-2"><Download className="size-4" />CSV</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Teknisi</TableHead><TableHead className="text-right">Total Job</TableHead><TableHead className="text-right">Selesai</TableHead><TableHead className="text-right">Dibatalkan</TableHead><TableHead className="text-right">Laba</TableHead><TableHead className="text-right">Komisi</TableHead></TableRow></TableHeader>
              <TableBody>
                {!techs && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Klik tab untuk muat</TableCell></TableRow>}
                {techs?.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell><Trophy className={`size-4 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-zinc-400" : i === 2 ? "text-orange-700" : "text-muted-foreground/30"}`} /></TableCell>
                    <TableCell className="font-semibold">{t.name}</TableCell>
                    <TableCell className="text-right font-mono">{t.total_jobs}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{t.completed}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{t.cancelled}</TableCell>
                    <TableCell className="text-right font-mono">{fmtIDR(t.total_profit)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{fmtIDR(t.commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
