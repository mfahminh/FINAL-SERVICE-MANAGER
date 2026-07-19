import { useEffect, useState } from "react";
import api, { fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const empty = { email: "", password: "", name: "", role: "kasir", phone: "" };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => setUsers((await api.get("/users")).data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load();  }, []);

  const isAdmin = me?.role === "admin";
  const save = async () => {
    try {
      if (isAdmin) {
        await api.post("/user-change-requests", { action: "create", payload: form });
        toast.success("Request dikirim ke Owner"); setOpen(false); setForm(empty); return;
      }
      await api.post("/users", form);
      toast.success("Tersimpan"); setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus user?")) return;
    try { await api.delete(`/users/${id}`); toast.success("Dihapus"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-5" data-testid="users-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Akses</div>
          <h1 className="font-display font-black text-3xl tracking-tight">Manajemen User</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2" data-testid="add-user-btn"><Plus className="size-4" />Tambah User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>User Baru</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="u-name" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="u-email" /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="u-pass" /></div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="u-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {me?.role === "owner" && <SelectItem value="owner">Owner</SelectItem>}
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teknisi">Teknisi</SelectItem>
                    <SelectItem value="kasir">Kasir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={save} className="w-full" data-testid="save-user-btn">Buat</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="hidden md:table-cell">Dibuat</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold">{u.name}</TableCell>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell><Badge variant="outline" className="uppercase text-[10px]">{u.role}</Badge></TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                <TableCell>{me?.role === "owner" && u.id !== me.id && <Button size="icon" variant="ghost" onClick={() => del(u.id)}><Trash2 className="size-4 text-destructive" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
