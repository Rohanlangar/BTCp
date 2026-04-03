"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";

export const ConnectWallet = dynamic(
  () => import("@/components/wallet/ConnectWallet").then((mod) => mod.ConnectWallet),
  { ssr: false }
);

export const PostBountyForm = dynamic(
  () => import("@/components/bounty/PostBountyForm").then((mod) => mod.PostBountyForm),
  { ssr: false }
);

export function DashboardClient({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
