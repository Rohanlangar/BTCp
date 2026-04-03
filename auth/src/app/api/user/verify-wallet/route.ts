import { auth, pool } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie");

    let session = null;
    try {
      session = await auth.api.getSession({ headers: { cookie: cookieHeader || "" } });
    } catch (error) {
      console.error("Session error:", error);
    }

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized - Please sign in first" }, { status: 401 });
    }

    const { walletAddress, signature, challenge } = await request.json();

    if (!walletAddress || !signature || !challenge) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate Algorand wallet address format (58 base32 chars)
    const algorandAddressRegex = /^[A-Z2-7]{58}$/;
    if (!algorandAddressRegex.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid Algorand wallet address format" }, { status: 400 });
    }

    // Check if this wallet is already linked to any account
    const existingOwner = await pool.query(
      `SELECT id FROM "user" WHERE "walletAddress" = $1 LIMIT 1`,
      [walletAddress]
    );

    if (existingOwner.rows.length > 0) {
      if (existingOwner.rows[0].id === session.user.id) {
        // Already linked to THIS user — silently succeed, nothing to change
        return NextResponse.json({
          success: true,
          message: "Wallet already linked to your account",
          walletAddress,
        });
      } else {
        // Linked to SOMEONE ELSE — reject clearly
        return NextResponse.json(
          { error: "This wallet is already linked to another account" },
          { status: 409 }
        );
      }
    }

    // Safe to link — no conflicts
    try {
      // 1. Transactionally update:
      // Clear this wallet from anyone else who might have it (since walletAddress column must be unique)
      const clearOtherUsersQuery = `
        UPDATE "user" 
        SET "walletAddress" = NULL, "walletVerified" = FALSE 
        WHERE "walletAddress" = $1 AND id != $2
      `;
      await pool.query(clearOtherUsersQuery, [walletAddress, session.user.id]);

      // 2. Now link it to the current user
      const query = `
        UPDATE "user" 
        SET "walletAddress" = $1, "walletVerified" = $2 
        WHERE id = $3
      `;
      const values = [walletAddress, true, session.user.id];
      await pool.query(query, values);
    } catch (updateError: any) {
      console.error("Database update error:", updateError);
      return NextResponse.json({ error: "Failed to update wallet in database" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Wallet linked successfully",
      walletAddress,
    });
  } catch (error) {
    console.error("Wallet verification error:", error);
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 });
  }
}
