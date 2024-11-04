const formidable = require('formidable');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../../lib/cloudinaryConfig');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const convertChannelControl = (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error parsing the form:', err);
            return res.status(400).json({ error: 'Error parsing the file.' });
        }

        console.log('Parsed fields:', fields); // Log parsed fields
        console.log('Parsed files:', files); // Log parsed files

        // Check if audio file is uploaded
        if (!files.audio || files.audio.length === 0) {
            return res.status(400).json({ error: 'No audio file uploaded.' });
        }

        const inputFile = files.audio[0].filepath; // Access the uploaded file
        console.log('Input file path:', inputFile); // Log input file path
        if (!inputFile) {
            console.error('Input file path is undefined');
            return res.status(400).json({ error: 'Input file path is undefined' });
        }

        const outputDirectory = path.join(__dirname, '../../uploads');
        console.log('Output directory:', outputDirectory);
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
        }

        const outputFileName = `${Date.now()}.wav`;
        const outputFile = path.join(outputDirectory, outputFileName);

        try {
            ffmpeg(inputFile)
                .audioChannels(fields.channel[0] === 'mono' ? 1 : 2) // Access channel
                .toFormat('wav')
                .on('start', (commandLine) => {
                    console.log('Spawned FFmpeg with command: ' + commandLine);
                })
                .on('progress', (progress) => {
                    console.log('Processing: ' + progress.percent + '% done');
                })
                .on('end', async () => {
                    console.log('Conversion finished successfully');
                    try {
                        const result = await cloudinary.uploader.upload(outputFile, {
                            resource_type: 'auto',
                        });

                        if (fs.existsSync(inputFile)) {
                            fs.unlinkSync(inputFile); // Clean up input file
                        }
                        if (fs.existsSync(outputFile)) {
                            fs.unlinkSync(outputFile); // Clean up output file
                        }

                        res.status(200).json({ message: 'Conversion successful', output: result.secure_url });
                    } catch (uploadError) {
                        console.error('Error uploading to Cloudinary:', uploadError);
                        res.status(500).json({ error: 'Failed to upload to Cloudinary.' });
                    }
                })
                .on('error', (error) => {
                    console.error('Error during conversion:', error);
                    res.status(500).json({ error: 'Failed to convert audio.' });
                })
                .save(outputFile); // Save converted file
        } catch (error) {
            console.error('FFmpeg execution error:', error);
            res.status(500).json({ error: 'Failed to start FFmpeg.' });
        }
    });
};

module.exports = { convertChannelControl };
