import { SQSHandler } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.IMAGE_TABLE_NAME!;

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    try {
      const recordBody = JSON.parse(record.body); // SQS message
      const snsMessage = JSON.parse(recordBody.Message); // SNS message

      if (snsMessage.Records) {
        for (const messageRecord of snsMessage.Records) {
          const s3e = messageRecord.s3;
          const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
          console.log("Processing key:", srcKey);
          if (!srcKey.endsWith('.jpeg') && !srcKey.endsWith('.png')) {
            console.log('Invalid file type:', srcKey);
            throw new Error(`Invalid file type: ${srcKey}`);
          }
          await ddb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: { id: { S: srcKey } },
            ConditionExpression: 'attribute_not_exists(id)',
          }));
          console.log(`Logged image: ${srcKey}`);
        }
      } else {
        console.log('SNS message does not contain Records array:', JSON.stringify(snsMessage));
      }
    } catch (error) {
      console.error('Error processing record:', error);
    }
  }
}; 