import { SQSEvent, SQSHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.IMAGE_TABLE_NAME!;

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    // S3 事件消息格式
    const s3Info = body.Records?.[0]?.s3;
    if (!s3Info) throw new Error('Invalid S3 event structure');
    const key = decodeURIComponent(s3Info.object.key.replace(/\+/g, ' '));
    if (!key.endsWith('.jpeg') && !key.endsWith('.png')) {
      throw new Error(`Invalid file type: ${key}`);
    }
    // 写入 DynamoDB
    await ddb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id: { S: key },
      },
      ConditionExpression: 'attribute_not_exists(id)',
    }));
    console.log(`Logged image: ${key}`);
  }
}; 