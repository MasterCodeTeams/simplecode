import GithubProvider from "next-auth/providers/github";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization: {
        params: {
          // scope 'repo' = akses penuh repo publik & privat (buat, edit, hapus, branch, release, dll)
          // scope 'user' (BUKAN 'read:user') = wajib buat fitur Edit Profil,
          // karena 'read:user' cuma izin BACA, sedangkan update nama/bio/dll
          // butuh izin TULIS ke profil. 'user' sendiri sudah otomatis include
          // user:email dan user:follow, jadi gak perlu ditulis terpisah lagi.
          scope: "user repo delete_repo workflow",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const allowList = (process.env.ALLOWED_GITHUB_USERS || "")
        .split(",")
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);

      // Kalau ALLOWED_GITHUB_USERS kosong, siapa saja boleh login (mode publik/demo).
      // Kalau diisi, HANYA username yang terdaftar yang boleh masuk — orang lain otomatis ditolak.
      if (allowList.length === 0) return true;

      const login = ((profile as any)?.login || "").toLowerCase();
      return allowList.includes(login);
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        token.login = (profile as any).login;
        token.avatar = (profile as any).avatar_url;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).login = token.login;
      (session as any).avatar = token.avatar;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
