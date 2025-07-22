import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../config/env.js"
import cloudinary from "../config/cloudinary.js";
import sharp from 'sharp';

export const generateAuthToken = (user) => {
  if (!user || !user.userId || !user.email || !user.role) {
    throw new Error("Invalid user object provided for token generation");
  }
    return jwt.sign(
   user,
     JWT_SECRET,
      { expiresIn: '7d' }
    )
  }
  
  export function generateOtp(length = 6) {
    return Math.floor(100000 + Math.random() * 900000).toString().slice(0, length);
  }
  
  export function getExpiryMinutesFromNow(minutes = 2) {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + minutes);
    return expiry;
  }
  
  

  export const calculateOfferedPrice = (price, offer_type, offer_value) => {
  if (!offer_type || !offer_value) return null;

  const value = parseFloat(offer_value);
  const basePrice = parseFloat(price);

  if (offer_type === 'PERCENTAGE') {
    return basePrice - (basePrice * value / 100);
  } else if (offer_type === 'FLAT') {
    return basePrice - value;
  }

  return null;
};
import streamifier from 'streamifier';

export const processAndUploadImages = async (files, slug, primary_index = 0) => {
  return await Promise.all(files.map((file, idx) => {
    return new Promise(async (resolve, reject) => {
      try {
        const resizedBuffer = await sharp(file.buffer)
          .resize(800, 800, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toBuffer();

        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'ayurfresh/products',
            public_id: `${slug}_${idx}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve({
              url: result.secure_url,
              is_primary: idx === primary_index,
            });
          }
        );

        const readable = streamifier.createReadStream(resizedBuffer);
        readable.pipe(uploadStream);
      } catch (error) {
        reject(error);
      }
    });
  }));
};

export const deleteCloudinaryImage = async (url) => {
  const publicId = url.split('/').slice(-1)[0].split('.')[0]
  const folder = 'ayurfresh/products';
  const fullPublicId = `${folder}/${publicId}`;
  return cloudinary.uploader.destroy(fullPublicId);
};

export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // Replace spaces and non-word characters with hyphens
}


export function getPaginationParams(req, defaultLimit = 8) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.record) || defaultLimit;
  const skip = (page - 1) * limit;

  const search = req.query.search?.trim() || '';

  return { page, limit, skip, search };
}
