## Distributed Systems - Event-Driven Architecture.

__Name:__ Caixian Wang

__Demo__: 

This repository contains the implementation of a skeleton design for an application that manages a photo gallery, illustrated below. The app uses an event-driven architecture and is deployed on the AWS platform using the CDK framework for infrastructure provisioning.



### Code Status.

__Feature:__

+ Photographer:
  + Log new Images
  + Metadata updating
  + Invalid image removal  
  + Status Update Mailer
+ Moderator
  + Status updating

### Commit Information 

1. **Install dependencies:** type the commands to Install dependencies.

   ```sh
   npm install
   cdk deploy
   ```

2. **Configure an S3 bucket:** Upload ``.jpeg`` and ``.png ``files is allowed.

3. **Configure S3 event notifications:** Push the ObjectCreated event to the SNS topic.

4. **SNS Topic subscribes to SQS queues:** Set a filter to allow only image upload events to be queued.

5. **The SQS queue triggers a Log Image Lambda.**

6. **Image Lambda Setting：** 

   - The Log Image Lambda checks the file type and only handles ``.jpeg`` and ``.png``, otherwise it throws an exception (the message goes into the DLQ).
   - The Log Image Lambda writes the file name of a valid image to the DynamoDB table as the primary key.

7. **DynamoDB table:** Create a DynamoDB table and pass the table name to Lambda via an environment variable.

8. **Photographer Post Messages:** The photographer uses the AWS CLI to post messages with message attributes to SNS Topics.

9. **Configure the Add Metadata Lambda subscription:** Configure the Add Metadata Lambda subscription for an SNS topic, set a filter, and only receive metadata-related messages (attributes Caption, Date, name).

10. **Parse message bodies and attributes, and update DynamoDB tables:** Add Metadata Lambda parses the message body and attributes, and updates the metadata fields of the corresponding image in the DynamoDB table.

11. **Exception will be thrown if it is invalid:** The Log Image Lambda checks the file type, and if it is invalid, it throws an exception and the message enters the SQS DLQ.

12. **Status Update Mailer:** When the status of an image changes, the photographer will be automatically notified by email.

13. **Implement filtering capabilities.**

14. **Implement the status updating function.**

15. **Modify the mailbox and test it.**

16. **Add testing information :** 

    ```json
    //attributes.json
    {
      "metadata_type": {
        "DataType": "String",
        "StringValue": "Caption"
      }
    }
    ```

    ```json
    // message.json
    {
        "id": "image1.jpeg",
        "value": "Olympic 100m final - 2024"
      }
    ```

    

