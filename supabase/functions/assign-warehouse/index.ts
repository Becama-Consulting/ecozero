import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssignmentRequest {
  of_id: string;
  material_type?: string;
  priority?: number;
  estimated_hours?: number;
}

interface ProductionLine {
  id: string;
  name: string;
  capacity: number;
  status: string;
  current_occupancy?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { of_id, material_type, priority = 0, estimated_hours = 4 } = await req.json() as AssignmentRequest;

    console.log('Asignación solicitada para OF:', of_id);

    // Obtener líneas de producción activas (naves)
    const { data: lines, error: linesError } = await supabaseClient
      .from('production_lines')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (linesError) {
      console.error('Error obteniendo líneas:', linesError);
      throw linesError;
    }

    if (!lines || lines.length === 0) {
      throw new Error('No hay naves disponibles');
    }

    // Calcular ocupación actual de cada nave
    const linesWithOccupancy: ProductionLine[] = [];
    
    for (const line of lines) {
      const { count, error: countError } = await supabaseClient
        .from('fabrication_orders')
        .select('*', { count: 'exact', head: true })
        .eq('line_id', line.id)
        .in('status', ['pendiente', 'en_proceso']);

      if (countError) {
        console.error('Error contando OFs:', countError);
      }

      linesWithOccupancy.push({
        ...line,
        current_occupancy: count || 0,
      });
    }

    console.log('Naves con ocupación:', linesWithOccupancy);

    // Algoritmo de asignación inteligente
    // 1. Filtrar naves con capacidad disponible
    const availableLines = linesWithOccupancy.filter(
      (line) => (line.current_occupancy || 0) < line.capacity
    );

    if (availableLines.length === 0) {
      console.warn('No hay capacidad disponible en ninguna nave');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No hay capacidad disponible en ninguna nave',
          bottleneck: true,
          lines: linesWithOccupancy,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // 2. Calcular score para cada nave disponible
    const scoredLines = availableLines.map((line) => {
      const occupancyRate = (line.current_occupancy || 0) / line.capacity;
      const availableCapacity = line.capacity - (line.current_occupancy || 0);
      
      // Score basado en:
      // - Capacidad disponible (más capacidad = mejor)
      // - Tasa de ocupación (balancear carga)
      // - Prioridad de la orden
      const capacityScore = availableCapacity * 10;
      const balanceScore = (1 - occupancyRate) * 5;
      const priorityBonus = priority * 2;
      
      const totalScore = capacityScore + balanceScore + priorityBonus;

      return {
        ...line,
        score: totalScore,
        occupancy_rate: occupancyRate,
        available_capacity: availableCapacity,
      };
    });

    // 3. Ordenar por score y seleccionar la mejor nave
    scoredLines.sort((a, b) => b.score - a.score);
    const selectedLine = scoredLines[0];

    console.log('Nave seleccionada:', selectedLine.name, 'Score:', selectedLine.score);

    // 4. Asignar la OF a la nave seleccionada
    const { error: updateError } = await supabaseClient
      .from('fabrication_orders')
      .update({ 
        line_id: selectedLine.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', of_id);

    if (updateError) {
      console.error('Error asignando OF a nave:', updateError);
      throw updateError;
    }

    // 5. Verificar si alguna nave está cerca del límite de capacidad (>80%)
    const alerts = linesWithOccupancy
      .filter((line) => {
        const occupancy = line.id === selectedLine.id 
          ? (line.current_occupancy || 0) + 1 
          : (line.current_occupancy || 0);
        return (occupancy / line.capacity) > 0.8;
      })
      .map((line) => ({
        warehouse: line.name,
        occupancy: line.id === selectedLine.id 
          ? (line.current_occupancy || 0) + 1 
          : (line.current_occupancy || 0),
        capacity: line.capacity,
        rate: ((line.id === selectedLine.id 
          ? (line.current_occupancy || 0) + 1 
          : (line.current_occupancy || 0)) / line.capacity * 100).toFixed(1),
      }));

    // Crear alerta si hay saturación
    if (alerts.length > 0) {
      for (const alert of alerts) {
        await supabaseClient
          .from('alerts')
          .insert({
            type: 'saturacion_nave',
            severity: alert.rate >= '90' ? 'critical' : 'warning',
            message: `${alert.warehouse} está al ${alert.rate}% de capacidad (${alert.occupancy}/${alert.capacity})`,
            related_of_id: of_id,
          });
      }
    }

    console.log('Asignación completada exitosamente');

    return new Response(
      JSON.stringify({
        success: true,
        assigned_warehouse: {
          id: selectedLine.id,
          name: selectedLine.name,
          occupancy: selectedLine.current_occupancy,
          capacity: selectedLine.capacity,
          score: selectedLine.score,
        },
        all_warehouses: linesWithOccupancy.map(line => ({
          id: line.id,
          name: line.name,
          occupancy: line.id === selectedLine.id 
            ? (line.current_occupancy || 0) + 1 
            : (line.current_occupancy || 0),
          capacity: line.capacity,
          occupancy_rate: ((line.id === selectedLine.id 
            ? (line.current_occupancy || 0) + 1 
            : (line.current_occupancy || 0)) / line.capacity * 100).toFixed(1),
        })),
        alerts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en assign-warehouse:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
