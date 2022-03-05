import * as path from 'path'
import * as fsp from 'fs/promises'
import * as child_proc from 'child-process-promise'

class Mixer {
    private recordingsDir: string

    /**
     * Mixes recording fragments into one single sound file.
     * @param recordingsDir Directory where each sound file is stored in
     */
    constructor(recordingsDir: string) {
        this.recordingsDir = recordingsDir
    }

    async run() {
        let sourceFiles = await fsp.readdir(this.recordingsDir)
        let command = this.build_command(this.recordingsDir, sourceFiles)
        
        console.log(`ffmpeg command:\n\n\t$ ${command}\n\n`)

        let ffmpegProc = await child_proc.spawn(command, [], { shell: true })
    }

    private build_command(baseDir: string, fileList: string[]): string {
        // Natural sort (alphabetical and numerical order)
        fileList = fileList.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    
        fileList = fileList
            .filter(f => f !== path.basename(this.outputFilePath))
            .filter(f => path.extname(f) === '.ogg' || path.extname(f) === '.mp3')
    
        let files = fileList.map(f => ({
            name: f,
            startMs: parseInt(f.split(',')[0].split('-')[0]),
            endMs: parseInt(f.split(',')[0].split('-')[1]),
            userId: f.split(',')[1].split('.').shift()
        }))
    
        // Build command
        let command = `ffmpeg`
    
        for (const file of files) { command += ` -i ${baseDir}${file.name}` }
    
        command += ` -filter_complex "`
    
        for (let i = 0; i < files.length; i++) {
            let f = files[i]
            command += `[${i}:a]adelay=${f.startMs}|${f.startMs}[out${i}];`
        }
    
        for (let i = 0; i < files.length; i++) { command += `[out${i}]` }
    
        command += `amix=inputs=${files.length}[out]" -map "[out]" ${this.outputFilePath}`
    
        return command
    }

    /**
     * The absolute path to the output file of the mixer.
     */
    public get outputFilePath(): string {
        return path.join(this.recordingsDir, 'output.mp3')
    }
}

export default Mixer