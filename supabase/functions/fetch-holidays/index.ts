import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, country } = await req.json();

    if (!year || !country) {
      return new Response(JSON.stringify({ error: "Missing 'year' or 'country' in request body." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const CALENDARIFIC_API_KEY = Deno.env.get("CALENDARIFIC_API_KEY");
    if (!CALENDARIFIC_API_KEY) {
      return new Response(JSON.stringify({ error: "CALENDARIFIC_API_KEY is not set in Supabase secrets." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const url = `https://calendarific.com/api/v2/holidays?api_key=${CALENDARIFIC_API_KEY}&country=${country}&year=${year}`;
    console.log(`Fetching holidays from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Calendarific API error: ${response.status} - ${errorText}`);
      return new Response(JSON.stringify({ error: `Failed to fetch holidays from Calendarific API: ${response.status} ${errorText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    const data = await response.json();
    console.log("Calendarific API response received.");

    // Initialize Supabase client for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key for server-side operations
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const holidaysToUpsert = data.response.holidays.map((holiday: any) => ({
      name: holiday.name,
      holiday_date: holiday.date.iso,
      display_order: 0, // Default display order
    }));

    if (holidaysToUpsert.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('islamic_holidays')
        .upsert(holidaysToUpsert, { onConflict: 'holiday_date,name' }); // Upsert based on date and name to avoid duplicates

      if (upsertError) {
        console.error("Error upserting holidays to Supabase:", upsertError);
        return new Response(JSON.stringify({ error: `Failed to save holidays to database: ${upsertError.message}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      console.log(`Successfully upserted ${holidaysToUpsert.length} holidays.`);
    } else {
      console.log("No holidays to upsert.");
    }

    return new Response(JSON.stringify({ message: "Holidays fetched and saved successfully!", count: holidaysToUpsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in fetch-holidays Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});