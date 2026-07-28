"use client";

import { SessionProvider } from "next-auth/react";
import UpdateChecker from "./UpdateChecker";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import InstallPrompt from "./InstallPrompt";
import ActivityTracker from "./ActivityTracker";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      <UpdateChecker />
      <InstallPrompt />
      <ActivityTracker />
      {children}
    </SessionProvider>
  );
}
