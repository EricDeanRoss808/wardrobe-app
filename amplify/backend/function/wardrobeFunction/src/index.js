const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

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

    // ─── GET /wardrobe ── fetch user's wardrobe items ───
    if (path === '/wardrobe' && method === 'GET') {
      const result = await dynamo.query({
        TableName: TABLES.wardrobe,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }).promise();
      return respond(200, result.Items);
    }

    // ─── POST /wardrobe ── add a wardrobe item ───
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
      await dynamo.put({
        TableName: TABLES.wardrobe,
        Item: item
      }).promise();
      return respond(200, { message: 'Item saved', item });
    }

    // ─── POST /wardrobe/presign ── get pre-signed S3 upload URL ───
    if (path === '/wardrobe/presign' && method === 'POST') {
      const { fileName, fileType } = JSON.parse(event.body || '{}');
      const key = `uploads/${userId}/${Date.now()}-${fileName}`;
      const url = await s3.getSignedUrlPromise('putObject', {
        Bucket: BUCKET,
        Key: key,
        ContentType: fileType,
        Expires: 300
      });
      return respond(200, { uploadUrl: url, key });
    }

    // ─── POST /outfits ── save generated outfit ───
    // Hours 17-22 team: add Gemini outfit generation here
    if (path === '/outfits' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const outfit = {
        userId,
        outfitId: `outfit_${Date.now()}`,
        items: body.items || [],
        occasion: body.occasion || 'casual',
        generatedAt: new Date().toISOString()
      };
      await dynamo.put({
        TableName: TABLES.outfits,
        Item: outfit
      }).promise();
      return respond(200, { message: 'Outfit saved', outfit });
    }

    // ─── GET /outfits ── fetch user's saved outfits ───
    if (path === '/outfits' && method === 'GET') {
      const result = await dynamo.query({
        TableName: TABLES.outfits,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }).promise();
      return respond(200, result.Items);
    }

    // ─── POST /swipe ── save a swipe result ───
    // Hours 11-16 team: add personalization logic here
    if (path === '/swipe' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const swipe = {
        userId,
        timestamp: new Date().toISOString(),
        itemId: body.itemId,
        direction: body.direction
      };
      await dynamo.put({
        TableName: TABLES.swipes,
        Item: swipe
      }).promise();
      return respond(200, { message: 'Swipe recorded', swipe });
    }

    // ─── GET /swipe ── get swipe history ───
    if (path === '/swipe' && method === 'GET') {
      const result = await dynamo.query({
        TableName: TABLES.swipes,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }).promise();
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