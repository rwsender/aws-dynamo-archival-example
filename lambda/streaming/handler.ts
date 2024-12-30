import { KinesisStreamHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const handler: KinesisStreamHandler = async (event) => {
  const s3Client = new S3Client();

  const bucketName = process.env.BUCKET_NAME;

  if (!bucketName) {
    throw new Error('Bucket name environment variable not set');
  }

  try {
    const records = event.Records;
    console.log(JSON.stringify(records));

    const promises = records.map(async (record: any) => {
      // Write the record to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: `record-${record.dynamodb?.OldImage.id.S}`,
          Body: JSON.stringify(record.dynamodb?.OldImage),
        }),
      );
    });

    await Promise.all(promises);

    console.log('Records processed successfully');
  } catch (error) {
    console.error('Error processing records:', error);
    throw new Error('Error processing records');
  }
};
