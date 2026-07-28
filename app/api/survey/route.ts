import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMySurveyStatus, submitSurvey } from "@/lib/survey";

// GET -> cek apakah user yang login udah isi survey minggu ini
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;

  try {
    const status = await getMySurveyStatus(login);
    return Response.json(status);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST -> submit jawaban survey (cuma boleh 1x per akun per minggu)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  const opinion = String(body.opinion || "").trim();
  const suggestion = String(body.suggestion || "").trim();
  const hasIssue = body.hasIssue === true;
  const issueDetail = body.issueDetail ? String(body.issueDetail) : "";

  if (!opinion) {
    return Response.json({ error: "Pertanyaan 1 wajib diisi" }, { status: 400 });
  }
  if (typeof body.hasIssue !== "boolean") {
    return Response.json({ error: "Pertanyaan 2 wajib dipilih (Ya/Tidak)" }, { status: 400 });
  }
  if (!suggestion) {
    return Response.json({ error: "Pertanyaan 4 wajib diisi" }, { status: 400 });
  }

  try {
    const result = await submitSurvey(login, avatar, {
      opinion,
      hasIssue,
      issueDetail,
      suggestion,
    });
    return Response.json({ ok: true, weekKey: result.weekKey });
  } catch (e: any) {
    if (e.message === "ALREADY_ANSWERED") {
      return Response.json(
        { error: "Kamu sudah mengisi survey minggu ini. Sampai jumpa minggu depan!" },
        { status: 409 }
      );
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
