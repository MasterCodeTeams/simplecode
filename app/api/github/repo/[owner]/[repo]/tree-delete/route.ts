import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// Hapus 1 file ATAU 1 folder beserta semua isinya (rekursif), jadi 1 commit
// aja — beda dari DELETE di /contents yang cuma bisa 1 file per commit.
// Caranya: ambil tree lengkap (recursive), cari semua entry yang path-nya
// persis sama ATAU diawali "path/", lalu di git tree baru kasih sha: null
// buat masing-masing entry itu (itu cara resmi Git Trees API buat "hapus
// path ini dari tree").
//
// Body: { path, branch, message? }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { path, branch, message } = await req.json();
  if (!path || !branch) {
    return Response.json({ error: "path dan branch wajib diisi" }, { status: 400 });
  }

  try {
    const { data: refData } = await octokit.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
    });
    const latestCommitSha = refData.object.sha;

    const { data: commitData } = await octokit.git.getCommit({
      owner: params.owner,
      repo: params.repo,
      commit_sha: latestCommitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    const { data: fullTree } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: baseTreeSha,
      recursive: "true",
    });

    const toDelete = (fullTree.tree || []).filter(
      (item) => item.path === path || item.path?.startsWith(`${path}/`)
    );

    if (toDelete.length === 0) {
      return Response.json({ error: "File/folder tidak ditemukan" }, { status: 404 });
    }

    const deletionEntries = toDelete.map((item) => ({
      path: item.path!,
      mode: item.mode as "100644" | "100755" | "040000" | "160000" | "120000",
      type: item.type as "blob" | "tree" | "commit",
      sha: null,
    }));

    const { data: newTree } = await octokit.git.createTree({
      owner: params.owner,
      repo: params.repo,
      base_tree: baseTreeSha,
      // @ts-ignore -- sha: null valid di Git Trees API buat hapus entry, tipe octokit belum akomodasi ini
      tree: deletionEntries,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: params.owner,
      repo: params.repo,
      message: message || `Delete ${path}`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.git.updateRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return Response.json({ ok: true, deletedCount: toDelete.length, commit: newCommit });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
