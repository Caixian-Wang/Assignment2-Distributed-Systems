import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    if (!key.endsWith('.jpeg') && !key.endsWith('.png')) {
      // 删除不合规文件
      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      console.log(`Deleted invalid file: ${key}`);
    } else {
      console.log(`Valid image uploaded: ${key}`);
    }
  }
}; 