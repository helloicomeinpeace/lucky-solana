use crate::*;

#[derive(Accounts)]
pub struct SetWinner<'info> {
    #[account(
        seeds = [b"global_state"], 
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
    #[account(mut)]
    pub lottery: Account<'info, LotteryState>,
    #[account(
        constraint = global_state.lottery_master == lottery_master.key()
    )]
    pub lottery_master: Signer<'info>,
    #[account(
        mut,
        seeds = [b"lottery-central-authority"],
        bump
    )]
    /// CHECK: we are verifying the seeds for this PDA
    pub lottery_central_authority: AccountInfo<'info>,
    #[account(mut, constraint = lottery_token_account.owner == lottery_central_authority.key() && lottery.token_account == lottery_token_account.key())]
    pub lottery_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl SetWinner<'_> {
    pub fn validate(&self, _ctx: &Context<Self>) -> Result<()> {
        msg!("init_client validate");
        Ok(())
    }

    pub fn actuate(ctx: &Context<Self>) -> Result<()> {
        msg!("init_client actuate");

        Ok(())
    }
}