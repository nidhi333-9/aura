import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, Download, KeyRound, Laptop, Trash2 } from "lucide-react";
import { api } from "../api/client";
import useResource from "../hooks/useResource";
import { timeAgo } from "../utils/format";

const RAW = "https://raw.githubusercontent.com/nidhi333-9/aura/main/tracker";
// The code alphabet is [A-Z2-9] plus one dash, so it is safe in a shell with no quoting.
const macCommand = (code) => `curl -fsSL ${RAW}/install.sh | AURA_PAIR_CODE=${code} bash`;
const winCommand = (code) => `$env:AURA_PAIR_CODE="${code}"; irm ${RAW}/install.ps1 | iex`;

const FAST_POLL_MS = 3_000; // while a code is waiting to be used, notice the pairing quickly
const SLOW_POLL_MS = 30_000;

const CommandButton = ({ id, icon, label, command, dark, copied, onCopy }) => (
  <button
    type="button"
    onClick={() => onCopy(id, command)}
    className={`group relative flex items-center justify-between gap-3 text-white px-5 py-3.5 rounded-2xl transition-all duration-300 shadow-xl text-left ${
      dark
        ? "bg-gray-900 hover:bg-black shadow-gray-900/10 border border-gray-800"
        : "bg-[var(--aura-blue)] hover:brightness-110 shadow-[var(--aura-blue)]/20"
    }`}
  >
    <div className="flex items-center gap-3 overflow-hidden">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex flex-col items-start min-w-0">
        <span className={`text-[10px] uppercase font-bold leading-none mb-1 ${dark ? "text-gray-400" : "text-white/70"}`}>
          {label}
        </span>
        <code className="text-xs font-mono truncate max-w-[220px] sm:max-w-[420px]">{command}</code>
      </div>
    </div>
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 ${dark ? "bg-white/10" : "bg-white/15"}`}>
      {copied === id ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-300" />
          <span className="text-[11px] font-bold uppercase text-emerald-300">Copied</span>
        </>
      ) : (
        <>
          {dark ? <Copy className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          <span className="text-[11px] font-bold uppercase">Copy</span>
        </>
      )}
    </div>
  </button>
);

const mmss = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const SensorSetup = () => {
  const navigate = useNavigate();

  // A pairing in progress: the code, when it stops working (client clock, for the
  // countdown) and when the server issued it (server clock, to recognise the device that used
  // it without caring about clock skew).
  const [pairing, setPairing] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(null);

  const [confirmingId, setConfirmingId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [removedIds, setRemovedIds] = useState([]);
  const [revokeError, setRevokeError] = useState(null);

  const secondsLeft = pairing ? Math.max(0, Math.round((pairing.expiresAt - now) / 1000)) : 0;
  const expired = !!pairing && secondsLeft === 0;

  // Poll quickly only while a live code is waiting; otherwise a slow refresh is plenty.
  const waiting = !!pairing && !expired;
  const devicesRes = useResource("/api/devices", waiting ? FAST_POLL_MS : SLOW_POLL_MS);
  const devices = (devicesRes.data?.devices ?? []).filter((d) => !removedIds.includes(d.id));

  // The device that used our code is simply the one created after the code was issued.
  const connected = pairing
    ? devices.find((d) => Date.parse(d.created_at) >= pairing.issuedAt)
    : null;

  useEffect(() => {
    if (!waiting || connected) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting, connected]);

  const handleUnauthorized = (err) => {
    if (err.response?.status !== 401) return false;
    localStorage.removeItem("token");
    navigate("/", { replace: true });
    return true;
  };

  const generate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data } = await api.post("/api/devices/pair-code");
      const receivedAt = Date.now();
      setNow(receivedAt);
      setPairing({
        code: data.code,
        expiresAt: receivedAt + data.expires_in * 1000,
        issuedAt: Date.parse(data.expires_at) - data.expires_in * 1000,
      });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setGenerateError(err.response?.data?.error || "Couldn't create a pairing code. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = (key, text) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {}); // clipboard can be blocked; the text is on screen to select
  };

  const revoke = async (id) => {
    setRevokingId(id);
    setRevokeError(null);
    try {
      await api.delete(`/api/devices/${id}`);
      setRemovedIds((ids) => [...ids, id]); // disappear now; the next refresh confirms it
      devicesRes.retry();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setRevokeError(err.response?.data?.error || "Couldn't remove that device. Please try again.");
    } finally {
      setRevokingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <section
      id="connect-sensor"
      className="mt-16 bg-white/60 backdrop-blur-xl p-8 md:p-12 rounded-[40px] border border-white/40 shadow-xl"
    >
      <div className="max-w-xl mx-auto text-center mb-10">
        <span className="inline-flex items-center gap-1.5 text-[var(--aura-blue)] font-bold tracking-widest uppercase text-[11px] bg-[var(--aura-blue)]/10 border border-[var(--aura-blue)]/20 px-4 py-1.5 rounded-full">
          Connect Sensor
        </span>
        <h2 className="text-3xl font-extrabold text-[var(--aura-dark)] mt-4 mb-3 tracking-tight">
          Run this on your machine
        </h2>
        <p className="text-gray-500 font-medium text-sm">
          The command carries a one-time pairing code, not your login. It works once, expires in 10
          minutes, and the sensor then gets its own key that you can remove below at any time.
        </p>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl mx-auto">
        {connected ? (
          <div role="status" className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl px-6 py-5">
            <Check className="w-6 h-6 shrink-0" />
            <div className="flex-grow">
              <p className="font-extrabold">Connected: {connected.name}</p>
              <p className="text-sm font-medium text-emerald-800">
                It will start showing up in your dashboard within a minute.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPairing(null)}
              className="text-sm font-bold underline underline-offset-4 hover:opacity-80 shrink-0"
            >
              Add another device
            </button>
          </div>
        ) : pairing && !expired ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-6 py-4">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Pairing code</p>
                <p className="text-2xl sm:text-3xl font-black font-mono tracking-widest whitespace-nowrap text-[var(--aura-dark)]" data-testid="pair-code">
                  {pairing.code}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm font-semibold text-slate-500 tabular-nums">Expires in {mmss(secondsLeft)}</p>
                <button
                  type="button"
                  onClick={() => copy("code", pairing.code)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[var(--aura-dark)] whitespace-nowrap"
                >
                  {copied === "code" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === "code" ? "Copied" : "Copy code"}
                </button>
              </div>
            </div>
            <CommandButton id="mac" dark icon="🍎" label="macOS Terminal" command={macCommand(pairing.code)} copied={copied} onCopy={copy} />
            <CommandButton id="windows" icon="🪟" label="Windows PowerShell" command={winCommand(pairing.code)} copied={copied} onCopy={copy} />
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              <span className="font-semibold text-gray-500">macOS:</span> paste into Terminal.{" "}
              <span className="font-semibold text-gray-500">Windows:</span> paste into PowerShell. This page
              notices when the sensor connects.
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {expired && (
              <p role="status" className="text-sm font-semibold text-amber-700">
                That code expired. Generate a new one.
              </p>
            )}
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 bg-[var(--aura-dark)] text-white px-7 py-3.5 rounded-2xl text-sm font-bold shadow-lg hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              <KeyRound size={16} />
              {generating ? "Creating code…" : expired ? "Generate a new code" : "Get install command"}
            </button>
            {generateError && (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {generateError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* devices */}
      <div className="max-w-2xl mx-auto mt-12 pt-8 border-t border-slate-200/70">
        <h3 className="text-lg font-extrabold text-[var(--aura-dark)] tracking-tight mb-4">Your devices</h3>

        {revokeError && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
            {revokeError}
          </p>
        )}

        {devicesRes.error && !devicesRes.data ? (
          <p className="text-sm font-medium text-slate-500">
            Couldn't load your devices.{" "}
            <button type="button" onClick={devicesRes.retry} className="underline underline-offset-4 font-bold hover:opacity-80">
              Try again
            </button>
          </p>
        ) : !devicesRes.data ? (
          <p className="text-sm font-medium text-slate-400">Loading…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm font-medium text-slate-500">
            No devices paired yet. Sensors installed before pairing existed still work, but only
            paired devices are listed here.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white/80 rounded-2xl border border-slate-100 px-5 py-3.5">
                <Laptop size={20} className="text-slate-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-grow">
                  <p className="font-bold text-[var(--aura-dark)] truncate">{d.name}</p>
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`inline-block w-2 h-2 rounded-full ${d.online ? "bg-green-500" : "bg-slate-300"}`}
                    />
                    {d.online ? "Online" : d.last_seen ? `Last seen ${timeAgo(d.last_seen)}` : "Not seen yet"}
                    {d.os ? ` · ${d.os}` : ""}
                  </p>
                </div>
                {confirmingId === d.id ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-600">Remove? Its sensor will stop recording.</span>
                    <button
                      type="button"
                      onClick={() => revoke(d.id)}
                      disabled={revokingId === d.id}
                      className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-60"
                    >
                      {revokingId === d.id ? "Removing…" : "Remove"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 font-bold text-slate-600 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(d.id)}
                    aria-label={`Remove ${d.name}`}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default SensorSetup;
