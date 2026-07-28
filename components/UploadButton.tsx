"use client";

import { useRef, useState } from "react";
import { FaUpload, FaFileUpload, FaFolderPlus, FaImage, FaFileArchive, FaFolderOpen } from "react-icons/fa";
import {
  detectConnectionQuality, chunkParamsFor, splitIntoChunks, QUALITY_LABEL,
} from "@/lib/uploadChunking";

// Folder/file yang di-skip default (bisa dimatikan lewat toggle "upload semua file")
const IGNORED_SEGMENTS = ["node_modules", ".next", ".git", ".vercel", ".DS_Store"];
// File ini SELALU dicek terpisah karena isinya kredensial (bukan cuma "gak perlu", tapi beresiko bocor)
const SECRET_PATTERNS = [".env", ".env.local", ".env.production", ".env.development"];

function shouldIgnore(relPath: string) {
  const segments = relPath.split("/");
  return segments.some((s) => IGNORED_SEGMENTS.includes(s));
}

function isSecretFile(relPath: string) {
  const filename = relPath.split("/").pop() || "";
  return SECRET_PATTERNS.some((p) => filename === p || filename.startsWith(p + "."));
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Konversi Uint8Array -> base64 tanpa bikin call stack overflow buat file
// gede (String.fromCharCode.apply langsung ke array besar bisa crash).
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }
  return btoa(binary);
}

// Buang segmen path paling depan (nama folder utama), sisain childnya aja.
// "project-utama/src/index.js" -> "src/index.js"
function stripTopLevelFolder(relPath: string): string {
  const idx = relPath.indexOf("/");
  return idx >= 0 ? relPath.slice(idx + 1) : relPath;
}

type UploadFilePayload = { path: string; content: string; isBase64: boolean };

