/**
 * CloudFront Function for Custom Domain Tenant Routing
 * 
 * This function runs on viewer-request and modifies the request
 * to include the correct tenant subdomain in a custom header.
 * 
 * For standupnow.ch -> sets X-Tenant-Subdomain: standupnow
 * 
 * The frontend then uses this header to determine the tenant.
 */

// Domain to tenant subdomain mapping
const DOMAIN_MAPPING = {
  'standupnow.ch': 'standupnow',
  'www.standupnow.ch': 'standupnow'
};

function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : '';
  
  // Check if this is a custom domain
  var tenantSubdomain = DOMAIN_MAPPING[host.toLowerCase()];
  
  if (tenantSubdomain) {
    // Add custom header with tenant subdomain
    request.headers['x-tenant-subdomain'] = { value: tenantSubdomain };
    
    // Also add the resolved tenant ID for standupnow
    // This ensures the frontend gets the correct tenant immediately
    if (tenantSubdomain === 'standupnow') {
      request.headers['x-tenant-id'] = { value: 'ab5b624a-0707-48d4-bafb-e59f3276aece' };
    }
  }
  
  return request;
}
