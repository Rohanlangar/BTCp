// src/lib/ml-client.ts
// HTTP client for the Python ML Validator service (SBERT + CodeBERT + Bandit)

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8001";

export interface MLAnalysisRequest {
  issue_text: string;
  pr_text: string;
  code_diff: string;
}

export interface SecurityFinding {
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  message: string;
  rule: string;
}

export interface MLAnalysisResponse {
  relevance: number;          // Layer 1: SBERT (0-100)
  alignment: number;          // Layer 2: CodeBERT (0-100)
  security_score: number;     // Layer 3: Bandit (0-100)
  security_findings: SecurityFinding[];
  security_metadata: {
    lines_extracted: number;
    scanned_for_vulnerabilities: boolean;
  };
  overall_ml_score: number;   // 3-layer weighted score (we'll recalculate with Gemini)
}

/**
 * Call the Python ML service to run Layers 1-3.
 * The service must be running: `python main.py` in the Validator/ml-service folder.
 */
export async function runMLAnalysis(data: MLAnalysisRequest): Promise<MLAnalysisResponse> {
  const response = await fetch(`${ML_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML Service Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Check if the ML service is online.
 */
export async function checkMLServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}
