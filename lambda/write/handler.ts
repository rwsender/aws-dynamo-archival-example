import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

export const handler: any = async () => {
  const dynamoDbClient = new DynamoDBClient();

  const expirationTime = Math.floor(Date.now() / 1000) + 3600; // Set expiration time to 1 hour from current time

  const params = {
    TableName: 'dynamodb-archival-poc',
    Item: {
      id: { S: uuidv4() },
      name: { S: 'item' },
      expirationTime: { N: expirationTime.toString() },
    },
  };

  const command = new PutItemCommand(params);

  try {
    await dynamoDbClient.send(command);
    console.log('Item successfully added to DynamoDB table');
  } catch (error) {
    console.error('Error adding item to DynamoDB table:', error);
    throw new Error('Error adding item to DynamoDB table');
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'success' }),
  };
};
