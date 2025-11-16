import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface EditOFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  of: {
    id: string;
    customer: string;
    line_id: string | null;
    priority: number;
    sap_id: string | null;
  };
}

interface ProductionLine {
  id: string;
  name: string;
}

export const EditOFModal = ({ isOpen, onClose, onSuccess, of }: EditOFModalProps) => {
  const [customer, setCustomer] = useState(of.customer);
  const [lineId, setLineId] = useState(of.line_id || '');
  const [priority, setPriority] = useState(of.priority);
  const [sapId, setSapId] = useState(of.sap_id || '');
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<ProductionLine[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Reset valores al abrir
      setCustomer(of.customer);
      setLineId(of.line_id || '');
      setPriority(of.priority);
      setSapId(of.sap_id || '');
      fetchLines();
    }
  }, [isOpen, of]);

  const fetchLines = async () => {
    try {
      const { data, error } = await supabase
        .from('production_lines')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setLines(data || []);
    } catch (error) {
      console.error('Error fetching lines:', error);
      toast.error('Error al cargar líneas de producción');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!customer.trim()) {
      toast.error('El nombre del cliente es requerido');
      return;
    }

    if (priority < 0 || priority > 10) {
      toast.error('La prioridad debe estar entre 0 y 10');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('fabrication_orders')
        .update({
          customer: customer.trim(),
          line_id: lineId || null,
          priority,
          sap_id: sapId.trim() || null,
        })
        .eq('id', of.id);

      if (error) throw error;

      toast.success('OF actualizada exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating OF:', error);
      toast.error('Error al actualizar OF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Orden de Fabricación</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="customer">Cliente *</Label>
            <Input
              id="customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Nombre del cliente"
              required
              maxLength={100}
            />
          </div>
          
          <div>
            <Label htmlFor="line">Línea de Producción</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar línea (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin asignar</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Prioridad (0-10)</Label>
            <Input
              id="priority"
              type="number"
              min="0"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label htmlFor="sapId">SAP ID</Label>
            <Input
              id="sapId"
              value={sapId}
              onChange={(e) => setSapId(e.target.value)}
              placeholder="ID de SAP"
              maxLength={50}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
