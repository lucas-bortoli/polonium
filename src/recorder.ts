import { VoiceConnection, VoiceConnectionState, entersState, VoiceConnectionStatus, VoiceReceiver, AudioReceiveStream, EndBehaviorType } from '@discordjs/voice'
import { Client, Guild, GuildTextBasedChannel, Snowflake, VoiceBasedChannel } from 'discord.js'
import fsp from 'fs/promises'
import fs from 'fs'
import { pipeline } from 'node:stream'
import * as prism from 'prism-media'
import * as child_process from 'child_process'

type GuildID = Snowflake
type UserID = Snowflake

const Recorders = new Map<GuildID, Recorder>()

class Recorder {
    public client: Client
    public guild: Guild
    public textChannel: GuildTextBasedChannel
    public voiceChannel: VoiceBasedChannel
    public voiceConnection: VoiceConnection
    public voiceReceiver: VoiceReceiver

    public destroyed: boolean = false

    constructor(textChannel: GuildTextBasedChannel, voiceChannel: VoiceBasedChannel, voiceConnection: VoiceConnection) {
        this.textChannel = textChannel
        this.voiceConnection = voiceConnection
        this.voiceChannel = voiceChannel
        this.voiceReceiver = voiceConnection.receiver
        this.guild = textChannel.guild
        this.client = textChannel.client
        
        Recorders.set(textChannel.guildId, this)
        
        this.voiceConnection.on(VoiceConnectionStatus.Disconnected, (oldState, newState) => this.onVoiceDisconnect(oldState, newState))
    }

    public async start() {
        const selfMember = await this.guild.members.fetch(this.client.user.id)

        selfMember.setNickname(`🔴 Recording`)

        this.voiceReceiver.speaking.addListener('start', user => this.onUserSpeakingStart(user))
        this.voiceReceiver.speaking.addListener('end', user => this.onUserSpeakingStop(user))
    }

    public async stop() {
        const selfMember = await this.guild.members.fetch(this.client.user.id)

        // Remove listeners
        this.voiceReceiver.speaking.removeAllListeners('start')
        this.voiceReceiver.speaking.removeAllListeners('end')

        selfMember.setNickname(``)
    }

    public destroy() {
        if (this.voiceConnection)
            this.voiceConnection.destroy()

        this.voiceConnection = null
        this.destroyed = true
        Recorders.delete(this.guild.id)
    }

    /**
     * Called when a user starts speaking.
     * @param userId User who is speaking
     */
    private async onUserSpeakingStart(userId: string) {
        if (this.voiceReceiver.subscriptions.has(userId))
            return

        const user = await this.client.users.fetch(userId)
        
        // Don't record bots (music bots etc.)
        if (user.bot)
            return

        console.log(`${new Date().toLocaleTimeString()} User ${user.tag} falando`)

        const filePath = `recordings/${this.guild.id}/${this.voiceChannel.id}/`
        const fileName = `${Date.now()}-${userId}.pcm`
    
        await fsp.mkdir(filePath, { recursive: true })
        const fileStream = fs.createWriteStream(`${filePath}${fileName}`)
    
        const rawStream = this.voiceReceiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 100 }})

        const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 })

        pipeline(rawStream, decoder, fileStream, (err) => {
            if (err) {
                console.warn(`❌ Erro ao escrever arquivo ${fileName} - ${err.message}`);
            } else {
                console.log(`⌛ Transcodando arquivo ${fileName}...`)

                child_process.spawn(`ffmpeg -f s16le -ar 48000 -ac 2 -i ${filePath}${fileName} ${filePath}${fileName.replace('.pcm', '.ogg')}`, { shell: true })
                    .once('exit', () => fs.unlink(`${filePath}${fileName}`, () => {})) // delete original file
            }
        })
    }

    private async onUserSpeakingStop(userId: string) {
        
    }

    /**
     * Called when the voice state changes (e.g. the bot is moved between channels, or kicked, or disconnected)
     * @param oldState 
     * @param newState 
     */
    private async onVoiceDisconnect(oldState: VoiceConnectionState, newState: VoiceConnectionState) {
    	try {
            await Promise.race([
                entersState(this.voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000),
            ])
        
            // Seems to be reconnecting to a new channel - ignore disconnect
        } catch (error) {
            // Seems to be a real disconnect which SHOULDN'T be recovered from
            this.voiceConnection.destroy()
        }
    }
}

export default Recorder
export { Recorders }