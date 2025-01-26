use anchor_lang::prelude::*;
use anchor_spl::{
token::{self, MintTo as SplMint, Transfer as SplTransfer,},
token::{Token, TokenAccount, Mint},
associated_token::{get_associated_token_address,AssociatedToken},
metadata::{
    create_metadata_accounts_v3,
    create_master_edition_v3,
    mpl_token_metadata::types::{DataV2,CollectionDetails},
    mpl_token_metadata::types::{Data, Creator, Collection},
    CreateMetadataAccountsV3,
    CreateMasterEditionV3,
    SetAndVerifySizedCollectionItem,
    VerifySizedCollectionItem,
    mpl_token_metadata::accounts::Metadata as MPLMetadata,
    Metadata as Metaplex,
},
};
pub mod actions;
pub use actions::*;
// use spl_token::state::Mint;

declare_id!("5X6xVcL5Fc9qzWXrRSJfnqLu6xXpLmHZX1szaGoj5NHr");
const MAX_TICKETS_PER_USER: usize = 20; // Example value

#[program]
pub mod lucky_sol {

    use std::ops::{Div, Mul};

    use anchor_spl::{metadata::{mpl_token_metadata::accounts::Metadata, sign_metadata, set_and_verify_sized_collection_item, verify_sized_collection_item, SignMetadata, VerifyCollection}, token, token_interface::Mint};
    // use anchor_spl::{metadata, token_interface::Mint};
    use solana_program::{clock::{self, Clock}, program::invoke, program_pack::Pack};

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, symbol: String, uri: String) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        let lottery_master = &ctx.accounts.initializer;

        // set the state
        global_state.lotteries = 0;
        global_state.lottery_master = lottery_master.key();
        global_state.lottery_collection_mint = ctx.accounts.lottery_collection_mint.key();


        let seeds = &["lottery-central-authority".as_bytes(),&[ctx.bumps.lottery_central_authority]];
        let signer = [&seeds[..]];
        
        let creator: Creator = Creator { address: (ctx.accounts.lottery_central_authority.key()), verified: (true), share: (100) };

        // mint 1 token to the initializer - holds the collection NFT
        let cpi_accounts_new = SplMint {
            mint: ctx.accounts.lottery_collection_mint.to_account_info(),
            to: ctx.accounts.initializer_token_account.to_account_info(),
            authority: ctx.accounts.lottery_central_authority.to_account_info(),
        };

            
            // set metadata for this NFT
            let token_data: DataV2 = DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                // creators: Some(vec![creator]),
                creators: None,
                collection: None,
                uses: None,
            };

            let metadata_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    payer: ctx.accounts.initializer.to_account_info(),
                    update_authority: ctx.accounts.lottery_central_authority.to_account_info(),
                    mint: ctx.accounts.lottery_collection_mint.to_account_info(),
                    metadata: ctx.accounts.collection_metadata.to_account_info(),
                    mint_authority: ctx.accounts.lottery_central_authority.to_account_info(),
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
                Some(CollectionDetails::V1 { size: (0) }),
            )?;

            let master_edition_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 { 
                    edition: ctx.accounts.master_edition_account.to_account_info(), 
                    mint: ctx.accounts.lottery_collection_mint.to_account_info(), 
                    update_authority: ctx.accounts.lottery_central_authority.to_account_info(), 
                    mint_authority: ctx.accounts.lottery_central_authority.to_account_info(), 
                    payer: ctx.accounts.initializer.to_account_info(), 
                    metadata: ctx.accounts.collection_metadata.to_account_info(), 
                    token_program: ctx.accounts.token_program.to_account_info(), 
                    system_program: ctx.accounts.system_program.to_account_info(), 
                    rent: ctx.accounts.rent.to_account_info()
                },
                &signer,
            );

            token::mint_to(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts_new,&signer),1)?;
            create_master_edition_v3(master_edition_ctx, Some(0)).map_err(|_| error!(ErrorCode::MasterEditionCreationFailed))?;

            
            // set_and_verify_collection(ctx, collection_authority_record);
        Ok(())
    }
    
    // #[access_control(ctx.accounts.validate(&ctx, &params))]
    pub fn create_lottery<'info>(ctx: Context<CreateLottery>,
        name: String,
        symbol: String,
        uri: String,
        ticket_price: u64,
        max_tickets: u16,
        max_tickets_per_user: u8,
        end_time: i64,
        prize_distribution: Vec<u8>) -> Result<()> {

            let lottery_state = &mut ctx.accounts.lottery;
            let seeds = &["lottery-central-authority".as_bytes(),&[ctx.bumps.lottery_central_authority]];
            let signer = [&seeds[..]];
            let clock = Clock::get()?;

            lottery_state.ticket_price = ticket_price;
            lottery_state.max_tickets = max_tickets;
            lottery_state.max_tickets_per_user = max_tickets_per_user;
            lottery_state.prize_distribution = prize_distribution;
            lottery_state.token_account = ctx.accounts.lottery_token_account.key();
            lottery_state.token_mint = ctx.accounts.mint.key();
            lottery_state.ticket_mint = ctx.accounts.ticket_mint.key();
            lottery_state.end_time = end_time;
            lottery_state.is_active = true;

            assert!(ctx.accounts.ticket_mint.supply == 0, "ticket mint needs to have 0 supply");
            assert!(end_time > clock.unix_timestamp, "incorrect lottery end time provided");

            lottery_state.end_time = end_time;

            let creator: Creator = Creator { address: (ctx.accounts.lottery_creator.key()), verified: (false), share: (100) };
            let collection: Collection = Collection { verified: (false), key: (ctx.accounts.lottery_collection_mint.key()) }; 

            // set metadata for this NFT
            let token_data: DataV2 = DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                creators: Some(vec![creator]),
                collection: Some(collection),
                uses: None,
            };

            let metadata_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    payer: ctx.accounts.lottery_creator.to_account_info(),
                    update_authority: ctx.accounts.lottery_central_authority.to_account_info(),
                    mint: ctx.accounts.ticket_mint.to_account_info(),
                    metadata: ctx.accounts.ticket_mint_metadata.to_account_info(),
                    mint_authority: ctx.accounts.lottery_central_authority.to_account_info(),
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

            // SIGN THE METADATA WITH THE CREATOR TO VERIFY

            let verify_creator_accounts = SignMetadata{
                metadata: ctx.accounts.ticket_mint_metadata.to_account_info(),
                creator: ctx.accounts.lottery_creator.to_account_info(),
            };

            let verify_creator_ctx = CpiContext::new(ctx.accounts.token_metadata_program.to_account_info(), verify_creator_accounts);

            sign_metadata(verify_creator_ctx);

            let verify_collection_accounts = SetAndVerifySizedCollectionItem{
                metadata: ctx.accounts.ticket_mint_metadata.to_account_info(),
                collection_authority: ctx.accounts.lottery_central_authority.to_account_info(),
                payer: ctx.accounts.lottery_creator.to_account_info(),
                update_authority: ctx.accounts.lottery_central_authority.to_account_info(),
                collection_mint: ctx.accounts.lottery_collection_mint.to_account_info(),
                collection_metadata: ctx.accounts.lottery_collection_metadata.to_account_info(),
                collection_master_edition: ctx.accounts.lottery_collection_master.to_account_info()
            };

            let verify_collection_ctx = CpiContext::new_with_signer(ctx.accounts.token_metadata_program.to_account_info(), verify_collection_accounts, &signer);
            set_and_verify_sized_collection_item(verify_collection_ctx, None);
        Ok(())
    }

    pub fn purchase_lottery_ticket<'info>(ctx: Context<'_, '_ , 'info ,'info, PurchaseLotteryTicket<'info>>, number_of_tickets: u16) -> Result<()> {
        let lottery_state = &mut ctx.accounts.lottery;
        let ticket_price = lottery_state.ticket_price;
        let ticket_mint = &ctx.accounts.ticket_mint;

        assert!(lottery_state.is_active, "lottery has ended");
        assert!(ticket_mint.supply <= lottery_state.max_tickets as u64, "tickets sold out");
        // check if total tickets issued cap is crossed after minting this ticket
        assert!(ticket_mint.supply + (number_of_tickets as u64) <= lottery_state.max_tickets as u64, "not enough tickets");

        let destination = &ctx.accounts.lottery_token_account;
        let source = &ctx.accounts.buyer_token_account;
        let token_program = &ctx.accounts.token_program;
        let buyer = &ctx.accounts.buyer;
        let lottery_authority = &ctx.accounts.lottery_central_authority;
        let seeds = &["lottery-central-authority".as_bytes(),&[ctx.bumps.lottery_central_authority]];
        let signer = [&seeds[..]];


        // Transfer tokens from buyer to lottery vault
        let cpi_accounts = SplTransfer {
            from: source.to_account_info().clone(),
            to: destination.to_account_info().clone(),
            authority: buyer.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();
        
        token::transfer(
            CpiContext::new(cpi_program.clone(), cpi_accounts),
            ticket_price
            )?;
    

        let cpi_accounts_new = SplMint {
            mint: ctx.accounts.ticket_mint.to_account_info(),
            to: ctx.accounts.buyer_ticket_account.to_account_info(),
            authority: lottery_authority.to_account_info(),
        };

        // mint tickets nft to the buyer
        token::mint_to(CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_new,&signer),
        number_of_tickets as u64)?;

    
        Ok(())
    }

    pub fn set_winner<'info>(ctx: Context<'_, '_ , 'info ,'info, SetWinner<'info>>) -> Result<()> {
        
        let seeds = &["lottery-central-authority".as_bytes(),&[ctx.bumps.lottery_central_authority]];
        let signer = [&seeds[..]];

        // get winners
        let winner_account_info_iter = &mut ctx.remaining_accounts.iter();
        let prize_distribution = &ctx.accounts.lottery.prize_distribution;
        let is_active = &ctx.accounts.lottery.is_active;

        assert!(is_active,"lottery has ended");
        
        // check that the number of winners received is legal
        let winner_is_legal = prize_distribution.len() == winner_account_info_iter.len() || winner_account_info_iter.len() == 1;
        assert!(winner_is_legal);

        let mut index = 0;
        let tvl = ctx.accounts.lottery_token_account.amount;
        let mut tvt = 0 as u64;
        let from_account = &ctx.accounts.lottery_token_account;
        // Transferring tokens from token vault to winners
        loop {
            if winner_account_info_iter.len() == 0 { break };

            let to_account = next_account_info(winner_account_info_iter).unwrap();

            let cpi_accounts = SplTransfer {
                from: from_account.to_account_info(),
                to: to_account.to_account_info(),
                authority:ctx.accounts.lottery_central_authority.to_account_info(),
            };

            let cpi_program = ctx.accounts.token_program.to_account_info();
            
            let amount = 
            if index == prize_distribution.len() - 1 || winner_account_info_iter.len() == 0
            { 
                tvl - tvt
            } 
            else { 
                (prize_distribution[index] as u64).mul(tvl).div(100)
            };
            tvt += amount;
            token::transfer(
                CpiContext::new_with_signer(cpi_program, cpi_accounts, &signer),
                amount
                )?;

        }

        Ok(())
    }
    
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        seeds = [b"global_state"], 
        bump, 
        payer = initializer, 
        space = 8 + 8 + 32 + 32)]
    global_state: Account<'info, GlobalState>,
    /// CHECK: Metaplex will create this master edition account
    #[account(mut)]
    master_edition_account: UncheckedAccount<'info>,
    #[account(mut)]
    initializer: Signer<'info>,
    /// CHECK: metaplex is initing it so it's ok
    #[account(
        mut,
        mint::decimals = 0,
        mint::authority = lottery_central_authority,
        mint::freeze_authority = lottery_central_authority
    )]
    pub lottery_collection_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = initializer, 
        associated_token::mint = lottery_collection_mint, 
        associated_token::authority = initializer,
    )]
    pub initializer_token_account: Account<'info, TokenAccount>,
    /// CHECK: Metaplex will create this metadata account
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,
    #[account(
        init,
        payer = initializer,
        space = 8,
        seeds = [b"lottery-central-authority"],
        bump
    )]
    /// CHECK: we are verifying the seeds for this PDA
    pub lottery_central_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    pub token_metadata_program: Program<'info, Metaplex>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}


#[account]
pub struct GlobalState {
    pub lotteries: u64, // count of lotteries
    pub lottery_master: Pubkey, // used as the signer for announcing winners
    pub lottery_collection_mint: Pubkey, // this collection with father all ticket collections
}


#[account]
pub struct LotteryState {
    pub ticket_price: u64,
    pub max_tickets: u16,
    pub max_tickets_per_user: u8,
    pub prize_distribution: Vec<u8>,
    pub ticket_mint: Pubkey,
    pub token_mint: Pubkey,
    pub token_account: Pubkey,
    pub end_time: i64,
    pub is_active: bool
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
    CalculationOverflow,
    
    
    #[msg("verification of collection failed.")]
    CollectionVerificationFailed,
    
    
    #[msg("Creation of Master Edition failed.")]
    MasterEditionCreationFailed
}
