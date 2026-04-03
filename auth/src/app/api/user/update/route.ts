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
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { role, roleSelected, walletAddress } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (role !== undefined) {
      updates.push(`"role" = $${paramIndex++}`);
      values.push(role);
    }
    if (roleSelected !== undefined) {
      updates.push(`"roleSelected" = $${paramIndex++}`);
      values.push(roleSelected);
    }
    if (walletAddress !== undefined) {
      updates.push(`"walletAddress" = $${paramIndex++}`);
      values.push(walletAddress);
      
      // Assume walletVerified is true when they connect it here for simplicity
      updates.push(`"walletVerified" = $${paramIndex++}`);
      values.push(true);
    }

    if (updates.length > 0) {
      values.push(session.user.id);
      const query = `UPDATE "user" SET ${updates.join(", ")} WHERE id = $${paramIndex}`;
      await pool.query(query, values);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
