import { Snowflake } from 'discord.js'

type Timestamp = number
type UserId = Snowflake

interface RecordingLogItemUserSpeakingStart {
    timestamp: Timestamp,
    type: 'userSpeakStart',
    userId: UserId
}

interface RecordingLogItemUserSpeakingStop {
    timestamp: number,
    type: 'userSpeakStop',
    userId: UserId
}

interface RecordingLogItemUserEnterChannel {
    timestamp: number,
    type: 'userEnterChannel',
    userId: UserId
}

interface RecordingLogItemUserLeaveChannel {
    timestamp: number,
    type: 'userLeaveChannel',
    userId: UserId
}

type RecordingLogItem = 
    RecordingLogItemUserSpeakingStart | 
    RecordingLogItemUserSpeakingStop |
    RecordingLogItemUserEnterChannel |
    RecordingLogItemUserLeaveChannel

type RecordingLog = RecordingLogItem[]