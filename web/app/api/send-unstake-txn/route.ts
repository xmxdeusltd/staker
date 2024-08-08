import { NextResponse } from "next/server";
import { Connection, Transaction } from "@solana/web3.js";

export async function POST(req: Request) {
  const { signedTransaction } = await req.json();

  const connection = new Connection(process.env.RPC_URL!, "confirmed");

  const transaction = Transaction.from(
    Buffer.from(signedTransaction, "base64")
  );

  try {
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    console.log("Unstake transaction sent:", signature);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    return NextResponse.json({ signature });
  } catch (error) {
    console.error("Error submitting unstake transaction:", error);
    return NextResponse.json(
      { error: "Failed to submit unstake transaction" },
      { status: 500 }
    );
  }
}
