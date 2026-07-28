"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaCheckCircle } from "react-icons/fa";

export default function SurveyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [opinion, setOpinion] = useState("");
  const [hasIssue, setHasIssue] = useState<boolean | null>(null);
  const [issueDetail, setIssueDetail] = useState("");
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/survey")
      .then((r) => r.json())
      .then((data) => {
        if (data.answered) {
          setAlreadyAnswered(true);
          setResetAt(data.resetAt);
        }
      })
      .finally(() => setLoading(false));
  }, [status]);

  async function submit() {
    setError("");
    if (!opinion.trim()) return setError("Pertanyaan 1 wajib diisi");
    if (hasIssue === null) return setError("Pertanyaan 2 wajib dipilih");
    if (!suggestion.trim()) return setError("Pertanyaan 4 wajib diisi");

    setSubmitting(true);
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        opinion,
        hasIssue,
        issueDetail,
        suggestion,
      }),
    });
    setSubmitting(false);

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDone(true);
    } else {
      setError(data.error || "Gagal mengirim survey");
      if (res.status === 409) setAlreadyAnswered(true);
    }
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="p-1 text-gray-400">
          <FaArrowLeft />
        </Link>
        <h1 className="font-bold text-lg">Survey Master Code</h1>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500 px-4 mt-6">Memuat...</p>
      ) : done ? (
        <div className="px-4 mt-10 flex flex-col items-center text-center gap-3">
          <FaCheckCircle className="text-4xl text-green-400" />
          <p className="font-semibold">Terima kasih atas masukannya!</p>
          <p className="text-sm text-gray-400">
            Jawabanmu udah kekirim. Survey akan dibuka lagi minggu depan.
          </p>
          <Link
            href="/survey/live"
            className="mt-2 bg-accent text-white font-medium px-5 py-2.5 rounded-lg text-sm"
          >
            Lihat Live Survey
          </Link>
        </div>
      ) : alreadyAnswered ? (
        <div className="px-4 mt-10 flex flex-col items-center text-center gap-3">
          <FaCheckCircle className="text-4xl text-accent" />
          <p className="font-semibold">Kamu sudah mengisi survey minggu ini</p>
          <p className="text-sm text-gray-400">
            {resetAt
              ? `Survey akan direset dan bisa diisi lagi mulai ${new Date(
                  resetAt
                ).toLocaleString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`
              : "Coba lagi minggu depan, ya."}
          </p>
          <Link
            href="/survey/live"
            className="mt-2 bg-accent text-white font-medium px-5 py-2.5 rounded-lg text-sm"
          >
            Lihat Live Survey
          </Link>
        </div>
      ) : (
        <div className="px-4 mt-6 flex flex-col gap-6 max-w-lg mx-auto">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              1. Bagaimana menurutmu tentang Master Code?
            </label>
            <textarea
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              rows={4}
              placeholder="Tulis pendapatmu di sini..."
              className="bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              2. Apakah ada hal yang tidak memuaskan?
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHasIssue(true)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                  hasIssue === true
                    ? "bg-accent/20 border-accent text-accent"
                    : "border-border text-gray-400"
                }`}
              >
                Ya
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasIssue(false);
                  setIssueDetail("");
                }}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                  hasIssue === false
                    ? "bg-accent/20 border-accent text-accent"
                    : "border-border text-gray-400"
                }`}
              >
                Tidak
              </button>
            </div>
          </div>

          {hasIssue === true && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                3. Apa hal yang tidak memuaskan?{" "}
                <span className="text-gray-500 font-normal">(opsional)</span>
              </label>
              <textarea
                value={issueDetail}
                onChange={(e) => setIssueDetail(e.target.value)}
                rows={3}
                placeholder="Ceritain di sini..."
                className="bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              4. Beri saran agar MasterCode terus berkembang!
            </label>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              rows={4}
              placeholder="Saran kamu..."
              className="bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting}
            className="bg-accent text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Kirim"}
          </button>
        </div>
      )}
    </main>
  );
}
