import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCommentsForAnnouncement, addComment } from "@/lib/announcements";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getCommentsForAnnouncement(params.id);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { content }
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;

  try {
    const body = await req.json();
    const comment = await addComment({
      announcementId: params.id,
      login,
      avatarUrl: avatar,
      content: body.content || "",
    });
    return Response.json(comment);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
