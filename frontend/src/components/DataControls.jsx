import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { api } from "../api/client";
import useResource from "../hooks/useResource";

// "Your data": what Aura holds about you, and two ways to remove it. Deleting always takes a
// second, deliberate step, and the server insists on it too (it wants the word DELETE).
const CONFIRM_WORD = "DELETE";
const SUMMARY_REFRESH_MS = 5 * 60 * 1000;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const DataControls = () => {
  const navigate = useNavigate();
  const summary = useResource("/api/account/summary", SUMMARY_REFRESH_MS);
  const [step, setStep] = useState(null); // null | "data" | "account"
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const held = summary.data;

  const cancel = () => {
    setStep(null);
    setTyped("");
    setError(null);
  };

  // Returns true when the server did it.
  const remove = async (url) => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(url, { data: { confirm: CONFIRM_WORD } });
      return true;
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/", { replace: true });
        return false;
      }
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const deleteData = async () => {
    if (!(await remove("/api/account/data"))) return;
    setStep(null);
    setDone("All your tracked data was deleted. Reloading…");
    setTimeout(() => window.location.reload(), 1200);
  };

  const deleteAccount = async () => {
    if (!(await remove("/api/account"))) return;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  return (
    <section
      id="your-data"
      className="mt-16 bg-white/60 backdrop-blur-xl p-8 md:p-12 rounded-[40px] border border-white/40 shadow-xl"
    >
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-extrabold text-[var(--aura-dark)] tracking-tight">Your data</h2>
        <p className="text-sm font-medium text-slate-500 mt-2">
          {summary.error && !held ? (
            <>
              Couldn't check what Aura holds.{" "}
              <button type="button" onClick={summary.retry} className="underline underline-offset-4 font-bold hover:opacity-80">
                Try again
              </button>
            </>
          ) : !held ? (
            "Checking what Aura holds…"
          ) : held.samples === 0 ? (
            "Aura holds no tracked activity for you right now."
          ) : (
            <>
              Aura holds <b>{held.samples.toLocaleString()}</b> tracked samples
              {held.first_sample ? ` since ${formatDate(held.first_sample)}` : ""}, including the window titles.
            </>
          )}{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-4 font-bold hover:opacity-80">
            Read the privacy notice
          </a>
          .
        </p>

        {done && (
          <p role="status" className="mt-5 text-sm font-semibold text-emerald-700">
            {done}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-5 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        {!done && step === null && (
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              type="button"
              onClick={() => setStep("data")}
              className="flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-2xl border border-slate-200 bg-white text-[var(--aura-dark)] hover:bg-slate-50 transition-colors"
            >
              <Trash2 size={15} />
              Delete my tracked data
            </button>
            <button
              type="button"
              onClick={() => setStep("account")}
              className="flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-2xl border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} />
              Delete my account
            </button>
          </div>
        )}

        {step === "data" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/70 px-6 py-5">
            <p className="text-sm font-semibold text-red-900">
              Delete all your tracked samples and every chart? Your account and paired devices stay, and the sensor
              keeps recording new activity. This can't be undone.
            </p>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={deleteData}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Yes, delete my data"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "account" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/70 px-6 py-5">
            <p className="text-sm font-semibold text-red-900">
              This deletes your account, your paired devices and all your tracked data. Your sensors stop by
              themselves. This can't be undone.
            </p>
            <label className="block mt-4 text-sm font-semibold text-red-900" htmlFor="confirm-delete">
              Type <b>{CONFIRM_WORD}</b> to confirm
            </label>
            <input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full max-w-xs px-4 py-2 rounded-xl border border-red-200 bg-white text-sm font-mono tracking-widest"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={deleteAccount}
                disabled={busy || typed !== CONFIRM_WORD}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? "Deleting…" : "Delete my account"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DataControls;
