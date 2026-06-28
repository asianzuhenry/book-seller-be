import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";
import { r2 } from "../config/r2";


export const uploadToR2 = async (
  file: Express.Multer.File,
  folder: string
) => {
  try {
    const extension = file.originalname.split(".").pop();
    const key = `${folder}/${uuid()}.${extension}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return {
      key,
      url: `${process.env.R2_PUBLIC_URL}/${key}`,
    };
  } catch (err) {
    console.error("R2 Upload Error:", err);
    throw err;
  }
};