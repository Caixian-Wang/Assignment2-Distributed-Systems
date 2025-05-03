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

### Push Information 

1. **Install dependencies:** type the commands to Install dependencies.

   ```sh
   npm install
   cdk deploy
   ```

2. **Configure an S3 bucket:** Upload ``.jpeg`` and ``.png ``files is allowed.

