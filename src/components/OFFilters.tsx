import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface OFFilters {
  status?: string;
  lineId?: string;
  dateFrom?: string;
  dateTo?: string;
  customer?: string;
}

interface OFFiltersProps {
  onFilterChange: (filters: OFFilters) => void;
  lines?: Array<{ id: string; name: string }>;
}

export const OFFilters = ({ onFilterChange, lines = [] }: OFFiltersProps) => {
  const [filters, setFilters] = useState<OFFilters>({});

  const handleFilterChange = (key: keyof OFFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Filtros</h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              <X className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="status">Estado</Label>
            <Select 
              value={filters.status || ""} 
              onValueChange={(v) => handleFilterChange('status', v)}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="completada">Completada</SelectItem>
                <SelectItem value="validada">Validada</SelectItem>
                <SelectItem value="albarana">Albaranada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="line">Línea</Label>
            <Select 
              value={filters.lineId || ""} 
              onValueChange={(v) => handleFilterChange('lineId', v)}
            >
              <SelectTrigger id="line">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="customer">Cliente</Label>
            <Input
              id="customer"
              placeholder="Buscar cliente"
              value={filters.customer || ""}
              onChange={(e) => handleFilterChange('customer', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="dateFrom">Desde</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom || ""}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="dateTo">Hasta</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo || ""}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
