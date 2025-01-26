import { ConfirmedSignatureInfo, Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import {
  Metadata,
  PROGRAM_ADDRESS as metaplexProgramId,
} from "@metaplex-foundation/mpl-token-metadata";
import { AnchorProvider } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/lucky_sol.json";
import { LotteryState } from "../tests/schemas";

async function main() {
  // Get command line arguments
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  // Define filters
  const filters = [
    {
      // Data size filter: Only return accounts with 128 bytes of data
      dataSize: 138,
    },
  ];

  const program = new anchor.Program(idl as anchor.Idl, provider);

  // Fetch accounts with filters
  const accounts = await connection.getProgramAccounts(program.programId, {
    filters: filters,
  });

  accounts.forEach(({ pubkey, account }) => {
    let state: LotteryState = LotteryState.deserialize(account.data);
    console.log(`Account: ${pubkey.toBase58()}, Data: ${state.maxTickets}`);
    console.log(`Account: ${pubkey.toBase58()}, Data: ${state.ticketPrice}`);
  });
}

main().then(() => console.log("Success"));
