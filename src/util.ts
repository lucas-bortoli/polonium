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
}

export default Utils