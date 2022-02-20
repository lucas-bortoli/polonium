import * as Discord from 'discord.js'
import { joinVoiceChannel } from '@discordjs/voice'
import Recorder, { Recorders } from './recorder'
import Mixer from './mixer'
import Utils from './util'
import * as fsp from 'fs/promises'

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

            const mixer = new Mixer(recorder.recordingsDir, 'output.ogg')

            const statusMsg = await message.reply('Aguarde! Processando a gravação - pode demorar um pouco')
            await Utils.delay(1000)

            try {
                await mixer.run()
            } catch (error) {
                console.error(`Erro na mixagem:`, error)
                await statusMsg.edit(statusMsg.content + `\nErro na mixagem.`)
                return CommandResult.Error
            }

            const outputFileSize = (await fsp.stat(mixer.outputFile)).size

            await statusMsg.edit(statusMsg.content + `\nFazendo upload... Enviarei também o link no seu DM quando terminar. (são ${Utils.humanFileSize(outputFileSize)})`)
            
            await statusMsg.edit(statusMsg.content + '\n✅ Processamento concluído')
            
            return CommandResult.Success
        }
    },
]

export default Commands