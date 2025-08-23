import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// BigQuery REST API endpoint
const BIGQUERY_API_BASE = 'https://bigquery.googleapis.com/bigquery/v2'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get credentials from Supabase environment variables
    const projectId = Deno.env.get('GCS_PROJECT_ID');
    const clientEmail = Deno.env.get('GCS_CLIENT_EMAIL');
    const privateKey = Deno.env.get('GCS_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing credentials:', { 
        hasProjectId: !!projectId, 
        hasClientEmail: !!clientEmail, 
        hasPrivateKey: !!privateKey 
      });
      throw new Error('Missing required GCS credentials in environment variables');
    }

    // Get access token using service account
    const accessToken = await getAccessToken(clientEmail, privateKey);
    
    // Get request body for filters
    const body = await req.json().catch(() => ({}));
    const { limit = 100, recent = false, team, category, impact } = body;
    
    // Build the query based on filters
    let query = `
      SELECT 
        team_name,
        first_player_rank_out_injury,
        next_player_rank_available,
        category
      FROM \`${projectId}.bi.injury_insights\`
    `;

    const whereConditions = [];
    
    if (team) {
      whereConditions.push(`team_name = '${team}'`);
    }
    
    if (category) {
      whereConditions.push(`category = '${category}'`);
    }
    
    // Note: impact filter removed since impact_level field doesn't exist
    // if (impact) {
    //   whereConditions.push(`impact_level = '${impact}'`);
    // }
    
    // Note: recent filter removed since created_at field doesn't exist
    // if (recent) {
    //   whereConditions.push(`created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)`);
    // }
    
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Order by team_name since created_at doesn't exist
    query += ` ORDER BY team_name ASC LIMIT ${limit}`;

    console.log('Executing BigQuery query:', query);

    const queryResponse = await fetch(`${BIGQUERY_API_BASE}/projects/${projectId}/queries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        useLegacySql: false,
      }),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('BigQuery API error:', errorText);
      throw new Error(`BigQuery API error: ${queryResponse.status} - ${errorText}`);
    }

    const queryResult = await queryResponse.json();
    
    if (queryResult.error) {
      console.error('BigQuery query error:', queryResult.error);
      throw new Error(`BigQuery query error: ${queryResult.error.message}`);
    }

    // Extract rows from the response
    const rows = queryResult.rows || [];
    const schema = queryResult.schema?.fields || [];

    console.log(`BigQuery returned ${rows.length} rows`);

    // Transform the data for frontend consumption
    const transformedData = rows.map((row: any) => {
      const values = row.f || [];
      const rowData: any = {};
      
      // Map schema fields to values
      schema.forEach((field: any, index: number) => {
        rowData[field.name] = values[index]?.v || null;
      });

      return {
        id: `${rowData.team_name}-${rowData.first_player_rank_out_injury}-${rowData.category}`,
        teamName: rowData.team_name,
        injuredPlayer: rowData.first_player_rank_out_injury,
        nextPlayer: rowData.next_player_rank_available,
        category: rowData.category,
        // Generate default values for missing fields
        createdAt: new Date().toISOString(),
        impact: calculateImpact(rowData.category),
        opportunity: {
          description: `Injury creates opportunity for ${rowData.next_player_rank_available} in ${rowData.category}`,
          confidence: 75.0,
          edge: 5.0,
        },
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: transformedData,
        count: transformedData.length,
        timestamp: new Date().toISOString(),
        message: `Successfully fetched ${transformedData.length} injury insights from BigQuery`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in injury insights function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        details: error.stack || 'No stack trace available'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Helper function to calculate impact based on category
function calculateImpact(category: string): 'high' | 'medium' | 'low' {
  switch (category.toLowerCase()) {
    case 'points':
      return 'high'
    case 'rebounds':
      return 'medium'
    case 'assists':
      return 'medium'
    default:
      return 'low'
  }
}

// Get access token using service account credentials
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  try {
    // Create JWT assertion
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/bigquery',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now,
    };

    // Create JWT using the djwt library
    const key = await importPKCS8(privateKey);
    const jwt = await create(header, payload, key);

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      throw new Error(`Failed to get access token: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully obtained access token');
    return tokenData.access_token;

  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error(`Failed to authenticate with Google: ${error.message}`);
  }
}

// Import PKCS8 private key
async function importPKCS8(privateKeyPem: string): Promise<CryptoKey> {
  try {
    // Clean up the private key (remove headers, footers, and format properly)
    const cleanPrivateKey = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '')
      .replace(/\\n/g, '\n');

    // Convert base64 to ArrayBuffer
    const binaryString = atob(cleanPrivateKey);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import the private key
    const key = await crypto.subtle.importKey(
      'pkcs8',
      bytes,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );
    
    return key;

  } catch (error) {
    console.error('Error importing private key:', error);
    throw new Error(`Failed to import private key: ${error.message}`);
  }
}
