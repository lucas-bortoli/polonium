import { Snowflake } from 'discord.js'

type Timestamp = number
type UserId = Snowflake

type RecordingLogItemType = 'start' | 'stop' | 'userSpeakStart' | 'userSpeakStop' | 'userEnterChannel' | 'userLeaveChannel'