import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    const validateImageTypeFn = new lambdanode.NodejsFunction(this, "ValidateImageTypeFn", {
      entry: "lambdas/validateImageType.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });

    // 创建 SNS Topic
    const imageEventsTopic = new sns.Topic(this, "ImageEventsTopic");

    // S3 事件推送到 SNS Topic
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(imageEventsTopic)
    );

    // 创建 SQS 死信队列（DLQ）
    const imageUploadDLQ = new sqs.Queue(this, "ImageUploadDLQ", {
      retentionPeriod: cdk.Duration.days(14),
    });

    // 创建 SQS 队列，关联 DLQ
    const imageUploadQueue = new sqs.Queue(this, "ImageUploadQueue", {
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: imageUploadDLQ,
      },
    });

    // SQS 只接收图片上传事件（无元数据属性）
    imageEventsTopic.addSubscription(
      new subs.SqsSubscription(imageUploadQueue, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.stringFilter({
            allowlist: [],
          }),
        },
        rawMessageDelivery: true,
      })
    );

    // 创建 DynamoDB 表，开启 Stream
    const imageTable = new dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // Log Image Lambda
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      entry: "lambdas/processImage.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });
    logImageFn.addEventSource(new events.SqsEventSource(imageUploadQueue));
    imageTable.grantWriteData(logImageFn);
    logImageFn.addEnvironment("IMAGE_TABLE_NAME", imageTable.tableName);

    // Add Metadata Lambda
    const addMetadataFn = new lambdanode.NodejsFunction(this, "AddMetadataFn", {
      entry: "lambdas/addMetadata.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });
    imageTable.grantWriteData(addMetadataFn);
    addMetadataFn.addEnvironment("IMAGE_TABLE_NAME", imageTable.tableName);

    // Add Metadata Lambda 只接收带有 Caption、Date、name 属性的消息
    imageEventsTopic.addSubscription(
      new subs.LambdaSubscription(addMetadataFn, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.stringFilter({
            allowlist: ["Caption", "Date", "name"],
          }),
        },
      })
    );

    // Remove Image Lambda
    const removeImageFn = new lambdanode.NodejsFunction(this, "RemoveImageFn", {
      entry: "lambdas/removeImage.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });
    removeImageFn.addEventSource(new events.SqsEventSource(imageUploadDLQ));
    imagesBucket.grantDelete(removeImageFn);

    // Update Status Lambda 只接收无属性的审核消息
    const updateStatusFn = new lambdanode.NodejsFunction(this, "UpdateStatusFn", {
      entry: "lambdas/updateStatus.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        IMAGE_TABLE_NAME: imageTable.tableName,
      },
    });
    imageTable.grantWriteData(updateStatusFn);
    updateStatusFn.addEnvironment("IMAGE_TABLE_NAME", imageTable.tableName);
    imageEventsTopic.addSubscription(
      new subs.LambdaSubscription(updateStatusFn, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.existsFilter(),
        },
      })
    );

    // 创建 Status Update Mailer Lambda
    const statusUpdateMailerFn = new lambdanode.NodejsFunction(this, "StatusUpdateMailerFn", {
      entry: "lambdas/statusUpdateMailer.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        IMAGE_TABLE_NAME: imageTable.tableName,
        SES_FROM_ADDRESS: "20108795@mail.wit.ie", // 已验证邮箱
      },
    });

    // 赋予 Lambda 读取表和 SES 发送邮件权限
    imageTable.grantReadData(statusUpdateMailerFn);
    statusUpdateMailerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"]
    }));

    // 配置 DynamoDB Stream 触发 Lambda
    statusUpdateMailerFn.addEventSource(
      new events.DynamoEventSource(imageTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 5,
      })
    );

    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
  }
}
