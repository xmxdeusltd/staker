import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import IDL from "../../../../programs/token_staking/target/idl/token_staking.json";

export async function POST(req: Request) {
  const { publicKey } = await req.json();

  const connection = new Connection(process.env.RPC_URL!, "confirmed");
  const payer = new PublicKey(publicKey);

  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: payer } as anchor.Wallet,
    { commitment: "confirmed" }
  );
  const program = new anchor.Program(IDL, provider);

  const tx = await program.methods
    .initialize()
    .accounts({
      myAccount: payer,
      user: payer,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  const transaction = new anchor.web3.Transaction().add(tx);
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = payer;
  transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
  console.log(
    "transaction",
    transaction.lastValidBlockHeight,
    transaction.recentBlockhash
  );
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
  });

  return NextResponse.json({
    serializedTransaction: serializedTransaction.toString("base64"),
  });
}
