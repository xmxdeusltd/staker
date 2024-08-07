use anchor_lang::prelude::*;

declare_id!("7yKPtWXyxycfPc7viu939gUxub2XogBdm12X1Fi2sbbi");

#[program]
pub mod token_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
