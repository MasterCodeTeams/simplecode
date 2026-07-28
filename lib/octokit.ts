import { Octokit } from "@octokit/rest";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getOctokitFromSession() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  if (!token) return null;
  return new Octokit({ auth: token });
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
