import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ERPOrder {
  sap_id: string;
  customer: string;
  priority: number;
  estimated_hours: number;
  delivery_date: string;
  materials_check: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { source = 'manual', orders: manualOrders } = await req.json();

    console.log(`📥 Importing orders from source: ${source}`);

    let ordersToImport: ERPOrder[] = [];

    if (source === 'manual' && manualOrders) {
      // Importación manual desde JSON
      ordersToImport = manualOrders;
      console.log(`📋 Manual import: ${ordersToImport.length} orders`);
    } else if (source === 'sap') {
      // Integración con SAP (simulada)
      // En producción, aquí iría la llamada real a SAP API
      console.log('🔄 Connecting to SAP API...');
      
      // SIMULACIÓN: Generar pedidos de ejemplo
      ordersToImport = [
        {
          sap_id: `SAP-${Date.now()}-001`,
          customer: 'Cliente Demo A',
          priority: 8,
          estimated_hours: 12,
          delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          materials_check: true
        },
        {
          sap_id: `SAP-${Date.now()}-002`,
          customer: 'Cliente Demo B',
          priority: 5,
          estimated_hours: 8,
          delivery_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          materials_check: false
        },
        {
          sap_id: `SAP-${Date.now()}-003`,
          customer: 'Cliente Demo C',
          priority: 9,
          estimated_hours: 16,
          delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          materials_check: true
        }
      ];

      console.log(`✅ SAP simulation: ${ordersToImport.length} orders fetched`);
    } else {
      throw new Error('Invalid source. Use "manual" or "sap"');
    }

    // Validar pedidos
    const validOrders = ordersToImport.filter(order => {
      const isValid = order.customer && 
                     order.priority !== undefined && 
                     order.estimated_hours > 0;
      
      if (!isValid) {
        console.warn(`⚠️ Invalid order skipped:`, order);
      }
      return isValid;
    });

    // Verificar duplicados en BD
    const existingSapIds = validOrders
      .filter(o => o.sap_id)
      .map(o => o.sap_id);

    const { data: existingOFs } = await supabase
      .from('fabrication_orders')
      .select('sap_id')
      .in('sap_id', existingSapIds);

    const existingSet = new Set(existingOFs?.map(of => of.sap_id));

    const newOrders = validOrders.filter(order => 
      !order.sap_id || !existingSet.has(order.sap_id)
    );

    console.log(`📊 Orders to import: ${newOrders.length}/${validOrders.length} (${validOrders.length - newOrders.length} duplicates skipped)`);

    // Preparar datos enriquecidos
    const enrichedOrders = newOrders.map(order => ({
      id: crypto.randomUUID(),
      customer: order.customer,
      priority: order.priority,
      sap_id: order.sap_id || null,
      estimated_hours: order.estimated_hours,
      delivery_date: order.delivery_date,
      materials_available: order.materials_check || false,
      required_capacity: 1 // Simplificado, en producción esto vendría del ERP
    }));

    return new Response(
      JSON.stringify({
        success: true,
        imported: enrichedOrders.length,
        skipped: validOrders.length - newOrders.length,
        total: ordersToImport.length,
        orders: enrichedOrders,
        message: `Imported ${enrichedOrders.length} orders successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in import-orders:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
