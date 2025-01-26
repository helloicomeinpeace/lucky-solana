import * as borsh from "@coral-xyz/borsh";
import { PublicKey } from "@solana/web3.js";

export class LotteryState {
  ticketPrice: bigint;
  maxTickets: bigint;
  maxTicketsPerUser: number;
  prizeDistribution: Uint8Array;
  ticketCollectionMint: PublicKey;
  tokenMint: PublicKey;
  tokenAccount: PublicKey;
  endTime: bigint;
  isActive: boolean;

  constructor(
    ticketPrice: bigint,
    maxTickets: bigint,
    maxTicketsPerUser: number,
    prizeDistribution: Uint8Array,
    ticketMint: PublicKey,
    tokenMint: PublicKey,
    tokenAccount: PublicKey,
    endTime: bigint,
    isActive: boolean
  ) {
    this.ticketPrice = ticketPrice;
    this.maxTickets = maxTickets;
    this.maxTicketsPerUser = maxTicketsPerUser;
    this.prizeDistribution = prizeDistribution;
    this.ticketCollectionMint = ticketMint;
    this.tokenMint = tokenMint;
    this.tokenAccount = tokenAccount;
    this.endTime = endTime;
    this.isActive = isActive;
  }

  static borshAccountSchema = borsh.struct([
    borsh.u64("ticket_price"),
    borsh.u16("max_tickets"),
    borsh.u8("max_tickets_per_user"),
    borsh.vecU8("prize_distribution"),
    borsh.publicKey("ticket_mint"),
    borsh.publicKey("token_mint"),
    borsh.publicKey("token_account"),
    borsh.i64("end_time"),
    borsh.bool("is_active"),
  ]);

  static deserialize(buffer?: Buffer): LotteryState | null {
    if (!buffer) {
      return null;
    }

    // make sure to slice off the account discriminator
    try {
      const {
        ticket_price,
        max_tickets,
        max_tickets_per_user,
        prize_distribution,
        ticket_mint,
        token_mint,
        token_account,
        end_time,
        is_active,
      } = this.borshAccountSchema.decode(buffer.subarray(8, buffer.length));

      return new LotteryState(
        ticket_price,
        max_tickets,
        max_tickets_per_user,
        prize_distribution,
        new PublicKey(ticket_mint),
        new PublicKey(token_mint),
        new PublicKey(token_account),
        end_time,
        is_active
      );
    } catch (error) {
      console.error("Deserialization error:", error);
      console.error("Buffer length:", buffer.length);
      console.error("Buffer data:", buffer.toString("hex"));
      return null;
    }
  }
}
