
use crate::*;

#[derive(Accounts)]
pub struct CreateLottery<'info> {
    #[account(mut, signer)]
    pub lottery_creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(mut,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
    #[account()]
    pub mint: Account<'info, Mint>,
    // enough capacity to hold 10 max winners (max prize distribution length)
    #[account(init, 
        payer = lottery_creator,
        seeds = [b"lottery-state", ticket_mint.key().as_ref()],
        bump,
        space = 8 + 8 + 2 + 1 + (4 + 10) + 32 + 32 + 32 + 8 + 1
    )]
    pub lottery: Account<'info, LotteryState>,
    #[account(
        token::authority = lottery_central_authority,
        token::mint = mint
    )]
    pub lottery_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"lottery-central-authority"],
        bump
    )]
    /// CHECK: we are verifying the seeds for this PDA
    pub lottery_central_authority: AccountInfo<'info>,
    /// CHECK: metaplex is initing it so it's ok
    #[account(
        mint::decimals = 0,
        mint::authority = lottery_central_authority,
    )]
    pub ticket_mint: Account<'info, Mint>,
    #[account(
        constraint = lottery_collection_mint.key() == global_state.lottery_collection_mint
    )]
    pub lottery_collection_mint: Account<'info, Mint>,
    /// CHECK: Metaplex will create this ticket collection metadata account
    #[account(mut)]
    pub ticket_mint_metadata: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Metaplex will check this account for us
    pub lottery_collection_master: AccountInfo<'info>,
    #[account(mut)]
    /// CHECK: Metaplex will check this account for us
    pub lottery_collection_metadata: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}