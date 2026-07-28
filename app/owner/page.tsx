"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaUsers, FaUserClock, FaChartLine, FaClock, FaPoll } from "react-icons/fa";
import { isOwner } from "@/lib/owner";
import { useLivePolling } from "@/lib/useLivePolling";
import LiveNumber from "@/components/LiveNumber";

type OwnerStats = {
  totalRegisteredUsers: number;
  activeUsers: number;
  averageMonthlyActiveUsers: number;
  averageUsageSeconds: number;
  averageSurveyRespondentsPerWeek: number;
};

// Format detik jadi "1j 23m" / "45m" biar gampang dibaca, bukan angka detik
// mentah.
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

export default function OwnerPanel() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [error, setError] = useState("");

  const login = (session as any)?.login as string | undefined;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    // Bukan owner -> tendang balik ke dashboard, bukan cuma disembunyiin
    // di UI. Pengecekan beneran (yang gak bisa ditembus) tetap ada di
    // server lewat /api/owner/stats.
    if (status === "authenticated" && !isOwner(login)) router.replace("/dashboard");
  }, [status, login, router]);

  async function loadStats() {
    const res = await fetch("/api/owner/stats");
    if (res.ok) {
      setStats(await res.json());
      setError("");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Gagal memuat statistik");
    }
  }

  useEffect(() => {
    if (status === "authenticated" && isOwner(login)) loadStats();
  }, [status, login]);

  // Auto-refresh tiap 15 detik selama halaman ini dibuka & tab aktif.
  useLivePolling(loadStats, 15000, status === "authenticated" && isOwner(login));

  if (status !== "authenticated" || !isOwner(login)) return null;

  const cards = stats
    ? [
        {
          label: "Jumlah User Terdaftar",
          value: stats.totalRegisteredUsers,
          icon: FaUsers,
        },
        {
          label: "Jumlah User Aktif",
          value: stats.activeUsers,
          icon: FaUserClock,
          hint: "Aktif dalam 24 jam terakhir",
        },
        {
          label: "Rata-Rata Jumlah User Aktif Bulanan",
          value: stats.averageMonthlyActiveUsers,
          icon: FaChartLine,
          hint: "Aktif dalam 30 hari terakhir",
        },
        {
          label: "Rata-Rata Waktu Pakai",
          value: formatDuration(stats.averageUsageSeconds),
          icon: FaClock,
          hint: "Rata-rata seluruh user, sepanjang waktu",
        },
        {
          label: "Rata-Rata Survey per Minggu",
          value: stats.averageSurveyRespondentsPerWeek,
          icon: FaPoll,
          hint: "Rata-rata jumlah pengirim, dari semua minggu",
        },
      ]
    : [];

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-7 h-7 rounded-md" />
            Owner Panel
          </h1>
          <Link href="/dashboard" className="text-xs text-gray-400 underline">
            Kembali
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            {error.includes("SUPABASE") && (
              <p className="mt-1 text-xs text-red-300/70">
                Owner Panel butuh Supabase (lihat README bagian 2c) plus
                tabel <code>user_activity</code> tambahan (lihat komentar di
                lib/ownerStats.ts).
              </p>
            )}
          </div>
        )}

        {!stats && !error && (
          <p className="text-sm text-gray-400">Memuat statistik...</p>
        )}

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border bg-panel p-4"
              >
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <card.icon />
                  {card.label}
                </div>
                <div className="text-2xl font-bold">
                  {typeof card.value === "number" ? (
                    <LiveNumber value={card.value} />
                  ) : (
                    card.value
                  )}
                </div>
                {card.hint && (
                  <div className="text-[11px] text-gray-500 mt-1">{card.hint}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
