import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET ?path=src/index.js&ref=main  -> isi file atau listing folder
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "";
  const ref = searchParams.get("ref") || undefined;

  try {
    const { data } = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path,
      ref,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

// Body: { path, content (base64 atau plain text), message, branch, sha? (kalau update file lama), isBase64? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { path, content, message, branch, sha, isBase64 } = await req.json();

  try {
    const encoded = isBase64
      ? content
      : Buffer.from(content, "utf-8").toString("base64");

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: params.owner,
      repo: params.repo,
      path,
      message: message || `Update ${path}`,
      content: encoded,
      branch,
      sha: sha || undefined,
    });

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { path, message, branch, sha }
export async function DELETE(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { path, message, branch, sha } = await req.json();

  try {
    const { data } = await octokit.repos.deleteFile({
      owner: params.owner,
      repo: params.repo,
      path,
      message: message || `Delete ${path}`,
      branch,
      sha,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
