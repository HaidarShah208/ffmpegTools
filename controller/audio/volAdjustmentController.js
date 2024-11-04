const formidable = require('formidable');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../../lib/cloudinaryConfig');

const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const convertVolumeAdjustment = (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error parsing the form:', err);
            return res.status(400).json({ error: 'Error parsing the file.' });
        }

        console.log('Received fields:', fields);
        console.log('Received files:', files);

        // Check if the file is present
        if (!files.audio || files.audio.length === 0) {
            return res.status(400).json({ error: 'No audio file uploaded.' });
        }

        const inputFile = files.audio[0].filepath; // Access the first file uploaded
        const volume = parseFloat(fields.volume);
        if (isNaN(volume) || volume < 0 || volume > 2) {
            return res.status(400).json({ error: 'Invalid volume value. Must be between 0 and 2.' });
        }

        const outputFileName = `${Date.now()}_adjusted.wav`;
        const outputFile = path.join(__dirname, '../../uploads', outputFileName);

        ffmpeg(inputFile)
            .audioFilters(`volume=${volume}`)
            .toFormat('wav')
            .on('end', async () => {
                console.log('Volume adjustment finished successfully');
                // Optional: Upload to Cloudinary
                try {
                    const result = await cloudinary.uploader.upload(outputFile, {
                        resource_type: 'auto',
                    });

                    // Clean up temporary files
                    fs.unlinkSync(inputFile);
                    fs.unlinkSync(outputFile);

                    res.status(200).json({ message: 'Volume adjusted successfully', url: result.secure_url });
                } catch (uploadError) {
                    console.error('Error uploading to Cloudinary:', uploadError);
                    res.status(500).json({ error: 'Failed to upload to Cloudinary.' });
                }
            })
            .on('error', (error) => {
                console.error('Error adjusting volume:', error);
                res.status(500).json({ error: 'Failed to adjust volume.' });
            })
            .save(outputFile);
    });
};

module.exports = { convertVolumeAdjustment };
