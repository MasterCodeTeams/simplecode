"use client";

import { useEffect, useState } from "react";

// Tipe event beforeinstallprompt (belum ada di lib TypeScript bawaan).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari gak dukung display-mode media query buat ini, tapi
    // punya property khusus sendiri.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Kalau sudah dibuka dari home screen (sudah ter-install), jangan
    // pernah tampilin popup ini.
    if (isStandalone()) return;

    setIsIosDevice(isIos());

    // Android/Chrome/Edge: tunggu browser nawarin event ini, tahan popup
    // bawaannya, terus tampilin popup versi kita sendiri.
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    }

    // iOS gak punya event beforeinstallprompt sama sekali — langsung
    // tampilin popup instruksi manual (asal bukan sedang standalone).
    if (isIos()) {
      setShow(true);
    }

    // Begitu user benar-benar install (lewat popup kita ATAU lewat menu
    // browser langsung), popup langsung disembunyikan.
    function handleAppInstalled() {
      setShow(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-5 shadow-xl">
        <h2 className="text-base font-semibold mb-2">Install Master Code</h2>

        {isIosDevice ? (
          <p className="text-sm text-gray-400 mb-5">
            Tekan tombol <span className="font-medium">Share</span> di
            Safari, lalu pilih{" "}
            <span className="font-medium">&quot;Add to Home Screen&quot;</span>{" "}
            biar Master Code bisa dibuka langsung dari home screen kamu.
          </p>
        ) : (
          <p className="text-sm text-gray-400 mb-5">
            Install Master Code ke perangkat kamu biar bisa dibuka langsung
            dari home screen, tanpa buka browser dulu.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setShow(false)}
            className="px-3 py-1.5 rounded-lg text-sm border border-border"
          >
            Nanti
          </button>
          {!isIosDevice && (
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-lg text-sm bg-accent font-medium"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
