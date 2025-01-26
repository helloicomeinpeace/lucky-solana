import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/lucky_sol.json";
import bs58 from "bs58";
import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAccount,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMint2Instruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { create_mint } from "../tests/utils";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = new anchor.Program(idl as anchor.Idl, provider);
const metaplex = Metaplex.make(provider.connection);

async function main() {
  let [globalState, globalStateBump] = await PublicKey.findProgramAddress(
    [Buffer.from("global_state")],
    program.programId
  );
  let lottery_collection_mint = new PublicKey(
    "DpdkPDwMG7neQH8s88f6wobcdtKyVjmTs2qpUKZ1VENZ"
  );
  let lottery_collection_master_edition = metaplex
    .nfts()
    .pdas()
    .masterEdition({ mint: lottery_collection_mint });
  let [lottery_collection_mint_metadata, collection_mint_metadata_bump] =
    await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        lottery_collection_mint.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );
  let [lotteryCentralAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("lottery-central-authority")],
    program.programId
  );

  // Create the lottery
  let ticketPrice = new anchor.BN(5 * 10 ** 9);
  let maxTickets = new anchor.BN(50);
  let maxTicketsPerUser = 5;
  let maxWinners = 3;
  let prizeDistribution = Buffer.alloc(3);

  prizeDistribution[0] = 50;
  prizeDistribution[1] = 25;
  prizeDistribution[2] = 25;

  const mint = new PublicKey("5DRQ4WkeM1URSZkxSKTsLSodAYLgX4Q3uRGUcTPA9Cje");

  const encoded = bs58.decode(
    "4X5tFj4kHG9h2YbLerzcYcyXurnJFRhUP6wiWXsmVh5fa53EYbSieHaF8AXg4rU3QbpN9o5YNdC3XFZAW15huoUu"
  );
  const lotteryCreator = Keypair.fromSecretKey(encoded);
  const ticket_mint = anchor.web3.Keypair.generate();
  const ticket_collection_master_edition =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        ticket_mint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    )[0];
  let [ticket_mint_metadata, ticket_collection_mint_metadata_bump] =
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        ticket_mint.publicKey.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );
  console.log("ticket-collection-mint:\n", ticket_mint.publicKey);
  const creator_ticket_collection_token_account =
    await getAssociatedTokenAddress(
      ticket_mint.publicKey,
      lotteryCreator.publicKey
    );
  const lotteryAccount_A = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("lottery-state"), ticket_mint.publicKey.toBuffer()],
    program.programId
  )[0];
  console.log("lottery account: \n", lotteryAccount_A);
  const lotteryTokenAccount = anchor.web3.Keypair.generate();
  console.log("lottery token account:\n", lotteryTokenAccount.publicKey);
  const endTime = Math.floor(
    new Date("February 18, 2025 03:24:00").getTime() / 1000
  );
  const create_lottery_ix = await program.methods
    .createLottery(
      "New lottery",
      "NL",
      "https://arweave.net/K09asIwU154_KPjRe7Mgr0FFFYRBxqYhiEbePD1nslA",
      ticketPrice,
      maxTickets,
      maxTicketsPerUser,
      new anchor.BN(endTime),
      prizeDistribution
    )
    .accounts({
      lotteryCreator: lotteryCreator.publicKey,
      globalState: globalState,
      mint: mint,
      lotteryCentralAuthority: lotteryCentralAuthority,
      ticketMint: ticket_mint.publicKey,
      lotteryCollectionMint: lottery_collection_mint,
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

  // Get the minimum balance required for rent exemption
  const rentExemptionLamports =
    await provider.connection.getMinimumBalanceForRentExemption(165);

  // Create the account with SystemProgram
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: lotteryCreator.publicKey, // Payer's public key
    newAccountPubkey: lotteryTokenAccount.publicKey, // New token account's public key
    lamports: rentExemptionLamports, // Rent-exempt balance
    space: 165, // Space required for token account
    programId: TOKEN_PROGRAM_ID, // Token Program ID
  });

  const create_lottery_token_account_ix = createInitializeAccountInstruction(
    lotteryTokenAccount.publicKey,
    mint,
    lotteryCentralAuthority
  );

  const mint_lamports = await getMinimumBalanceForRentExemptMint(
    provider.connection
  );

  const create_ticket_mint_ix = SystemProgram.createAccount({
    fromPubkey: lotteryCreator.publicKey,
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

  const tx = new Transaction();
  const tx2 = new Transaction();

  tx.add(createAccountIx, create_lottery_token_account_ix);

  tx2.add(create_ticket_mint_ix, init_ticket_mint_ix, create_lottery_ix);

  const sig = await sendAndConfirmTransaction(provider.connection, tx, [
    lotteryCreator,
    lotteryTokenAccount,
  ]);

  await sendAndConfirmTransaction(provider.connection, tx2, [
    lotteryCreator,
    ticket_mint,
  ]);
}

main().catch(console.error);