// Upload 1 batch, otomatis coba ulang (exponential backoff) kalau gagal —
// entah gagal dari server ATAU koneksinya putus di tengah jalan (fetch
// throw). Batch yang lebih kecil (menyesuaikan sinyal) + retry ini yang
// bikin upload gak gampang "kepotong" cuma karena sinyal sempat goyang.
async function uploadChunkWithRetry(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: UploadFilePayload[],
  onRetry: (attempt: number, maxAttempts: number) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxAttempts = 4; // 1 percobaan awal + 3x retry
  let lastError = "Gagal upload";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/tree`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branch, message, files }),
      });
      if (res.ok) return { ok: true };
      const d = await res.json().catch(() => ({}));
      lastError = d.error || `HTTP ${res.status}`;
    } catch (e: any) {
      // fetch throw = biasanya koneksi putus di tengah jalan
      lastError = e?.message || "Koneksi terputus";
    }

    if (attempt < maxAttempts) {
      onRetry(attempt, maxAttempts);
      await new Promise((r) => setTimeout(r, attempt * 2000)); // 2s, 4s, 6s
    }
  }

  return { ok: false, error: lastError };
}

// Bentuk generik buat 1 file yang mau di-upload, apapun asalnya (input
// biasa, folder, atau hasil ekstrak ZIP) — biar validasi/filter-nya cuma
// ditulis SEKALI di processEntries, gak diduplikasi 3x.
type PendingFile = {
  relPath: string;
  size: number;
  getBase64: () => Promise<string>;
};

export default function UploadButton({
  owner,
  repo,
  branch,
  currentFolder,
  onDone,
}: {
  owner: string;
  repo: string;
  branch: string;
  currentFolder: string; // path folder tujuan di file tree, "" = root
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const childFolderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [includeAll, setIncludeAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  // ==== Logika inti (filter, cek rahasia, cek ukuran, kirim ke API) — ====
  // ==== dipakai bareng oleh upload file biasa, folder, child folder, ====
  // ==== dan ZIP.                                                     ====
  async function processEntries(rawEntries: PendingFile[]) {
    try {
      const afterIgnoreFilter = includeAll
        ? rawEntries
        : rawEntries.filter((e) => !shouldIgnore(e.relPath));

      const secretEntries = afterIgnoreFilter.filter((e) => isSecretFile(e.relPath));
      let entries = afterIgnoreFilter;

      if (secretEntries.length > 0) {
        const names = secretEntries.map((e) => e.relPath).join(", ");
        const includeSecrets = confirm(
          `Ditemukan file environment (${names}) yang biasanya berisi kredensial/API key rahasia.\n\n` +
          `Kalau repo ini PUBLIC, siapa saja bisa lihat & pakai kredensial itu.\n\n` +
          `Tetap upload file ini juga?`
        );
        if (!includeSecrets) {
          entries = afterIgnoreFilter.filter((e) => !secretEntries.includes(e));
        }
      }

      if (entries.length === 0) {
        alert("Tidak ada file yang bisa di-upload.");
        return;
      }

      // GitHub keras nolak file > 100MB, dan file besar bikin browser berat.
      const bigFiles = entries.filter((e) => e.size > 100 * 1024 * 1024);
      if (bigFiles.length > 0) {
        const names = bigFiles.map((e) => e.relPath).join(", ");
        alert(
          `File ini lebih dari 100MB dan akan DITOLAK GitHub, jadi otomatis di-skip: ${names}\n\n` +
          `Untuk file sebesar ini, GitHub sarankan pakai Git LFS (belum didukung app ini).`
        );
        entries = entries.filter((e) => !bigFiles.includes(e));
      }

      const warnFiles = entries.filter((e) => e.size > 25 * 1024 * 1024);
      if (warnFiles.length > 0) {
        const proceed = confirm(
          `${warnFiles.length} file berukuran di atas 25MB. Proses upload bisa lemot, terutama di HP. Lanjut?`
        );
        if (!proceed) return;
      }

      if (entries.length === 0) return;

      const skipped = rawEntries.length - entries.length;

      if (entries.length > 300) {
        const proceed = confirm(
          `Kamu mau upload ${entries.length} file sekaligus. GitHub API bisa rate-limit kalau kebanyakan dalam 1 commit. Lanjut tetap coba?`
        );
        if (!proceed) return;
      }

      setProgress(`Membaca ${entries.length} file${skipped ? ` (${skipped} di-skip)` : ""}...`);

      const payload = await Promise.all(
        entries.map(async (e) => {
          const targetPath = currentFolder ? `${currentFolder}/${e.relPath}` : e.relPath;
          const base64 = await e.getBase64();
          return { path: targetPath, content: base64, isBase64: true };
        })
      );

      setProgress(`Meng-upload ${payload.length} file ke GitHub...`);

      const quality = detectConnectionQuality();
      const { maxFiles, maxBytes } = chunkParamsFor(quality);
      const chunks = splitIntoChunks(payload, maxFiles, maxBytes);

      if (chunks.length > 1) {
        setProgress(
          `Sinyal terdeteksi ${QUALITY_LABEL[quality]} — upload dipecah jadi ${chunks.length} bagian biar aman...`
        );
        await new Promise((r) => setTimeout(r, 900)); // kasih waktu user baca pesannya
      }

      let uploadedSoFar = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkMessage =
          chunks.length > 1
            ? `Upload ${payload.length} file via Master Code (bagian ${i + 1}/${chunks.length})`
            : `Upload ${payload.length} file via Master Code`;

        setProgress(
          chunks.length > 1
            ? `Bagian ${i + 1}/${chunks.length} — ${chunk.length} file...`
            : `Meng-upload ${payload.length} file ke GitHub...`
        );

        const result = await uploadChunkWithRetry(
          owner,
          repo,
          branch,
          chunkMessage,
          chunk,
          (attempt, maxAttempts) => {
            setProgress(
              `Bagian ${i + 1}/${chunks.length} gagal, koneksi mungkin goyang. Coba lagi (${attempt}/${maxAttempts - 1})...`
            );
          }
        );

        if (result.ok === false) {
          const doneMsg =
            uploadedSoFar > 0
              ? `${uploadedSoFar} dari ${payload.length} file udah berhasil ke-commit sebelum ini gagal.`
              : `Belum ada file yang ke-upload.`;
          alert(
            `Upload berhenti di bagian ${i + 1}/${chunks.length}: ${result.error}\n\n${doneMsg}\n\n` +
            `Coba upload lagi cuma buat file yang tersisa, atau cek koneksi internet kamu.`
          );
          if (uploadedSoFar > 0) onDone(); // refresh tree biar yang udah kecommit kelihatan
          return;
        }

        uploadedSoFar += chunk.length;
      }

      onDone();
    } finally {
      setUploading(false);
      setProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
      if (childFolderInputRef.current) childFolderInputRef.current.value = "";
      if (zipInputRef.current) zipInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  // Upload File / Upload Gambar / Upload Folder (BIASA — nama folder tetap
  // ikut jadi prefix path, ga berubah dari sebelumnya)
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setOpen(false);
    const files = Array.from(fileList);
    const entries: PendingFile[] = files.map((f) => ({
      relPath: (f as any).webkitRelativePath || f.name,
      size: f.size,
      getBase64: () => readAsBase64(f),
    }));
    await processEntries(entries);
  }

  // Upload Child Folder Utama — folder yang dipilih user JANGAN ikut jadi
  // prefix, cuma isinya (child) yang di-upload. "project/src/a.js" -> "src/a.js"
  async function handleChildFolderFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setOpen(false);
    const files = Array.from(fileList);
    const entries: PendingFile[] = files.map((f) => ({
      relPath: stripTopLevelFolder((f as any).webkitRelativePath || f.name),
      size: f.size,
      getBase64: () => readAsBase64(f),
    }));
    await processEntries(entries);
  }

  // Upload ZIP — ekstrak di browser (JSZip). Kalau SEMUA file di dalam ZIP
  // sama-sama berada di bawah 1 folder pembungkus yang sama persis (pola
  // umum ZIP dari GitHub/StackBlitz dkk: "nama-project-main/..."), folder
  // pembungkus itu di-skip, yang di-upload cuma childnya. Kalau file-nya
  // memang tersebar di root ZIP (gak ada folder pembungkus tunggal), gak
  // ada yang di-strip — upload apa adanya.
  async function handleZipFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setOpen(false);
    setProgress("Membaca isi ZIP...");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const fileEntries = Object.values(zip.files).filter((e) => !e.dir);

      if (fileEntries.length === 0) {
        alert("ZIP kosong atau formatnya gak valid.");
        setUploading(false);
        setProgress("");
        if (zipInputRef.current) zipInputRef.current.value = "";
        return;
      }

      const topSegments = new Set(fileEntries.map((e) => e.name.split("/")[0]));
      let prefixToStrip = "";
      if (topSegments.size === 1) {
        const only = Array.from(topSegments)[0];
        if (fileEntries.every((e) => e.name.startsWith(only + "/"))) {
          prefixToStrip = only + "/";
        }
      }

      setProgress(`Mengekstrak ${fileEntries.length} file dari ZIP...`);

      const entries: PendingFile[] = await Promise.all(
        fileEntries.map(async (e) => {
          const bytes = await e.async("uint8array");
          return {
            relPath: prefixToStrip ? e.name.slice(prefixToStrip.length) : e.name,
            size: bytes.byteLength,
            getBase64: async () => uint8ToBase64(bytes),
          };
        })
      );

      await processEntries(entries);
    } catch (err: any) {
      alert("Gagal membaca file ZIP: " + (err?.message || "format ZIP tidak valid/rusak"));
      setUploading(false);
      setProgress("");
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={uploading}
        className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-3 py-1.5 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
      >
        <FaUpload size={11} />
        {uploading ? progress || "Uploading..." : "Upload"}
      </button>

      {open && !uploading && (
        <div className="absolute right-0 mt-1 w-64 bg-panel border border-border rounded-lg shadow-xl z-20 overflow-hidden">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5"
          >
            <FaFileUpload size={12} /> Upload File
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border"
          >
            <FaImage size={12} /> Upload Gambar
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border"
          >
            <FaFolderPlus size={12} /> Upload Folder
          </button>
          <button
            onClick={() => childFolderInputRef.current?.click()}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border text-left"
          >
            <FaFolderOpen size={12} className="mt-0.5 shrink-0" />
            <span>
              Upload Child Folder Utama
              <span className="block text-[11px] text-gray-500">
                Nama foldernya di-skip, cuma isinya yang diupload
              </span>
            </span>
          </button>
          <button
            onClick={() => zipInputRef.current?.click()}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border text-left"
          >
            <FaFileArchive size={12} className="mt-0.5 shrink-0" />
            <span>
              Upload ZIP
              <span className="block text-[11px] text-gray-500">
                Folder pembungkus di dalam ZIP otomatis di-skip
              </span>
            </span>
          </button>
          <label className="flex items-start gap-2 px-3 py-2.5 text-xs border-t border-border cursor-pointer">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => setIncludeAll(e.target.checked)}
              className="accent-accent mt-0.5"
            />
            <span>
              Upload semua file
              <span className="block text-gray-500">termasuk node_modules, .next, .git</span>
            </span>
          </label>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore - atribut non-standar tapi didukung browser modern untuk pilih folder
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={childFolderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => handleChildFolderFiles(e.target.files)}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => handleZipFile(e.target.files?.[0] || null)}
      />
    </div>
  );
}
