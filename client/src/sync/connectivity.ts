import { runSync } from "./syncEngine";

export function startConnectivityMonitoring(): () => void {
  const onOnline = () => void runSync();
  const onVisible = () => {
    if (document.visibilityState === "visible") void runSync();
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(() => void runSync(), 60_000);

  void runSync(); // attempt immediately on mount

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
  };
}
