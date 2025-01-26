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
  // test USDC token
  const mint = new PublicKey("5DRQ4WkeM1URSZkxSKTsLSodAYLgX4Q3uRGUcTPA9Cje");

  // mint of the new ticket nft
  const ticketMint1 = anchor.web3.Keypair.generate();
  const encoded = bs58.decode(
    "62GJZHM8EZoDx11EgfzV9KayfbFXgqY5o52HHjjvmdcsoY6FQ3HatMe7D9wMUWBrsyb1spaiY2AQDLSoeLLDv8k9"
  );
  const winner = Keypair.fromSecretKey(encoded);
  const winner_token_account = await getAssociatedTokenAddress(
    mint,
    winner.publicKey
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

  // const lotteryState = LotteryState.deserialize(lotteryStateAcc.data);

  const lotteryAccount_A = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("lottery-state"), ticket_collection_mint.toBuffer()],
    program.programId
  )[0];

  const state_buff = await provider.connection.getAccountInfo(lotteryAccount_A);

  const lottery_state = LotteryState.deserialize(state_buff.data);

  const lotteryTokenAccount = lottery_state.tokenAccount;
  let [globalState, globalStateBump] = await PublicKey.findProgramAddress(
    [Buffer.from("global_state")],
    program.programId
  );

  let [lotteryCentralAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("lottery-central-authority")],
    program.programId
  );

  // set winner ticket ix
  const set_winner_ix = await program.methods
    .setWinner()
    .accounts({
      globalState: globalState,
      lottery: lotteryAccount_A,
      lotteryMaster: provider.wallet.publicKey,
      lotteryCentralAuthority: lotteryCentralAuthority,
      lotteryTokenAccount: lotteryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts([
      {
        pubkey: winner_token_account,
        isWritable: true,
        isSigner: false,
      },
    ])
    .instruction();

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const tx = new Transaction();

  tx.add(set_winner_ix);

  const sig = await provider.sendAndConfirm(tx, []);
}

main().catch(console.error);
