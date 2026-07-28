"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaTimes,
  FaSearch,
  FaClipboardList,
  FaCog,
  FaUsers,
  FaBullhorn,
  FaUserShield,
  FaSignOutAlt,
} from "react-icons/fa";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  login?: string | null;
  avatarUrl?: string | null;
  isOwnerUser?: boolean;
  onSignOut: () => void;
};

// Urutan sengaja: Settings Profil paling atas (paling sering dicari user),
// baru Announcement, Survey, Komunitas, Search di bawahnya.
const LINKS = [
  { href: "/settings", label: "Settings Profil", icon: FaCog },
  { href: "/announcement", label: "Announcement", icon: FaBullhorn },
  { href: "/survey", label: "Survey", icon: FaClipboardList },
  { href: "/komunitas", label: "Komunitas", icon: FaUsers },
  { href: "/search", label: "Search", icon: FaSearch },
];

// Sidebar navigasi global (off-canvas / drawer). Dipakai di semua halaman
// biar Search, Survey, Settings, Komunitas, Announcement, Profile, dst gak
// numpuk di header — cukup 1 tombol hamburger buat buka/tutup.
//
// Khusus dashboard: search TETAP di body dashboard (input "Cari repository..."),
// sidebar ini cuma buat navigasi antar-halaman, bukan fitur search itu sendiri.
export default function Sidebar({
  open,
  onClose,
  login,
  avatarUrl,
  isOwnerUser,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[82vw] flex-col
        bg-panel border-r border-border shadow-2xl transition-transform duration-300 ease-out
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <span className="font-bold text-base flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-7 h-7 rounded-md" />
            Master <span className="text-accent">Code</span>
          </span>
          <button
            onClick={onClose}
            aria-label="Tutup menu"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 active:scale-95"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {login && (
          <Link
            href={`/users/${login}`}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-4 border-b border-border hover:bg-white/5 active:bg-white/5"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-border shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{login}</p>
              <p className="text-xs text-gray-500">Profile — lihat profil publik</p>
            </div>
          </Link>
        )}

        <nav className="flex-1 overflow-y-auto py-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors
                ${
                  active
                    ? "text-accent bg-accent/10 border-r-2 border-accent"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={14} className={active ? "text-accent" : "text-gray-500"} />
                {label}
              </Link>
            );
          })}

          {isOwnerUser && (
            <Link
              href="/owner"
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors
              ${
                pathname === "/owner"
                  ? "text-yellow-400 bg-yellow-400/10 border-r-2 border-yellow-400"
                  : "text-yellow-400/90 hover:bg-white/5"
              }`}
            >
              <FaUserShield size={14} />
              Owner Panel
            </Link>
          )}
        </nav>

        <div className="border-t border-border p-4">
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            <FaSignOutAlt size={12} />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
