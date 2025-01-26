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

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = new anchor.Program(idl as anchor.Idl, provider);

const metaplex = Metaplex.make(provider.connection);

async function main() {
  const mint_lamports = await getMinimumBalanceForRentExemptMint(
    provider.connection
  );
  let lottery_collection_mint = anchor.web3.Keypair.generate();
  let [lottery_collection_mint_metadata, collection_mint_metadata_bump] =
    await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        lottery_collection_mint.publicKey.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );
  let [lotteryCentralAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("lottery-central-authority")],
    program.programId
  );
  let [globalState, globalStateBump] = await PublicKey.findProgramAddress(
    [Buffer.from("global_state")],
    program.programId
  );
  const initializer_collection_token_account = await getAssociatedTokenAddress(
    lottery_collection_mint.publicKey,
    provider.wallet.publicKey
  );

  let lottery_collection_master_edition = metaplex
    .nfts()
    .pdas()
    .masterEdition({ mint: lottery_collection_mint.publicKey });

  const create_lottery_mint_ix = SystemProgram.createAccount({
    fromPubkey: provider.wallet.publicKey,
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

  const init_contract_ix = await program.methods
    .initialize(
      "LOTTERY MACHINE",
      "",
      "https://arweave.net/2vbkXh7eF9L75ezAiDpiv_sLVYyeNE-jPXZZpoY-PeA"
    )
    .accounts({
      globalState: globalState,
      masterEditionAccount: lottery_collection_master_edition,
      initializer: provider.wallet.publicKey,
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

  // now sign with the tokenAccount

  await provider.sendAndConfirm(init_transac, [lottery_collection_mint]);

  // console.log(lottery_collection_mint.publicKey);

  //   const [programAccount, _] = await anchor.web3.PublicKey.findProgramAddress(
  //     [Buffer.from("example")],
  //     program.programId
  //   );

  //   const tx = await program.rpc.initialize({
  //     accounts: {
  //       authority: provider.wallet.publicKey,
  //       programAccount,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     },
  //   });

  //   console.log("Transaction signature:", tx);

  console.log("ggoogooo");
}

main().catch(console.error);
