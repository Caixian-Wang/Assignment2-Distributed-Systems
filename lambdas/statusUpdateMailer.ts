import { DynamoDBStreamEvent, DynamoDBStreamHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});
const FROM_ADDRESS = process.env.SES_FROM_ADDRESS!;

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventName !== 'MODIFY') continue;
    const newImage = record.dynamodb?.NewImage;
    const oldImage = record.dynamodb?.OldImage;
    if (!newImage || !oldImage) continue;
    // 仅在 status 字段发生变化时发送邮件
    const newStatus = newImage.status?.S;
    const oldStatus = oldImage.status?.S;
    if (!newStatus || newStatus === oldStatus) continue;
    const id = newImage.id?.S;
    const reason = newImage.reason?.S || '';
    const email = newImage.email?.S || '';
    if (!id || !email) continue;
    // 构造邮件内容
    const subject = `Your image ${id} review status: ${newStatus}`;
    const body = `Hello,\n\nYour image (${id}) review status has changed to: ${newStatus}.\nReason: ${reason}`;
    // 发送邮件
    await ses.send(new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
    }));
    console.log(`Sent status update email to ${email} for image ${id}`);
  }
}; 