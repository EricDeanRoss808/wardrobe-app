const AWS = require('aws-sdk');

exports.handler = async (event) => {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Route: GET /wardrobe - fetch user's wardrobe items
    if (path === '/wardrobe' && method === 'GET') {
      return respond(200, { message: 'Get wardrobe - TODO' });
    }

    // Route: POST /wardrobe - add a wardrobe item
    if (path === '/wardrobe' && method === 'POST') {
      return respond(200, { message: 'Add wardrobe item - TODO' });
    }

    // Route: POST /wardrobe/presign - get pre-signed S3 upload URL
    if (path === '/wardrobe/presign' && method === 'POST') {
      const s3 = new AWS.S3();
      const { fileName, fileType } = JSON.parse(event.body);
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `uploads/${Date.now()}-${fileName}`,
        ContentType: fileType,
        Expires: 300
      };
      const url = await s3.getSignedUrlPromise('putObject', params);
      return respond(200, { uploadUrl: url, key: params.Key });
    }

    // Route: POST /outfits - outfit generation (Hours 17-22 team fills this in)
    if (path === '/outfits' && method === 'POST') {
      return respond(200, { message: 'Outfit generation - TODO' });
    }

    // Route: POST /swipe - save swipe result (Hours 11-16 team fills this in)
    if (path === '/swipe' && method === 'POST') {
      return respond(200, { message: 'Swipe recorded - TODO' });
    }

    // Route: GET /swipe - get swipe feed (Hours 11-16 team fills this in)
    if (path === '/swipe' && method === 'GET') {
      return respond(200, { message: 'Get swipe feed - TODO' });
    }

    return respond(404, { error: 'Route not found' });

  } catch (err) {
    console.error(err);
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