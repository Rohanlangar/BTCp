import { betterAuth } from "better-auth";
import { Database } from "better-sqlite3";
import SQLite from "better-sqlite3";

const db = new SQLite("./sqlite.db");

export const auth = betterAuth({
  database: db,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    },
  },
  user: {
    additionalFields: {
      walletAddress: {
        type: "string",
        required: false,
      },
      walletVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
    cookieCache: {
      enabled: true,
    },
  },
  advanced: {
    cookiePrefix: "bounty-platform",
  },
});
