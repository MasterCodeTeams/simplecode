// Groq (https://console.groq.com) — free tier, API OpenAI-compatible, inference cepat (LPU).
// Daftar gratis, buat API key, lalu set GROQ_API_KEY di environment variable.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant"; // model kecil & cepat, cocok buat code suggestion realtime

export async function getCodeSuggestion(params: {
  filename: string;
  language: string;
  codeBefore: string; // isi kode sebelum kursor
  codeAfter: string; // isi kode setelah kursor
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variable");
  }

  const prompt = `Kamu adalah asisten code-completion seperti GitHub Copilot.
File: ${params.filename}
Bahasa: ${params.language}

Lanjutkan kode berikut. HANYA balas dengan potongan kode lanjutannya saja (tanpa penjelasan, tanpa markdown code fence, tanpa mengulang kode sebelumnya).

=== KODE SEBELUM KURSOR ===
${params.codeBefore}
=== KODE SETELAH KURSOR (jika ada) ===
${params.codeAfter}
=== LANJUTAN KODE ===`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.2,
      stop: ["=== "],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content || "";
  // bersihkan kalau model tetap kasih code fence
  return text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
}

// Batas karakter log yang dikirim ke AI — CI logs bisa ratusan KB, padahal
// errornya hampir selalu ada di bagian AKHIR log (setelah semua step yang
// sukses). Jadi ambil potongan terakhir aja biar hemat & relevan.
const MAX_LOG_CHARS = 8000;

export async function getDebugAnalysis(params: {
  jobName: string;
  logs: string;
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variable");
  }

  const trimmedLogs =
    params.logs.length > MAX_LOG_CHARS
      ? "...(log dipotong, cuma bagian akhir yang ditampilkan)...\n" +
        params.logs.slice(-MAX_LOG_CHARS)
      : params.logs;

  const prompt = `Kamu adalah asisten debugging buat developer. Di bawah ini adalah log CI/build job "${params.jobName}" yang gagal atau perlu dicek.

Tugas kamu:
1. Jelaskan dengan bahasa sederhana (Bahasa Indonesia) apa yang sebenarnya jadi masalah/error utamanya.
2. Sebutkan kemungkinan penyebabnya.
3. Kasih langkah konkret buat memperbaikinya.

Jawab singkat, jelas, terstruktur pakai poin-poin. Jangan mengulang seluruh isi log mentah-mentah.

=== LOG ===
${trimmedLogs}
=== AKHIR LOG ===`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 700,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content || "";
  return text.trim();
}
