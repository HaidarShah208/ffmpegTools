const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');
const fs = require('fs');

const extractFrames = async (req, res) => {
    const tmpDir = os.tmpdir();
    const tempVideoPath = path.join(tmpDir, `temp-${uuidv4()}.mp4`);
    const tempFramesDir = path.join(tmpDir, `frames-${uuidv4()}`);
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const videoBuffer = req.file.buffer;
        const requestedFrames = parseInt(req.body.frameRate) || 1;
        
        // Create temporary directory for frames
        fs.mkdirSync(tempFramesDir, { recursive: true });
        
        // Write video buffer to temporary file
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
        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .screenshots({
                    count: requestedFrames,
                    timemarks: Array.from(
                        { length: requestedFrames }, 
                        (_, i) => Math.min(i * interval, duration - 0.001)
                    ),
                    folder: tempFramesDir,
                    filename: 'frame-%d.jpg',
                    size: '480x?'
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Read frames and convert to base64
        const frames = fs.readdirSync(tempFramesDir)
            .filter(file => file.endsWith('.jpg'))
            .map(file => {
                const framePath = path.join(tempFramesDir, file);
                const frameBuffer = fs.readFileSync(framePath);
                return `data:image/jpeg;base64,${frameBuffer.toString('base64')}`;
            });

        // Cleanup temporary files
        fs.rmSync(tempVideoPath, { force: true });
        fs.rmSync(tempFramesDir, { recursive: true, force: true });

        res.json({ 
            success: true, 
            frames,
            count: frames.length 
        });

    } catch (error) {
        // Ensure cleanup on error
        try {
            fs.rmSync(tempVideoPath, { force: true });
            fs.rmSync(tempFramesDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }

        console.error('Error extracting frames:', error);
        res.status(500).json({ 
            error: 'Failed to extract frames',
            details: error.message 
        });
    }
};

module.exports = { extractFrames };