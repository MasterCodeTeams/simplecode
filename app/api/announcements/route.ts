import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { listAnnouncements, createAnnouncement } from "@/lib/announcements";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await listAnnouncements();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { title, content } — khusus owner
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa buat pengumuman" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const announcement = await createAnnouncement({
      title: body.title,
      content: body.content,
      createdBy: login,
      avatarUrl: (session as any).avatar || null,
    });
    return Response.json(announcement);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
