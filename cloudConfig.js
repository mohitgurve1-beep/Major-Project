const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

const isCloudinaryConfigured = () => {
  const cloudName = process.env.CLOUD_NAME;
  const apiKey = process.env.CLOUD_API_KEY;
  const apiSecret = process.env.CLOUD_API_SECRET;

  return Boolean(cloudName && cloudName !== 'your_cloud_name' && apiKey && apiKey !== 'your_cloud_api_key' && apiSecret && apiSecret !== 'your_cloud_api_secret');
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
  });
}

const storage = isCloudinaryConfigured()
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'wanderlust_DEV',
        allowedFormats: ['png', 'jpg', 'jpeg'],
      },
    })
  : multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'uploads'));
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      },
    });

module.exports = {
    cloudinary,
    storage,
    isCloudinaryConfigured,
}
