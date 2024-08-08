use anchor_lang::prelude::*;

declare_id!("Zch9tAY2N9rwkP8fevkUE2xUFepYqAM1xn7kQZFAeFU");

#[program]
pub mod token_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, staking_period: i64) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;
        staking_pool.authority = ctx.accounts.authority.key();
        staking_pool.staking_period = staking_period;
        staking_pool.total_staked = 0;
        Ok(())
    }

    pub fn adjust_staking_period(ctx: Context<AdjustStakingPeriod>, new_staking_period: i64) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;
        staking_pool.staking_period = new_staking_period;
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;
        let user = &mut ctx.accounts.user;

        // Transfer SOL from user to staking pool
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user_account.to_account_info(),
                to: ctx.accounts.staking_pool_account.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        staking_pool.total_staked += amount;
        user.staked_amount += amount;
        user.stake_timestamp = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;
        let user = &mut ctx.accounts.user;

        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= user.stake_timestamp + staking_pool.staking_period,
            StakingError::StakingPeriodNotComplete
        );

        let amount = user.staked_amount;

        // Transfer SOL from staking pool back to user
        **ctx.accounts.staking_pool_account.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user_account.try_borrow_mut_lamports()? += amount;

        staking_pool.total_staked -= amount;
        user.staked_amount = 0;
        user.stake_timestamp = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8,
        seeds = [b"staking_pool"],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdjustStakingPeriod<'info> {
    #[account(mut, has_one = authority)]
    pub staking_pool: Account<'info, StakingPool>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"staking_pool"], bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(
        init_if_needed,
        payer = user_account,
        space = 8 + 8 + 8,
        seeds = [b"user", user_account.key().as_ref()],
        bump
    )]
    pub user: Account<'info, User>,
    #[account(mut)]
    pub user_account: Signer<'info>,
    /// CHECK: This is safe because we're only using it to transfer SOL
    #[account(mut)]
    pub staking_pool_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"staking_pool"], bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(
        mut,
        seeds = [b"user", user_account.key().as_ref()],
        bump
    )]
    pub user: Account<'info, User>,
    #[account(mut)]
    pub user_account: Signer<'info>,
    /// CHECK: This is safe because we're only using it to transfer SOL
    #[account(mut)]
    pub staking_pool_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct StakingPool {
    pub authority: Pubkey,
    pub staking_period: i64,
    pub total_staked: u64,
}

#[account]
pub struct User {
    pub staked_amount: u64,
    pub stake_timestamp: i64,
}

#[error_code]
pub enum StakingError {
    #[msg("Staking period is not complete")]
    StakingPeriodNotComplete,
}