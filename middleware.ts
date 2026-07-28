import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      // Halaman cuma dikirim ke browser kalau ada session JWT yang valid.
      // Tanpa session valid, next-auth otomatis redirect ke /login sebelum
      // konten apapun (termasuk struktur halaman) sempat sampai ke browser.
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/editor/:path*",
    "/search/:path*",
    "/users/:path*",
    "/repository/:path*",
    "/settings/:path*",
    "/survey/:path*",
    "/owner/:path*",
    "/komunitas/:path*",
    "/announcement/:path*",
  ],
};
