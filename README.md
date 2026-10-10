# BloodLineRZ Management Discord Bot

Automated Discord.js v14 bot for BloodLineRZ FiveM Gang RP. It creates a channel/role layout, posts a verification panel that assigns the exact role **BloodLine**, provides gang/business/VIP/creator/whitelist application forms, private application channels, staff approve/reject controls, close-and-transcript logging, and an optional FiveM status command.

## Requirements
- Node.js 20+
- A Discord server where you can manage roles and channels
- Bot application from https://discord.com/developers/applications

## Install
1. Extract the ZIP.
2. Install Node.js 20 or newer from https://nodejs.org/.
3. Open a terminal in this folder and run `npm install`.
4. Copy `.env.example` to `.env`.
5. Set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` in `.env`. `GUILD_ID` is recommended for faster command registration.
6. Optional: set `CFX_SERVER_CODE` to the short code from your `https://cfx.re/join/XXXXX` link to enable `/server-status`.
7. In the Discord Developer Portal, enable the Server Members Intent if shown as required, add `bot` and `applications.commands` scopes, and invite the bot.
8. Give the bot Manage Roles, Manage Channels, View Channels, Send Messages, Embed Links, Read Message History, and Manage Messages. Move the bot's highest role above **BloodLine**, **👤 Unverified**, and any roles it should assign. Never share your token.
9. Run `npm start` and then run `/setup` in your server as an administrator.

## Features
- `/setup`: creates/reuses roles, categories, channels, starter rules and welcome posts, and panels.
- `/post-panels`: posts the verification and application panels again.
- `/server-status`: shows online/offline and player count when `CFX_SERVER_CODE` is configured.
- `/bloodline-help`: shows bot command help.
- Verification button in `#verify-here` adds **BloodLine** and removes **👤 Unverified** if the member has it.
- Application forms for gangs, businesses, VIP/donation inquiries, creators/streamers, and whitelist.
- Each application is placed in a private channel visible to the applicant and authorized staff.
- Staff can approve/reject applications. Gang, streamer, VIP and whitelist approvals assign the matching role where configured. Business approval is recorded without automatically granting an owner role.
- Closing an application posts a transcript excerpt (up to 100 messages / embed text excerpt) in `#staff-logs`, then deletes the application channel.

## Role notes
- **BloodLine** is the verified member role exactly as requested.
- The bot does not automatically give Founder to anyone; assign elevated staff roles manually.
- Discord only lets a bot manage roles below its highest role.
- Check permissions after setup. Setup is designed to reuse matching channel/role names and does not delete existing channels.

## Safety and limitations
- VIP/donation is inquiry-only; this bot does not take payments. Never collect card numbers, passwords, or payment credentials in Discord.
- `/server-status` depends on the CFX join code being valid and the public FiveM listing being reachable. If the server is not publicly listed, status may show unreachable.
- Transcripts are sent as a text excerpt in an embed, not a downloadable HTML file. Long conversations may be truncated.
- This bot is not a full FiveM whitelist integration: it collects an application and gives the **BloodLine** Discord role if staff approve the whitelist application. It does not automatically whitelist a player in your FiveM framework/database.
- Keep the bot running on a PC/VPS/Node host for commands and buttons to work.

## Troubleshooting
- Slash commands missing: check token, application ID, guild ID, installation scopes, then restart.
- Role assignment fails: make sure the bot has Manage Roles and its top role is above BloodLine and Unverified.
- Channel creation fails: ensure Manage Channels and the bot's role permissions are correct.
- Application panel repeats: `/post-panels` intentionally posts a fresh set of buttons; avoid running repeatedly unless needed.
