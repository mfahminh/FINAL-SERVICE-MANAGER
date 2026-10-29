import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Wrench, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

const REMEMBERED_EMAIL_KEY = "service-manager-remembered-email";

export default function Login() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) || "");
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY)));
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (rememberEmail) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      toast.error("Preferensi ingat email tidak dapat disimpan di perangkat ini.");
    }
    const ok = await login(email, password);
    setLoading(false);
    if (ok) { toast.success("Login berhasil"); navigate("/"); }
  };

  const handleForgot = async () => {
    try {
      await api.post("/auth/forgot-password", { email });
      toast.success("Jika email terdaftar, link reset telah dikirim.");
      setShowForgot(false);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left visual */}
      <div className="hidden lg:flex flex-1 relative bg-zinc-950 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1741392075783-87332ac08840?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxtb3RoZXJib2FyZCUyMG1hY3JvJTIwbWluaW1hbHxlbnwwfHx8fDE3ODI0NjQ3NDd8MA&ixlib=rb-4.1.0&q=85"
          alt="motherboard"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-950/60 to-orange-950/40" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="size-5" />
            </div>
            <div className="font-display font-black text-xl tracking-tight">SERVICE HP MANAGER</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-orange-400 mb-3">Workshop Operating System</div>
            <h1 className="font-display font-black text-5xl xl:text-6xl leading-[0.95] mb-6">
              Kelola Service<br/>HP Anda.<br/>
              <span className="text-orange-500">Tanpa Kacau.</span>
            </h1>
            <p className="text-zinc-300 max-w-md text-sm leading-relaxed">
              Dari penerimaan barang, diagnosa teknisi, sampai pembayaran dan garansi - semua dalam satu kontrol panel yang dirancang untuk konter modern.
            </p>
          </div>
          <div className="text-xs text-zinc-500 font-mono">// v1.0 • Production Build</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Wrench className="size-5" />
            </div>
            <span className="font-display font-black text-lg">SERVICE HP MANAGER</span>
          </div>

          {!showForgot ? (
            <>
              <div className="mb-8">
                <div className="text-[11px] uppercase tracking-[0.3em] text-primary mb-2">Sign In</div>
                <h2 className="font-display font-black text-3xl tracking-tight">Selamat datang kembali</h2>
                <p className="text-sm text-muted-foreground mt-2">Masuk untuk melanjutkan workflow service Anda</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    data-testid="login-email-input" required className="mt-1.5" />
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline" data-testid="forgot-password-link">
                      Lupa password?
                    </button>
                  </div>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    data-testid="login-password-input" required className="mt-1.5" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="remember-email" checked={rememberEmail} onCheckedChange={(checked) => setRememberEmail(checked === true)}
                    data-testid="remember-email-checkbox" />
                  <Label htmlFor="remember-email" className="text-sm font-normal cursor-pointer">Ingat email di perangkat ini</Label>
                </div>
                {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-md" data-testid="login-error">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full gap-2" data-testid="login-submit-btn">
                  {loading ? "Memproses..." : "Masuk"} <ArrowRight className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-display font-black text-3xl mb-2">Reset Password</h2>
              <p className="text-sm text-muted-foreground mb-6">Masukkan email Anda untuk menerima link reset.</p>
              <div className="space-y-4">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" data-testid="forgot-email-input" />
                <div className="flex gap-2">
                  <Button onClick={handleForgot} className="flex-1" data-testid="forgot-submit-btn">Kirim Link</Button>
                  <Button variant="outline" onClick={() => setShowForgot(false)} data-testid="forgot-cancel-btn">Batal</Button>
                </div>
              </div>
            </>
          )}

          <div className="mt-8 text-center">
            <Link to="/track" className="text-xs text-muted-foreground hover:text-foreground" data-testid="public-track-link">
              Cek status service tanpa login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
