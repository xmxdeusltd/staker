"use client";
import dynamic from "next/dynamic";
import SolanaButton from "./components/SolanaButton";

// not the most optimal way but fixes hydration errors
const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Home() {
  // design is minimal purely for demo purposes
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center p-4 text-white">
        <h1 className="text-xl font-bold">Staker</h1>
        <WalletMultiButtonDynamic />
      </nav>
      <div className="relative border p-2 rounded-lg w-full max-w-md flex-col flex gap-4 place-items-center justify-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-center">Stake</h1>
          <p className="text-sm text-gray-500">Stake SOL for fun</p>
        </div>
        <SolanaButton>Greet</SolanaButton>
      </div>
    </main>
  );
}
