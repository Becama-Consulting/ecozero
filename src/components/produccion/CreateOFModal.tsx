import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CreateOFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProductionLine {
  id: string;
  name: string;
}

export const CreateOFModal = ({ isOpen, onClose, onSuccess }: CreateOFModalProps) => {
  const { user } = useAuth();
  const [customer, setCustomer] = useState('');
  const [lineId, setLineId] = useState('');
  const [priority, setPriority] = useState(0);
  const [sapId, setSapId] = useState('');
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<ProductionLine[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchLines();
    }
  }, [isOpen]);

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
    
    if (!user) {
      toast.error('Debes estar autenticado');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('fabrication_orders')
        .insert({
          customer,
          line_id: lineId || null,
          priority,
          sap_id: sapId || null,
          status: 'pendiente',
          supervisor_id: user.id,
        });

      if (error) throw error;

      toast.success('OF creada exitosamente');
      
      // Reset form
      setCustomer('');
      setLineId('');
      setPriority(0);
      setSapId('');
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating OF:', error);
      toast.error('Error al crear OF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Orden de Fabricación</DialogTitle>
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
            />
          </div>
          
          <div>
            <Label htmlFor="line">Línea de Producción</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar línea (opcional)" />
              </SelectTrigger>
              <SelectContent>
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
            <Label htmlFor="sapId">SAP ID (opcional)</Label>
            <Input
              id="sapId"
              value={sapId}
              onChange={(e) => setSapId(e.target.value)}
              placeholder="Dejar vacío para autoincremental"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear OF'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
