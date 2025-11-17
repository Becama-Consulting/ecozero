import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Order {
  id: string;
  customer: string;
  priority: number;
  estimated_hours: number;
  required_capacity: number;
  sap_id?: string;
  materials_available: boolean;
}

interface ProductionLine {
  id: string;
  name: string;
  capacity: number;
  status: string;
  current_load: number;
}

interface SequenceResult {
  sequence: Array<{
    order_id: string;
    line_id: string;
    position: number;
    estimated_start: string;
    estimated_end: string;
  }>;
  conflicts: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    affected_orders: string[];
  }>;
  metrics: {
    total_orders: number;
    avg_wait_time: number;
    capacity_utilization: number;
    estimated_completion: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { orders, auto_create = false } = await req.json();

    console.log(`🔄 Sequencing ${orders?.length || 0} orders (auto_create: ${auto_create})`);

    // Obtener líneas de producción disponibles
    const { data: lines, error: linesError } = await supabase
      .from('production_lines')
      .select('*')
      .eq('status', 'active');

    if (linesError) throw linesError;

    // Obtener OFs activas para calcular carga actual
    const { data: activeOFs, error: ofsError } = await supabase
      .from('fabrication_orders')
      .select('line_id, status')
      .in('status', ['pendiente', 'en_proceso']);

    if (ofsError) throw ofsError;

    // Calcular carga actual por línea
    const lineLoad = new Map<string, number>();
    lines?.forEach(line => {
      const load = activeOFs?.filter(of => of.line_id === line.id).length || 0;
      lineLoad.set(line.id, load);
    });

    // Ordenar pedidos por prioridad (mayor prioridad primero)
    const sortedOrders = [...(orders || [])].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    const sequence: SequenceResult['sequence'] = [];
    const conflicts: SequenceResult['conflicts'] = [];
    const now = new Date();

    // Algoritmo de secuenciación greedy
    for (const order of sortedOrders) {
      // Verificar materiales
      if (!order.materials_available) {
        conflicts.push({
          type: 'MATERIALS_UNAVAILABLE',
          severity: 'critical',
          message: `Pedido ${order.customer} no tiene materiales disponibles`,
          affected_orders: [order.id]
        });
        continue;
      }

      // Buscar línea con menor carga
      let selectedLine: ProductionLine | null = null;
      let minLoad = Infinity;

      for (const line of lines || []) {
        const currentLoad = lineLoad.get(line.id) || 0;
        
        // Verificar capacidad
        if (currentLoad >= line.capacity) {
          conflicts.push({
            type: 'CAPACITY_EXCEEDED',
            severity: 'warning',
            message: `Línea ${line.name} sin capacidad disponible`,
            affected_orders: [order.id]
          });
          continue;
        }

        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          selectedLine = line;
        }
      }

      if (!selectedLine) {
        conflicts.push({
          type: 'NO_LINE_AVAILABLE',
          severity: 'critical',
          message: `No hay líneas disponibles para pedido ${order.customer}`,
          affected_orders: [order.id]
        });
        continue;
      }

      // Calcular tiempos estimados
      const position = lineLoad.get(selectedLine.id) || 0;
      const hoursOffset = position * (order.estimated_hours || 8);
      
      const estimatedStart = new Date(now.getTime() + hoursOffset * 60 * 60 * 1000);
      const estimatedEnd = new Date(
        estimatedStart.getTime() + (order.estimated_hours || 8) * 60 * 60 * 1000
      );

      sequence.push({
        order_id: order.id,
        line_id: selectedLine.id,
        position: position + 1,
        estimated_start: estimatedStart.toISOString(),
        estimated_end: estimatedEnd.toISOString()
      });

      // Actualizar carga
      lineLoad.set(selectedLine.id, position + 1);

      // Crear OF automáticamente si está habilitado
      if (auto_create) {
        const { error: createError } = await supabase
          .from('fabrication_orders')
          .insert({
            customer: order.customer,
            priority: order.priority || 0,
            line_id: selectedLine.id,
            status: 'pendiente',
            sap_id: order.sap_id
          });

        if (createError) {
          console.error('Error creating OF:', createError);
          conflicts.push({
            type: 'OF_CREATION_FAILED',
            severity: 'warning',
            message: `Error al crear OF para ${order.customer}: ${createError.message}`,
            affected_orders: [order.id]
          });
        } else {
          console.log(`✅ OF created for order ${order.id}`);
        }
      }
    }

    // Calcular métricas
    const totalOrders = orders?.length || 0;
    const successfulAssignments = sequence.length;
    const avgWaitTime = sequence.reduce((sum, item, idx) => {
      const waitHours = (new Date(item.estimated_start).getTime() - now.getTime()) 
        / (1000 * 60 * 60);
      return sum + waitHours;
    }, 0) / (successfulAssignments || 1);

    const totalCapacity = lines?.reduce((sum, line) => sum + line.capacity, 0) || 1;
    const usedCapacity = Array.from(lineLoad.values()).reduce((sum, load) => sum + load, 0);
    const capacityUtilization = (usedCapacity / totalCapacity) * 100;

    const lastEnd = sequence.length > 0 
      ? new Date(Math.max(...sequence.map(s => new Date(s.estimated_end).getTime())))
      : now;

    const result: SequenceResult = {
      sequence,
      conflicts,
      metrics: {
        total_orders: totalOrders,
        avg_wait_time: Math.round(avgWaitTime * 10) / 10,
        capacity_utilization: Math.round(capacityUtilization * 10) / 10,
        estimated_completion: lastEnd.toISOString()
      }
    };

    console.log(`✅ Sequencing complete: ${successfulAssignments}/${totalOrders} assigned`);
    console.log(`⚠️ ${conflicts.length} conflicts detected`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sequence-production:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
