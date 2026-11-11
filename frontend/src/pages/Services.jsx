import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { fmtDate, fmtIDR, STATUS_COLORS, SERVICE_STATUSES, maskPhone } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit3, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

const ACCESSORIES = ["Charger", "Dus", "SIM", "Memory", "Softcase", "Lainnya"];
const EMPTY_FORM = {
  customer_id: "", brand: "", model: "", imei1: "", imei2: "", color: "",
  accessories: [], complaint: "", device_password: "", pattern: "", pin: "",
  estimated_cost: 0, dp: 0,
};

const paymentStatus = (service) => {
  const paid = Math.max(0, Number(service.total_paid) || 0);
  const due = Math.max(0, Number(service.final_cost ?? service.estimated_cost) || 0);
  if (paid === 0) return { label: "Belum bayar", className: "border-red-200 bg-red-50 text-red-700" };
  if (paid >= due) return { label: "Lunas", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  return { label: "Belum lunas", className: "border-amber-200 bg-amber-50 text-amber-700" };
};

export default function Services() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [customers, setCustomers] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const navigate = useNavigate();
  const canManageServices = ["owner", "admin", "kasir"].includes(user?.role);

  const load = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    const r = await api.get(`/services?${params.toString()}`);
    setItems(r.data);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load();  }, [q, status]);
  useEffect(() => {
    if (canManageServices) api.get("/customers").then((r) => setCustomers(r.data));
  }, [canManageServices]);

  const canEditOrDelete = (service) => (
    canManageServices
    && !service.assigned_technician_id
    && !["Selesai", "Sudah Diambil"].includes(service.status)
  );
  const canDelete = (service) => (
    canEditOrDelete(service)
    && !(Number(service.total_paid) > 0)
    && !(service.items_used || []).length
  );

  const edit = (service) => {
    setEditingService(service);
    setForm({
      customer_id: service.customer_id || "",
      brand: service.brand || "",
      model: service.model || "",
      imei1: service.imei1 || "",
      imei2: service.imei2 || "",
      color: service.color || "",
      accessories: service.accessories || [],
      complaint: service.complaint || "",
      device_password: service.device_password || "",
      pattern: service.pattern || "",
      pin: service.pin || "",
      estimated_cost: service.estimated_cost || 0,
      dp: service.dp || 0,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/services/${editingService.id}`, {
        ...form,
        estimated_cost: Number(form.estimated_cost),
        dp: Number(form.dp),
      });
      toast.success("Data service diperbarui");
      setEditOpen(false);
      setEditingService(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal memperbarui service");
    }
  };

  const del = async (service) => {
    if (!window.confirm(`Hapus service ${service.service_number}?`)) return;
    try {
      await api.delete(`/services/${service.id}`);
      toast.success("Service dihapus");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menghapus service");
    }
  };

  return (
    <div className="space-y-5" data-testid="services-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Workflow</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Service</h1>
        </div>
        <Button data-testid="new-service-btn" onClick={() => navigate("/services/new")} className={`gap-2 ${user?.role === "teknisi" ? "hidden" : ""}`}>
          <Plus className="size-4" /> Penerimaan Baru
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) setEditingService(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit Data Service</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pelanggan</Label>
              <Select value={form.customer_id} onValueChange={(value) => setForm({ ...form, customer_id: value })}>
                <SelectTrigger data-testid="edit-service-customer"><SelectValue placeholder="Pilih pelanggan..." /></SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name} • {customer.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><Label>Merk</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div><Label>IMEI 1</Label><Input value={form.imei1} onChange={(e) => setForm({ ...form, imei1: e.target.value })} /></div>
              <div><Label>IMEI 2</Label><Input value={form.imei2} onChange={(e) => setForm({ ...form, imei2: e.target.value })} /></div>
              <div><Label>Warna</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
              <div><Label>Password HP</Label><Input value={form.device_password} onChange={(e) => setForm({ ...form, device_password: e.target.value })} /></div>
              <div><Label>Pola</Label><Input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} /></div>
              <div><Label>PIN</Label><Input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
            </div>
            <div>
              <Label>Kelengkapan</Label>
              <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-6">
                {ACCESSORIES.map((accessory) => (
                  <label key={accessory} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.accessories.includes(accessory)}
                      onCheckedChange={(checked) => setForm({
                        ...form,
                        accessories: checked
                          ? [...form.accessories, accessory]
                          : form.accessories.filter((item) => item !== accessory),
                      })}
                    />
                    {accessory}
                  </label>
                ))}
              </div>
            </div>
            <div><Label>Keluhan Pelanggan</Label><Textarea rows={3} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Estimasi Biaya</Label><Input type="number" min="0" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} /></div>
              <div><Label>DP</Label><Input type="number" min="0" value={form.dp} onChange={(e) => setForm({ ...form, dp: e.target.value })} /></div>
            </div>
            <Button onClick={saveEdit} className="w-full" data-testid="save-service-edit">Simpan Perubahan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border border-border">
        <div className="p-4 border-b border-border flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari nomor / IMEI / nama / perangkat..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} data-testid="services-search-input" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]" data-testid="status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {SERVICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Service</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead className="hidden md:table-cell">Device</TableHead>
              <TableHead className="hidden lg:table-cell">Keluhan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pembayaran</TableHead>
              <TableHead className="hidden lg:table-cell">Estimasi</TableHead>
              <TableHead className="hidden md:table-cell">Tanggal Masuk</TableHead>
              <TableHead className="hidden md:table-cell">Tanggal Selesai</TableHead>
              {canManageServices && <TableHead className="w-24">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={canManageServices ? 10 : 9} className="text-center text-muted-foreground py-12">Belum ada service</TableCell></TableRow>}
            {items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/services/${s.id}`)} data-testid={`service-row-${s.service_number}`}>
                <TableCell className="font-mono text-sm font-semibold text-primary">{s.service_number}</TableCell>
                <TableCell>
                  <div className="font-semibold">{s.customer_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{maskPhone(s.customer_phone, user?.role)}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">{s.brand} {s.model}<div className="text-xs text-muted-foreground font-mono">{s.imei1}</div></TableCell>
                <TableCell className="hidden lg:table-cell max-w-[220px]">
                  <div className="line-clamp-2 text-sm" title={s.complaint || ""}>{s.complaint || "-"}</div>
                </TableCell>
                <TableCell><span className={`status-pill ${STATUS_COLORS[s.status] || ""}`}>{s.status}</span></TableCell>
                <TableCell><Badge variant="outline" className={paymentStatus(s).className}>{paymentStatus(s).label}</Badge></TableCell>
                <TableCell className="hidden lg:table-cell font-mono">{fmtIDR(s.estimated_cost)}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmtDate(s.created_at)}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                  {["Selesai", "Sudah Diambil"].includes(s.status)
                    ? fmtDate(s.completed_at || s.finished_at || s.status_history?.find((entry) => ["Selesai", "Sudah Diambil"].includes(entry.status))?.at)
                    : ""}
                </TableCell>
                {canManageServices && (
                  <TableCell>
                    {canEditOrDelete(s) && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); edit(s); }} data-testid={`edit-service-${s.id}`} aria-label="Edit service">
                          <Edit3 className="size-4" />
                        </Button>
                        {canDelete(s) && (
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); del(s); }} data-testid={`delete-service-${s.id}`} aria-label="Hapus service">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
