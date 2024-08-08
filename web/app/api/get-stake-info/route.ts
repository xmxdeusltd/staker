import { NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { type TokenStaking } from "../../../../programs/token_staking/target/types/token_staking";
import IDL from "../../../../programs/token_staking/target/idl/token_staking.json";

export async function POST(req: Request) {
  const { publicKey } = await req.json();

  if (!publicKey) {
    return NextResponse.json(
      { error: "Public key is required" },
      { status: 400 }
    );
  }

  const connection = new Connection(process.env.RPC_URL!, "confirmed");
  const userPublicKey = new PublicKey(publicKey);

  try {
    const provider = new anchor.AnchorProvider(
      connection,
      { publicKey: userPublicKey } as anchor.Wallet,
      { commitment: "confirmed" }
    );
    const program = new anchor.Program(IDL as TokenStaking, provider);

    const [stakingPoolPda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool")],
      program.programId
    );

    const [userPda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("user"), userPublicKey.toBuffer()],
      program.programId
    );

    const balance = await connection.getBalance(userPublicKey);
    let stakingPool;
    try {
      stakingPool = await program.account.stakingPool.fetch(stakingPoolPda);
    } catch (e) {
      console.error("Error fetching staking pool");
      stakingPool = {
        totalStaked: new anchor.BN(0),
        stakingPeriod: new anchor.BN(0),
      };
    }
    let userAccount;
    try {
      userAccount = await program.account.user.fetch(userPda);
    } catch (e) {
      console.error("Error fetching user account");
      userAccount = {
        stakedAmount: new anchor.BN(0),
        stakeTimestamp: new anchor.BN(0),
      };
    }

    return NextResponse.json({
      balance: balance / LAMPORTS_PER_SOL, // Convert lamports to SOL
      stakedAmount:
        userAccount!.stakedAmount.toNumber() / LAMPORTS_PER_SOL || 0, // Convert lamports to SOL
      totalStaked: stakingPool!.totalStaked.toNumber() / LAMPORTS_PER_SOL || 0, // Convert lamports to SOL
      stakingPeriod: stakingPool!.stakingPeriod.toNumber() || 0,
    });
  } catch (e) {
    console.error("Error fetching stake info:", e);
    return NextResponse.json(
      { error: "Failed to fetch stake info" },
      { status: 500 }
    );
  }
}
