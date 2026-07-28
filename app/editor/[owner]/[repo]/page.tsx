"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CodeEditor from "@/components/CodeEditor";
import PlainTextEditor from "@/components/PlainTextEditor";
import FileToolbarMenu from "@/components/FileToolbarMenu";
import FileTree from "@/components/FileTree";
import FileActionSheet from "@/components/FileActionSheet";
import BranchSelector from "@/components/BranchSelector";
import UploadButton from "@/components/UploadButton";
import RepoSettings from "@/components/RepoSettings";
import IssuesPanel from "@/components/IssuesPanel";
import ReleasesPanel from "@/components/ReleasesPanel";
import LogsPanel from "@/components/LogsPanel";
import CopyModal from "@/components/CopyModal";
import TestPanel from "@/components/TestPanel";
import ImageViewer from "@/components/ImageViewer";
import { buildFileTree, Branch, TreeItem, FileNode } from "@/types";
import {
  FaBars, FaTimes, FaSave, FaFileMedical, FaFolderPlus,
  FaTrash, FaArrowLeft, FaCog, FaExclamationCircle, FaTag, FaCode,
  FaHistory, FaDownload, FaCopy, FaEye, FaFlask, FaStop, FaEdit, FaEllipsisV,
} from "react-icons/fa";

type Tab = "files" | "issues" | "releases" | "settings" | "logs";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"];
function isImagePath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXT.includes(ext);
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

