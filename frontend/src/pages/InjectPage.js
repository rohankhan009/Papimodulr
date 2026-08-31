import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Radio,
  ShieldCheck,
  Loader2,
  Signal,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function StatusBadge({ status }) {
  if (status === "delivered")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/15">
        <CheckCircle2 className="w-3 h-3 mr-1" /> DELIVERED
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/15">
        <XCircle className="w-3 h-3 mr-1" /> FAILED
      </Badge>
    );
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30">
      <Clock className="w-3 h-3 mr-1" /> PENDING
    </Badge>
  );
}

export default function InjectPage() {
  const [clients, setClients] = useState([]);
  const [clientKey, setClientKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);

  const loadClients = async () => {
    try {
      const res = await api.get("/clients/public");
      setClients(res.data);
    } catch (e) {
      /* ignore */
    }
  };

  const loadLogs = async () => {
    try {
      const res = await api.get("/logs", { params: { limit: 15 } });
      setLogs(res.data);
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    loadClients();
    loadLogs();
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.key === clientKey),
    [clients, clientKey]
  );

  const handleSend = async () => {
    if (!clientKey) return toast.error("Pehle client key chuno");
    if (!senderId.trim()) return toast.error("Sender ID daalo");
    if (!body.trim()) return toast.error("Message body daalo");
    setSending(true);
    try {
      const res = await api.post("/inject", {
        client_key: clientKey,
        sender_id: senderId,
        body,
      });
      if (res.data?.status === "failed") {
        toast.error(res.data.detail || "Telegram par send fail ho gaya");
      } else {
        toast.success("Telegram par bhej diya gaya ✅");
        setBody("");
      }
      loadLogs();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail, "Send fail ho gaya"));
      loadLogs();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ti-bg min-h-screen">
      <div className="ti-grid min-h-screen">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-md sticky top-0 z-20 bg-[#090D16]/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center ti-glow">
                <Radio className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-lg leading-none text-white tracking-tight">
                  TeleInject
                </h1>
                <p className="font-mono-ti text-[10px] text-sky-400/70 tracking-widest uppercase">
                  SMS → Telegram Dispatch
                </p>
              </div>
            </div>
            <Link to="/admin/login" data-testid="admin-panel-link">
              <Button
                variant="outline"
                className="border-sky-500/30 bg-slate-900/50 text-sky-300 hover:bg-sky-500/10 hover:text-sky-200"
                data-testid="go-admin-btn"
              >
                <ShieldCheck className="w-4 h-4 mr-2" /> Admin Panel
              </Button>
            </Link>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Message <span className="text-sky-400">Inject</span> Panel
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-2xl">
              Client key chuno, Sender ID aur Message Body daalo — wahi message
              turant us client ke Telegram par SMS jaisa pahunch jayega.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:col-span-3 ti-card rounded-2xl p-6 sm:p-8"
            >
              <div className="space-y-6">
                <div>
                  <Label className="text-slate-300 mb-2 block font-medium">
                    Client Key
                  </Label>
                  <Select value={clientKey} onValueChange={setClientKey}>
                    <SelectTrigger
                      className="bg-slate-950/60 border-slate-700 text-white h-12 font-mono-ti"
                      data-testid="client-key-select"
                    >
                      <SelectValue placeholder="-- Client chuno (jaise: ramu) --" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                      {clients.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          Koi client nahi. Admin panel se add karo.
                        </div>
                      )}
                      {clients.map((c) => (
                        <SelectItem
                          key={c.key}
                          value={c.key}
                          className="font-mono-ti"
                          data-testid={`client-option-${c.key}`}
                        >
                          {c.key} · {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300 mb-2 block font-medium">
                    Sender ID
                  </Label>
                  <Input
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    placeholder="AD-PAPIATMA-s"
                    className="bg-slate-950/60 border-slate-700 text-white h-12 font-mono-ti"
                    data-testid="sender-id-input"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-slate-300 font-medium">
                      Message Body
                    </Label>
                    <span className="font-mono-ti text-xs text-slate-500">
                      {body.length} chars
                    </span>
                  </div>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Papiji i love you"
                    rows={5}
                    className="bg-slate-950/60 border-slate-700 text-white resize-none font-mono-ti"
                    data-testid="message-body-input"
                  />
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sending}
                  className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-base ti-glow"
                  data-testid="send-inject-btn"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Bhej raha
                      hai...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" /> Telegram par Bhejo
                    </>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* Preview */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="lg:col-span-2 space-y-6"
            >
              <div className="ti-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Signal className="w-4 h-4 text-sky-400" />
                  <h3 className="font-heading font-semibold text-white text-sm uppercase tracking-wider">
                    Live Telegram Preview
                  </h3>
                </div>
                <div className="rounded-2xl bg-slate-800/70 border border-sky-500/20 p-4 min-h-[120px]">
                  <div className="text-[11px] text-slate-500 font-mono-ti mb-2">
                    {selectedClient
                      ? `@ ${selectedClient.name}`
                      : "Client not selected"}
                  </div>
                  <div className="rounded-xl bg-slate-900/80 border border-white/5 px-4 py-3">
                    <p className="font-mono-ti text-sm font-bold text-sky-300 break-words">
                      {senderId || "SENDER-ID"}
                    </p>
                    <p className="font-mono-ti text-sm text-slate-200 whitespace-pre-wrap break-words mt-1">
                      {body || "Message body yahan dikhega..."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="ti-card rounded-2xl p-6">
                <h3 className="font-heading font-semibold text-white text-sm uppercase tracking-wider mb-4">
                  Recent Dispatches
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto ti-scroll pr-1" data-testid="public-logs">
                  {logs.length === 0 && (
                    <p className="text-slate-500 text-sm">Abhi tak koi message nahi.</p>
                  )}
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-lg bg-slate-950/50 border border-white/5 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono-ti text-xs text-sky-300 truncate">
                          {l.sender_id}
                        </span>
                        <StatusBadge status={l.status} />
                      </div>
                      <p className="text-xs text-slate-400 truncate">{l.body}</p>
                      <p className="text-[10px] text-slate-600 font-mono-ti mt-1">
                        {l.client_key} · {new Date(l.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
