import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();

    if (!fileUrl) {
      throw new Error('fileUrl is required');
    }

    // 1. Descargar PDF
    console.log('Downloading PDF:', fileUrl);
    const pdfResponse = await fetch(fileUrl);
    
    if (!pdfResponse.ok) {
      throw new Error('Failed to download PDF');
    }

    const buffer = await pdfResponse.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    // 2. Extraer datos con OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.warn('OPENAI_API_KEY not configured, returning mock data');
      // Retornar datos mock si no hay API key
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            agency: "Mock Agency",
            invoiceNumber: "MOCK-001",
            date: new Date().toISOString().split('T')[0],
            periodStart: new Date().toISOString().split('T')[0],
            periodEnd: new Date().toISOString().split('T')[0],
            employees: [],
            total: 0,
            subtotal: 0,
            iva: 0,
            extractedAt: new Date().toISOString(),
            mock: true
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    console.log('Extracting data with OpenAI...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: `Extrae TODOS los datos de esta factura de agencia ETT (Faster, Randstad, etc.).

IMPORTANTE: Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:

{
  "agency": "string (nombre agencia)",
  "invoiceNumber": "string",
  "date": "YYYY-MM-DD",
  "periodStart": "YYYY-MM-DD",
  "periodEnd": "YYYY-MM-DD",
  "employees": [
    {
      "name": "string",
      "hours": number,
      "hourlyRate": number,
      "amount": number
    }
  ],
  "total": number,
  "subtotal": number,
  "iva": number
}

Si algún campo no está disponible, usa null. Asegúrate de que hours, hourlyRate, amount, total sean números, no strings.` 
            },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:application/pdf;base64,${base64}`,
                detail: 'high'
              } 
            }
          ]
        }],
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error('OpenAI API request failed');
    }

    const openaiResult = await openaiResponse.json();
    console.log('OpenAI response:', openaiResult);

    // 3. Parsear resultado
    const content = openaiResult.choices[0].message.content;
    
    // Extraer JSON limpio
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    // 4. Validar estructura
    if (!extractedData.invoiceNumber || !extractedData.total) {
      throw new Error('Invalid extracted data: missing required fields');
    }

    // 5. Retornar datos
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...extractedData,
          extractedAt: new Date().toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
