// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Las credenciales las sacarás del panel principal de tu cuenta de Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const isHeic = file && (
            file.mimetype === 'image/heic' || 
            file.mimetype === 'image/heif' || 
            file.originalname?.toLowerCase().endsWith('.heic') || 
            file.originalname?.toLowerCase().endsWith('.heif')
        );

        return {
            folder: 'gym_receipts',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'heic', 'heif'],
            format: isHeic ? 'jpg' : undefined,
        };
    },
});

const upload = multer({ storage: storage });

export { upload };