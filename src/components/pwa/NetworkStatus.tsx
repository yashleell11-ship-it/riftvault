"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function NetworkStatus() {
  useEffect(() => {
    const onOffline = () => toast.warning("You are offline", { description: "Some features need a connection." });
    const onOnline = () => toast.success("Back online");

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
