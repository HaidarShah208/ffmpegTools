// controllers/audioProcessingController.js
const formidable = require('formidable');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../../lib/cloudinaryConfig');

// Set FFmpeg path
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// Function to handle audio silence removal
const removeSilence = (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(400).json({ error: 'Error parsing the file.' });
        }

        // Check if the file is present
        if (!files.audio || files.audio.length === 0) {
            return res.status(400).json({ error: 'No audio file uploaded.' });
        }

        const inputFile = files.audio[0].filepath; // Access the first file uploaded
        const outputFileName = `${Date.now()}.wav`;
        const outputFile = path.join(__dirname, '../../uploads', outputFileName);

        // Process the audio to remove silence
        ffmpeg(inputFile)
            .audioFilters('silenceremove=1:0:-50dB') // Adjust parameters as needed
            .toFormat('wav')
            .on('end', async () => {
                console.log('Silence removal finished successfully');

                // Upload the processed audio to Cloudinary
                try {
                    const result = await cloudinary.uploader.upload(outputFile, {
                        resource_type: 'video', // Use 'video' for audio files in Cloudinary
                    });

                    // Clean up temporary files
                    fs.unlinkSync(inputFile); // Delete the uploaded file
                    fs.unlinkSync(outputFile); // Delete the processed file

                    // Respond with the Cloudinary URL
                    res.status(200).json({ message: 'Silence removal successful!', url: result.secure_url });
                } catch (uploadError) {
                    console.error('Error uploading to Cloudinary:', uploadError);
                    res.status(500).json({ error: 'Failed to upload to Cloudinary.' });
                }
            })
            .on('error', (error) => {
                console.error('Error processing audio:', error);
                res.status(500).json({ error: 'Failed to process audio.' });
            })
            .save(outputFile);
    });
};

module.exports = { removeSilence };
