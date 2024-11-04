const cloudinary = require('../../lib/cloudinaryConfig');
const formidable = require('formidable');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Function to mix audio files
const mixAudio = (req, res) => {
    const form = new formidable.IncomingForm();
  
    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('Error parsing the files:', err);
            return res.status(400).json({ error: 'Error parsing the files' });
        }
  
        // Extract audio file paths
        const audioFiles = Object.values(files.audioFiles).map(file => file.filepath);
        console.log('Audio files received for mixing:', audioFiles); // Debugging: log received files
  
        if (audioFiles.length < 2) {
            console.error('Insufficient audio files:', audioFiles.length);
            return res.status(400).json({ error: 'At least two audio files are required.' });
        }
  
        const outputPath = path.join(__dirname, '../../uploads', 'mixedAudio.mp3');
        console.log('Output path for mixed audio:', outputPath); // Debugging: log output path
  
        // Use FFmpeg to mix the audio files with a complex filtergraph
        const command = ffmpeg();
  
        // Add each audio file as an input to the command
        audioFiles.forEach(file => {
            console.log('Adding audio file to FFmpeg input:', file); // Debugging: log each input file
            command.input(file);
        });
  
        command
            .complexFilter(`amix=inputs=${audioFiles.length}:duration=longest`) // Adjusted filter for multiple inputs
            .on('end', () => {
                console.log('Mixing finished successfully.'); // Debugging: log success

                // Check if the mixed audio file exists before uploading
                fs.stat(outputPath, (statErr, stats) => {
                    if (statErr || !stats.isFile()) {
                        console.error('Mixed audio file not found:', outputPath);
                        return res.status(500).json({ error: 'Mixed audio file not found' });
                    }

                    // Upload mixed audio to Cloudinary
                    cloudinary.uploader.upload(outputPath, { resource_type: 'audio' }, (uploadError, result) => {
                        // Clean up uploaded files if needed
                        audioFiles.forEach(file => fs.unlinkSync(file));
                        fs.unlinkSync(outputPath); // Remove the mixed file after uploading

                        if (uploadError) {
                            console.error('Error uploading to Cloudinary:', uploadError);
                            console.log('Upload error response:', uploadError.response); // Log the full response for more insights
                            return res.status(500).json({ error: 'Upload to Cloudinary failed' });
                        }

                        res.status(200).json({ url: result.secure_url });
                    });
                });
            })
            .on('error', (err) => {
                console.error('Error mixing audio:', err);
                res.status(500).send('Error mixing audio');
            })
            .save(outputPath);
    });
};

module.exports = { mixAudio };
