const ffmpeg = require('fluent-ffmpeg');
const cloudinary = require('../lib/cloudinaryConfig');

const speedController = async (req, res) => {
  const { speed } = req.body;

  try {
    // Convert the buffer to a readable stream
    const bufferStream = require('stream').Readable.from(req.file.buffer);

    // Process the video with ffmpeg and upload directly to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const cloudinaryUploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'video' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      // Use fluent-ffmpeg to process the video
      ffmpeg(bufferStream)
        .videoFilters(`setpts=${1 / speed}*PTS`)
        .pipe(cloudinaryUploadStream, { end: true }) // Pipe the processed video directly to Cloudinary
        .on('error', reject)
        .on('end', () => {
          console.log('Video processing finished successfully');
        });
    });

    res.json({ videoUrl: result.secure_url });
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({ error: 'Error processing video' });
  }
};

module.exports = { speedController };
