const ffmpegPath = require('ffmpeg-static'); // Static FFmpeg binary
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

ffmpeg.setFfmpegPath(ffmpegPath); // Set FFmpeg path for fluent-ffmpeg

const extractFrames = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const videoBuffer = req.file.buffer;
        const requestedFrames = parseInt(req.body.frameRate) || 1;

        // Set /tmp directory for Vercel
        const outputDir = path.join('/tmp', 'frames');
        const tempVideoPath = path.join('/tmp', `temp-${uuidv4()}.mp4`);

        // Create directories in /tmp
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(tempVideoPath, videoBuffer);

        const batchId = uuidv4();
        const framesPath = path.join(outputDir, batchId);
        fs.mkdirSync(framesPath);

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

        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .screenshots({
                    count: requestedFrames,
                    timemarks: Array.from({ length: requestedFrames }, (_, i) => 
                        Math.min(i * interval, duration - 0.001)
                    ),
                    folder: framesPath,
                    filename: 'frame-%d.jpg',
                    size: '480x?'
                })
                .on('end', () => {
                    fs.unlinkSync(tempVideoPath); // Clean up temp file
                    resolve();
                })
                .on('error', (err) => {
                    fs.unlinkSync(tempVideoPath); // Clean up on error
                    reject(err);
                });
        });

        // Prepare frames URLs for response
        const frames = fs.readdirSync(framesPath)
            .filter(file => file.endsWith('.jpg'))
            .map(file => `/tmp/frames/${batchId}/${file}`);

        res.json({ success: true, frames, batchId });

    } catch (error) {
        console.error('Error extracting frames:', error);
        res.status(500).json({ error: 'Failed to extract frames' });
    }
};

module.exports = { extractFrames };
