"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (process.env.NODE_ENV !== "production" || isLocal) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(keys.map((key) => caches.delete(key))),
        );
      }
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