export default function EditorPage({
  params,
}: {
  params: { owner: string; repo: string };
}) {
  const { owner, repo } = params;
  const { status } = useSession();
  const router = useRouter();

  const [repoInfo, setRepoInfo] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState("");
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeSha, setActiveSha] = useState<string | undefined>(undefined);
  // File yang dibuka defaultnya cuma PREVIEW (read-only, syntax-highlighted).
  // Baru masuk mode edit (textarea native) kalau user pencet "Edit File" di
  // menu titik-tiga — biar copy/paste pakai keyboard bawaan HP, bukan
  // clipboard custom Monaco.
  const [editMode, setEditMode] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [actionNode, setActionNode] = useState<FileNode | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [changingImage, setChangingImage] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("files");
  const searchParams = useSearchParams();

  useEffect(() => {
    // Dipakai RepoSettings buat balik ke tab Settings setelah rename repo
    // (karena redirect ke URL baru bikin state tab lokal ke-reset).
    if (searchParams.get("tab") === "settings") setTab("settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [commitMsg, setCommitMsg] = useState("");
  const [showCommitBox, setShowCommitBox] = useState(false);
  const [showFork, setShowFork] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testPreviewUrl, setTestPreviewUrl] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  // repo bukan milik sendiri & gak ada akses tulis -> mode lihat-lihat aja
  const canEdit = repoInfo?.permissions?.push ?? true;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const loadRepoInfo = useCallback(async () => {
    const res = await fetch(`/api/github/repo/${owner}/${repo}/settings`);
    if (res.ok) {
      const data = await res.json();
      setRepoInfo(data);
      if (!branch) setBranch(data.default_branch);
    }
  }, [owner, repo, branch]);

  const loadBranches = useCallback(async () => {
    const res = await fetch(`/api/github/repo/${owner}/${repo}/branches`);
    if (res.ok) setBranches(await res.json());
  }, [owner, repo]);

  const loadTree = useCallback(async () => {
    if (!branch) return;
    const res = await fetch(
      `/api/github/repo/${owner}/${repo}/tree?ref=${encodeURIComponent(branch)}`
    );
    if (res.ok) {
      const data = await res.json();
      setTreeItems(data.tree || []);
    }
  }, [owner, repo, branch]);

  useEffect(() => {
    if (status === "authenticated") {
      loadRepoInfo();
      loadBranches();
    }
  }, [status]);

  useEffect(() => {
    if (branch) loadTree();
  }, [branch, loadTree]);

  async function openFile(path: string) {
    setLoadingFile(true);
    setActivePath(path);
    setSidebarOpen(false);
    setImageBase64(null);
    setEditMode(false); // file baru selalu kebuka dalam mode Preview dulu
    const res = await fetch(
      `/api/github/repo/${owner}/${repo}/contents?path=${encodeURIComponent(
        path
      )}&ref=${encodeURIComponent(branch)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (isImagePath(path)) {
        // gambar: JANGAN di-atob jadi teks, simpan base64 mentah buat ditampilkan sebagai <img>
        setImageBase64(data.content.replace(/\n/g, ""));
        setContent("");
        setOriginalContent("");
      } else {
        const decoded =
          data.encoding === "base64" ? atob(data.content.replace(/\n/g, "")) : data.content;
        setContent(decoded);
        setOriginalContent(decoded);
      }
      setActiveSha(data.sha);
    }
    setLoadingFile(false);
  }

  function cancelEdit() {
    if (isDirty && !confirm("Ada perubahan yang belum di-commit. Buang perubahan itu?")) {
      return;
    }
    setContent(originalContent);
    setEditMode(false);
  }

  async function saveFile() {
    if (!activePath) return;
    if (!commitMsg.trim()) {
      setShowCommitBox(true);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: activePath,
        content,
        message: commitMsg,
        branch,
        sha: activeSha,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setActiveSha(data.content.sha);
      setOriginalContent(content);
      setCommitMsg("");
      setShowCommitBox(false);
      setEditMode(false); // balik ke Preview abis commit
      loadTree();
    } else {
      const d = await res.json();
      alert("Gagal menyimpan: " + d.error);
    }
  }

  async function createNewFile() {
    const name = prompt("Path file baru, contoh: src/index.js");
    if (!name) return;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: name,
        content: "",
        message: `Create ${name}`,
        branch,
      }),
    });
    if (res.ok) {
      loadTree();
      openFile(name);
    } else {
      const d = await res.json();
      alert("Gagal: " + d.error);
    }
  }

  async function createNewFolder() {
    const name = prompt("Nama folder baru, contoh: src/components");
    if (!name) return;
    // GitHub tidak punya folder kosong asli, jadi kita taruh file .gitkeep
    const path = `${name}/.gitkeep`;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path,
        content: "",
        message: `Create folder ${name}`,
        branch,
      }),
    });
    if (res.ok) loadTree();
    else alert("Gagal membuat folder");
  }

  async function deleteActiveFile() {
    if (!activePath || !activeSha) return;
    if (!confirm(`Hapus file "${activePath}"?`)) return;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: activePath,
        message: `Delete ${activePath}`,
        branch,
        sha: activeSha,
      }),
    });
    if (res.ok) {
      setActivePath(null);
      setContent("");
      loadTree();
    } else {
      alert("Gagal menghapus file");
    }
  }

  // Nama unik buat hasil duplikat, cek tabrakan ke treeItems yang sedang
  // dimuat (path persis buat file, atau path/prefix buat folder).
  function generateDuplicatePath(node: FileNode): string {
    const existingPaths = treeItems.map((i) => i.path);
    const collides = (candidate: string) =>
      existingPaths.some((p) => p === candidate || p.startsWith(`${candidate}/`));

    const lastSlash = node.path.lastIndexOf("/");
    const dir = lastSlash >= 0 ? node.path.slice(0, lastSlash) : "";
    const name = node.path.slice(lastSlash + 1);

    let base: string;
    let ext = "";
    if (node.type === "file" && name.includes(".")) {
      const dot = name.lastIndexOf(".");
      base = name.slice(0, dot);
      ext = name.slice(dot); // termasuk titiknya
    } else {
      base = name;
    }

    let attempt = `${base} copy`;
    let n = 2;
    while (collides(dir ? `${dir}/${attempt}${ext}` : `${attempt}${ext}`)) {
      attempt = `${base} copy ${n}`;
      n++;
    }
    return dir ? `${dir}/${attempt}${ext}` : `${attempt}${ext}`;
  }

  async function duplicateNode(node: FileNode) {
    const newPath = generateDuplicatePath(node);
    if (!confirm(`Duplikasi "${node.path}" jadi "${newPath}"?`)) return;

    const res = await fetch(`/api/github/repo/${owner}/${repo}/tree-duplicate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        newPath,
        branch,
        message: `Duplicate ${node.path} to ${newPath}`,
      }),
    });
    if (res.ok) {
      loadTree();
    } else {
      const d = await res.json().catch(() => ({}));
      alert("Gagal menduplikasi: " + (d.error || "unknown error"));
    }
  }

  async function deleteNode(node: FileNode) {
    const warning =
      node.type === "folder"
        ? `Hapus folder "${node.path}" beserta SEMUA isinya? Tindakan ini tidak bisa dibatalkan.`
        : `Hapus file "${node.path}"? Tindakan ini tidak bisa dibatalkan.`;
    if (!confirm(warning)) return;

    const res = await fetch(`/api/github/repo/${owner}/${repo}/tree-delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        branch,
        message: `Delete ${node.path}`,
      }),
    });
    if (res.ok) {
      // Kalau file yang lagi kebuka di editor ada di dalam yang barusan
      // dihapus (persis, atau ada di dalam folder yang dihapus), tutup
      // editornya juga.
      if (activePath === node.path || activePath?.startsWith(`${node.path}/`)) {
        setActivePath(null);
        setContent("");
      }
      loadTree();
    } else {
      const d = await res.json().catch(() => ({}));
      alert("Gagal menghapus: " + (d.error || "unknown error"));
    }
  }

  async function renameActiveFile() {
    if (!activePath) return;
    const newPath = prompt("Path baru buat file ini:", activePath);
    if (!newPath || newPath === activePath) return;
    if (!confirm(`Pindahkan "${activePath}" ke "${newPath}"?`)) return;

    setRenaming(true);
    try {
      // GitHub gak punya operasi "rename" langsung, jadi caranya: baca ulang
      // isi file dari sumbernya (bukan dari state, biar aman buat file
      // apapun termasuk gambar/binary), bikin file baru di path baru dengan
      // isi yang sama, baru hapus file lama.
      const getRes = await fetch(
        `/api/github/repo/${owner}/${repo}/contents?path=${encodeURIComponent(
          activePath
        )}&ref=${encodeURIComponent(branch)}`
      );
      if (!getRes.ok) throw new Error("Gagal membaca file sumber");
      const fileData = await getRes.json();

      const putRes = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: newPath,
          content: (fileData.content || "").replace(/\n/g, ""),
          isBase64: true,
          message: `Rename ${activePath} to ${newPath}`,
          branch,
        }),
      });
      if (!putRes.ok) {
        const d = await putRes.json();
        throw new Error(d.error || "Gagal membuat file di path baru");
      }

      const delRes = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: activePath,
          message: `Rename ${activePath} to ${newPath}`,
          branch,
          sha: fileData.sha,
        }),
      });
      if (!delRes.ok) {
        const d = await delRes.json();
        throw new Error(
          (d.error || "Gagal menghapus file lama") +
            " — file baru sudah dibuat, file lama perlu dihapus manual."
        );
      }

      await loadTree();
      await openFile(newPath);
    } catch (e: any) {
      alert("Gagal rename: " + (e?.message || "Terjadi kesalahan"));
    } finally {
      setRenaming(false);
    }
  }

  async function changeImage(file: File | null) {
    if (!file || !activePath) return;
    setChangingImage(true);
    try {
      const base64 = await readAsBase64(file);
      const isFirstUpload = !imageBase64;
      const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: activePath,
          content: base64,
          isBase64: true,
          message: isFirstUpload
            ? `Tambah gambar ${activePath}`
            : `Ganti gambar ${activePath}`,
          branch,
          sha: activeSha,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setImageBase64(base64);
        setActiveSha(data.content.sha);
        loadTree();
      } else {
        const d = await res.json().catch(() => ({}));
        alert("Gagal simpan gambar: " + (d.error || `HTTP ${res.status}`));
      }
    } catch (e: any) {
      alert("Gagal simpan gambar: " + (e?.message || "cek koneksi internet."));
    } finally {
      setChangingImage(false);
    }
  }

  async function createBranch(newName: string) {
    const res = await fetch(`/api/github/repo/${owner}/${repo}/branches`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newBranch: newName, fromBranch: branch }),
    });
    if (res.ok) {
      await loadBranches();
      setBranch(newName);
    } else {
      const d = await res.json();
      alert("Gagal buat branch: " + d.error);
    }
  }

  const fileTree = buildFileTree(treeItems);
  const isDirty = content !== originalContent;

  if (status !== "authenticated") return null;

  return (
    <div className="h-dvh flex flex-col bg-base">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-panel shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-1 lg:hidden"
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          <Link href="/dashboard" className="hidden lg:flex p-2 -ml-1 text-gray-400">
            <FaArrowLeft />
          </Link>
          <span className="text-sm font-semibold truncate">{repo}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTest(true)}
            title="Test project (GitHub Actions)"
            className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs sm:text-sm active:scale-95"
          >
            <FaFlask size={11} className="text-green-400" />
            <span className="hidden sm:inline">Test</span>
          </button>
          {!canEdit && repoInfo && (
            <>
              <a
                href={`https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`}
                target="_blank"
                rel="noopener noreferrer"
                title="Download ZIP"
                className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs sm:text-sm"
              >
                <FaDownload size={11} />
                <span className="hidden sm:inline">ZIP</span>
              </a>
              <button
                onClick={() => setShowFork(true)}
                title="Copy repo ini ke akun saya"
                className="flex items-center gap-1.5 bg-accent rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium"
              >
                <FaCopy size={11} />
                <span className="hidden sm:inline">Copy</span>
              </button>
            </>
          )}
          {branches.length > 0 && (
            <BranchSelector
              branches={branches}
              current={branch}
              onChange={setBranch}
              onCreate={createBranch}
            />
          )}
        </div>
      </header>

      {!canEdit && repoInfo && (
        <div className="flex items-center gap-2 bg-yellow-950/40 border-b border-yellow-900/50 text-yellow-300 text-xs px-3 py-2 shrink-0">
          <FaEye size={11} className="shrink-0" />
          Mode lihat saja — kamu bukan pemilik repo ini. Pakai tombol <b>Copy</b> di atas
          buat nyalin ke akun kamu sendiri kalau mau edit.
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar (drawer di mobile, fixed di desktop) */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40 w-72 sm:w-80 lg:w-72 shrink-0
            bg-panel border-r border-border flex flex-col
            transition-transform duration-200 top-[49px] lg:top-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0 text-xs">
            <TabBtn active={tab === "files"} onClick={() => setTab("files")} icon={<FaCode size={12} />} label="Files" />
            <TabBtn active={tab === "logs"} onClick={() => setTab("logs")} icon={<FaHistory size={12} />} label="Logs" />
            <TabBtn active={tab === "issues"} onClick={() => setTab("issues")} icon={<FaExclamationCircle size={12} />} label="Issues" />
            <TabBtn active={tab === "releases"} onClick={() => setTab("releases")} icon={<FaTag size={12} />} label="Release" />
            {canEdit && (
              <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<FaCog size={12} />} label="Setting" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "files" && (
              <>
                {canEdit && (
                  <div className="flex items-center gap-1.5 p-2 border-b border-border">
                    <button onClick={createNewFile} title="File baru" className="p-2 rounded-md hover:bg-white/5">
                      <FaFileMedical size={13} />
                    </button>
                    <button onClick={createNewFolder} title="Folder baru" className="p-2 rounded-md hover:bg-white/5">
                      <FaFolderPlus size={13} />
                    </button>
                    <div className="ml-auto">
                      <UploadButton
                        owner={owner}
                        repo={repo}
                        branch={branch}
                        currentFolder=""
                        onDone={loadTree}
                      />
                    </div>
                  </div>
                )}
                <div className="py-1">
                  <FileTree
                    nodes={fileTree}
                    activePath={activePath || undefined}
                    onSelectFile={openFile}
                    onAction={canEdit ? setActionNode : undefined}
                  />
                  {fileTree.length === 0 && (
                    <p className="text-xs text-gray-500 text-center mt-6 px-4">
                      Repository kosong. Buat file baru atau upload.
                    </p>
                  )}
                </div>
              </>
            )}
            {tab === "logs" && branch && <LogsPanel owner={owner} repo={repo} branch={branch} />}
            {tab === "issues" && <IssuesPanel owner={owner} repo={repo} />}
            {tab === "releases" && (
              <ReleasesPanel owner={owner} repo={repo} branches={branches.map((b) => b.name)} />
            )}
            {tab === "settings" && canEdit && repoInfo && (
              <RepoSettings owner={owner} repo={repo} info={repoInfo} onUpdated={loadRepoInfo} />
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden top-[49px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Editor area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {activePath ? (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-panel/50 shrink-0">
                <span className="text-xs sm:text-sm text-gray-300 truncate">{activePath}</span>
                {isImagePath(activePath) ? (
                  canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer active:scale-95">
                        {changingImage ? (
                          "Menyimpan..."
                        ) : imageBase64 ? (
                          <>
                            <FaFileMedical size={11} /> Ganti Gambar
                          </>
                        ) : (
                          <>
                            <FaFileMedical size={11} /> Tambah Gambar
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={changingImage}
                          onChange={(e) => {
                            changeImage(e.target.files?.[0] || null);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={renameActiveFile}
                        disabled={changingImage || renaming}
                        className="p-2 text-gray-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Rename file"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={deleteActiveFile}
                        disabled={changingImage}
                        className="p-2 text-red-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Hapus file"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  )
                ) : canEdit ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDirty && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
                    {editMode ? (
                      <>
                        <button
                          onClick={cancelEdit}
                          className="p-2 text-gray-400 hover:bg-white/5 rounded-md"
                          title="Batal, balik ke Preview"
                        >
                          <FaTimes size={12} />
                        </button>
                        <button
                          onClick={saveFile}
                          disabled={!isDirty || saving}
                          className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium disabled:opacity-40"
                        >
                          <FaSave size={11} />
                          {saving ? "Menyimpan..." : "Commit"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowFileMenu(true)}
                        className="p-2 text-gray-300 hover:bg-white/5 rounded-md"
                        title="Opsi file"
                      >
                        <FaEllipsisV size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-500 flex items-center gap-1 shrink-0">
                    <FaEye size={10} /> read-only
                  </span>
                )}
              </div>

              {loadingFile ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                  Memuat file...
                </div>
              ) : imageBase64 ? (
                <ImageViewer path={activePath} base64={imageBase64} />
              ) : isImagePath(activePath) ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  {canEdit ? (
                    <label className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-2xl px-10 py-12 cursor-pointer active:scale-[0.98] transition text-center">
                      <span className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl leading-none">
                        +
                      </span>
                      <span className="text-sm text-gray-300">
                        {changingImage ? "Menyimpan..." : "Tambah Gambar"}
                      </span>
                      <span className="text-xs text-gray-500 max-w-[220px]">
                        File ini belum punya isi. Pilih gambar buat diisikan ke{" "}
                        <span className="text-gray-400">{activePath}</span>
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={changingImage}
                        onChange={(e) => {
                          changeImage(e.target.files?.[0] || null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <p className="text-sm text-gray-500">File gambar ini masih kosong.</p>
                  )}
                </div>
              ) : canEdit && editMode ? (
                <PlainTextEditor value={content} onChange={setContent} />
              ) : (
                <CodeEditor
                  path={activePath}
                  value={content}
                  onChange={canEdit ? setContent : () => {}}
                  aiEnabled={false}
                  readOnly={true}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <div>
                <p className="text-gray-400 text-sm">
                  Pilih file dari sidebar untuk mulai edit, atau buat file baru.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Commit message dialog */}
      {showCommitBox && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5">
            <h3 className="font-semibold mb-3 text-sm">Pesan Commit</h3>
            <input
              autoFocus
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder={`Update ${activePath}`}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              onKeyDown={(e) => e.key === "Enter" && saveFile()}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCommitBox(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm"
              >
                Batal
              </button>
              <button
                onClick={saveFile}
                className="flex-1 py-2.5 rounded-lg bg-accent text-sm font-medium"
              >
                Commit & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showFork && (
        <CopyModal owner={owner} repo={repo} onClose={() => setShowFork(false)} />
      )}
      {actionNode && (
        <FileActionSheet
          node={actionNode}
          onClose={() => setActionNode(null)}
          onDuplicate={duplicateNode}
          onDelete={deleteNode}
        />
      )}
      {showFileMenu && activePath && (
        <FileToolbarMenu
          path={activePath}
          onClose={() => setShowFileMenu(false)}
          onEdit={() => setEditMode(true)}
          onRename={renameActiveFile}
          onDelete={deleteActiveFile}
        />
      )}
      {showTest && branch && (
        <TestPanel
          owner={owner}
          repo={repo}
          branch={branch}
          onClose={() => setShowTest(false)}
          onStartTest={(url) => {
            setShowTest(false);
            setTestPreviewUrl(url);
          }}
        />
      )}
      {testPreviewUrl && (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col">
          <div className="flex items-center justify-between gap-2 bg-panel border-b border-border px-3 py-2 shrink-0">
            <span className="text-xs text-gray-400 truncate">Testing: {repo}</span>
            <button
              onClick={() => setTestPreviewUrl(null)}
              className="flex items-center gap-1.5 bg-red-900/40 border border-red-800 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
            >
              <FaStop size={10} /> Stop Test
            </button>
          </div>
          <iframe src={testPreviewUrl} className="flex-1 w-full border-0 bg-white" title="Test preview" />
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2 ${
        active ? "text-accent border-b-2 border-accent" : "text-gray-500"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
