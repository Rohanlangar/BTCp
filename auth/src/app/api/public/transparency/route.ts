// src/app/api/public/transparency/route.ts
// Stateless Public API for Transparency Dashboard

import { NextResponse } from "next/server";
import { pool } from "@/lib/auth";

export async function GET() {
  try {
    // 1. Fetch Aggregated Stats by Status
    // Using real column names: rewardAlgo, status
    const statsResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(CAST(COALESCE("rewardAlgo", '0') AS NUMERIC)) as total_value
      FROM bounties
      GROUP BY status
    `);

    const listResult = await pool.query(`
      SELECT 
        b.id,
        b."issueTitle" as title,
        b.status::text,
        b."rewardAlgo" as amount_algo,
        b."createdAt" as created_at,
        u.name as owner_name,
        u.image as owner_image,
        u."walletAddress" as owner_wallet,
        (SELECT COUNT(*) FROM claims c WHERE c.bounty_id = b.id) as contributor_count
      FROM bounties b
      JOIN "user" u ON b."creatorId" = u.id
      ORDER BY b."createdAt" DESC
    `);

    // 3. Transform data for the frontend
    const stats = statsResult.rows.reduce((acc: any, row: any) => {
      acc[row.status] = {
        count: parseInt(row.count),
        value: parseFloat(row.total_value || 0)
      };
      return acc;
    }, {});

    // Categorize for cards based on actual ENUM values
    const liveStates = ['OPEN', 'CLAIMED', 'SUBMITTED'];
    const closedStates = ['SETTLED', 'CANCELLED'];

    const summary = {
      live_count: Object.keys(stats).filter(s => liveStates.includes(s)).reduce((sum, s) => sum + stats[s].count, 0),
      closed_count: Object.keys(stats).filter(s => closedStates.includes(s)).reduce((sum, s) => sum + stats[s].count, 0),
      total_algo_locked: Object.keys(stats).filter(s => liveStates.includes(s)).reduce((sum, s) => sum + stats[s].value, 0),
      total_participants: listResult.rows.reduce((sum, r) => sum + parseInt(r.contributor_count), 0),
    };

    return NextResponse.json({
      summary,
      stats,
      bounties: listResult.rows,
    });
  } catch (error) {
    console.error("Public Transparency API Error:", error);
    return NextResponse.json({ error: "Failed to fetch transparency data" }, { status: 500 });
  }
}
