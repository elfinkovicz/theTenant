// AWS Configuration - wird von Terraform generiert
export const awsConfig = {
  region: 'eu-central-1',
  
  cognito: {
    userPoolId: 'TERRAFORM_OUTPUT_USER_POOL_ID',
    clientId: 'TERRAFORM_OUTPUT_CLIENT_ID',
    identityPoolId: 'TERRAFORM_OUTPUT_IDENTITY_POOL_ID'
  },
  
  ivs: {
    channelArn: 'TERRAFORM_OUTPUT_CHANNEL_ARN',
    playbackUrl: 'TERRAFORM_OUTPUT_PLAYBACK_URL',
    chatRoomArn: 'TERRAFORM_OUTPUT_CHAT_ROOM_ARN'
  },
  
  api: {
    baseUrl: 'TERRAFORM_OUTPUT_API_GATEWAY_URL',
    endpoints: {
      auth: '/auth',
      chat: '/chat',
      shop: '/shop',
      events: '/events',
      sponsors: '/sponsors',
      contact: '/contact'
    }
  },
  
  s3: {
    bucketName: 'TERRAFORM_OUTPUT_BUCKET_NAME',
    cloudFrontUrl: 'TERRAFORM_OUTPUT_CLOUDFRONT_URL'
  }
}
