import { runSync } from "./syncEngine";

export function startConnectivityMonitoring(): () => void {
  const onOnline = () => void runSync(undefined, { pullOnly: true });
  const onVisible = () => {
    if (document.visibilityState === "visible") void runSync(undefined, { pullOnly: true });
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(() => void runSync(undefined, { pullOnly: true }), 60_000);

  void runSync(undefined, { pullOnly: true }); // attempt immediately on mount

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
  };
}
