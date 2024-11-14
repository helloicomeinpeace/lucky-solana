use crate::*;

#[derive(Accounts)]
pub struct SetWinner<'info> {
    #[account(mut)]
    pub lottery: Account<'info, LotteryState>,
    #[account(mut, constraint = lottery_token_account.owner == lottery.key() && lottery_token_account.mint == lottery.token_mint)]
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