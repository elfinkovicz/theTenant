const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-ce');

const ce = new CostExplorerClient({ region: process.env.REGION });

// Cache für Kosten (6 Stunden TTL)
const costCache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

async function getBillingEstimate(tenantId, month) {
  // month format: "2026-01"
  const cacheKey = `${tenantId}-${month}`;
  
  // Check cache
  if (costCache.has(cacheKey)) {
    const cached = costCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Returning cached estimate for', cacheKey);
      return cached.data;
    }
  }

  const [year, monthNum] = month.split('-');
  const startDate = `${year}-${monthNum}-01`;
  
  // Calculate end date (last day of month)
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

  console.log(`Fetching costs for tenant ${tenantId} from ${startDate} to ${endDate}`);

  try {
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'TAG',
          Key: 'BillingGroup'
        }
      ],
      Filter: {
        Tags: {
          Key: 'TenantId',
          Values: [tenantId]
        }
      }
    });

    const response = await ce.send(command);
    
    console.log('Cost Explorer response:', JSON.stringify(response, null, 2));

    // Parse response
    const costs = {
      multistream: 0,
      videohost: 0,
      domain: 0,
      crosspost: 0
    };

    if (response.ResultsByTime && response.ResultsByTime.length > 0) {
      const result = response.ResultsByTime[0];
      
      if (result.Groups && result.Groups.length > 0) {
        result.Groups.forEach(group => {
          const billingGroup = group.Keys[0];
          const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
          
          console.log(`BillingGroup: ${billingGroup}, Cost: ${cost}`);
          
          if (costs.hasOwnProperty(billingGroup)) {
            costs[billingGroup] = cost;
          }
        });
      }
    }

    // Calculate total
    const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
    const baseFee = 20.00;
    const estimatedTotal = baseFee + totalCost;

    const estimate = {
      month,
      baseFee,
      breakdown: {
        multistream: {
          label: 'Multistreaming',
          cost: parseFloat(costs.multistream.toFixed(2)),
          usage: 'N/A'
        },
        videohost: {
          label: 'Videohosting',
          cost: parseFloat(costs.videohost.toFixed(2)),
          usage: 'N/A'
        },
        domain: {
          label: 'Domain',
          cost: parseFloat(costs.domain.toFixed(2)),
          usage: 'N/A'
        },
        crosspost: {
          label: 'Crossposting',
          cost: parseFloat(costs.crosspost.toFixed(2)),
          usage: 'N/A'
        }
      },
      estimatedTotal: parseFloat(estimatedTotal.toFixed(2)),
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    costCache.set(cacheKey, {
      data: estimate,
      timestamp: Date.now()
    });

    console.log('Estimate calculated:', JSON.stringify(estimate, null, 2));
    return estimate;

  } catch (error) {
    console.error('Error fetching costs from Cost Explorer:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Return default estimate on error
    return {
      month,
      baseFee: 30.00,
      breakdown: {
        multistream: { label: 'Multistreaming', cost: 0, usage: 'N/A' },
        videohost: { label: 'Videohosting', cost: 0, usage: 'N/A' },
        domain: { label: 'Domain', cost: 0, usage: 'N/A' },
        crosspost: { label: 'Crossposting', cost: 0, usage: 'N/A' }
      },
      estimatedTotal: 30.00,
      lastUpdated: new Date().toISOString(),
      error: error.message
    };
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const { tenantId } = event.pathParameters || {};
    const { month } = event.queryStringParameters || {};
    
    if (!tenantId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'tenantId is required' })
      };
    }

    // Default to current month
    let currentMonth = month;
    if (!currentMonth) {
      const now = new Date();
      const year = now.getFullYear();
      const monthNum = String(now.getMonth() + 1).padStart(2, '0');
      currentMonth = `${year}-${monthNum}`;
    }

    const estimate = await getBillingEstimate(tenantId, currentMonth);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(estimate)
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
