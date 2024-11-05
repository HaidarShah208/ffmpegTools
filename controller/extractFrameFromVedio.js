const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');
const fs = require('fs');

const extractFrames = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const videoBuffer = req.file.buffer;
        const requestedFrames = parseInt(req.body.frameRate) || 1;
        
        // Use OS temp directory instead of local directory
        const tempDir = os.tmpdir();
        const batchId = uuidv4();
        const tempVideoPath = path.join(tempDir, `temp-${batchId}.mp4`);
        const framesPath = path.join(tempDir, batchId);

        // Create temporary directory for frames
        fs.mkdirSync(framesPath, { recursive: true });
        
        // Write video to temp directory
        fs.writeFileSync(tempVideoPath, videoBuffer);

        const getDuration = () => {
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
                    if (err) reject(err);
                    resolve(metadata.format.duration);
                });
            });
        };

        const duration = await getDuration();
        const interval = duration / requestedFrames;

        // Extract frames
        const frames = await new Promise((resolve, reject) => {
            const extractedFrames = [];
            
            ffmpeg(tempVideoPath)
                .screenshots({
                    count: requestedFrames,
                    timemarks: Array.from(
                        { length: requestedFrames }, 
                        (_, i) => Math.min(i * interval, duration - 0.001)
                    ),
                    folder: framesPath,
                    filename: 'frame-%d.jpg',
                    size: '480x?'
                })
                .on('end', async () => {
                    try {
                        // Read frames and convert to base64
                        const frameFiles = fs.readdirSync(framesPath)
                            .filter(file => file.endsWith('.jpg'))
                            .sort((a, b) => {
                                const aNum = parseInt(a.match(/\d+/)[0]);
                                const bNum = parseInt(b.match(/\d+/)[0]);
                                return aNum - bNum;
                            });

                        for (const file of frameFiles) {
                            const framePath = path.join(framesPath, file);
                            const frameBuffer = fs.readFileSync(framePath);
                            const base64Frame = frameBuffer.toString('base64');
                            extractedFrames.push({
                                filename: file,
                                data: `data:image/jpeg;base64,${base64Frame}`
                            });
                            
                            // Clean up frame file
                            fs.unlinkSync(framePath);
                        }

                        // Clean up
                        fs.unlinkSync(tempVideoPath);
                        fs.rmdirSync(framesPath);
                        
                        resolve(extractedFrames);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (err) => {
                    // Clean up on error
                    if (fs.existsSync(tempVideoPath)) {
                        fs.unlinkSync(tempVideoPath);
                    }
                    if (fs.existsSync(framesPath)) {
                        fs.rmdirSync(framesPath, { recursive: true });
                    }
                    reject(err);
                });
        });

        res.json({ 
            success: true, 
            frames,
            batchId 
        });

    } catch (error) {
        console.error('Error extracting frames:', error);
        res.status(500).json({ error: 'Failed to extract frames' });
    }
};

module.exports = { extractFrames };