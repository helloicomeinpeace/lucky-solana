import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  associatedTokenProgram,
  keypairIdentity,
  Metaplex,
  parseTokenAccount,
  tokenProgram,
} from "@metaplex-foundation/js";
import { LotteryState } from "./schemas";
import {
  MasterEditionV2,
  MasterEditionV1,
  Metadata,
} from "@metaplex-foundation/mpl-token-metadata";

import assert from "assert";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAccount,
  getMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  getTokenMetadata,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { NodeOracle } from "@switchboard-xyz/oracle";
import { LuckySol } from "../target/types/lucky_sol";
import { create_mint, getAssociatedTokenAccount } from "./utils";
import { timeStamp } from "console";

async function getTokenBalanceSpl(connection, tokenAccount) {
  const info = await getAccount(connection, tokenAccount);
  const amount = Number(info.amount);
  const mint = await getMint(connection, info.mint);
  const balance = amount / 10 ** mint.decimals;
  console.log("Balance (using Solana-Web3.js): ", balance);
  return balance;
}

describe("lucky_sol", () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const metaplex = Metaplex.make(provider.connection);

  const program = anchor.workspace.LuckySol as Program<LuckySol>;

  let mint_lamports: number;
  let globalState: PublicKey;
  let initializer: anchor.web3.Keypair;
  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;
  let user3: anchor.web3.Keypair;
  let user4: anchor.web3.Keypair;
  let user5: anchor.web3.Keypair;
  let user6: anchor.web3.Keypair;
  let mint: anchor.web3.Keypair;
  let ticket_collection_master_edition: anchor.web3.PublicKey;
  /**
   * HOLDS THE LOTTERY PROCEEDINGS
   */
  let lotteryTokenAccount: anchor.web3.Keypair;
  let lottery_collection_mint: anchor.web3.Keypair;
  let lottery_collection_mint_metadata: PublicKey;
  let lottery_collection_master_edition: PublicKey;
  let ticket_mint: anchor.web3.Keypair;
  let ticket_collection_mint_metadata: PublicKey;
  // let lotteryCollection: anchor.web3.Keypair;
  let lotteryCentralAuthority: PublicKey;
  // Generate a keypair for the lottery account
  let lotteryAccount_B = anchor.web3.Keypair.generate();
  user1 = anchor.web3.Keypair.generate();
  user2 = anchor.web3.Keypair.generate();
  user3 = anchor.web3.Keypair.generate();
  user4 = anchor.web3.Keypair.generate();
  user5 = anchor.web3.Keypair.generate();
  user6 = anchor.web3.Keypair.generate();
  // lotteryCollection = anchor.web3.Keypair.generate();
  initializer = anchor.web3.Keypair.generate();

  before(async () => {
    mint_lamports = await getMinimumBalanceForRentExemptMint(
      provider.connection
    );
    // Airdrop SOL to the initializer
    const signature = await provider.connection.requestAirdrop(
      initializer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(user1.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user2.publicKey, LAMPORTS_PER_SOL);

    await provider.connection.confirmTransaction(signature);

    /**
     *  lottery account authority will
     *  be the authority for the collection NFT mint,
     *  all lottery token accounts (vaults)
     *  and all ticket mints as well
     *  */
    // lottery
  });

  it("Should initialize the global state correctly", async () => {
    await provider.connection.requestAirdrop(
      initializer.publicKey,
      2 * LAMPORTS_PER_SOL
    );

    let globalStateBump;
    lottery_collection_mint = anchor.web3.Keypair.generate();
    // Derive the address for the GlobalState account
    [globalState, globalStateBump] = await PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      program.programId
    );

    let bump;
    [lotteryCentralAuthority, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lottery-central-authority")],
      program.programId
    );

    // CREATE METADATA FOR THE COLLECTION NFT AS WELL
    let collection_mint_metadata_bump;
    [lottery_collection_mint_metadata, collection_mint_metadata_bump] =
      await PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          new PublicKey(
            "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
          ).toBuffer(),
          lottery_collection_mint.publicKey.toBuffer(),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );

    // CREATE MASTER EDITION FOR COLLECTION NFT
    lottery_collection_master_edition = metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: lottery_collection_mint.publicKey });
    // anchor.web3.PublicKey.findProgramAddressSync(
    //   [
    //     Buffer.from("metadata"),
    //     new PublicKey(
    //       "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    //     ).toBuffer(),
    //     lottery_collection_mint.publicKey.toBuffer(),
    //     Buffer.from("edition"),
    //   ],
    //   new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    // )[0];

    // CREATE ASSOCIATED TOKEN ACCOUNT FOR THE COLLECTION NFT - INITIALIZER
    const initializer_collection_token_account =
      await getAssociatedTokenAddress(
        lottery_collection_mint.publicKey,
        initializer.publicKey
      );

    const create_lottery_mint_ix = SystemProgram.createAccount({
      fromPubkey: initializer.publicKey,
      newAccountPubkey: lottery_collection_mint.publicKey,
      space: MINT_SIZE,
      lamports: mint_lamports,
      programId: TOKEN_PROGRAM_ID,
    });

    const init_lottery_mint_ix = createInitializeMint2Instruction(
      lottery_collection_mint.publicKey,
      0,
      lotteryCentralAuthority,
      lotteryCentralAuthority
    );

    // Initialize the program
    const init_contract_ix = await program.methods
      .initialize("NAME", "SYM", "URI")
      .accounts({
        globalState: globalState,
        masterEditionAccount: lottery_collection_master_edition,
        initializer: initializer.publicKey,
        systemProgram: SystemProgram.programId,
        lotteryCollectionMint: lottery_collection_mint.publicKey,
        collectionMetadata: lottery_collection_mint_metadata,
        initializerTokenAccount: initializer_collection_token_account,
        lotteryCentralAuthority: lotteryCentralAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: new PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        ),
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();

    const init_transac = new Transaction();

    init_transac.add(
      create_lottery_mint_ix,
      init_lottery_mint_ix,
      init_contract_ix
    );

    const signers = [initializer, lottery_collection_mint];
    await sendAndConfirmTransaction(
      provider.connection,
      init_transac,
      signers
    ).catch((e) => console.log(e));

    // console.log(lottery_collection_mint.publicKey);

    // Fetch the global state account data
    const globalStateAccount = await program.account.globalState.fetch(
      globalState
    );

    // Perform assertions to verify the global state
    assert.equal(
      globalStateAccount.lotteries,
      0,
      "Initial lotteries count should be 0"
    );
    assert.ok(
      globalStateAccount.lotteryMaster.equals(initializer.publicKey),
      "Lottery master should match the initializer's public key"
    );

    // Additional assertions can be added here
    const master_edition_info = await provider.connection.getAccountInfo(
      lottery_collection_master_edition
    );

    const master_edition_data =
      MasterEditionV2.fromAccountInfo(master_edition_info);

    // console.log(master_edition_data);

    // const metadata = await Metadata.fromAccountAddress(
    //   provider.connection,
    //   lottery_collection_mint_metadata
    // );

    // console.log(metadata);
  });

  it("Should create a lottery correctly", async () => {
    // Parameters for create_lottery function
    const ticketPrice = new anchor.BN(10 * 10 ** 9); // Example ticket price is $10 USDC
    const maxTickets = new anchor.BN(100); // Example max tickets
    const maxTicketsPerUser = 5; // Example max tickets per user
    const maxWinners = 3; // Example max winners
    const prizeDistributionLength = 3; // The expected length
    let prizeDistribution = Buffer.alloc(prizeDistributionLength);

    prizeDistribution[0] = 50;
    prizeDistribution[1] = 25;
    prizeDistribution[2] = 25;

    // create mint
    mint = await create_mint(provider, initializer.publicKey);
    // collection_mint = anchor.web3.Keypair.generate();

    lotteryTokenAccount = anchor.web3.Keypair.generate();
    ticket_mint = anchor.web3.Keypair.generate();

    await createAccount(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      lotteryCentralAuthority, // authority for the lottery token account
      lotteryTokenAccount
    );

    // Fund the initializer account to make it rent-exempt
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        initializer.publicKey,
        LAMPORTS_PER_SOL
      )
    );

    // PublicKey.findProgramAddressSync(
    //   [
    //     user1.publicKey.toBuffer(),
    //     TOKEN_PROGRAM_ID.toBuffer(),
    //     ticket_collection_mint.toBuffer(),
    //   ],
    //   ASSOCIATED_TOKEN_PROGRAM_ID
    // )[0];
    // await getAssociatedTokenAddress(
    //   ticket_collection_mint,
    //   initializer.publicKey
    // );

    const [ticket_mint_metadata, _] = await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        ticket_mint.publicKey.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

    const create_ticket_mint_ix = SystemProgram.createAccount({
      fromPubkey: user1.publicKey,
      newAccountPubkey: ticket_mint.publicKey,
      space: MINT_SIZE,
      lamports: mint_lamports,
      programId: TOKEN_PROGRAM_ID,
    });

    const init_ticket_mint_ix = createInitializeMint2Instruction(
      ticket_mint.publicKey,
      0,
      lotteryCentralAuthority,
      lotteryCentralAuthority
    );

    const endTime = Math.floor(
      new Date("January 17, 2025 03:24:00").getTime() / 1000
    );

    const lotteryAccount_A = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery-state"), ticket_mint.publicKey.toBuffer()],
      program.programId
    )[0];

    // Create the lottery
    const create_lottery_ix = await program.methods
      .createLottery(
        "NAME",
        "SYM",
        "URI",
        ticketPrice,
        maxTickets,
        maxTicketsPerUser,
        new anchor.BN(endTime),
        prizeDistribution
      )
      .accounts({
        lotteryCreator: user1.publicKey,
        globalState: globalState,
        mint: mint.publicKey,
        lotteryCentralAuthority: lotteryCentralAuthority,
        ticketMint: ticket_mint.publicKey,
        lotteryCollectionMint: lottery_collection_mint.publicKey,
        lotteryCollectionMaster: lottery_collection_master_edition,
        lotteryCollectionMetadata: lottery_collection_mint_metadata,
        ticketMintMetadata: ticket_mint_metadata,
        lottery: lotteryAccount_A,
        lotteryTokenAccount: lotteryTokenAccount.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenMetadataProgram: new PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        ),
      })
      .instruction();

    const create_lottery_transaction = new Transaction();

    create_lottery_transaction.add(
      create_ticket_mint_ix,
      init_ticket_mint_ix,
      create_lottery_ix
    );
    const signers = [user1, ticket_mint];

    await sendAndConfirmTransaction(
      provider.connection,
      create_lottery_transaction,
      signers
    ).catch((e) => console.error(e));

    const lotteryStateAcc = await provider.connection.getAccountInfo(
      lotteryAccount_A
    );
    const lotteryState = LotteryState.deserialize(lotteryStateAcc.data);

    assert.ok(
      prizeDistribution.equals(lotteryState.prizeDistribution),
      "prize distributions mismatch"
    );
    // Perform assertions to verify the lottery state
    assert.equal(
      lotteryState.ticketPrice.toString(),
      ticketPrice.toString(),
      "Ticket price should match"
    );
    assert.equal(
      lotteryState.maxTickets.toString(),
      maxTickets.toString(),
      "Max tickets should match"
    );
    assert.equal(
      lotteryState.maxTicketsPerUser,
      maxTicketsPerUser,
      "Max tickets per user should match"
    );
    assert.deepEqual(
      lotteryState.prizeDistribution,
      prizeDistribution,
      "Prize distribution should match"
    );

    assert.ok(
      lotteryState.tokenMint.equals(mint.publicKey),
      "lottery token mint should match the correct mint key"
    );

    assert.ok(
      lotteryState.tokenAccount.equals(lotteryTokenAccount.publicKey),
      "Creator should match the lottery creator's public key"
    );

    const metadata = await Metadata.fromAccountAddress(
      provider.connection,
      ticket_mint_metadata
    );

    console.log(metadata);
  });

  it("should let user1 purchase tickets successfully from lottery A", async () => {
    const toAta = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      user1.publicKey
    );

    // give $1000 spl tokens to user 1
    const mintAmount = 1000 * 10 ** 9;
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      toAta,
      initializer,
      mintAmount
    );

    // mint of the new ticket nft
    const ticket_mint_buyer_ata = await getAssociatedTokenAddress(
      ticket_mint.publicKey,
      user1.publicKey
    );

    const lamports = await getMinimumBalanceForRentExemptMint(
      provider.connection
    );

    const transaction = new Transaction();

    const lotteryAccount_A = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery-state"), ticket_mint.publicKey.toBuffer()],
      program.programId
    )[0];

    // purchase ticket ix
    let purchase_lottery_ix = await program.methods
      .purchaseLotteryTicket(new anchor.BN(10))
      .accounts({
        lottery: lotteryAccount_A,
        lotteryTokenAccount: lotteryTokenAccount.publicKey,
        buyer: user1.publicKey,
        ticketMint: ticket_mint.publicKey,
        buyerTokenAccount: toAta,
        buyerTicketAccount: ticket_mint_buyer_ata,
        lotteryCentralAuthority: lotteryCentralAuthority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: new PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        ),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    transaction.add(computeBudgetIx, purchase_lottery_ix);

    const signers = [user1]; // Add all signers to this array

    // 4. Send the transaction with the additional signers
    await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      signers
    ).catch((e) => console.log(e));
  });

  it("should let user2 purchase tickets successfully from lottery A", async () => {
    const toAta = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      user2.publicKey
    );

    // give $1000 spl tokens to user 2
    const mintAmount = 1000 * 10 ** 9;
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      toAta,
      initializer,
      mintAmount
    );

    // mint of the new ticket nft
    const ticket_mint_buyer_ata = await getAssociatedTokenAddress(
      ticket_mint.publicKey,
      user2.publicKey
    );

    const lamports = await getMinimumBalanceForRentExemptMint(
      provider.connection
    );

    const transaction = new Transaction();

    const lotteryAccount_A = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery-state"), ticket_mint.publicKey.toBuffer()],
      program.programId
    )[0];

    // purchase ticket ix
    let purchase_lottery_ix = await program.methods
      .purchaseLotteryTicket(new anchor.BN(10))
      .accounts({
        lottery: lotteryAccount_A,
        lotteryTokenAccount: lotteryTokenAccount.publicKey,
        buyer: user2.publicKey,
        ticketMint: ticket_mint.publicKey,
        buyerTokenAccount: toAta,
        buyerTicketAccount: ticket_mint_buyer_ata,
        lotteryCentralAuthority: lotteryCentralAuthority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: new PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        ),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    transaction.add(computeBudgetIx, purchase_lottery_ix);

    const signers = [user2]; // Add all signers to this array

    // 4. Send the transaction with the additional signers
    await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      signers
    ).catch((e) => console.log(e));
  });

  it("should execute set winners and transfer the amount to winners correctly", async () => {
    const winnerTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      user1.publicKey
    );

    const lotteryAccount_A = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery-state"), ticket_mint.publicKey.toBuffer()],
      program.programId
    )[0];

    const set_winner_ix = await program.methods
      .setWinner()
      .accounts({
        globalState: globalState,
        lottery: lotteryAccount_A,
        lotteryMaster: initializer.publicKey,
        lotteryCentralAuthority: lotteryCentralAuthority,
        lotteryTokenAccount: lotteryTokenAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts({
        pubkey: winnerTokenAccount,
        isWritable: true,
        isSigner: false,
      })
      .instruction();

    let signers = [initializer];

    let tx = new Transaction();
    tx.add(set_winner_ix);

    await sendAndConfirmTransaction(provider.connection, tx, signers);

    const vault_acc_details = await getAccount(
      provider.connection,
      lotteryTokenAccount.publicKey
    );

    const winner_acc_details = await getAccount(
      provider.connection,
      winnerTokenAccount
    );
    // console.log(winner_acc_details.amount);
    // console.log(vault_acc_details.amount);
  });
});
