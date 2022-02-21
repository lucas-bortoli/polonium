import * as Discord from 'discord.js'
import { joinVoiceChannel } from '@discordjs/voice'
import Recorder, { Recorders } from './recorder'
import Mixer from './mixer'
import Utils from './util'
import * as fsp from 'fs/promises'

enum CommandResult {
    Success = 0,
    Error = 1,
    AbortedByUser = 2
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
        name: 'start',
        description: 'Começa a gravação em um canal de voz',
        owner_only: false,
        exec: async (client, message, args) => {
            const voiceChannel = message.member.voice.channel

            if (!voiceChannel) {
                await message.reply('Você deve estar em um canal de voz para iniciar a gravação.')
                return CommandResult.Error
            }

            const permissionLevel = Utils.determineMemberPermissionLevel(message.member)

            if (Recorders.has(message.guildId)) {
                const prevRecording = Recorders.get(message.guildId)
                const prevPermissionLevel = Utils.determineMemberPermissionLevel(prevRecording.startedBy)

                if (message.author.id !== prevRecording.startedBy.id
                    && permissionLevel > prevPermissionLevel) {
                        // Ask to stop previous recording
                        await message.reply(`Só é possível gravar um canal de voz ao mesmo tempo, e já há uma gravação acontecendo nesse servidor. Deseja pará-la? Digite \`${process.env.PREFIX}yes\` para confirmar.`)
                        let replies = await message.channel.awaitMessages({
                            filter: (_msg) => 
                                _msg.author.id === message.author.id && _msg.content.toLowerCase() === `${process.env.PREFIX}yes`,
                            time: 60 * 1000,
                            max: 1
                        })

                        // Timeout; abort command
                        if (replies.size < 1) 
                            return CommandResult.AbortedByUser

                        // If we reached here, then the user said "yes"; stop previous recording and continue...
                        await prevRecording.stop()
                        prevRecording.destroy()
                } else {
                    await message.reply('Já há uma gravação acontecendo nesse servidor.')
                    return CommandResult.Error
                }
            }

            await message.reply('Entrando no canal...')

            const voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guildId,
                selfMute: false,
                selfDeaf: false,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator
            })

            const recorder = new Recorder(message.member, message.channel as Discord.GuildTextBasedChannel, voiceChannel, voiceConnection)

            recorder.start()
            
            return CommandResult.Success
        }
    },
    {
        name: 'stop',
        description: 'Para a gravação atual',
        owner_only: false,
        exec: async (client, message, args) => {
            if (!Recorders.has(message.guildId)) {
                await message.reply('Não há nenhuma gravação ocorrendo nesse servidor.')
                return CommandResult.Error
            }

            const recorder = Recorders.get(message.guildId)

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