// src/app/api/bounties/health/route.ts
// Simple health check to verify if the Python ML service is reachable.

import { NextResponse } from "next/server";
import { checkMLServiceHealth } from "@/lib/ml-client";

export async function GET() {
  try {
    const isOnline = await checkMLServiceHealth();
    return NextResponse.json({ 
      ml_online: isOnline,
      message: isOnline ? "ML Service is reachable" : "ML Service is unreachable (Check localhost:8001)"
    });
  } catch {
    return NextResponse.json({ ml_online: false }, { status: 200 }); // Still 200 to allow client handling
  }
}
