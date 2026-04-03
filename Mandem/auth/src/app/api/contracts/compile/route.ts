import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import algosdk from "algosdk";

// Create algod client for testnet
const algodAddress = process.env.NEXT_PUBLIC_ALGOD_ADDRESS || "https://testnet-api.algonode.cloud";
const algodToken = process.env.NEXT_PUBLIC_ALGOD_TOKEN || "";
const algodClient = new algosdk.Algodv2(algodToken, algodAddress, "");

export async function GET() {
  try {
    // Read the TEAL files from the contracts/ directory
    const contractsDir = path.join(process.cwd(), "contracts");
    
    const approvalSource = await fs.readFile(
      path.join(contractsDir, "bounty_escrow_approval.teal"),
      "utf8"
    );
    const clearSource = await fs.readFile(
      path.join(contractsDir, "bounty_escrow_clear.teal"),
      "utf8"
    );

    // Compile programs via algod
    const approvalCompileResult = await algodClient.compile(approvalSource).do();
    const clearCompileResult = await algodClient.compile(clearSource).do();

    return NextResponse.json({
      approval: approvalCompileResult.result,
      clear: clearCompileResult.result,
    });
  } catch (error: any) {
    console.error("Failed to compile TEAL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to compile TEAL" },
      { status: 500 }
    );
  }
}
