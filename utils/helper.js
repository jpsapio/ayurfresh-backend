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
      { expiresIn: '30d' }
    )
  }
  
  export const  generateOTP=()=> {
    return Math.floor(100000 + Math.random() * 900000).toString();
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


export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // Replace spaces and non-word characters with hyphens
}
