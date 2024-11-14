import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";

export async function create_mint(
  provider,
  authority,
  freezeAuthority = null,
  decimals = 9
) {
  const mint = anchor.web3.Keypair.generate();
  const mintAccount = await createMint(
    provider.connection,
    provider.wallet.payer,
    authority,
    freezeAuthority,
    decimals,
    mint,
    undefined,
    TOKEN_PROGRAM_ID
  );

  return mint;
}

export async function getAssociatedTokenAccount(provider, mint, owner) {
  // get ATA
  const ata = getAssociatedTokenAddressSync(mint, owner);

  return ata;
}

module.exports = {
  create_mint,
  getAssociatedTokenAccount,
};
