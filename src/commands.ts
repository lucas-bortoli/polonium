import * as Discord from 'discord.js'
import { joinVoiceChannel } from '@discordjs/voice'
import Recorder, { Recorders } from './recorder'
import Mixer from './mixer'
import Utils from './util'
import * as fsp from 'fs/promises'
import { l } from './lang'

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
                await message.reply(l('cmdStartNeedVoiceChannel'))
                return CommandResult.Error
            }

            const permissionLevel = Utils.determineMemberPermissionLevel(message.member)

            if (Recorders.has(message.guildId)) {
                const prevRecording = Recorders.get(message.guildId)
                const prevPermissionLevel = Utils.determineMemberPermissionLevel(prevRecording.startedBy)

                if (message.author.id !== prevRecording.startedBy.id
                    && permissionLevel > prevPermissionLevel) {
                        // Ask to stop previous recording
                        await message.reply(l('cmdStartAlreadyRecordingAskOverride', { PREFIX: process.env.PREFIX }))
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
                } else {
                    await message.reply(l('cmdStartAlreadyRecording'))
                    return CommandResult.Error
                }
            }

            await message.reply('cmdStartEnteringChannel')

            const voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guildId,
                selfMute: false,
                selfDeaf: false,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator
            })

            const recorder = new Recorder(message.member, voiceChannel, voiceConnection)
            
            await recorder.start()
            
            return CommandResult.Success
        }
    },
    {
        name: 'stop',
        description: 'Para a gravação atual',
        owner_only: false,
        exec: async (client, message, args) => {
            if (!Recorders.has(message.guildId)) {
                await message.reply(l('cmdStopNotRecording'))
                return CommandResult.Error
            }

            const recorder = Recorders.get(message.guildId)

            await recorder.stop()

            const mixer = new Mixer(recorder.recordingsDir)

            const statusMsg = await message.reply(l('cmdStopProcessing'))
            await Utils.delay(1000)

            try {
                await mixer.run()
            } catch (error) {
                console.error('Error:', error)
                await statusMsg.edit(statusMsg.content + '\n' + l('cmdStopProcessingError'))
                return CommandResult.Error
            }

            const outputFileSize = (await fsp.stat(mixer.outputFilePath)).size

            await statusMsg.edit(statusMsg.content + '\n' + l('cmdStopUploading', { SIZE: Utils.humanFileSize(outputFileSize) }))
            await statusMsg.edit(statusMsg.content + '\n' + l('cmdStopDone'))

            return CommandResult.Success
        }
    },
]

export default Commands