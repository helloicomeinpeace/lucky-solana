import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import fs from "fs";
import os from "os";
import path from "path";
import { web3 } from "@coral-xyz/anchor";

// Define constants
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Load the default Solana wallet from the environment
function loadDefaultWallet() {
  const keypairPath = path.join(os.homedir(), ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

// Initialize Solana connection
const connection = new Connection("https://api.devnet.solana.com");

// Initialize Metaplex
const metaplex = Metaplex.make(connection);

// Function to add metadata
async function addMetadata(mintAddress, metadata) {
  try {
    const payer = loadDefaultWallet();
    const mintPublicKey = new PublicKey(mintAddress);

    // Derive Metadata PDA (Program Derived Address)
    const [metadataPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintPublicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Create the transaction to add metadata
    const transaction = new web3.Transaction().add(
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataPDA,
          mint: mintPublicKey,
          mintAuthority: payer.publicKey,
          payer: payer.publicKey,
          updateAuthority: payer.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name: metadata.name,
              symbol: metadata.symbol,
              uri: metadata.uri,
              sellerFeeBasisPoints: metadata.sellerFeeBasisPoints, // e.g., 500 for 5% royalties
              creators: null, // Optional: list of creators with share percentages
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: undefined,
          },
        }
      )
    );

    // Send and confirm the transaction
    const signature = await connection.sendTransaction(transaction, [payer]);
    await connection.confirmTransaction(signature, "confirmed");

    console.log("Metadata added successfully:", signature);
    return signature;
  } catch (error) {
    console.error("Error adding metadata:", error);
    throw error;
  }
}

// Example usage
const mintAddress = "5DRQ4WkeM1URSZkxSKTsLSodAYLgX4Q3uRGUcTPA9Cje"; // Replace with your token's mint address
const metadata = {
  name: "USDC",
  symbol: "USDC",
  uri: "https://example.com/metadata.json", // Link to your token metadata JSON
  sellerFeeBasisPoints: 0, // 5% royalty
  creators: [],
};

addMetadata(mintAddress, metadata).then((signature) => {
  console.log("Transaction signature:", signature);
});
