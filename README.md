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

