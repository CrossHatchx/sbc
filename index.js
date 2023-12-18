const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const accounts = [{
        guildId: 'YOUR_GUILD_ID', // Replace 'YOUR_GUILD_ID' with your guild ID
        channelId: 'YOUR_CHANNEL_ID', // Replace 'YOUR_CHANNEL_ID' with your channel ID
        title: 'Account 1', // Embed Title for the Account (example: https://i.imgur.com/NyOawPr.png)
        headers: {
            // Activision Stuff
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9,es;q=0.8",
            "sec-ch-ua": '"Not /ABrand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
            "cookie": 'ACT_SSO_COOKIE=YOUR_ACCOUNT_COOKIE', // Replace 'YOUR_ACCOUNT_COOKIE' with your account cookie
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
    },
    // Add details for other accounts similarly
    // {
    //   guildId: 'YOUR_GUILD_ID_2',
    //   channelId: 'YOUR_CHANNEL_ID_2',
    //   headers: { ... },
    // },
    // {
    //   guildId: 'YOUR_GUILD_ID_3',
    //   channelId: 'YOUR_CHANNEL_ID_3',
    //   headers: { ... },
    // },
];

let lastMessages = new Map();

async function sendDiscordMessage(accountIndex, content, embedData) {
    const {
        guildId,
        channelId,
        title
    } = accounts[accountIndex];

    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) throw new Error(`Invalid guild ID (${guildId}) or bot does not have access to the guild.`);

        const channel = guild.channels.cache.get(channelId);
        if (!channel) throw new Error(`Invalid channel ID (${channelId}) or bot does not have access to the channel.`);

        const embed = {
            title: embedData.title ? embedData.title : title,
            description: content,
            timestamp: new Date(),
            color: 0xc196ef,
        };

        if (embedData.gameTitles) {
            embed.fields = [{
                name: embedData.gameTitle,
                value: embedData.gameTitles,
                inline: true,
            }];
        }

        if (embedData.showGIF) {
            embed.image = {
                url: embedData.imageURL || 'https://media.discordapp.net/attachments/694525986695413761/1185989956695506984/nox.jpg',
            };
        }

        const lastMessage = lastMessages.get(accountIndex);
        if (lastMessage) {
            const message = await channel.messages.fetch(lastMessage);
            await message.edit({
                embeds: [embed],
            });
            console.log(`Account ${accountIndex + 1} - Embed edited successfully!`);
        } else {
            const message = await channel.send({
                embeds: [embed],
            });
            lastMessages.set(accountIndex, message.id);
            console.log(`Account ${accountIndex + 1} - Embed sent successfully!`);
        }
    } catch (error) {
        console.error(`Account ${accountIndex + 1} - Error sending message:`, error.message);
    }
}

function sendwebhookNoBan(accountIndex) {
    sendDiscordMessage(accountIndex, 'No Shadow Ban Detected', {
      showGIF: true,
      imageURL: 'https://media.discordapp.net/attachments/694525986695413761/1185989956695506984/nox.jpg',
    });
  }

function sendwebhookPermanentBan(accountIndex, gameTitles) {
    sendDiscordMessage(accountIndex, 'Permanent Ban Detected', {
        gameTitle: 'Permanently Banned Games:',
        showGIF: true,
        imageURL: 'https://media.discordapp.net/attachments/694525986695413761/1185989956695506984/nox.jpg',
        gameTitles: gameTitles.join('\n'),
    });
}

function sendwebhookShadowBan(accountIndex, gameTitle) {
    sendDiscordMessage(accountIndex, 'Shadow Banned', {
      description: 'Game Detected with Shadow Ban',
      gameTitles: gameTitle,
      showGIF: true,
      imageURL: 'https://media.discordapp.net/attachments/694525986695413761/1185989956695506984/nox.jpg',
      gameTitle: 'Game Title',
    });
  }
  

function checkAccounts() {
    accounts.forEach((account, index) => {
        const {
            headers
        } = account;

        axios
            .get("https://support.activision.com/api/bans/appeal?locale=en", {
                headers: headers,
                withCredentials: true,
            })
            .then(response => {
                const data = response.data;
                console.log(`Account ${index + 1} -`, data);
                if (data.bans && data.bans.length > 0) {
                    const permanentBans = data.bans.filter(
                        ban => ban.enforcement === "PERMANENT"
                    );
                    if (permanentBans.length > 0) {
                        const permanentGameTitles = permanentBans.map(ban => ban.title); // Collect all permanently banned game titles
                        console.log(
                            `Account ${index + 1} - Permanent Bans in: ${permanentGameTitles.join(', ')}`
                        );
                        sendwebhookPermanentBan(index, permanentGameTitles);
                    } else {
                        console.log(
                            `Account ${index + 1} - No permanent bans found, checking for other bans...`
                        );
                        const underReviewBans = data.bans.filter(
                            ban => ban.enforcement === "UNDER_REVIEW" && !ban.canAppeal
                        );
                        if (underReviewBans.length > 0) {
                            const firstBan = underReviewBans[0];
                            console.log(
                                `Account ${index + 1} - Shadow Banned in: ${firstBan.title}`
                            );
                            sendwebhookShadowBan(index, firstBan.title);
                        } else {
                            console.log(
                                `Account ${index + 1} - No bans found or bans found, but not under review without appeal disabled.`
                            );
                            sendwebhookNoBan(index);
                        }
                    }
                } else {
                    console.log(`Account ${index + 1} - No bans found.`);
                    sendwebhookNoBan(index);
                }
            })
            .catch(error => {
                console.error(`Account ${index + 1} -`, error);
            });
    });

    // Recheck after 120 seconds
    setTimeout(checkAccounts, 120000);
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Checking Accounts...`);
    // Start the initial check for all accounts
    checkAccounts();
});

client.login('YOUR_BOT_TOKEN'); // Replace 'YOUR_BOT_TOKEN' with your bot token