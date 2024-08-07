import React from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";

interface SolanaButtonProps {
  children: React.ReactNode;
}

const SolanaButton: React.FC<SolanaButtonProps> = ({ children }) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const handleClick = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      // Step 1: Request transaction from server
      const response = await fetch("/api/create-stake-txn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: publicKey.toString() }),
      });
      const { serializedTransaction } = await response.json();

      // Step 2: Deserialize and sign transaction client-side
      const transaction = Transaction.from(
        Buffer.from(serializedTransaction, "base64")
      );
      const signedTransaction = await signTransaction(transaction);

      // Step 3: Send signed transaction back to server
      const submitResponse = await fetch("/api/send-stake-txn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: Buffer.from(
            signedTransaction.serialize()
          ).toString("base64"),
        }),
      });
      const { signature } = await submitResponse.json();

      console.log("Transaction signature:", signature);
      alert("Transaction successful! Signature: " + signature);
    } catch (error) {
      console.error("Detailed error:", error);
      if (error instanceof Error) {
        alert(`Transaction failed: ${error.message}`);
      } else {
        alert("Transaction failed. See console for details.");
      }
    }
  };

  return (
    <button
      className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition-colors duration-300"
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

export default SolanaButton;
