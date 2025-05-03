import { SQSHandler } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.IMAGE_TABLE_NAME!;

export const handler: SQSHandler = async (event) => {
  console.log("Received SQS event:", JSON.stringify(event));
  for (const record of event.Records) {
    try {
      console.log("Processing SQS record:", JSON.stringify(record));
      const recordBody = JSON.parse(record.body); // SQS message
      console.log("SQS message body:", JSON.stringify(recordBody));
      const snsMessage = JSON.parse(recordBody.Message); // SNS message
      console.log("SNS message:", JSON.stringify(snsMessage));

      if (snsMessage.Records) {
        for (const messageRecord of snsMessage.Records) {
          const s3e = messageRecord.s3;
          const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
          console.log("Processing S3 object:", srcKey);
          if (!srcKey.endsWith('.jpeg') && !srcKey.endsWith('.png')) {
            console.log('Invalid file type detected:', srcKey);
            throw new Error(`Invalid file type: ${srcKey}`);
          }
          await ddb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: { id: { S: srcKey } },
            ConditionExpression: 'attribute_not_exists(id)',
          }));
          console.log(`Successfully logged image: ${srcKey}`);
        }
      } else {
        console.log('SNS message does not contain Records array:', JSON.stringify(snsMessage));
      }
    } catch (error) {
      console.error('Error processing record:', error);
      // 重新抛出错误，确保消息进入 DLQ
      throw error;
    }
  }
}; 