"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NewRepoModal from "@/components/NewRepoModal";
import Sidebar from "@/components/Sidebar";
import { FaLock, FaGlobe, FaPlus, FaCodeBranch, FaStar, FaBars } from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import { isOwner } from "@/lib/owner";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  async function loadRepos() {
    setLoading(true);
    const res = await fetch("/api/github/repos");
    if (res.ok) setRepos(await res.json());
    setLoading(false);
  }

  // Sama kayak loadRepos, tapi TANPA toggle setLoading — dipakai buat
  // auto-refresh biar list-nya update senyap tanpa nunjukin loading spinner
  // tiap 5 detik.
  async function refreshReposSilent() {
    const res = await fetch("/api/github/repos");
    if (res.ok) setRepos(await res.json());
  }

  useEffect(() => {
    if (status === "authenticated") loadRepos();
  }, [status]);

  // Live: daftar repo auto-refresh tiap 5 detik selama halaman ini dibuka &
  // tab aktif (otomatis berhenti kalau tab di-minimize/background).
  useLivePolling(refreshReposSilent, 5000, status === "authenticated" && !loading);

  const filtered = repos.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
              className="p-1.5 -ml-1.5 rounded-md text-gray-300 hover:bg-white/5 active:scale-95"
            >
              <FaBars size={18} />
            </button>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <img src="/logo.png" alt="" className="w-7 h-7 rounded-md" />
              Master <span className="text-accent">Code</span>
            </h1>
          </div>
          {(session as any)?.avatar && (
            <Link href={`/users/${(session as any).login}`}>
              <img
                src={(session as any).avatar}
                className="w-8 h-8 rounded-full"
                alt="avatar"
              />
            </Link>
          )}
        </div>
      </header>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        login={(session as any)?.login}
        avatarUrl={(session as any)?.avatar}
        isOwnerUser={isOwner((session as any)?.login)}
        onSignOut={() => {
          if (confirm("Yakin mau keluar dari akun ini?")) {
            signOut({ callbackUrl: "/login" });
          }
        }}
      />

      <div className="px-4 mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari repository..."
          className="flex-1 bg-panel border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={() => setShowNew(true)}
          className="bg-accent px-4 rounded-lg flex items-center gap-2 text-sm font-medium active:scale-[0.98]"
        >
          <FaPlus size={12} />
          <span className="hidden xs:inline">Baru</span>
        </button>
      </div>

      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-panel border border-border animate-pulse"
            />
          ))}

        {!loading &&
          filtered.map((repo) => (
            <Link
              key={repo.id}
              href={`/editor/${repo.owner.login}/${repo.name}`}
              className="block bg-panel border border-border rounded-xl p-4 active:scale-[0.98] transition hover:border-accent"
            >
              <div className="flex items-center gap-2 text-sm font-medium truncate">
                {repo.private ? (
                  <FaLock size={11} className="text-yellow-500 shrink-0" />
                ) : (
                  <FaGlobe size={11} className="text-green-500 shrink-0" />
                )}
                <span className="truncate">{repo.name}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 min-h-[2rem]">
                {repo.description || "Tidak ada deskripsi"}
              </p>
              <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-500">
                {repo.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                    {repo.language}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FaStar size={10} /> {repo.stargazers_count}
                </span>
                <span className="flex items-center gap-1">
                  <FaCodeBranch size={10} />
                </span>
              </div>
            </Link>
          ))}

        {!loading && filtered.length === 0 && (
          <p className="col-span-full text-center text-gray-500 text-sm mt-10">
            Tidak ada repository ditemukan.
          </p>
        )}
      </div>

      {showNew && (
        <NewRepoModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            loadRepos();
          }}
        />
      )}
    </main>
  );
}
