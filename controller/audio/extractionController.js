// routes/audioExtractor.js

const formidable = require('formidable');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../../lib/cloudinaryConfig'); // Import your Cloudinary configuration

// Set FFmpeg path if needed (optional, ffmpeg-static handles it)
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// Function to handle audio extraction
const convertAudioExtractor = (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(400).json({ error: 'Error parsing the file.' });
        }

        // Check if the file is present
        if (!files.video || files.video.length === 0) {
            return res.status(400).json({ error: 'No video file uploaded.' });
        }

        const inputFile = files.video[0].filepath; // Access the first file uploaded
        const outputFileName = `${Date.now()}.wav`;
        const outputFile = path.join(__dirname, '../../uploads', outputFileName); // Ensure this directory exists

        ffmpeg(inputFile)
            .toFormat('wav')
            .on('end', async () => {
                console.log('Audio extraction finished successfully');

                // Optional: Upload to Cloudinary
                try {
                    const result = await cloudinary.uploader.upload(outputFile, {
                        resource_type: 'auto', // Use 'auto' to handle different file types
                    });

                    // Clean up temporary files
                    fs.unlinkSync(inputFile); // Delete the uploaded video file
                    fs.unlinkSync(outputFile); // Delete the extracted audio file

                    // Respond with the Cloudinary URL
                    res.status(200).json({ message: 'Audio extraction successful', url: result.secure_url });
                } catch (uploadError) {
                    console.error('Error uploading to Cloudinary:', uploadError);
                    res.status(500).json({ error: 'Failed to upload to Cloudinary.' });
                }
            })
            .on('error', (error) => {
                console.error('Error extracting audio:', error);
                res.status(500).json({ error: 'Failed to extract audio.' });
            })
            .save(outputFile); // Save the extracted audio file
    });
};

module.exports = { convertAudioExtractor };
