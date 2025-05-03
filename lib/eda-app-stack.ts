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

    // SNS Topic 订阅 SQS 队列，设置过滤策略
    imageEventsTopic.addSubscription(
      new subs.SqsSubscription(imageUploadQueue, {
        filterPolicy: {
          suffix: sns.SubscriptionFilter.stringFilter({
            allowlist: ['.jpeg', '.png'],
          }),
        },
        rawMessageDelivery: true,
      })
    );

    // Add Metadata Lambda
    const addMetadataFn = new lambdanode.NodejsFunction(this, "AddMetadataFn", {
      entry: "lambdas/addMetadata.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });

    // SNS Topic 订阅 Add Metadata Lambda，设置过滤策略
    imageEventsTopic.addSubscription(
      new subs.LambdaSubscription(addMetadataFn, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.stringFilter({
            allowlist: ["Caption", "Date", "name"],
          }),
        },
      })
    );

    // Log Image Lambda
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      entry: "lambdas/logImage.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });

    // SQS 队列触发 Log Image Lambda
    logImageFn.addEventSource(new events.SqsEventSource(imageUploadQueue));

    // Remove Image Lambda
    const removeImageFn = new lambdanode.NodejsFunction(this, "RemoveImageFn", {
      entry: "lambdas/removeImage.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });

    // DLQ 触发 Remove Image Lambda
    removeImageFn.addEventSource(new events.SqsEventSource(imageUploadDLQ));

    // 创建 DynamoDB 表，开启 Stream
    const imageTable = new dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // 赋予 Lambda 写表权限，并传递表名环境变量
    imageTable.grantWriteData(logImageFn);
    logImageFn.addEnvironment("IMAGE_TABLE_NAME", imageTable.tableName);
    imageTable.grantWriteData(addMetadataFn);
    addMetadataFn.addEnvironment("IMAGE_TABLE_NAME", imageTable.tableName);

    // 创建 Status Update Mailer Lambda
    const statusUpdateMailerFn = new lambdanode.NodejsFunction(this, "StatusUpdateMailerFn", {
      entry: "lambdas/statusUpdateMailer.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        IMAGE_TABLE_NAME: imageTable.tableName,
        SES_FROM_ADDRESS: "your-verified-sender@example.com", // 替换为已验证的 SES 邮箱
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
