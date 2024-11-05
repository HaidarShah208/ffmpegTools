const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const extractFrames = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const videoBuffer = req.file.buffer;
        const requestedFrames = parseInt(req.body.frameRate) || 1;
        
        // Use /tmp directory for Vercel environment
        const outputDir = path.join('/tmp', 'frames');
        const tempVideoPath = path.join('/tmp', `temp-${uuidv4()}.mp4`);
        
        // Create directories in /tmp
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Write temporary video file
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

        // Process frames and convert to base64
        const processedFrames = await new Promise((resolve, reject) => {
            const frames = [];
            
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
                .on('end', async () => {
                    try {
                        // Read all frames and convert to base64
                        const frameFiles = fs.readdirSync(framesPath)
                            .filter(file => file.endsWith('.jpg'))
                            .sort((a, b) => {
                                const numA = parseInt(a.match(/\d+/)[0]);
                                const numB = parseInt(b.match(/\d+/)[0]);
                                return numA - numB;
                            });

                        for (const file of frameFiles) {
                            const framePath = path.join(framesPath, file);
                            const frameBuffer = fs.readFileSync(framePath);
                            const base64Frame = frameBuffer.toString('base64');
                            frames.push({
                                frame: `data:image/jpeg;base64,${base64Frame}`,
                                filename: file
                            });
                            
                            // Clean up individual frame file
                            fs.unlinkSync(framePath);
                        }

                        // Clean up
                        fs.rmdirSync(framesPath);
                        fs.unlinkSync(tempVideoPath);
                        
                        resolve(frames);
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
            frames: processedFrames,
            batchId 
        });

    } catch (error) {
        console.error('Error extracting frames:', error);
        // Clean up any remaining temporary files
        try {
            if (fs.existsSync(tempVideoPath)) {
                fs.unlinkSync(tempVideoPath);
            }
            if (fs.existsSync(framesPath)) {
                fs.rmdirSync(framesPath, { recursive: true });
            }
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
        res.status(500).json({ error: 'Failed to extract frames' });
    }
};

module.exports = { extractFrames };