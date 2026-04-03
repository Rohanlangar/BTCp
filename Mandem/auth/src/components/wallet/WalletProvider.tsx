"use client";

import { ReactNode, useMemo } from "react";
import {
  WalletManager,
  WalletProvider as TWalletProvider,
  NetworkId,
  WalletId,
} from "@txnlab/use-wallet-react";

/**
 * WalletProvider — wraps the app with @txnlab/use-wallet-react context.
 *
 * Uses the Pera Wallet connector on TestNet.
 * All child components can use the `useWallet` hook to:
 *   - Connect/disconnect the Pera wallet popup
 *   - Access the active wallet address
 *   - Sign transactions
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const walletManager = useMemo(() => {
    return new WalletManager({
      wallets: [WalletId.PERA],
      defaultNetwork: NetworkId.TESTNET,
    });
  }, []);

  return (
    <TWalletProvider manager={walletManager}>{children}</TWalletProvider>
  );
}
