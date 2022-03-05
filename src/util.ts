import { GuildMember } from "discord.js";
import Recorder from "./recorder";

enum PermissionLevel {
    ROOT = 1000,
    GUILD_MODERATOR = 10,
    USER = 1
}

class Utils {
    private constructor() { throw new Error('Don\'t instantiate me.') }

    /**
     * Returns a Promise that only resolves after a certain amount of time
     */
    static delay(ms: number) {
        return new Promise<void>(resolve => {
            setTimeout(() => resolve(), ms)
        })
    }

    /**
     * @param size Size, in bytes
     * @returns Human-readable file size string
     */
    static humanFileSize(size: number): string {
        var i = Math.floor( Math.log(size) / Math.log(1024) );
        //@ts-expect-error
        return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
    }

    static determineMemberPermissionLevel(member: GuildMember): PermissionLevel {
        // Owner of bot
        if (member.id === member.client.application.owner.id)
            return PermissionLevel.ROOT

        // Guild moderator
        if (member.permissions.has('MODERATE_MEMBERS'))
            return PermissionLevel.GUILD_MODERATOR

        // User
        return PermissionLevel.USER
    }

    /**
     * Checks if a guild member can stop the current recording.
     * @param member The member who's trying to stop the recording
     * @param recording The relevant recording
     */
    static memberCanStopRecording(member: GuildMember, recording: Recorder): boolean {
        const member_perm = Utils.determineMemberPermissionLevel(member)

        // Root and mods can always stop recordings
        if (member_perm === PermissionLevel.ROOT) return true
        if (member_perm === PermissionLevel.GUILD_MODERATOR) return true

        // Regular users can stop the recording if they started it
        if (member.id === recording.startedBy.id)
            return true

        // Can't stop the recording
        return false
    }
}

export default Utils