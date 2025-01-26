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
  createInitializeMint2Instruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { create_mint } from "../tests/utils";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

async function main() {
  const mint = await create_mint(provider, provider.wallet.publicKey);
  console.log(mint.publicKey);
}

main().catch(console.error);
