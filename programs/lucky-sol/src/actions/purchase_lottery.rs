use crate::*;

#[derive(Accounts)]
pub struct PurchaseLotteryTicket<'info> {
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub lottery: Account<'info, LotteryState>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut,
    token::mint = lottery.token_mint)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    #[account(
        mint::decimals = 0,
        mint::authority = lottery_token_authority,
        constraint = lottery.lottery_collection_mint == lottery_collection_mint.key()
    )]
    pub lottery_collection_mint: Account<'info,Mint>,
    #[account()]
    /// CHECK: we verify inside the instruction
    pub lottery_collection_metadata: AccountInfo<'info>,
    #[account(
        mut,
        token::authority = lottery_token_authority,
        token::mint = lottery.token_mint,
        constraint = lottery.token_account == lottery_token_account.key()
    )]
    pub lottery_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"lottery-authority", lottery.key().as_ref()],
        bump
    )]
    /// CHECK: we are verifying the seeds for this PDA
    pub lottery_token_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

impl PurchaseLotteryTicket<'_> {
    pub fn validate(&self, _ctx: &Context<Self>) -> Result<()> {
        msg!("init_client validate");
        Ok(())
    }

    pub fn actuate(ctx: &Context<Self>) -> Result<()> {
        msg!("init_client actuate");

        Ok(())
    }
}