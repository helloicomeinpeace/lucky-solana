use crate::*;

#[derive(Accounts)]
pub struct PurchaseLotteryTicket<'info> {
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub lottery: Account<'info, LotteryState>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut,
    associated_token::mint = lottery.token_mint,
    associated_token::authority = buyer
    )]
    pub buyer_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        mint::decimals = 0,
        mint::authority = lottery_central_authority,
        constraint = lottery.ticket_mint == ticket_mint.key()
    )]
    pub ticket_mint: Account<'info,Mint>,
    #[account(
        mut,
        token::authority = lottery_central_authority,
        token::mint = lottery.token_mint,
        constraint = lottery.token_account == lottery_token_account.key()
    )]
    pub lottery_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = ticket_mint,
        associated_token::authority = buyer
    )]
    pub buyer_ticket_account: Account <'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"lottery-central-authority"],
        bump
    )]
    /// CHECK: we are verifying the seeds for this PDA
    pub lottery_central_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
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