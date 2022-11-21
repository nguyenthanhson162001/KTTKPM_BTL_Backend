const fs = require('fs');
const dotenv = require('dotenv').config();
const multer = require('multer');
const AWS = require('aws-sdk');
const { v4: uuid } = require('uuid');
// config path 
const path = require('path');
const BucketName = 'imagecanhcut';
const CLOUD_FRONT_URL = 'https://d2rd596stqiu8q.cloudfront.net/';
const FILE_SIZE = parseInt(20971520);

// config aws
AWS.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

// config s3
const s3 = new AWS.S3();

class AWSS3Helper {
    async uploadFile(file, bucketName = BucketName) {
        console.log("🚀 ~ file: awss3.helper.js ~ line 30 ~ AWSS3Helper ~ uploadFile ~ file", file)

        const filePath = `${uuid() + Date.now().toString()}${file.originalname}`

        const uploadParams = {
            Bucket: bucketName,
            Body: file.buffer,
            Key: `${filePath}`,
        };
        console.log("🚀 ~ file: awss3.helper.js ~ line 38 ~ AWSS3Helper ~ uploadFile ~ Key", `${CLOUD_FRONT_URL}${filePath}`);

        const { mimetype } = file;
        console.log("🚀 ~ file: awss3.helper.js ~ line 36 ~ AWSS3Helper ~ uploadFile ~ mimetype", mimetype)
        if (
            mimetype === 'image/jpeg' ||
            mimetype === 'image/png' ||
            mimetype === 'image/gif' ||
            mimetype === 'video/mp3' ||
            mimetype === 'video/mp4'
        )
            uploadParams.ContentType = mimetype;

        try {
            const { Location } = await s3.upload(uploadParams, (error) => {
                if (error) {
                    throw new Error(error);
                }
            }).promise();

            const fileName = `${CLOUD_FRONT_URL}${filePath}`;
            return fileName;
        } catch (err) {
            console.log('err: ', err);
            throw new Error('Upload file Aws S3 failed');
        }
    }

    async uploadFileBuffer(buffer, bucketName = BucketName) {

        const filePath = `${uuid() + Date.now().toString()}`

        const uploadParams = {
            Bucket: bucketName,
            Body: buffer,
            Key: `${filePath}`,
        };
        console.log("🚀 ~ file: awss3.helper.js ~ line 38 ~ AWSS3Helper ~ uploadFile ~ Key", `${CLOUD_FRONT_URL}${filePath}`);

        try {
            const { Location } = await s3.upload(uploadParams, (error) => {
                if (error) {
                    throw new Error(error);
                }
            }).promise();

            const fileName = `${CLOUD_FRONT_URL}${filePath}`;
            return fileName;
        } catch (err) {
            console.log('err: ', err);
            throw new Error('Upload file Aws S3 failed');
        }
    }

    async deleteFile(url, bucketName = BucketName) {
        const urlSplit = url.split('/');
        const key = urlSplit[urlSplit.length - 1];

        const params = {
            Bucket: bucketName,
            Key: key,
        };

        try {
            await s3.deleteObject(params).promise();
        } catch (err) {
            throw new Error('Delete file Aws S3 failed');
        }
    }
}

module.exports = new AWSS3Helper();
