import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/lucky_sol.json";
import bs58 from "bs58";
import {
  ComputeBudgetProgram,
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
import { create_mint, getAssociatedTokenAccount } from "../tests/utils";
import { LotteryState } from "../tests/schemas";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = new anchor.Program(idl as anchor.Idl, provider);
const metaplex = Metaplex.make(provider.connection);

async function main() {
  // mint of the new ticket nft
  const ticketMint1 = anchor.web3.Keypair.generate();
  const encoded = bs58.decode(
    "62GJZHM8EZoDx11EgfzV9KayfbFXgqY5o52HHjjvmdcsoY6FQ3HatMe7D9wMUWBrsyb1spaiY2AQDLSoeLLDv8k9"
  );
  const ticket_buyer = Keypair.fromSecretKey(encoded);

  const ticketMint1Ata = await getAssociatedTokenAccount(
    provider,
    ticketMint1.publicKey,
    ticket_buyer.publicKey
  );

  // CREATE METADATA FOR THE COLLECTIBLE TICKET NFTS
  let [ticket1metadata, ticket1metadata_bump] =
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        ticketMint1.publicKey.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

  const ticket_collection_mint = new PublicKey(
    "BWPm4vB3JirKv8fz8HsS6YqD8oTRXeqW932BdEZeFdaL"
  );

  const ticketMint1Master = metaplex
    .nfts()
    .pdas()
    .masterEdition({ mint: ticketMint1.publicKey });

  const ticket_collection_master_edition = metaplex
    .nfts()
    .pdas()
    .masterEdition({ mint: ticket_collection_mint });

  let [ticket_collection_mint_metadata, collection_mint_metadata_bump] =
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        ticket_collection_mint.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

  const mint = new PublicKey("5DRQ4WkeM1URSZkxSKTsLSodAYLgX4Q3uRGUcTPA9Cje");

  const toAta = await getAssociatedTokenAddress(mint, ticket_buyer.publicKey);

  // const lotteryState = LotteryState.deserialize(lotteryStateAcc.data);

  const tx0 = createAssociatedTokenAccountInstruction(
    ticket_buyer.publicKey,
    toAta,
    ticket_buyer.publicKey,
    mint
  );

  const lotteryAccount_A = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("lottery-state"), ticket_collection_mint.toBuffer()],
    program.programId
  )[0];

  console.log(lotteryAccount_A);

  const state_buff = await provider.connection.getAccountInfo(lotteryAccount_A);

  const lottery_state = LotteryState.deserialize(state_buff.data);
  console.log(lottery_state);

  const lotteryTokenAccount = lottery_state.tokenAccount;
  // purchase ticket ix
  let purchase_lottery_ix = await program.methods
    .purchaseLotteryTicket()
    .accounts({
      lottery: lotteryAccount_A,
      lotteryTokenAccount: lotteryTokenAccount,
      buyer: ticket_buyer.publicKey,
      ticketCollectionMint: ticket_collection_mint,
      ticketCollectionMetadata: ticket_collection_mint_metadata,
      ticketCollectionMaster: ticket_collection_master_edition,
      buyerTokenAccount: toAta,
      ticketMintMaster: ticketMint1Master,
      ticketMint: ticketMint1.publicKey,
      ticketMintMetadata: ticket1metadata,
      buyerTicketAccount: ticketMint1Ata,
    })
    .instruction();

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const tx = new Transaction();

  tx.add(computeBudgetIx, purchase_lottery_ix);

  const sig = await sendAndConfirmTransaction(provider.connection, tx, [
    ticket_buyer,
    ticketMint1,
  ]);
}

main().catch(console.error);
