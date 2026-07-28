import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { createCommunityPoll } from "@/lib/community";

// Body: { question, options: string[], durationSeconds }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa buat Global Polling" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const poll = await createCommunityPoll({
      question: body.question,
      options: body.options,
      durationSeconds: Number(body.durationSeconds),
      createdBy: login,
    });
    return Response.json(poll);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
