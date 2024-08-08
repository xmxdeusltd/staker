import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";

interface StakingControlProps {
  // children: React.ReactNode;
}

const StakingControl: React.FC<StakingControlProps> = ({}) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [balance, setBalance] = useState(0);
  const [stakedAmount, setStakedAmount] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [isStaking, setIsStaking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey) {
      fetchBalance();
      fetchStakedAmount();
    }
  }, [publicKey, connection]);

  const fetchBalance = async () => {
    if (publicKey) {
      const balance = await connection.getBalance(publicKey);
      setBalance(balance / LAMPORTS_PER_SOL);
    }
  };

  const fetchStakedAmount = async () => {
    if (publicKey) {
      try {
        const response = await fetch("/api/get-stake-info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publicKey: publicKey.toString() }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch stake info");
        }

        const data = await response.json();
        setStakedAmount(data.stakedAmount);
      } catch (error) {
        console.error("Error fetching staked amount:", error);
        // You might want to set an error state here or show a notification to the user
      }
    }
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(parseFloat(event.target.value));
  };

  const handleActionToggle = () => {
    setIsStaking(!isStaking);
    setSliderValue(stakedAmount);
  };

  const getMaxValue = () => {
    return isStaking ? balance : stakedAmount;
  };

  const stake = async () => {
    setLoading(true);
    setError(null);

    if (!publicKey || !signTransaction) {
      console.error("Wallet not connected");
      return;
    }

    try {
      // Create stake transaction
      const response = await fetch("/api/create-stake-txn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: publicKey.toString(),
          amount: Math.floor(sliderValue * LAMPORTS_PER_SOL),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create stake transaction");
      }

      const { serializedTransaction } = await response.json();
      const transaction = Transaction.from(
        Buffer.from(serializedTransaction, "base64")
      );

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction);

      // Send the signed transaction
      const sendResponse = await fetch("/api/send-stake-txn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: signedTransaction.serialize().toString("base64"),
        }),
      });

      if (!sendResponse.ok) {
        throw new Error("Failed to send stake transaction");
      }

      const { signature } = await sendResponse.json();
      console.log("Stake transaction sent:", signature);

      // Update balances
      await fetchBalance();
      await fetchStakedAmount();
    } catch (error) {
      console.error("Error staking:", error);
      setError("Error staking");
    } finally {
      setLoading(false);
    }
  };

  const unstake = async () => {
    setLoading(true);
    setError(null);

    if (!publicKey || !signTransaction) {
      console.error("Wallet not connected");
      return;
    }

    try {
      // Create unstake transaction
      const response = await fetch("/api/create-unstake-txn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: publicKey.toString(),
          amount: Math.floor(sliderValue * LAMPORTS_PER_SOL),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create unstake transaction");
      }

      const { serializedTransaction } = await response.json();
      const transaction = Transaction.from(
        Buffer.from(serializedTransaction, "base64")
      );

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction);

      // Send the signed transaction
      const sendResponse = await fetch("/api/send-unstake-txn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: signedTransaction.serialize().toString("base64"),
        }),
      });

      if (!sendResponse.ok) {
        throw new Error("Failed to send unstake transaction");
      }

      const { signature } = await sendResponse.json();
      console.log("Unstake transaction sent:", signature);

      // Update balances
      await fetchBalance();
      await fetchStakedAmount();
    } catch (error) {
      console.error("Error unstaking:", error);
      setError("Error unstaking");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (isStaking) {
      await stake();
    } else {
      await unstake();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-between w-full">
        <span>Balance: {balance.toFixed(2)} SOL</span>
        <span>Staked: {stakedAmount.toFixed(2)} SOL</span>
      </div>
      <input
        type="range"
        min="0"
        max={getMaxValue()}
        step="0.01"
        value={sliderValue}
        onChange={handleSliderChange}
        className="w-full"
        disabled={!isStaking}
      />
      <div className="flex justify-between w-full">
        <span>{sliderValue.toFixed(2)} SOL</span>
        <button onClick={handleActionToggle} className="text-blue-500">
          {isStaking ? "Switch to Unstake" : "Switch to Stake"}
        </button>
      </div>
      <div className="text-center">
        <p>
          {isStaking ? "Amount to Stake:" : "Amount to Unstake:"}{" "}
          {sliderValue.toFixed(2)} SOL
        </p>
      </div>
      <button
        className={`bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition-colors duration-300 w-full ${
          loading ? "opacity-50 cursor-not-allowed" : ""
        }`}
        onClick={handleAction}
        disabled={loading}
      >
        {loading ? "Processing..." : isStaking ? "Stake" : "Unstake"}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default StakingControl;
