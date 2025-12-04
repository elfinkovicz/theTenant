const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET_NAME;
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const ADMIN_GROUP = process.env.ADMIN_GROUP_NAME || 'admins';

// Helper: Check if user is admin
function isAdmin(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
  
  if (!claims) return false;
  
  let groups = claims['cognito:groups'];
  if (!groups) return false;
  
  if (typeof groups === 'string') {
    if (groups.startsWith('[') && groups.endsWith(']')) {
      groups = groups.slice(1, -1).split(',').map(g => g.trim());
    } else {
      groups = [groups];
    }
  }
  
  return groups.includes(ADMIN_GROUP);
}

// Helper: CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
}

// Helper: Response
function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Request Context:', JSON.stringify(event.requestContext, null, 2));

  const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || event.requestContext?.routeKey?.split(' ')[0];
  const path = event.requestContext?.http?.path || event.path || event.requestContext?.path || event.rawPath || event.requestContext?.resourcePath;
  
  console.log('Detected method:', method);
  console.log('Detected path:', path);

  // Handle OPTIONS
  if (method === 'OPTIONS') {
    return response(200, {});
  }

  try {
    // GET /products - List all products (public)
    if (method === 'GET' && path === '/products') {
      const result = await docClient.send(new ScanCommand({
        TableName: PRODUCTS_TABLE
      }));

      const products = (result.Items || []).map(product => ({
        ...product,
        imageUrl: product.imageKey ? `https://${CDN_DOMAIN}/${product.imageKey}` : null
      }));

      return response(200, { products });
    }

    // GET /products/{productId} - Get single product (public)
    if (method === 'GET' && path.startsWith('/products/')) {
      const productId = path.split('/')[2];

      const result = await docClient.send(new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId }
      }));

      if (!result.Item) {
        return response(404, { error: 'Product not found' });
      }

      const product = {
        ...result.Item,
        imageUrl: result.Item.imageKey ? `https://${CDN_DOMAIN}/${result.Item.imageKey}` : null
      };

      return response(200, { product });
    }

    // All other routes require admin authentication
    if (!isAdmin(event)) {
      return response(403, { error: 'Admin access required' });
    }

    // POST /products - Create new product
    if (method === 'POST' && path === '/products') {
      const body = JSON.parse(event.body);
      const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const product = {
        productId,
        name: body.name,
        description: body.description || '',
        price: parseFloat(body.price) || 0,
        imageKey: body.imageKey || null,
        externalLink: body.externalLink || null,
        category: body.category || 'general',
        stock: parseInt(body.stock) || 0,
        featured: body.featured || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: PRODUCTS_TABLE,
        Item: product
      }));

      return response(201, { product });
    }

    // PUT /products/{productId} - Update product
    if (method === 'PUT' && path.startsWith('/products/')) {
      const productId = path.split('/')[2];
      const body = JSON.parse(event.body);

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      if (body.name !== undefined) {
        updateExpression.push('#name = :name');
        expressionAttributeNames['#name'] = 'name';
        expressionAttributeValues[':name'] = body.name;
      }
      if (body.description !== undefined) {
        updateExpression.push('description = :description');
        expressionAttributeValues[':description'] = body.description;
      }
      if (body.price !== undefined) {
        updateExpression.push('price = :price');
        expressionAttributeValues[':price'] = parseFloat(body.price);
      }
      if (body.imageKey !== undefined) {
        updateExpression.push('imageKey = :imageKey');
        expressionAttributeValues[':imageKey'] = body.imageKey;
      }
      if (body.externalLink !== undefined) {
        updateExpression.push('externalLink = :externalLink');
        expressionAttributeValues[':externalLink'] = body.externalLink;
      }
      if (body.category !== undefined) {
        updateExpression.push('category = :category');
        expressionAttributeValues[':category'] = body.category;
      }
      if (body.stock !== undefined) {
        updateExpression.push('stock = :stock');
        expressionAttributeValues[':stock'] = parseInt(body.stock);
      }
      if (body.featured !== undefined) {
        updateExpression.push('featured = :featured');
        expressionAttributeValues[':featured'] = body.featured;
      }

      updateExpression.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      return response(200, { message: 'Product updated' });
    }

    // DELETE /products/{productId} - Delete product
    if (method === 'DELETE' && path.startsWith('/products/')) {
      const productId = path.split('/')[2];

      // Get product to delete image
      const result = await docClient.send(new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId }
      }));

      if (result.Item && result.Item.imageKey) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: IMAGES_BUCKET,
          Key: result.Item.imageKey
        }));
      }

      await docClient.send(new DeleteCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId }
      }));

      return response(200, { message: 'Product deleted' });
    }

    // POST /products/upload-url - Generate presigned URL for image upload
    if (method === 'POST' && path === '/products/upload-url') {
      const body = JSON.parse(event.body);
      const { fileName, fileType } = body;

      const imageKey = `products/${Date.now()}_${fileName}`;
      const command = new PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: imageKey,
        ContentType: fileType
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return response(200, {
        uploadUrl,
        imageKey,
        imageUrl: `https://${CDN_DOMAIN}/${imageKey}`
      });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
};
