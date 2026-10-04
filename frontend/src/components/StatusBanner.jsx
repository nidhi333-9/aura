import { CircleAlert, EyeOff, Info, WifiOff } from "lucide-react";
import { timeAgo } from "../utils/format";

const TONES = {
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  blue: "bg-sky-50 text-sky-800 border-sky-200",
};

// One banner at a time, most important first. Renders nothing when everything is fine.
const StatusBanner = ({ live, onInstallClick, onPermissionsClick }) => {
  const sensor = live.data?.sensor;

  let banner = null;
  if (live.error && !live.data) {
    banner = {
      tone: "amber",
      Icon: WifiOff,
      text: "Can't reach the Aura server right now. Retrying automatically…",
    };
  } else if (live.loading && live.slow) {
    banner = {
      tone: "blue",
      Icon: Info,
      text: "Waking up the server — the first load after a quiet period can take up to a minute.",
    };
  } else if (live.data && !sensor?.last_seen) {
    banner = {
      tone: "amber",
      Icon: CircleAlert,
      text: "No sensor connected yet. Install it to start tracking.",
      action: "Install sensor",
      onAction: onInstallClick,
    };
  } else if (live.data && !sensor?.online) {
    banner = {
      tone: "amber",
      Icon: CircleAlert,
      text: `Sensor offline — last seen ${timeAgo(sensor.last_seen)}. Nothing new is being recorded.`,
      action: "Reconnect",
      onAction: onInstallClick,
    };
  } else if (live.data && sensor?.titles_unreadable) {
    banner = {
      tone: "amber",
      Icon: EyeOff,
      text: "Your sensor can't read window titles, so websites show up as “Other website”. Your Mac needs two permissions turned on.",
      action: "Show me how",
      onAction: onPermissionsClick,
    };
  } else if (live.error) {
    banner = {
      tone: "amber",
      Icon: WifiOff,
      text: "Connection problem — showing the last data we received.",
    };
  }

  if (!banner) return null;
  const { tone, Icon, text, action, onAction } = banner;

  return (
    <div
      role="status"
      className={`mb-8 flex flex-wrap items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-medium ${TONES[tone]}`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="flex-grow">{text}</span>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="underline underline-offset-4 font-bold hover:opacity-80"
        >
          {action}
        </button>
      )}
    </div>
  );
};

export default StatusBanner;
