import { GuildMember } from "discord.js";

enum PermissionLevel {
    ROOT = 0,
    GUILD_MODERATOR = 1,
    USER = 2
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
}

export default Utils