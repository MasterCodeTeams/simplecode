import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET ?ref=main -> seluruh struktur file & folder (recursive) buat file tree sidebar
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref") || undefined;

  try {
    const { data: refData } = await octokit.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${ref}`,
    });

    const { data } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: refData.object.sha,
      recursive: "true",
    });

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Upload banyak file sekaligus (folder upload) jadi 1 commit
// Body: { branch, message, files: [{ path, content(base64), isBase64 }] }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { branch, message, files } = await req.json();

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

    // Buat blob untuk tiap file (paralel)
    const blobs = await Promise.all(
      files.map(async (f: { path: string; content: string; isBase64?: boolean }) => {
        const { data: blob } = await octokit.git.createBlob({
          owner: params.owner,
          repo: params.repo,
          content: f.content,
          encoding: f.isBase64 ? "base64" : "utf-8",
        });
        return {
          path: f.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        };
      })
    );

    const { data: newTree } = await octokit.git.createTree({
      owner: params.owner,
      repo: params.repo,
      base_tree: baseTreeSha,
      tree: blobs,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: params.owner,
      repo: params.repo,
      message: message || `Upload ${files.length} file`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.git.updateRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return Response.json({ ok: true, commit: newCommit });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
