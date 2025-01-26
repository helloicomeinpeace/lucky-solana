import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/lucky_sol.json";
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
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { create_mint } from "../tests/utils";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

async function main() {
  const mint_key = new PublicKey(
    "5DRQ4WkeM1URSZkxSKTsLSodAYLgX4Q3uRGUcTPA9Cje"
  );
  const to_user = new PublicKey("8Zraqitba2gFqovkAszBSCkpsCUdPVtJLnRVUXgCQiXs");
  const to_ata = await getAssociatedTokenAddress(mint_key, to_user);

  const create_token_acc_ix = createAssociatedTokenAccountInstruction(
    provider.wallet.publicKey,
    to_ata,
    to_user,
    mint_key
  );

  // give $1000 spl tokens to user
  const mintAmount = 1000 * 10 ** 9;
  const mint_to_ix = createMintToInstruction(
    mint_key,
    to_ata,
    provider.wallet.publicKey,
    mintAmount
  );

  const tx = new Transaction();

  tx.add(create_token_acc_ix, mint_to_ix);

  await provider.sendAndConfirm(tx);
}

main().catch(console.error);
