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

    // 创建 SQS 队列
    const imageUploadQueue = new sqs.Queue(this, "ImageUploadQueue", {
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
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

    // Log Image Lambda
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      entry: "lambdas/logImage.ts",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
    });

    // SQS 队列触发 Log Image Lambda
    logImageFn.addEventSource(new events.SqsEventSource(imageUploadQueue));

    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
  }
}
