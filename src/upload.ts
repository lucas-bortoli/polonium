import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'
import fsp from 'fs/promises'
import Utils from './util'

// Split file in 7.2 MB chunks
const FILE_PIECE_MAX_SIZE = Math.round(7.2 * 1024 * 1024)

/**
 * File entry information used by the basedFS server to stream the file back to the user
 * https://github.com/lucas-bortoli/basedfs
 * https://github.com/lucas-bortoli/basedfs-share-server
 */
interface CloudFileEntry {
    type: 'file',
    size: number,
    pieces: string[],
    cdate: number,
    description: string
}

type FileEntryPointer = string

const createFilePointerFromEntryUrl = (link: string): FileEntryPointer =>
    link.split('').map(z => z === '/' ? '.' : z).reverse().join('').replace('x.', '')

export default class FileUpload {
    public sourceFile: string
    public webhookUrl: string

    constructor(sourceFile: string, webhookUrl: string) {
        this.sourceFile = sourceFile
        this.webhookUrl = webhookUrl
    }

    /**
     * Uploads a given file to the Discord server via a webhook, splitting it into 7 MB chunks in the process.
     * @param description File description to be shown on the download page
     */
    public async upload(description: string): Promise<FileEntryPointer> {
        const fileStat = await fsp.stat(this.sourceFile)
        const fileStream = fs.createReadStream(this.sourceFile, { encoding: 'binary' })

        let chunkLinks: string[] = []
        let chunkCounter: number = 0
        let readChunk: Buffer

        // Read all chunks from the file
        while (null !== (readChunk = fileStream.read(FILE_PIECE_MAX_SIZE))) {
            // Upload each chunk
            const link = await this.uploadData(readChunk, 'recorder_bot_' + Date.now())

            chunkLinks.push(link)
            chunkCounter++
        }

        const fileEntry: CloudFileEntry = {
            type: 'file',
            pieces: chunkLinks.map(link => link.replace('https://cdn.discordapp.com/attachments/', '')),
            size: fileStat.size,
            cdate: Date.now(),
            description
        }

        // Upload the file entry too
        const entryPointer: FileEntryPointer = await this.uploadFileEntry(fileEntry)

        return entryPointer
    }

    /**
     * Uploads a file to the webhook, and returns its link.
     * @param data 
     */
    private async uploadData(data: Buffer, fileName: string): Promise<string> {
        const requestBody = new FormData()

        requestBody.append('files[0]', data, fileName)
        requestBody.append('payload_json', JSON.stringify((
            { 'attachments': [ { 'id': 0, 'description': 'file_upload', 'filename': fileName } ] }
        )))

        const response = await fetch(this.webhookUrl, {
            method: 'POST',
            body: requestBody
        })
    
        const body = await response.json()
    
        const ratelimit_remaining = parseInt(response.headers.get('x-ratelimit-remaining'))
        const ratelimit_reset_after = parseFloat(response.headers.get('x-ratelimit-reset-after'))
    
        // if ratelimit reached, wait until we can proceed
        if (ratelimit_remaining === 0)
            await Utils.delay(ratelimit_reset_after * 1200)
    
        //@ts-expect-error
        return body.attachments[0].url as string
    }

    private async uploadFileEntry(entry: CloudFileEntry): Promise<FileEntryPointer> {
        const entryAsBuffer = Buffer.from(JSON.stringify(entry), 'utf-8')

        // A file name of 'x' means that the file is an entry (i.e. a meta-file; a file that
        // contains instructions about how the *actual* file should be downloaded)
        const uploadUrl = await this.uploadData(entryAsBuffer, 'x')

        return createFilePointerFromEntryUrl(uploadUrl)
    }
}