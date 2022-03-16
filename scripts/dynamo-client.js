const { DynamoDB } = require('@aws-sdk/client-dynamodb');

require('dotenv').config();

const dynamoDB = new DynamoDB({
  endpoint: process.env.DYNAMODB_LOCALHOST,
  tls: false,
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listTables() {
  const result = await dynamoDB.listTables({});
  console.log(result);
}

listTables();
