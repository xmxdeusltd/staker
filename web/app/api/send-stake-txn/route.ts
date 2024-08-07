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
    console.log("transaction", transaction.recentBlockhash);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    return NextResponse.json({ signature });
  } catch (error) {
    console.error("Error submitting transaction:", error);
    return NextResponse.json(
      { error: "Failed to submit transaction" },
      { status: 500 }
    );
  }
}
