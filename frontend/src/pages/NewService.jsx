import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtIDR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Save, Smartphone, User, Camera } from "lucide-react";
import { toast } from "sonner";

const ACCESSORIES = ["Charger", "Dus", "SIM", "Memory", "Softcase", "Lainnya"];

export default function NewService() {
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [newCust, setNewCust] = useState(false);
  const [cust, setCust] = useState({ name: "", phone: "", whatsapp: "", address: "", email: "", notes: "" });
  const [form, setForm] = useState({
    customer_id: "", brand: "", model: "", imei1: "", imei2: "", color: "",
    accessories: [], complaint: "", device_password: "", pattern: "", pin: "",
    estimated_cost: 0, dp: 0, photos: []
  });
  const navigate = useNavigate();

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)); }, []);

  const toggleAcc = (a) => {
    setForm((f) => ({ ...f, accessories: f.accessories.includes(a) ? f.accessories.filter(x => x !== a) : [...f.accessories, a] }));
  };

  const submit = async () => {
    try {
      let customerId = form.customer_id;
      if (newCust) {
        const r = await api.post("/customers", cust);
        customerId = r.data.id;
      }
      if (!customerId) { toast.error("Pilih atau buat pelanggan"); return; }
      const payload = { ...form, customer_id: customerId, estimated_cost: Number(form.estimated_cost), dp: Number(form.dp) };
      const r = await api.post("/services", payload);
      toast.success(`Service ${r.data.service_number} dibuat`);
      navigate(`/services/${r.data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal");
    }
  };

  const Steps = ["Pelanggan", "Device", "Keluhan & Biaya"];

  return (
    <div className="max-w-4xl mx-auto space-y-5" data-testid="new-service-page">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/services")} className="gap-1 -ml-3"><ArrowLeft className="size-4" /> Kembali</Button>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold mt-3">Form</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Penerimaan Service</h1>
      </div>

      <div className="flex items-center gap-2">
        {Steps.map((s, i) => {
          const n = i + 1;
          const active = step === n; const done = step > n;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>{n}</div>
              <div className={`text-xs uppercase tracking-wider ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{s}</div>
              {i < Steps.length - 1 && <div className={`flex-1 h-px ${done ? "bg-emerald-500" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      <Card className="p-5 border border-border">
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2"><User className="size-4 text-primary" /><h3 className="font-display font-bold text-lg">Data Pelanggan</h3></div>
            <div className="flex gap-2">
              <Button variant={!newCust ? "default" : "outline"} size="sm" onClick={() => setNewCust(false)} data-testid="existing-customer-btn">Pelanggan Lama</Button>
              <Button variant={newCust ? "default" : "outline"} size="sm" onClick={() => setNewCust(true)} data-testid="new-customer-btn">Pelanggan Baru</Button>
            </div>
            {!newCust ? (
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger data-testid="customer-select"><SelectValue placeholder="Pilih pelanggan..." /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} • {c.phone}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nama *</Label><Input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} data-testid="new-cust-name" /></div>
                <div><Label>No HP *</Label><Input value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} data-testid="new-cust-phone" /></div>
                <div><Label>WhatsApp</Label><Input value={cust.whatsapp} onChange={(e) => setCust({ ...cust, whatsapp: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Alamat</Label><Textarea rows={2} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} /></div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2"><Smartphone className="size-4 text-primary" /><h3 className="font-display font-bold text-lg">Detail Device</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Merk *</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} data-testid="brand-input" placeholder="iPhone, Samsung, Xiaomi..." /></div>
              <div><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} data-testid="model-input" placeholder="12 Pro, A53, dll" /></div>
              <div><Label>IMEI 1</Label><Input value={form.imei1} onChange={(e) => setForm({ ...form, imei1: e.target.value })} data-testid="imei1-input" /></div>
              <div><Label>IMEI 2</Label><Input value={form.imei2} onChange={(e) => setForm({ ...form, imei2: e.target.value })} /></div>
              <div><Label>Warna</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
              <div><Label>Password HP</Label><Input value={form.device_password} onChange={(e) => setForm({ ...form, device_password: e.target.value })} placeholder="opsional" /></div>
              <div><Label>Pola</Label><Input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} /></div>
              <div><Label>PIN</Label><Input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
            </div>
            <div>
              <Label>Kelengkapan</Label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
                {ACCESSORIES.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.accessories.includes(a)} onCheckedChange={() => toggleAcc(a)} data-testid={`acc-${a}`} />
                    {a}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-lg">Keluhan & Biaya</h3>
            <div><Label>Keluhan Pelanggan *</Label><Textarea rows={4} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} data-testid="complaint-input" placeholder="Contoh: Layar pecah, tidak bisa menyala..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Estimasi Biaya</Label><Input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} data-testid="estimated-cost-input" /></div>
              <div><Label>DP (Down Payment)</Label><Input type="number" value={form.dp} onChange={(e) => setForm({ ...form, dp: e.target.value })} data-testid="dp-input" /></div>
            </div>
            <div className="p-4 bg-muted/50 rounded-md border border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Ringkasan</div>
              <div className="text-sm">Estimasi: <span className="font-bold font-mono">{fmtIDR(form.estimated_cost)}</span></div>
              <div className="text-sm">DP: <span className="font-bold font-mono">{fmtIDR(form.dp)}</span></div>
              <div className="text-sm">Sisa: <span className="font-bold font-mono text-primary">{fmtIDR((form.estimated_cost || 0) - (form.dp || 0))}</span></div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-border">
          {step > 1 ? <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="prev-step-btn">← Sebelumnya</Button> : <span />}
          {step < 3
            ? <Button onClick={() => setStep(step + 1)} className="gap-2" data-testid="next-step-btn">Lanjut <ArrowRight className="size-4" /></Button>
            : <Button onClick={submit} className="gap-2" data-testid="submit-service-btn"><Save className="size-4" /> Simpan & Terima</Button>}
        </div>
      </Card>
    </div>
  );
}
