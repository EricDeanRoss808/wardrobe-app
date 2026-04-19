const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const lambdaClient = new LambdaClient({});

const TABLES = {
  users: process.env.STORAGE_USERS_NAME,
  wardrobe: process.env.STORAGE_WARDROBEITEMS_NAME,
  outfits: process.env.STORAGE_OUTFITS_NAME,
  swipes: process.env.STORAGE_SWIPEHISTORY_NAME
};

const BUCKET = process.env.STORAGE_WARDROBESTORAGE_BUCKETNAME;

exports.handler = async (event) => {
  const path = event.path;
  const method = event.httpMethod;
  const userId = event.requestContext?.identity?.cognitoIdentityId || 'test-user';

  console.log(`${method} ${path}`);

  try {

    // ─── GET /wardrobe ───
    if (path === '/wardrobe' && method === 'GET') {
      const result = await dynamo.send(new QueryCommand({
        TableName: TABLES.wardrobe,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }));
      return respond(200, result.Items);
    }

    // ─── POST /wardrobe ───
    if (path === '/wardrobe' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const item = {
        userId,
        itemId: `item_${Date.now()}`,
        name: body.name,
        brand: body.brand,
        category: body.category,
        fit: body.fit,
        color: body.color,
        tags: body.tags,
        seasons: body.seasons,
        photoKey: body.photoKey || null,
        createdAt: new Date().toISOString()
      };
      await dynamo.send(new PutCommand({
        TableName: TABLES.wardrobe,
        Item: item
      }));
      return respond(200, { message: 'Item saved', item });
    }

    // ─── POST /wardrobe/presign ───
    if (path === '/wardrobe/presign' && method === 'POST') {
      const { fileName, fileType } = JSON.parse(event.body || '{}');
      const key = `uploads/${userId}/${Date.now()}-${fileName}`;
      const url = await getSignedUrl(s3, new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: fileType
      }), { expiresIn: 300 });
      return respond(200, { uploadUrl: url, key });
    }

    // ─── POST /outfits ── fire and forget ───
    if (path === '/outfits' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const targetUserId = body.userId || userId;

      // Fire async - don't wait
      await lambdaClient.send(new InvokeCommand({
        FunctionName: 'outfit-generator',
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({ userId: targetUserId }))
      }));

      return respond(200, {
        status: 'generating',
        message: 'Outfit generation started. Poll GET /outfits for results.'
      });
    }

    // ─── GET /outfits ───
    if (path === '/outfits' && method === 'GET') {
      const result = await dynamo.send(new QueryCommand({
        TableName: TABLES.outfits,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }));
      return respond(200, result.Items);
    }

    // ─── POST /swipe ───
    if (path === '/swipe' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const swipe = {
        userId,
        timestamp: new Date().toISOString(),
        itemId: body.itemId,
        direction: body.direction
      };
      await dynamo.send(new PutCommand({
        TableName: TABLES.swipes,
        Item: swipe
      }));
      return respond(200, { message: 'Swipe recorded', swipe });
    }

    // ─── GET /swipe ───
    if (path === '/swipe' && method === 'GET') {
      const result = await dynamo.send(new QueryCommand({
        TableName: TABLES.swipes,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }));
      return respond(200, result.Items);
    }

    return respond(404, { error: 'Route not found' });

  } catch (err) {
    console.error('Error:', err);
    return respond(500, { error: err.message });
  }
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  },
  body: JSON.stringify(body)
});