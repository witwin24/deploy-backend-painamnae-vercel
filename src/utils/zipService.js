const archiver = require('archiver');
const { PassThrough } = require('stream');

/**
 * Create a zip file from CSV buffers
 * @param {Array} csvFiles - Array of objects with { fileName: string, data: Buffer }
 * @returns {Object} - { success: boolean, data: Buffer }
 */
const createZipArchive = async (csvFiles) => {
    try {
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        const chunks = [];
        const passThrough = new PassThrough();

        return new Promise((resolve, reject) => {
            passThrough.on('data', (chunk) => {
                chunks.push(chunk);
            });

            passThrough.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log('[Zip] Zip buffer created successfully, size:', buffer.length, 'bytes');
                
                resolve({
                    success: true,
                    data: buffer
                });
            });

            passThrough.on('error', reject);
            archive.on('error', reject);

            archive.pipe(passThrough);

            // Add CSV files to archive
            for (const csvFile of csvFiles) {
                archive.append(csvFile.data, { name: csvFile.fileName });
            }

            archive.finalize();
        });

    } catch (error) {
        console.error('[Zip Service Error]', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    createZipArchive
};
