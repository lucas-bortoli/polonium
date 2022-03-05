import { VoiceConnection, VoiceConnectionState, entersState, VoiceConnectionStatus, VoiceReceiver, AudioReceiveStream, EndBehaviorType } from '@discordjs/voice'
import { Client, Guild, GuildMember, GuildTextBasedChannel, Snowflake, VoiceBasedChannel, VoiceState } from 'discord.js'
import fsp from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'node:stream'
import * as prism from 'prism-media'
import * as child_process from 'child_process'
import { RecordingLogItemType } from './types'
import DeferredEvent from './deferred'

type GuildID = Snowflake
type UserID = Snowflake
type Timestamp = number

const Recorders = new Map<GuildID, Recorder>()

class Recorder {
    private client: Client
    private guild: Guild
    private voiceChannel: VoiceBasedChannel
    private voiceConnection: VoiceConnection
    private voiceReceiver: VoiceReceiver
    private eventLogFile: fs.WriteStream
    public onStopEvent: DeferredEvent<void>
    public stopped: boolean = false
    public recordingStartTimestamp: number = -1
    public startedBy: GuildMember

    // Store reference to the listener
    private _bind_voiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => void

    constructor(startedBy: GuildMember, voiceChannel: VoiceBasedChannel, voiceConnection: VoiceConnection) {
        this.voiceConnection = voiceConnection
        this.voiceChannel = voiceChannel
        this.voiceReceiver = voiceConnection.receiver
        this.guild = startedBy.guild
        this.client = startedBy.client
        this.startedBy = startedBy
        this.onStopEvent = new DeferredEvent()
        
        Recorders.set(this.guild.id, this)
        
        this.voiceConnection.on(VoiceConnectionStatus.Disconnected, (oldState, newState) => this.onVoiceDisconnect(oldState, newState))
    }

    /**
     * Starts the recording.
     */
    public async start() {
        // clean up old recording directory
        await fsp.rm(this.recordingsDir, { recursive: true, force: true })
        await fsp.mkdir(this.recordingsDir, { recursive: true })

        const recordingEventsFile = path.join(this.recordingsDir, 'recording.rectxt')
        this.eventLogFile = fs.createWriteStream(recordingEventsFile)

        // Create event listeners
        this.voiceReceiver.speaking.addListener('start', uid => this.onUserSpeakingStart(uid))
        this.voiceReceiver.speaking.addListener('end', uid => this.onUserSpeakingStop(uid))
        this._bind_voiceStateUpdate = this.onUserVoiceStateUpdate.bind(this)
        this.client.on('voiceStateUpdate', this._bind_voiceStateUpdate)

        this.logEvent('start', [])

        const selfMember = await this.guild.members.fetch(this.client.user.id)
        selfMember.setNickname(`🔴 Recording`)
    }

    /**
     * Stops the current recording.
     */
    public async stop() {
        // Remove listeners and close streams
        this.voiceReceiver.speaking.removeAllListeners('start')
        this.voiceReceiver.speaking.removeAllListeners('end')
        this.client.removeListener('voiceStateUpdate', this._bind_voiceStateUpdate)

        if (this.voiceConnection)
            this.voiceConnection.destroy()

        this.voiceConnection = null
        this.stopped = true

        this.logEvent('stop', [])
        this.eventLogFile.close()
        Recorders.delete(this.guild.id)

        const selfMember = await this.guild.members.fetch(this.client.user.id)
        selfMember.setNickname(``)

        // Call all external stop event handlers
        this.onStopEvent.resolve()
    }

    /**
     * Called when a user starts speaking.
     * @param userId User who is speaking
     */
    private async onUserSpeakingStart(userId: string) {
        const user = await this.client.users.fetch(userId)

        if (user.bot || this.voiceReceiver.subscriptions.has(userId))
            return

        // Recording starts when the first person speaks
        if (this.recordingStartTimestamp === -1)
            this.recordingStartTimestamp = Date.now()

        this.logEvent('userSpeakStart', [ userId ])

        const speakingStartTime = this.currentRecordingTime
        
        // received opus -> pcm -> mp3 22kHz mono
        const opusNetworkStream = this.voiceReceiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 200 }})
        const opusToPcm = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 })
        const pcmToMp3 = child_process.spawn(`ffmpeg -f s16le -ar 48000 -ac 2 -i - -f mp3 -ar 22050 -ac 1 -`, { shell: true })

        const outputFilename = path.join(this.recordingsDir, `${userId}.recording.mp3`)
        const outputFile = fs.createWriteStream(outputFilename)

        opusNetworkStream.pipe(opusToPcm)
        opusToPcm.pipe(pcmToMp3.stdin)
        pcmToMp3.stdout.pipe(outputFile)

        pcmToMp3.once('exit', () => {
            const speakingStopTime = this.currentRecordingTime

            console.log(`💾 Arquivo escrito ${outputFilename}..`)

            // rename file
            fsp.rename(outputFilename, path.join(this.recordingsDir, `${speakingStartTime}-${speakingStopTime},${userId}.mp3`))
        })
    }

    /**
     * Called when a user stops speaking.
     * @param userId User who stopped speaking
     */
    private async onUserSpeakingStop(userId: string) {
        this.logEvent('userSpeakStop', [ userId ])
    }

    private async onUserVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guildId = newState.guild.id
        
        // Ignore events from other guilds
        if (this.guild.id !== guildId) return
    
        if (oldState.channelId !== this.voiceChannel.id && newState.channelId === this.voiceChannel.id) {
            // Joined the channel
            this.logEvent('userEnterChannel', [ newState.id ])
        } else if (oldState.channelId === this.voiceChannel.id && newState.channelId !== this.voiceChannel.id) {
            // Left the channel
            this.logEvent('userLeaveChannel', [ newState.id ])

            // Check if we're the only ones in the channel now
            const vc = await this.voiceChannel.fetch()

            if (vc.members.size <= 1 || !vc.members.has(this.client.user.id)) {
                // Stop the recording
                this.stop()
            }
        }
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
            this.stop()
        }
    }

    /**
     * Registers an event in the recording log (e.g. user speaks, stops speaking, enters channel...)
     * @param type 
     */
    private logEvent(type: RecordingLogItemType, data: string[]): void {
        const stream = this.eventLogFile
        const currentRecordingTime = this.currentRecordingTime

        if (stream && stream.writable) {
            stream.write([ currentRecordingTime, type, ...data ].join(',') + '\n')
        }
    }

    /**
     * Returns the current time, relative to the start of the recording.
     */
    get currentRecordingTime(): number {
        // If an user hasn't spoken yet, then the recording hasn't actually started.
        if (this.recordingStartTimestamp === -1)
            return 0

        return Date.now() - this.recordingStartTimestamp
    }

    /**
     * Where recording fragments are stored
     */
    get recordingsDir(): string {
        return `recordings/${this.guild.id}/${this.voiceChannel.id}/`
    }
}

export default Recorder
export { Recorders }