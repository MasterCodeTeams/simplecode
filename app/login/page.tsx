"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { FaGithub } from "react-icons/fa";

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <main className="min-h-dvh flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm sm:max-w-md text-center">
        <div className="mb-8">
          <img
            src="/logo.png"
            alt="Master Code"
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-2xl"
          />
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Master <span className="text-accent">Code</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-400">
            Editor GitHub lengkap, langsung dari browser. Edit, commit, branch,
            release — di HP atau di laptop, sama enaknya.
          </p>
        </div>

        {error === "AccessDenied" && (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-lg p-3 mb-4">
            Akun GitHub ini tidak diizinkan mengakses aplikasi ini.
          </p>
        )}

        <button
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3 rounded-xl active:scale-[0.98] transition text-base"
        >
          <FaGithub size={20} />
          Login dengan GitHub
        </button>

        <p className="mt-6 text-xs text-gray-500">
          Kami hanya menyimpan token sesi di browser kamu. Tidak ada data
          repository yang disimpan di server kami.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
