import * as Discord from 'discord.js'
import Commands from './commands'
import { Recorders } from './recorder'

const client = new Discord.Client({
    intents: [ 'GUILD_VOICE_STATES', 'GUILDS', 'GUILD_MESSAGES' ]
})

client.on('ready', async () => {
    console.log('✅ Client ready')
})

client.on('messageCreate', async message => {
    if (!message.guildId || message.author.bot || !message.content.startsWith(process.env.PREFIX)) return

    const args = message.content.split(' ')
    const cmd = args.shift().replace(process.env.PREFIX, '')

    const command = Commands.find(search => search.name === cmd)

    if (!command)
        return

    // Owner-only command
    if (command.owner_only && client.application.owner.id !== message.author.id)
        return

    try {
        await command.exec(client, message, args)
    } catch (error) {
        console.error(error)
    }
})

/**
 * Emitted when a user enters or leaves a voice channel.
 */
client.on('voiceStateUpdate', async (_, newState) => {
    const guildId = newState.guild.id
    const channelId = newState.channelId

    // Check if there's a recording for this guild
    if (Recorders.has(guildId)) {
        const recorder = Recorders.get(guildId)

        
    }
})

client.login(process.env.TOKEN)