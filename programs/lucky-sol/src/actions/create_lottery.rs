use crate::*;

#[derive(Accounts)]
pub struct CreateLottery<'info> {
    #[account(mut)]
    pub lottery_creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    global_state: Account<'info, GlobalState>,
    #[account()]
    pub mint: Account<'info, Mint>,
    // enough capacity to hold 50 max winners and 300 total lottery ticket holders
    #[account(init, payer = lottery_creator, space = 8 + 8 + 32 + 8 + 1 + 1 + 8 + 4 + 50 + 4 + (300 * 32) + 32 +32)]
    pub lottery: Account<'info, LotteryState>,
    #[account(
        token::authority = lottery_token_authority,
        token::mint = mint
    )]
    pub lottery_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = lottery_creator,
        space = 8,
        seeds = [b"lottery-authority", lottery.key().as_ref()],
        bump
    )]
    /// CHECK: we are verifying the seeds for this PDA
    pub lottery_token_authority: AccountInfo<'info>,
    /// CHECK: metaplex is initing it so it's ok
    #[account(init, 
        payer = lottery_creator,
        mint::decimals = 0,
        mint::authority = lottery_token_authority,
    )]
    pub lottery_collection_mint: Account<'info, Mint>,
    /// CHECK: Metaplex will create this metadata account
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

impl CreateLottery<'_> {
    pub fn validate(&self, _ctx: &Context<Self>) -> Result<()> {
        msg!("init_client validate");
        Ok(())
    }

    pub fn actuate(ctx: &Context<Self>) -> Result<()> {
        msg!("init_client actuate");

        Ok(())
    }
}