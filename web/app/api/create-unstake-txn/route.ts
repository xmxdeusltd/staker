import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { type TokenStaking } from "../../../../programs/token_staking/target/types/token_staking";
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
  const program = new anchor.Program(IDL as TokenStaking, provider);

  const [stakingPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("staking_pool")],
    program.programId
  );

  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), payer.toBuffer()],
    program.programId
  );

  const tx = await program.methods
    .unstake()
    .accounts({
      stakingPool: stakingPoolPda,
      user: userPda,
      userAccount: payer,
      stakingPoolAccount: stakingPoolPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .instruction();

  const transaction = new anchor.web3.Transaction().add(tx);
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = payer;
  transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
  });

  return NextResponse.json({
    serializedTransaction: serializedTransaction.toString("base64"),
  });
}
