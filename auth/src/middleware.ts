import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Exclude api/auth, Next.js assets, login, and static files
  if (
    pathname.includes("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/login") ||
    pathname.includes("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  try {
    // Fetch session from better-auth endpoint
    const sessionResponse = await fetch(new URL("/api/auth/get-session", request.url), {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    const sessionData = await sessionResponse.json();
    const user = sessionData?.user;

    // Not authenticated, accessing protected route -> redirect to login
    if (!user) {
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/choose-role") || pathname.startsWith("/connect-wallet")) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return NextResponse.next();
    }

    const { role, roleSelected, walletAddress } = user;

    // Handle /choose-role route
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
      if (!walletAddress) {
        return NextResponse.redirect(new URL("/connect-wallet", request.url));
      }

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
    console.error("Middleware Auth Check Error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|public).*)",
  ],
};
