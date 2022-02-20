import * as path from 'path'
import * as fsp from 'fs/promises'
import * as child_proc from 'child-process-promise'
import { promisify } from 'util'

class Mixer {
    private outputFilename: string
    private recordingsDir: string

    /**
     * Mixes recording fragments into one single sound file.
     * @param recordingsDir Directory where each sound file is stored in
     * @param outputFilename The full path to the output file.
     */
    constructor(recordingsDir: string, outputFilename: string) {
        this.recordingsDir = recordingsDir
        this.outputFilename = outputFilename
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
            .filter(f => f !== path.basename(this.outputFile))
            .filter(f => path.extname(f) === '.ogg')
    
        let files = fileList.map(f => ({
            name: f,
            startMs: parseInt(f.split(',')[0].split('-')[0]),
            endMs: parseInt(f.split(',')[0].split('-')[1]),
            userId: f.split(',')[1].split('.').shift()
        }))
    
        let command = ``
    
        command += `ffmpeg`
    
        for (const file of files) {
            command += ` -i ${baseDir}${file.name}`
        }
    
        command += ` -filter_complex "`
    
        for (let i = 0; i < files.length; i++) {
            let f = files[i]
            command += `[${i}:a]adelay=${f.startMs}|${f.startMs}[out${i}];`
        }
    
        for (let i = 0; i < files.length; i++) {
            let f = files[i]
            command += `[out${i}]`
        }
    
        command += `amix=inputs=${files.length}[out]" -map "[out]" ${this.outputFile}`
    
        return command
    }

    get outputFile(): string {
        return path.join(this.recordingsDir, this.outputFilename)
    }
}

export default Mixer