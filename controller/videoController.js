const formidable = require('formidable');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const cloudinary = require('../lib/cloudinaryConfig');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const mergeVideos  = (req, res) => {
    const form = new formidable.IncomingForm();

    console.log('Starting file upload...');

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(400).json({ error: 'Error parsing the files.' });
        }

        console.log("File upload complete. Starting video upload to Cloudinary...");

        const videoFiles = Object.values(files.video).map(file => file.filepath);

        if (videoFiles.length === 0) {
            return res.status(400).json({ error: 'No video files uploaded.' });
        }

        // Step 1: Upload videos to Cloudinary and store URLs
        const uploadedVideoURLs = [];
        try {
            for (const file of videoFiles) {
                const result = await cloudinary.uploader.upload(file, { resource_type: 'video' });
                uploadedVideoURLs.push(result.secure_url);
                // Optionally, delete the local file after upload if needed
                await fs.remove(file);
            }
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error.message);
            return res.status(500).json({ error: 'Failed to upload video files to Cloudinary.' });
        }

        console.log("All videos uploaded to Cloudinary. Starting video merge...");

        // Step 2: Prepare to merge videos
        const outputVideoPath = path.join(os.tmpdir(), `merged_video_${Date.now()}.mp4`);

        const ffmpegCommand = ffmpeg();

        // Add each video URL as input to ffmpeg
        uploadedVideoURLs.forEach(url => ffmpegCommand.input(url));

        // Prepare the output for the merged video
        ffmpegCommand
            .complexFilter(
                uploadedVideoURLs.map((_, index) => `[${index}:v]scale=640:360,fps=30[v${index}];[${index}:a]anull[a${index}]`).join(';') +
                ';' + uploadedVideoURLs.map((_, index) => `[v${index}][a${index}]`).join('') +
                `concat=n=${uploadedVideoURLs.length}:v=1:a=1[outv][outa]`,
                ['outv', 'outa']
            )
            .output(outputVideoPath) // Specify the temporary output file
            .on('end', async () => {
                console.log('Merging finished!');

                try {
                    // Upload the merged video to Cloudinary
                    const cloudinaryUpload = await cloudinary.uploader.upload(outputVideoPath, {
                        resource_type: 'video',
                        public_id: `merged_video_${Date.now()}`, // Customize the public ID if needed
                        overwrite: true,
                    });

                    // Clean up the temporary merged video file
                    await fs.remove(outputVideoPath);

                    res.status(200).json({
                        message: 'Videos merged and uploaded successfully!',
                        url: cloudinaryUpload.secure_url // Get the URL of the uploaded merged video
                    });
                } catch (error) {
                    console.error('Error uploading merged video to Cloudinary:', error.message);
                    res.status(500).json({ error: 'Failed to upload merged video to Cloudinary.' });
                }
            })
            .on('error', (error) => {
                console.error('Error merging videos:', error.message);
                res.status(500).json({ error: 'Failed to merge videos. ' + error.message });
            })
            .run();
    });
};

module.exports = { mergeVideos  };
