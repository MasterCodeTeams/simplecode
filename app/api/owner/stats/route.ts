import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { getOwnerStats } from "@/lib/ownerStats";

// Cuma akun @MasterCodeTeams yang boleh baca statistik ini — dicek di sini
// (server), bukan cuma di halaman client, biar gak bisa ditembus walau
// orang lain iseng manggil endpoint-nya langsung.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stats = await getOwnerStats();
    return Response.json(stats);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
