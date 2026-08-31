import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Radio,
  LogOut,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Activity,
  Plus,
  Pencil,
  Trash2,
  Zap,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="ti-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono-ti text-[11px] text-slate-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="font-heading text-3xl font-extrabold text-white mt-1">
            {value}
          </p>
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    delivered: ["bg-emerald-500/15 text-emerald-400 border-emerald-500/30", CheckCircle2, "DELIVERED"],
    failed: ["bg-red-500/15 text-red-400 border-red-500/30", XCircle, "FAILED"],
    pending: ["bg-amber-500/15 text-amber-400 border-amber-500/30", Activity, "PENDING"],
  };
  const [cls, Icon, text] = map[status] || map.pending;
  return (
    <Badge className={`${cls} border hover:bg-transparent`}>
      <Icon className="w-3 h-3 mr-1" /> {text}
    </Badge>
  );
}

const emptyForm = { key: "", name: "", bot_token: "", chat_id: "", active: true };

export default function AdminPanel() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);

  const loadAll = async () => {
    try {
      const [s, c, l] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/clients"),
        api.get("/admin/logs"),
      ]);
      setStats(s.data);
      setClients(c.data);
      setLogs(l.data);
    } catch (e) {
      toast.error("Data load nahi hua");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowToken(false);
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      key: c.key,
      name: c.name,
      bot_token: c.bot_token,
      chat_id: c.chat_id,
      active: c.active,
    });
    setShowToken(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.key.trim() || !form.name.trim() || !form.bot_token.trim() || !form.chat_id.trim()) {
      return toast.error("Saari fields bharo");
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/clients/${editing.id}`, form);
        toast.success("Client update ho gaya");
      } else {
        await api.post("/admin/clients", form);
        toast.success("Client add ho gaya");
      }
      setDialogOpen(false);
      loadAll();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail, "Save fail"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Client "${c.key}" delete karna hai?`)) return;
    try {
      await api.delete(`/admin/clients/${c.id}`);
      toast.success("Client delete ho gaya");
      loadAll();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    }
  };

  const handleTest = async (c) => {
    setTestingId(c.id);
    try {
      await api.post(`/admin/clients/${c.id}/test`);
      toast.success(`${c.name} ke Telegram par test message chala gaya ✅`);
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail, "Test fail — token/chat id check karo"));
    } finally {
      setTestingId(null);
    }
  };

  const doLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="ti-bg min-h-screen">
      <div className="ti-grid min-h-screen">
        <header className="border-b border-white/5 backdrop-blur-md sticky top-0 z-20 bg-[#090D16]/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center ti-glow">
                <Radio className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-lg leading-none text-white">
                  PAPIATMA MODULE <span className="text-sky-400">Admin</span>
                </h1>
                <p className="font-mono-ti text-[10px] text-slate-500 tracking-widest uppercase">
                  {admin?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={doLogout}
              className="border-red-500/30 bg-slate-900/50 text-red-300 hover:bg-red-500/10"
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-slate-900/60 border border-white/10 mb-6">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="clients" data-testid="tab-clients">Clients</TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <StatCard icon={Users} label="Total Clients" value={stats?.total_clients ?? "-"} color="#38BDF8" />
                <StatCard icon={Zap} label="Active Clients" value={stats?.active_clients ?? "-"} color="#10B981" />
                <StatCard icon={Send} label="Total Sent" value={stats?.total_sent ?? "-"} color="#38BDF8" />
                <StatCard icon={CheckCircle2} label="Delivered" value={stats?.delivered ?? "-"} color="#10B981" />
                <StatCard icon={XCircle} label="Failed" value={stats?.failed ?? "-"} color="#EF4444" />
                <StatCard icon={Activity} label="Success Rate" value={`${stats?.success_rate ?? 0}%`} color="#F59E0B" />
              </div>
            </TabsContent>

            {/* Clients */}
            <TabsContent value="clients">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-xl font-bold text-white">Clients</h2>
                <Button onClick={openCreate} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold" data-testid="add-client-btn">
                  <Plus className="w-4 h-4 mr-2" /> Add Client
                </Button>
              </div>
              <div className="ti-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto ti-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-slate-400">Key</TableHead>
                        <TableHead className="text-slate-400">Name</TableHead>
                        <TableHead className="text-slate-400">Chat ID</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.length === 0 && (
                        <TableRow className="border-white/5">
                          <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                            Koi client nahi. "Add Client" se shuru karo.
                          </TableCell>
                        </TableRow>
                      )}
                      {clients.map((c) => (
                        <TableRow key={c.id} className="border-white/5 hover:bg-slate-800/30" data-testid={`client-row-${c.key}`}>
                          <TableCell className="font-mono-ti text-sky-300 font-medium">{c.key}</TableCell>
                          <TableCell className="text-slate-200">{c.name}</TableCell>
                          <TableCell className="font-mono-ti text-slate-400 text-xs">{c.chat_id}</TableCell>
                          <TableCell>
                            {c.active ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-transparent">Active</Badge>
                            ) : (
                              <Badge className="bg-slate-500/15 text-slate-400 border border-slate-500/30 hover:bg-transparent">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleTest(c)} disabled={testingId === c.id} className="text-amber-400 hover:bg-amber-500/10 h-8 w-8 p-0" title="Test connection" data-testid={`test-client-${c.key}`}>
                                {testingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="text-sky-400 hover:bg-sky-500/10 h-8 w-8 p-0" title="Edit" data-testid={`edit-client-${c.key}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(c)} className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0" title="Delete" data-testid={`delete-client-${c.key}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Logs */}
            <TabsContent value="logs">
              <h2 className="font-heading text-xl font-bold text-white mb-4">Message Logs</h2>
              <div className="ti-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto ti-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-slate-400">Time</TableHead>
                        <TableHead className="text-slate-400">Client</TableHead>
                        <TableHead className="text-slate-400">Sender</TableHead>
                        <TableHead className="text-slate-400">Body</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 && (
                        <TableRow className="border-white/5">
                          <TableCell colSpan={5} className="text-center text-slate-500 py-8">Abhi tak koi log nahi.</TableCell>
                        </TableRow>
                      )}
                      {logs.map((l) => (
                        <TableRow key={l.id} className="border-white/5 hover:bg-slate-800/30">
                          <TableCell className="font-mono-ti text-xs text-slate-500 whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</TableCell>
                          <TableCell className="font-mono-ti text-sky-300 text-xs">{l.client_key}</TableCell>
                          <TableCell className="font-mono-ti text-slate-300 text-xs">{l.sender_id}</TableCell>
                          <TableCell className="text-slate-300 text-sm max-w-xs truncate">{l.body}{l.error ? <span className="block text-red-400 text-[11px]">{l.error}</span> : null}</TableCell>
                          <TableCell><StatusBadge status={l.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Client dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editing ? "Edit Client" : "Add Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300 mb-2 block">Key</Label>
                <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="ramu" className="bg-slate-950/60 border-slate-700 font-mono-ti" data-testid="form-key-input" />
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Client Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Clinkit" className="bg-slate-950/60 border-slate-700" data-testid="form-name-input" />
              </div>
            </div>
            <div>
              <Label className="text-slate-300 mb-2 block">Telegram Bot Token</Label>
              <div className="relative">
                <Input type={showToken ? "text" : "password"} value={form.bot_token} onChange={(e) => setForm({ ...form, bot_token: e.target.value })} placeholder="123456:ABC-DEF..." className="bg-slate-950/60 border-slate-700 font-mono-ti pr-10" data-testid="form-token-input" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-400">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-slate-300 mb-2 block">Telegram Chat ID</Label>
              <Input value={form.chat_id} onChange={(e) => setForm({ ...form, chat_id: e.target.value })} placeholder="-1001234567890" className="bg-slate-950/60 border-slate-700 font-mono-ti" data-testid="form-chatid-input" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-950/40 border border-slate-700 px-4 py-3">
              <div>
                <p className="text-slate-200 text-sm font-medium">Active</p>
                <p className="text-slate-500 text-xs">Inactive clients ko messages nahi bheje ja sakte</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="form-active-switch" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold" data-testid="save-client-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
