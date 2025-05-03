import { SQSHandler, SQSEvent } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      // S3 事件消息格式
      const s3Info = body.Records?.[0]?.s3;
      if (!s3Info) throw new Error('Invalid S3 event structure');
      const bucket = s3Info.bucket.name;
      const key = decodeURIComponent(s3Info.object.key.replace(/\+/g, ' '));
      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      console.log(`Removed invalid image from DLQ: ${key}`);
    } catch (err) {
      console.error('Failed to process DLQ message:', err);
    }
  }
}; 