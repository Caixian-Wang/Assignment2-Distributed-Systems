import { SNSEvent, SNSHandler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.IMAGE_TABLE_NAME!;

export const handler: SNSHandler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const id = message.id;
    const update = message.update;
    if (!id || !update || !update.status) {
      console.log('Missing id or update.status');
      continue;
    }
    // 更新 DynamoDB 表
    await ddb.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: id } },
      UpdateExpression: 'SET #status = :status, #reason = :reason',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#reason': 'reason',
      },
      ExpressionAttributeValues: {
        ':status': { S: update.status },
        ':reason': { S: update.reason || '' },
      },
    }));
    console.log(`Updated status for image ${id} to ${update.status}`);
  }
}; 