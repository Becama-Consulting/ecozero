import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentUrl } = await req.json();
    
    if (!documentUrl) {
      return new Response(
        JSON.stringify({ error: 'documentUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Llamar a Lovable AI para validar el documento
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en detección de documentos médicos fraudulentos.
Analiza el documento proporcionado y determina si es auténtico o ha sido manipulado.
Busca señales de edición digital, inconsistencias en formato, fechas sospechosas, etc.

Responde SOLO con un objeto JSON con esta estructura exacta:
{
  "isFake": boolean,
  "confidence": number (0-100),
  "reasons": ["motivo 1", "motivo 2"],
  "recommendation": "texto breve"
}`
          },
          {
            role: 'user',
            content: `Analiza este documento médico y determina si es auténtico: ${documentUrl}

IMPORTANTE: Responde SOLO con el JSON solicitado, sin texto adicional.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "validate_document",
              description: "Validar autenticidad de documento médico",
              parameters: {
                type: "object",
                properties: {
                  isFake: {
                    type: "boolean",
                    description: "true si el documento parece falso o manipulado"
                  },
                  confidence: {
                    type: "number",
                    description: "Nivel de confianza de la detección (0-100)"
                  },
                  reasons: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de motivos que indican si es falso"
                  },
                  recommendation: {
                    type: "string",
                    description: "Recomendación breve sobre qué hacer"
                  }
                },
                required: ["isFake", "confidence", "reasons", "recommendation"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "validate_document" } }
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: 'AI credits depleted. Please add funds to continue.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI validation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData));

    // Extraer el resultado de la tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call in response');
      return new Response(
        JSON.stringify({ error: 'Invalid AI response format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(validation),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-document-ia:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
