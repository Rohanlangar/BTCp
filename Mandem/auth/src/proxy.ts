import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if the route should be protected
  const protectedRoutes = ["/dashboard", "/api/user"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Get the session from headers
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");

  try {
    // Attempt to get the session
    const session = await auth.api.getSession({
      headers: {
        cookie: cookieHeader || "",
      },
    });

    if (!session) {
      // Redirect to login if not authenticated
      if (pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      // Return 401 for API routes
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  } catch (error) {
    // If there's an error getting the session, redirect to login
    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/user/:path*"],
};
