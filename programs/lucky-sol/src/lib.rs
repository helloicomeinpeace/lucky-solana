use anchor_lang::prelude::*;
use anchor_spl::{
token::{self, Token, TokenAccount,Mint, MintTo as SplMint, Transfer as SplTransfer},
associated_token::{get_associated_token_address,AssociatedToken},
metadata::{
    create_metadata_accounts_v3,
    mpl_token_metadata::types::{DataV2,CollectionDetails},
    mpl_token_metadata::types::{Data, Creator},
    CreateMetadataAccountsV3, 
    Metadata as Metaplex,
},
};
use solana_program::{
    // program::invoke_signed,
    // program_option::COption,
    // system_instruction,
    // stake::config::ID, sysvar::rent::Rent
    // keystore::Keypair
};
pub mod actions;
pub use actions::*;
// use spl_token::state::Mint;

declare_id!("CThD8o3Et3NXW68mSeGr4zL8bCe1SQc2SQRHaB44xw2q");
const MAX_TICKETS_PER_USER: usize = 20; // Example value

#[program]
pub mod lucky_sol {

    use anchor_spl::metadata;
    use solana_program::program_pack::Pack;
    use spl_token::state::Mint;

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        let lottery_master = &ctx.accounts.initializer;

        // set the state
        global_state.lotteries = 0;
        global_state.lottery_master = *lottery_master.key;
        Ok(())
    }
    
    // #[access_control(ctx.accounts.validate(&ctx, &params))]
    pub fn create_lottery(ctx: Context<CreateLottery>,
        name: String,
        symbol: String,
        uri: String,
        ticket_price: u64,
        max_tickets: u64,
        max_tickets_per_user: u8,
        max_winners: u8,
        prize_distribution: Vec<u8>) -> Result<()> {

            if max_winners as usize != prize_distribution.len() || prize_distribution.iter().sum::<u8>() != 100 {
                return Err(ErrorCode::InvalidPrizeDistribution.into());
            }


            let lottery_state = &mut ctx.accounts.lottery;
            let seeds = &["lottery-authority".as_bytes(), &lottery_state.key().to_bytes(),&[ctx.bumps.lottery_token_authority]];
            let signer = [&seeds[..]];

            lottery_state.ticket_price = ticket_price;
            lottery_state.max_tickets = max_tickets;
            lottery_state.max_tickets_per_user = max_tickets_per_user;
            lottery_state.max_winners = max_winners;
            lottery_state.prize_distribution = prize_distribution;
            lottery_state.total_tickets_issued = 0;
            lottery_state.creator = *ctx.accounts.lottery_creator.key;
            lottery_state.token_account = ctx.accounts.lottery_token_account.key();
            lottery_state.token_mint = ctx.accounts.mint.key();
            lottery_state.lottery_collection_mint = ctx.accounts.lottery_collection_mint.key();

            let creator: Creator = Creator { address: (ctx.accounts.lottery_token_authority.key()), verified: (true), share: (100) };
            
            // set metadata for this NFT
            let token_data: DataV2 = DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                creators: Some(vec![creator]),
                collection: None,
                uses: None,
            };

            let metadata_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    payer: ctx.accounts.lottery_creator.to_account_info(),
                    update_authority: ctx.accounts.lottery_token_authority.to_account_info(),
                    mint: ctx.accounts.lottery_collection_mint.to_account_info(),
                    metadata: ctx.accounts.collection_metadata.to_account_info(),
                    mint_authority: ctx.accounts.lottery_token_authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                &signer,
            );


            create_metadata_accounts_v3(
                metadata_ctx,
                token_data,
                false,
                true,
                Some(CollectionDetails::V1 { size: 0 }),
            )?;
        
        Ok(())
    }

    pub fn purchase_lottery_ticket(ctx: Context<PurchaseLotteryTicket>, number_of_tickets: u64) -> Result<()> {
        let lottery_state = &mut ctx.accounts.lottery;
        let ticket_price = lottery_state.ticket_price;
    
        let amount = ticket_price.checked_mul(number_of_tickets)
            .ok_or(ErrorCode::CalculationOverflow)?;

        let destination = &ctx.accounts.lottery_token_account;
        let source = &mut ctx.accounts.buyer_token_account;
        let token_program = &ctx.accounts.token_program;
        let authority: &Signer<'_> = &ctx.accounts.buyer;


        // Transfer tokens from taker to initializer
        let cpi_accounts = SplTransfer {
            from: source.to_account_info().clone(),
            to: destination.to_account_info().clone(),
            authority: authority.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();
        
        token::transfer(
            CpiContext::new(cpi_program.clone(), cpi_accounts),
            amount)?;

        let account_info_iter = &mut ctx.remaining_accounts.iter();
        let account1 = next_account_info(account_info_iter);
        // .ok_or_else(|| error!(MyError::MintAccountNotFound))?;
        let mut account_data = account1.unwrap().data.borrow_mut();

        let mint = Mint::unpack(account_data)?;
        // mint tickets to buyer
        // for account in ctx.remaining_accounts.iter() {
        
        // Transfer tokens from taker to initializer
        
        let cpi_accounts_new = SplMint {
            mint: account.to_account_info().clone(),
            to: source.to_account_info().clone(),
            authority: authority.to_account_info().clone(),
        };

        token::mint_to(CpiContext::new(cpi_program.clone(), cpi_accounts_new),
        1)?;
        // }


        let (metadata_derived_key, _) = Pubkey::find_program_address(&[b"metadata", ctx.accounts.token_metadata_program.key().as_ref(), ctx.accounts.lottery_collection_mint.key().as_ref()], ctx.accounts.token_metadata_program.key);

        let lottery_collection_mint = &ctx.accounts.lottery_collection_mint;
        
        assert_eq!(metadata_derived_key, ctx.accounts.lottery_collection_metadata.key());
        
        // set metadata for this raffle ticket NFTs
        // let token_data: DataV2 = DataV2 {
        //     name,
        //     symbol,
        //     uri,
        //     seller_fee_basis_points: 0,
        //     creators: None,
        //     collection: None,
        //     uses: None,
        // };
        // mint tickets to buyer
        // for account in ctx.remaining_accounts.iter() {

    
        // }

        lottery_state.total_tickets_issued += number_of_tickets;
    
        Ok(())
    }

    pub fn set_winner(ctx: Context<SetWinner>) -> Result<()> {
        // only transferring the tokens to the caller here - no winners being set
        
        Ok(())
    }
    
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, seeds = [b"global_state"], bump, payer = initializer, space = 8 + 8 + 32)]
    global_state: Account<'info, GlobalState>,
    #[account(mut)]
    initializer: Signer<'info>,
    system_program: Program<'info, System>
}


#[account]
pub struct GlobalState {
    pub lotteries: u64, // count of lotteries
    pub lottery_master: Pubkey // the owner of the lottery factory
}


#[account]
pub struct LotteryState {
    pub ticket_price: u64,
    pub creator: Pubkey,
    pub max_tickets: u64,
    pub max_tickets_per_user: u8,
    pub max_winners: u8,
    pub total_tickets_issued: u64,
    pub prize_distribution: Vec<u8>,
    pub lottery_collection_mint: Pubkey,
    pub token_mint: Pubkey,
    pub token_account: Pubkey
}


#[error_code]
pub enum ErrorCode {
    #[msg("The maximum number of tickets per user is exceeded.")]
    ExceedsMaxTicketsPerUser,

    #[msg("The maximum number of tickets for the lottery has been issued.")]
    MaxTicketsIssued,
    
    #[msg("Failed to create PDA.")]
    PDACreationFailed,

    #[msg("Invalid prize distribution")]
    InvalidPrizeDistribution,

    #[msg("Calculation overflow occurred.")]
    CalculationOverflow
}
