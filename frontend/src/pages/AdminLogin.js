import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, ArrowLeft, Lock } from "lucide-react";

export default function AdminLogin() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (admin) navigate("/admin", { replace: true });
  }, [admin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login successful");
      navigate("/admin", { replace: true });
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail, "Login fail ho gaya"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ti-bg min-h-screen">
      <div className="ti-grid min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-sky-400 text-sm mb-6 transition-colors"
            data-testid="back-home-link"
          >
            <ArrowLeft className="w-4 h-4" /> Inject Panel par wapas
          </Link>

          <div className="ti-card rounded-2xl p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-14 h-14 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center ti-glow mb-4">
                <ShieldCheck className="w-7 h-7 text-sky-400" />
              </div>
              <h1 className="font-heading text-2xl font-extrabold text-white tracking-tight">
                Admin Access
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Clients aur tokens manage karne ke liye login karo
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-slate-300 mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@teleinject.com"
                  className="bg-slate-950/60 border-slate-700 text-white h-12"
                  data-testid="admin-email-input"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-950/60 border-slate-700 text-white h-12"
                  data-testid="admin-password-input"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold ti-glow"
                data-testid="admin-login-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" /> Login
                  </>
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
