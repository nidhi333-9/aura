// What a Mac user must switch on once, or every window title reads "Unknown". The dashboard
// banner "Show me how" scrolls here (id="mac-permissions"), and it is always visible so a
// first-time user sees it right next to the install command.

const Step = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--aura-blue)]/10 text-[var(--aura-blue)] text-xs font-black flex items-center justify-center">
      {n}
    </span>
    <span>{children}</span>
  </li>
);

const MacPermissions = () => (
  <div
    id="mac-permissions"
    className="max-w-2xl mx-auto mt-10 bg-white/80 rounded-2xl border border-slate-100 px-6 py-5 text-left scroll-mt-24"
  >
    <h3 className="text-lg font-extrabold text-[var(--aura-dark)] tracking-tight">
      On a Mac: allow 2 things (one time)
    </h3>
    <p className="text-sm font-medium text-slate-500 mt-1 mb-4">
      macOS keeps window titles private until you say yes. Without this, every website shows up as
      “Other website”. Windows doesn't need this.
    </p>
    <ol className="flex flex-col gap-3 text-sm font-medium text-slate-700">
      <Step n={1}>
        Open <b>System Settings → Privacy &amp; Security → Accessibility</b> and turn on{" "}
        <b>Terminal</b> (the app you pasted the command into, for example iTerm).
      </Step>
      <Step n={2}>
        Open <b>Privacy &amp; Security → Automation</b>. Under <b>Terminal</b>, turn on{" "}
        <b>System Events</b>, and your browser (Chrome, Safari…) so Aura can learn the website's name.
        If a switch isn't there yet, macOS asks by itself the first time: click <b>OK</b>.
      </Step>
      <Step n={3}>
        Quit Terminal completely (<b>Cmd + Q</b>), open it again and start the sensor with{" "}
        <code className="bg-slate-100 rounded px-1.5 py-0.5 text-xs font-mono">~/.aura/aura-sensor</code>{" "}
        (no code needed).
      </Step>
    </ol>
    <p className="text-xs font-medium text-slate-400 mt-4">
      Aura only sends a website's name (like linkedin.com), never the full address, and skips private windows.
    </p>
  </div>
);

export default MacPermissions;
