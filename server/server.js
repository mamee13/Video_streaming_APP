import express from "express";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "http://localhost:3000/oauth2callback" // must match Google Cloud
);

// Step 1: generate auth URL
app.get("/auth", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.send"],
  });
  res.redirect(authUrl);
});

// Step 2: handle Google redirect
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code received");

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    console.log("Refresh Token:", tokens.refresh_token);

    // Optional: send test email immediately
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "Test Email",
      text: "This is a test email from Nodemailer using OAuth2 Web App flow",
    });

    res.send("Success! Refresh token printed in console and test email sent.");
  } catch (err) {
    console.error(err);
    res.send("Error retrieving tokens");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Open http://localhost:3000/auth to authorize Gmail access");
  console.log("Loaded REFRESH_TOKEN:", process.env.REFRESH_TOKEN);
});
