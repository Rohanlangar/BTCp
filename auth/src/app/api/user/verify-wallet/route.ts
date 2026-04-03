import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function POST(request: NextRequest) {
  try {
    // Get the session
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie");

    let session = null;
    try {
      session = await auth.api.getSession({
        headers: {
          cookie: cookieHeader || "",
        },
      });
    } catch (error) {
      console.error("Session error:", error);
    }

    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in first" },
        { status: 401 }
      );
    }

    // Parse the request body
    const { walletAddress, signature, challenge } = await request.json();

    // Validate inputs
    if (!walletAddress || !signature || !challenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate Algorand wallet address format
    const algorandAddressRegex = /^[A-Z2-7]{58}$/;

    if (!algorandAddressRegex.test(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid Algorand wallet address format" },
        { status: 400 }
      );
    }

    // Update user with wallet info directly in Postgres
    try {
      await pool.query(
        `UPDATE "user" SET "walletAddress" = $1, "walletVerified" = $2 WHERE id = $3`,
        [walletAddress, true, session.user.id]
      );
    } catch (updateError: any) {
      console.error("Database update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update wallet in database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Wallet linked successfully",
      walletAddress: walletAddress,
    });
  } catch (error) {
    console.error("Wallet verification error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

