import * as Discord from 'discord.js'
import { joinVoiceChannel } from '@discordjs/voice'
import Recorder, { Recorders } from './recorder'

enum CommandResult {
    Success = 0,
    Error = 1
}

type Command = {
    name: string,
    description: string,
    owner_only: boolean,
    exec: (client: Discord.Client, message: Discord.Message, args: string[]) => Promise<CommandResult>
}

const Commands: Command[] = [
    {
        name: 'ping',
        description: 'Checa se o bot está online',
        owner_only: false,
        exec: async (client, message, args) => {
            await message.reply('\\🏓')
            return CommandResult.Success
        }
    },
    {
        name: 'record',
        description: 'Começa a gravação em um canal de voz',
        owner_only: false,
        exec: async (client, message, args) => {
            const voiceChannel = message.member.voice.channel

            if (!voiceChannel) {
                await message.reply('Você deve estar em um canal de voz para iniciar a gravação.')
                return CommandResult.Error
            }

            await message.reply('Entrando no canal...')

            const voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guildId,
                selfMute: false,
                selfDeaf: false,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator
            })

            const recorder = new Recorder(message.channel as Discord.GuildTextBasedChannel, voiceChannel, voiceConnection)

            recorder.start()
            
            return CommandResult.Success
        }
    },
    {
        name: 'stop',
        description: 'Para a gravação atual',
        owner_only: false,
        exec: async (client, message, args) => {
            const recorder = Recorders.get(message.guildId)

            if (!recorder) {
                await message.reply('Não há nenhuma gravação ocorrendo nesse servidor.')
                return CommandResult.Error
            }

            recorder.stop()
            recorder.destroy()
            
            return CommandResult.Success
        }
    },
]

export default Commands