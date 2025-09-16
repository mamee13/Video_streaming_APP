import dotenv from "dotenv";
import { google } from "googleapis";
import readline from "readline";

dotenv.config();

// Check env variables
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.EMAIL_USER) {
  console.error("Please make sure CLIENT_ID, CLIENT_SECRET, and EMAIL_USER are set in .env");
  process.exit(1);
}

// Use localhost redirect URI
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "http://localhost"
);

// Generate auth URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline", // Needed to get refresh token
  scope: ["https://www.googleapis.com/auth/gmail.send"],
});

console.log("\nAuthorize this app by visiting this URL:\n", authUrl);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Prompt user for code
rl.question("\nAfter allowing access, paste the code here: ", async (code) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    console.log("\n✅ Your refresh token is:\n", tokens.refresh_token);
    console.log("\nAdd this to your .env as REFRESH_TOKEN");
  } catch (error) {
    console.error("Error retrieving access token:", error);
  } finally {
    rl.close();
  }
});
