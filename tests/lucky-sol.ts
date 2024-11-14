import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Metaplex } from "@metaplex-foundation/js";
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
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { NodeOracle } from "@switchboard-xyz/oracle";
import { LuckySol } from "../target/types/lucky_sol";
import { create_mint, getAssociatedTokenAccount } from "./utils";

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

  let globalState: PublicKey;
  let initializer: anchor.web3.Keypair;
  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;
  let mint: anchor.web3.Keypair;
  let lotteryTokenAccount: anchor.web3.Keypair;
  let collection_mint: anchor.web3.Keypair;
  let collection_mint_metadata: PublicKey;
  // let lotteryCollection: anchor.web3.Keypair;
  let lotteryAccountAuthority: PublicKey;
  // Generate a keypair for the lottery account
  let lotteryAccount = anchor.web3.Keypair.generate();
  user1 = anchor.web3.Keypair.generate();
  user2 = anchor.web3.Keypair.generate();
  // lotteryCollection = anchor.web3.Keypair.generate();
  initializer = anchor.web3.Keypair.generate();

  before(async () => {
    // Airdrop SOL to the initializer
    const signature = await provider.connection.requestAirdrop(
      initializer.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      initializer.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(user1.publicKey, LAMPORTS_PER_SOL);

    await provider.connection.confirmTransaction(signature);

    // Derive the address for the GlobalState account
    const [globalStateAddress, _] = await PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      program.programId
    );
    globalState = globalStateAddress;

    // Initialize the program
    await program.rpc.initialize({
      accounts: {
        globalState: globalState,
        initializer: initializer.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [initializer],
    });

    // Additional setup can be added here
    let bump;
    [lotteryAccountAuthority, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lottery-authority"), lotteryAccount.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Should initialize the global state correctly", async () => {
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
  });

  it("Should create a lottery correctly", async () => {
    // Parameters for create_lottery function
    const ticketPrice = new anchor.BN(10); // Example ticket price
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
    collection_mint = anchor.web3.Keypair.generate();

    lotteryTokenAccount = anchor.web3.Keypair.generate();

    let collection_mint_metadata_bump;

    // CREATE METADATA FOR THE COLLECTION NFT
    [collection_mint_metadata, collection_mint_metadata_bump] =
      PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey(
            "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
          ).toBuffer(),
          collection_mint.publicKey.toBuffer(),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );

    await createAccount(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      lotteryAccountAuthority, // authority for the lottery token account
      lotteryTokenAccount
    );

    // Fund the initializer account to make it rent-exempt
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        initializer.publicKey,
        LAMPORTS_PER_SOL
      )
    );

    // Create the lottery
    await program.rpc
      .createLottery(
        "NAME",
        "SYM",
        "URI",
        ticketPrice,
        maxTickets,
        maxTicketsPerUser,
        maxWinners,
        prizeDistribution,
        {
          accounts: {
            lotteryCreator: initializer.publicKey,
            globalState: globalState,
            mint: mint.publicKey,
            lotteryTokenAuthority: lotteryAccountAuthority,
            lotteryCollectionMint: collection_mint.publicKey,
            collectionMetadata: collection_mint_metadata,
            lottery: lotteryAccount.publicKey,
            lotteryTokenAccount: lotteryTokenAccount.publicKey,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenMetadataProgram: new PublicKey(
              "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
            ),
          },
          signers: [initializer, lotteryAccount, collection_mint],
        }
      )
      .catch((e) => console.error(e));

    // Fetch the LotteryState account data
    const lotteryState = await program.account.lotteryState.fetch(
      lotteryAccount.publicKey
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
    assert.equal(
      lotteryState.maxWinners,
      maxWinners,
      "Max winners should match"
    );
    assert.deepEqual(
      lotteryState.prizeDistribution,
      prizeDistribution,
      "Prize distribution should match"
    );
    assert.ok(
      lotteryState.creator.equals(initializer.publicKey),
      "Creator should match the lottery creator's public key"
    );

    assert.ok(
      lotteryState.tokenMint.equals(mint.publicKey),
      "lottery token mint should match the correct mint key"
    );

    assert.ok(
      lotteryState.tokenAccount.equals(lotteryTokenAccount.publicKey),
      "Creator should match the lottery creator's public key"
    );

    const token = await metaplex
      .nfts()
      .findByMint({ mintAddress: collection_mint.publicKey });
    console.log(token);
  });

  it("should let user1 purchase tickets successfully", async () => {
    const toAta = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      user1.publicKey
    );

    // give spl tokens to user
    const mintAmount = 1000 * 10 ** 9;
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      toAta,
      initializer,
      mintAmount
    );

    const numberOfTickets = 2;

    // mint of the new ticket nft
    const ticketMint1 = anchor.web3.Keypair.generate();
    // another mint of the new ticket nft
    const ticketMint2 = anchor.web3.Keypair.generate();

    const lamports = await getMinimumBalanceForRentExemptMint(
      provider.connection
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: user1.publicKey,
        newAccountPubkey: ticketMint1.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        ticketMint1.publicKey,
        0,
        lotteryAccountAuthority,
        TOKEN_PROGRAM_ID
      ),
      SystemProgram.createAccount({
        fromPubkey: user1.publicKey,
        newAccountPubkey: ticketMint2.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        ticketMint2.publicKey,
        0,
        lotteryAccountAuthority,
        TOKEN_PROGRAM_ID
      )
    );

    // purchase ticket ix
    let purchase_lottery_ix = await program.methods
      .purchaseLotteryTicket(new anchor.BN(numberOfTickets))
      .accounts({
        lottery: lotteryAccount.publicKey,
        lotteryTokenAccount: lotteryTokenAccount.publicKey,
        buyer: user1.publicKey,
        lotteryCollectionMint: collection_mint.publicKey,
        lotteryCollectionMetadata: collection_mint_metadata,
        buyerTokenAccount: toAta,
      })
      .remainingAccounts([
        { pubkey: ticketMint1.publicKey, isWritable: true, isSigner: false },
        { pubkey: ticketMint2.publicKey, isWritable: true, isSigner: false },
      ])
      .instruction();

    transaction.add(purchase_lottery_ix);

    const signers = [user1, ticketMint1, ticketMint2]; // Add all signers to this array

    // 4. Send the transaction with the additional signers
    await provider
      .sendAndConfirm(transaction, signers)
      .catch((e) => console.log(e));

    // Fetch the updated LotteryState account data
    const updatedLotteryState = await program.account.lotteryState.fetch(
      lotteryAccount.publicKey
    );

    // Check that ticket IDs have been purchased
    assert.equal(
      updatedLotteryState.totalTicketsIssued.toNumber(),
      numberOfTickets,
      "Total tickets issued should match the number of purchased tickets"
    );
  });

  // it("should let user2 purchase tickets successfully", async () => {
  //   const toAta = await createAssociatedTokenAccount(
  //     provider.connection,
  //     provider.wallet.payer,
  //     mint.publicKey,
  //     user2.publicKey
  //   );

  //   // give spl tokens to user
  //   const mintAmount = 1000 * 10 ** 9;
  //   await mintTo(
  //     provider.connection,
  //     provider.wallet.payer,
  //     mint.publicKey,
  //     toAta,
  //     initializer,
  //     mintAmount
  //   );

  //   const numberOfTickets = 5;

  //   // purchase ticket
  //   await program.rpc.purchaseLotteryTicket(new anchor.BN(numberOfTickets), {
  //     accounts: {
  //       lottery: lotteryAccount.publicKey,
  //       lotteryTokenAccount: lotteryTokenAccount.publicKey,
  //       buyer: user2.publicKey,
  //       buyerTokenAccount: toAta,
  //       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //     },
  //     signers: [user2],
  //   });

  //   // Fetch the updated LotteryState account data
  //   const updatedLotteryState = await program.account.lotteryState.fetch(
  //     lotteryAccount.publicKey
  //   );

  //   // Check that ticket IDs have been purchased
  //   assert.equal(
  //     updatedLotteryState.totalTicketsIssued.toNumber(),
  //     numberOfTickets + 2,
  //     "Total tickets issued should match the number of purchased tickets"
  //   );

  //   // Check that the last `numberOfTickets` entries in `lottery_tickets` match the buyer's public key
  //   const purchasedTicketOwners = updatedLotteryState.lotteryTickets.slice(-2);
  //   assert.ok(
  //     purchasedTicketOwners.every((ticketOwner) =>
  //       ticketOwner.equals(user2.publicKey)
  //     ),
  //     "The last entries in the lottery_tickets array should match the buyer's public key"
  //   );
  // });
});
