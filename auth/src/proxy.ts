import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // We should protect /dashboard, /choose-role, /connect-wallet, and /api/user
  const protectedRoutes = ["/dashboard", "/api/user", "/choose-role", "/connect-wallet"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  try {
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie");

    // Must use fetch instead of auth.api.getSession because proxy runs on Edge runtime
    // and importing our auth config containing 'pg' driver will crash the Edge runtime.
    const sessionResponse = await fetch(new URL("/api/auth/get-session", request.url), {
      headers: { cookie: cookieHeader || "" },
      cache: "no-store", // Force Next.js to not cache this session check!
    });

    const sessionData = await sessionResponse.json();
    const user = sessionData?.user;

    // Not authenticated -> redirect to login or 401
    if (!user) {
      if (pathname.startsWith("/api/user")) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const role = (user as any).role;
    const roleSelected = (user as any).roleSelected;
    const walletAddress = (user as any).walletAddress;

    // Handle /choose-role
    if (pathname.startsWith("/choose-role")) {
      if (roleSelected && walletAddress) {
        return NextResponse.redirect(new URL(`/dashboard/${role === "admin" ? "admin" : "contributor"}`, request.url));
      }
      if (roleSelected && !walletAddress) {
        return NextResponse.redirect(new URL("/connect-wallet", request.url));
      }
      return NextResponse.next();
    }

    // Handle /connect-wallet route
    if (pathname.startsWith("/connect-wallet")) {
      if (!roleSelected) {
        return NextResponse.redirect(new URL("/choose-role", request.url));
      }
      if (walletAddress) {
        return NextResponse.redirect(new URL(`/dashboard/${role === "admin" ? "admin" : "contributor"}`, request.url));
      }
      return NextResponse.next();
    }

    // Handle /dashboard routes
    if (pathname.startsWith("/dashboard")) {
      if (!roleSelected) {
        return NextResponse.redirect(new URL("/choose-role", request.url));
      }
      // walletAddress is now optional - users can skip wallet connection and still access dashboard

      // Root /dashboard redirect based on role
      if (pathname === "/dashboard") {
        return NextResponse.redirect(new URL(`/dashboard/${role === "admin" ? "admin" : "contributor"}`, request.url));
      }

      // Role specific dashboard access
      if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard/contributor", request.url));
      }
      if (pathname.startsWith("/dashboard/contributor") && role !== "contributor") {
        return NextResponse.redirect(new URL("/dashboard/admin", request.url));
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Proxy Auth Check Error:", error);
    if (pathname.startsWith("/api/user")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/user/:path*", "/choose-role", "/connect-wallet"],
};
