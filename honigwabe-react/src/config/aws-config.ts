export const awsConfig = {
  region: 'eu-central-1',
  
  cognito: {
    userPoolId: 'eu-central-1_51DAT0n1j',
    clientId: '622465vqjubuav4e0r4pae2q5u',
    domain: 'honigwabe-081033004511'
  },
  
  ivs: {
    playbackUrl: 'https://53e6ac09334d.eu-central-1.playback.live-video.net/api/video/v1/eu-central-1.081033004511.channel.9q8zX0NcDW2p.m3u8',
    chatRoomArn: 'arn:aws:ivschat:eu-central-1:081033004511:room/8LlFnw2JKAfJ'
  },
  
  api: {
    contactForm: 'https://q91fu5z277.execute-api.eu-central-1.amazonaws.com',
    sponsor: 'https://t1z6kdrqog.execute-api.eu-central-1.amazonaws.com/',
    shop: 'https://xd3b0v72nl.execute-api.eu-central-1.amazonaws.com/',
    user: 'https://1rhnpplzti.execute-api.eu-central-1.amazonaws.com',
    video: 'https://1rhnpplzti.execute-api.eu-central-1.amazonaws.com/videos',
    team: 'https://1rhnpplzti.execute-api.eu-central-1.amazonaws.com',
    chat: 'https://52b5ai8j61.execute-api.eu-central-1.amazonaws.com'
  },
  
  s3: {
    bucketName: 'honigwabe-website-081033004511',
    sponsorAssets: 'honigwabe-sponsor-assets-081033004511',
    productImages: 'honigwabe-product-images-081033004511'
  }
}
