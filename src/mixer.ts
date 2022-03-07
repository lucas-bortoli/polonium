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
        let isValidAudioSourceFile = (file: string) => 
            path.extname(file) === '.ogg' || path.extname(file) === '.mp3'

        let chunkSize = 5
        let allFiles: string[]

        // Repeat mixing operation until there's only one file in the directory
        do {
            allFiles = 
                (await fsp.readdir(this.recordingsDir)).filter(isValidAudioSourceFile)

            // Natural sort (alphabetical and numerical order)
            allFiles = allFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

            // Split array into $chunkSize chunks
            for (let i = 0; i < allFiles.length; i += chunkSize) {
                let chunkFiles = allFiles.slice(i, i + chunkSize)

                // Get start and end timestamp based on each file name
                let startTime = Math.min(...chunkFiles.map(name => parseInt(name.split('-')[0])))
                let endTime = Math.max(...chunkFiles.map(name => parseInt(name.split('-')[1])))

                console.log(`chunk ${i / chunkSize}: ${chunkFiles.join(',')}`)

                let command = this.build_command(this.recordingsDir, `${startTime}-${endTime}.mp3`, chunkFiles)
                console.log(`ffmpeg command:\n\n\t$ ${command}\n\n`)

                // Wait until ffmpeg mixer process is done
                await child_proc.spawn(command, [], { shell: true })

                // Remove source files
                for (const file of chunkFiles)
                    await fsp.unlink(path.join(this.recordingsDir, file))
            }
        } while (allFiles.length !== 1)

        console.log(allFiles)
    }

    private build_command(baseDir: string, outputFileName: string, fileList: string[]): string {
        let files = fileList.map(f => ({
            name: f,
            startMs: parseInt(f.split(',')[0].split('-')[0]),
            endMs: parseInt(f.split(',')[0].split('-')[1])
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
    
        command += `amix=inputs=${files.length}[out]" -map "[out]" ${path.join(this.recordingsDir, outputFileName)}`
    
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