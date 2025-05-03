import { SNSEvent, SNSHandler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.IMAGE_TABLE_NAME!;

export const handler: SNSHandler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const metadataType = record.Sns.MessageAttributes?.metadata_type?.Value;
    const id = message.id;
    const value = message.value;
    if (!id || !value || !metadataType) {
      console.log('Missing id, value, or metadata_type');
      continue;
    }
    // 更新 DynamoDB 表
    await ddb.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: id } },
      UpdateExpression: `SET #attr = :val` ,
      ExpressionAttributeNames: { '#attr': metadataType },
      ExpressionAttributeValues: { ':val': { S: value } },
    }));
    console.log(`Updated ${id} with ${metadataType}: ${value}`);
  }
}; 