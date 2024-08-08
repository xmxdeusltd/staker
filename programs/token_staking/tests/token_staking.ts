import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenStaking } from "../target/types/token_staking";
import { PublicKey, Connection } from "@solana/web3.js";
import { expect } from "chai";

describe("token_staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenStaking as Program<TokenStaking>;

  let stakingPoolPda: PublicKey;
  let stakingPoolBump: number;

  const stakingPeriod = new anchor.BN(5); // 5 seconds for testing purposes

  before(async () => {
    [stakingPoolPda, stakingPoolBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool")],
      program.programId
    );
  });
  // Helper function to log account balances
  async function logBalances(
    userPublicKey: PublicKey,
    poolPublicKey: PublicKey
  ) {
    const userBalance = await provider.connection.getBalance(userPublicKey);
    const poolBalance = await provider.connection.getBalance(poolPublicKey);
    console.log(
      `User balance: ${userBalance / anchor.web3.LAMPORTS_PER_SOL} SOL`
    );
    console.log(
      `Pool balance: ${poolBalance / anchor.web3.LAMPORTS_PER_SOL} SOL`
    );
  }

  // Helper function to log staking pool state
  async function logStakingPoolState(poolPublicKey: PublicKey) {
    const stakingPool = await program.account.stakingPool.fetch(poolPublicKey);
    console.log(`Staking pool state:`);
    console.log(`  Authority: ${stakingPool.authority.toString()}`);
    console.log(
      `  Staking period: ${stakingPool.stakingPeriod.toString()} seconds`
    );
    console.log(
      `  Total staked: ${stakingPool.totalStaked.toString()} lamports`
    );
  }

  // Helper function to log user state
  async function logUserState(userPublicKey: PublicKey) {
    const userAccount = await program.account.user.fetch(userPublicKey);
    console.log(`User state:`);
    console.log(
      `  Staked amount: ${userAccount.stakedAmount.toString()} lamports`
    );
    console.log(`  Stake timestamp: ${userAccount.stakeTimestamp.toString()}`);
  }

  // Helper function to airdrop and confirm
  async function airdropAndConfirm(
    connection: Connection,
    address: PublicKey,
    amount: number
  ) {
    const signature = await connection.requestAirdrop(address, amount);
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...latestBlockhash,
    });
  }

  // Helper function to derive user PDA
  async function deriveUserPDA(
    userPublicKey: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("user"), userPublicKey.toBuffer()],
      program.programId
    );
  }

  it("Initializes the staking pool", async () => {
    const tx = await program.methods
      .initialize(stakingPeriod)
      .accounts({
        stakingPool: stakingPoolPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    const stakingPool = await program.account.stakingPool.fetch(stakingPoolPda);
    expect(stakingPool.authority.toString()).to.equal(
      provider.wallet.publicKey.toString()
    );
    expect(stakingPool.stakingPeriod.toNumber()).to.equal(
      stakingPeriod.toNumber()
    );
    expect(stakingPool.totalStaked.toNumber()).to.equal(0);

    await logStakingPoolState(stakingPoolPda);
  });

  it("Adjusts the staking period", async () => {
    const newStakingPeriod = new anchor.BN(20); // 20 seconds
    const oldStakingPeriod = new anchor.BN(5); // 5 seconds

    await program.methods
      .adjustStakingPeriod(newStakingPeriod)
      .accounts({
        stakingPool: stakingPoolPda,
        authority: provider.wallet.publicKey,
      } as any)
      .rpc();

    const stakingPool = await program.account.stakingPool.fetch(stakingPoolPda);
    expect(stakingPool.stakingPeriod.toNumber()).to.equal(
      newStakingPeriod.toNumber()
    );

    await logStakingPoolState(stakingPoolPda);

    await program.methods
      .adjustStakingPeriod(oldStakingPeriod)
      .accounts({
        stakingPool: stakingPoolPda,
        authority: provider.wallet.publicKey,
      } as any)
      .rpc();

    const stakingPoolv2 = await program.account.stakingPool.fetch(
      stakingPoolPda
    );
    expect(stakingPoolv2.stakingPeriod.toNumber()).to.equal(
      oldStakingPeriod.toNumber()
    );
    await logStakingPoolState(stakingPoolPda);
  });

  it("Stakes tokens", (done) => {
    (async () => {
      console.log("Test started");
      const user = anchor.web3.Keypair.generate();
      const [userPDA, _] = await deriveUserPDA(user.publicKey);
      const stakeAmount = new anchor.BN(100_000_000); // 0.1 SOL

      console.log("Before airdrop:");
      await logBalances(user.publicKey, stakingPoolPda);

      console.log("Airdropping...");
      await airdropAndConfirm(
        provider.connection,
        user.publicKey,
        1_000_000_000
      );

      console.log("Before staking:");
      await logBalances(user.publicKey, stakingPoolPda);
      await logStakingPoolState(stakingPoolPda);

      console.log("Staking...");
      const tx = await program.methods
        .stake(stakeAmount)
        .accounts({
          stakingPool: stakingPoolPda,
          user: userPDA,
          userAccount: user.publicKey,
          stakingPoolAccount: stakingPoolPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([user])
        .rpc();

      console.log("Confirming transaction...");
      await provider.connection.confirmTransaction(tx, "confirmed");

      console.log("Transaction confirmed, waiting...");
      setTimeout(async () => {
        try {
          console.log("After staking:");
          await logBalances(user.publicKey, stakingPoolPda);
          await logStakingPoolState(stakingPoolPda);
          await logUserState(userPDA);

          console.log("Fetching staking pool...");
          const stakingPool = await program.account.stakingPool.fetch(
            stakingPoolPda
          );
          expect(stakingPool.totalStaked.toNumber()).to.equal(
            stakeAmount.toNumber()
          );

          console.log("Fetching user account...");
          const userAccount = await program.account.user.fetch(userPDA);
          expect(userAccount.stakedAmount.toNumber()).to.equal(
            stakeAmount.toNumber()
          );

          console.log("Test completed successfully");
          done();
        } catch (error) {
          console.error("Error in setTimeout:", error);
          done(error);
        }
      }, 2000);
    })().catch((error) => {
      console.error("Caught error:", error);
      done(error);
    });
  });

  it("Fails to unstake before staking period is complete", (done) => {
    (async () => {
      const user = anchor.web3.Keypair.generate();
      const [userPDA, _] = await deriveUserPDA(user.publicKey);
      const stakeAmount = new anchor.BN(100_000_000); // 0.1 SOL

      await airdropAndConfirm(
        provider.connection,
        user.publicKey,
        1_000_000_000
      );

      console.log("Before staking:");
      await logBalances(user.publicKey, stakingPoolPda);
      await logStakingPoolState(stakingPoolPda);

      const stakeTx = await program.methods
        .stake(stakeAmount)
        .accounts({
          stakingPool: stakingPoolPda,
          user: userPDA,
          userAccount: user.publicKey,
          stakingPoolAccount: stakingPoolPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([user])
        .rpc();

      await provider.connection.confirmTransaction(stakeTx, "confirmed");

      setTimeout(async () => {
        console.log("After staking:");
        await logBalances(user.publicKey, stakingPoolPda);
        await logStakingPoolState(stakingPoolPda);
        await logUserState(userPDA);

        // Try to unstake immediately
        try {
          await program.methods
            .unstake()
            .accounts({
              stakingPool: stakingPoolPda,
              user: userPDA,
              userAccount: user.publicKey,
              stakingPoolAccount: stakingPoolPda,
              systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .signers([user])
            .rpc();
          expect.fail("Unstake should have failed");
        } catch (error) {
          expect(error.message).to.include("Staking period is not complete");
        }

        console.log("After failed unstake attempt:");
        await logBalances(user.publicKey, stakingPoolPda);
        await logStakingPoolState(stakingPoolPda);
        await logUserState(userPDA);

        done();
      }, 2000);
    })().catch(done);
  });

  it("Successfully unstakes after staking period", async () => {
    const user = anchor.web3.Keypair.generate();
    const [userPDA, _] = await deriveUserPDA(user.publicKey);
    const stakeAmount = new anchor.BN(100_000_000); // 0.1 SOL

    await airdropAndConfirm(provider.connection, user.publicKey, 1_000_000_000);

    console.log("Before staking:");
    await logBalances(user.publicKey, stakingPoolPda);
    await logStakingPoolState(stakingPoolPda);

    const stakeTx = await program.methods
      .stake(stakeAmount)
      .accounts({
        stakingPool: stakingPoolPda,
        user: userPDA,
        userAccount: user.publicKey,
        stakingPoolAccount: stakingPoolPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([user])
      .rpc();

    await provider.connection.confirmTransaction({
      signature: stakeTx,
      ...(await provider.connection.getLatestBlockhash()),
    });

    console.log("After staking:");
    await logBalances(user.publicKey, stakingPoolPda);
    await logStakingPoolState(stakingPoolPda);
    await logUserState(userPDA);

    console.log("Waiting for staking period to complete...");
    // Wait for the staking period to complete (5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // Simulate network activity to advance the clock
    const airdropSignature = await provider.connection.requestAirdrop(
      user.publicKey,
      1
    );
    await provider.connection.confirmTransaction({
      signature: airdropSignature,
      ...(await provider.connection.getLatestBlockhash()),
    });

    console.log("Attempting to unstake...");
    const unstakeTx = await program.methods
      .unstake()
      .accounts({
        stakingPool: stakingPoolPda,
        user: userPDA,
        userAccount: user.publicKey,
        stakingPoolAccount: stakingPoolPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([user])
      .rpc();

    await provider.connection.confirmTransaction({
      signature: unstakeTx,
      ...(await provider.connection.getLatestBlockhash()),
    });

    console.log("After unstaking:");
    await logBalances(user.publicKey, stakingPoolPda);
    await logStakingPoolState(stakingPoolPda);
    await logUserState(userPDA);

    const userAccount = await program.account.user.fetch(userPDA);
    expect(userAccount.stakedAmount.toNumber()).to.equal(0);
  });
});
