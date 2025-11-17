import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Camera,
  Save,
  ArrowRight,
  ArrowLeft,
  ListChecks,
  RefreshCw,
} from 'lucide-react';
import { PhotoGallery } from '@/components/produccion/PhotoGallery';
import { useState as usePhotoState } from 'react';

interface ProductionStep {
  id: string;
  step_number: number;
  step_name: string;
  status: string;
  of_id: string;
  data_json: any;
  photos: string[];
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  of?: {
    id: string;
    sap_id: string;
    customer: string;
    status: string;
  };
}

interface DataField {
  name: string;
  label: string;
  type: 'number' | 'text' | 'time';
  required?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  validation?: (value: any) => { valid: boolean; message?: string };
}

export default function RegistroDatos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [incidencia, setIncidencia] = useState('');

  // Campos de datos configurables según el tipo de paso
  const dataFields: DataField[] = [
    {
      name: 'cantidad_producida',
      label: 'Cantidad Producida',
      type: 'number',
      required: true,
      min: 0,
      unit: 'uds',
      validation: (value) => {
        if (value < 0) return { valid: false, message: 'Debe ser un número positivo' };
        return { valid: true };
      },
    },
    {
      name: 'tiempo_ejecucion',
      label: 'Tiempo de Ejecución',
      type: 'number',
      required: true,
      min: 0,
      unit: 'min',
      validation: (value) => {
        if (value < 0) return { valid: false, message: 'Debe ser un número positivo' };
        if (value > 480) return { valid: false, message: 'El tiempo parece demasiado alto' };
        return { valid: true };
      },
    },
    {
      name: 'temperatura',
      label: 'Temperatura',
      type: 'number',
      min: -50,
      max: 200,
      unit: '°C',
      validation: (value) => {
        if (value && (value < -50 || value > 200)) {
          return { valid: false, message: 'Temperatura fuera de rango (-50 a 200°C)' };
        }
        return { valid: true };
      },
    },
    {
      name: 'medida_1',
      label: 'Medida Longitud',
      type: 'number',
      min: 0,
      unit: 'mm',
    },
    {
      name: 'medida_2',
      label: 'Medida Ancho',
      type: 'number',
      min: 0,
      unit: 'mm',
    },
    {
      name: 'observaciones',
      label: 'Observaciones',
      type: 'text',
    },
  ];

  useEffect(() => {
    if (user) {
      fetchMySteps();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  const fetchMySteps = async () => {
    setLoading(true);
    try {
      // Obtener pasos asignados al usuario actual
      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select(
          `
          *,
          of:fabrication_orders(id, sap_id, customer, status)
        `
        )
        .eq('assigned_to', user?.id)
        .in('status', ['pendiente', 'en_proceso'])
        .order('step_number', { ascending: true });

      if (stepsError) throw stepsError;

      setSteps((stepsData as any) || []);

      // Inicializar formData con datos existentes del paso actual
      if (stepsData && stepsData.length > 0) {
        const currentStep = stepsData[0];
        if (currentStep.data_json && typeof currentStep.data_json === 'object') {
          setFormData(currentStep.data_json as Record<string, any>);
        } else {
          setFormData({});
        }
      }
    } catch (error) {
      console.error('Error fetching steps:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pasos de producción',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('registro-datos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_steps',
          filter: `assigned_to=eq.${user?.id}`,
        },
        () => {
          fetchMySteps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const validateField = (fieldName: string, value: any): { valid: boolean; message?: string } => {
    const field = dataFields.find((f) => f.name === fieldName);
    if (!field) return { valid: true };

    // Validación de campo requerido
    if (field.required && (value === '' || value === null || value === undefined)) {
      return { valid: false, message: 'Este campo es obligatorio' };
    }

    // Validación personalizada
    if (field.validation) {
      return field.validation(value);
    }

    // Validación de rango para números
    if (field.type === 'number' && value !== '') {
      const numValue = Number(value);
      if (field.min !== undefined && numValue < field.min) {
        return { valid: false, message: `Debe ser mayor o igual a ${field.min}` };
      }
      if (field.max !== undefined && numValue > field.max) {
        return { valid: false, message: `Debe ser menor o igual a ${field.max}` };
      }
    }

    return { valid: true };
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));

    // Validar en tiempo real
    const validation = validateField(fieldName, value);
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      if (!validation.valid) {
        newErrors[fieldName] = validation.message || 'Error de validación';
      } else {
        delete newErrors[fieldName];
      }
      return newErrors;
    });
  };

  const validateAllFields = (): boolean => {
    const errors: Record<string, string> = {};
    dataFields.forEach((field) => {
      const value = formData[field.name];
      const validation = validateField(field.name, value);
      if (!validation.valid) {
        errors[field.name] = validation.message || 'Error de validación';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveCurrentStep = async (completeStep: boolean = false) => {
    if (!steps[currentStepIndex]) return;

    if (!validateAllFields()) {
      toast({
        title: 'Errores de validación',
        description: 'Por favor, corrige los errores antes de guardar',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const currentStep = steps[currentStepIndex];
      const updateData: any = {
        data_json: formData,
      };

      if (completeStep) {
        updateData.status = 'completado';
        updateData.completed_at = new Date().toISOString();
      } else if (currentStep.status === 'pendiente') {
        updateData.status = 'en_proceso';
        updateData.started_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('production_steps')
        .update(updateData)
        .eq('id', currentStep.id);

      if (error) throw error;

      toast({
        title: completeStep ? '✅ Paso completado' : '💾 Datos guardados',
        description: completeStep
          ? `Paso ${currentStep.step_number} completado correctamente`
          : 'Los datos se han guardado correctamente',
      });

      // Si se completó el paso, crear alerta si hay incidencia
      if (completeStep && incidencia.trim()) {
        await supabase.from('alerts').insert({
          type: 'incidencia_produccion',
          severity: 'warning',
          message: `Incidencia en paso ${currentStep.step_number} - ${currentStep.step_name}: ${incidencia}`,
          related_of_id: currentStep.of_id,
        });
        setIncidencia('');
      }

      // Actualizar estado de la OF si es necesario
      if (completeStep) {
        await supabase
          .from('fabrication_orders')
          .update({ status: 'en_proceso' })
          .eq('id', currentStep.of_id)
          .eq('status', 'pendiente');
      }

      fetchMySteps();

      // Avanzar al siguiente paso si se completó
      if (completeStep && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        setFormData(steps[currentStepIndex + 1]?.data_json || {});
        setValidationErrors({});
      }
    } catch (error) {
      console.error('Error saving step:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los datos',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const currentStep = steps[currentStepIndex];
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <ListChecks className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">No hay pasos asignados</h2>
        <p className="text-muted-foreground">
          Actualmente no tienes pasos de producción asignados.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header con progreso */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl">Registro de Producción</CardTitle>
              <Badge variant="outline" className="text-lg">
                {currentStepIndex + 1} / {steps.length}
              </Badge>
            </div>
            <Progress value={progress} className="h-3" />
            <CardDescription className="mt-2">
              OF: {currentStep?.of?.sap_id} - {currentStep?.of?.customer}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Información del paso actual */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  Paso {currentStep.step_number}: {currentStep.step_name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  {currentStep.status === 'pendiente' && (
                    <>
                      <Clock className="h-4 w-4" />
                      Pendiente
                    </>
                  )}
                  {currentStep.status === 'en_proceso' && (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      En proceso
                    </>
                  )}
                  {currentStep.status === 'completado' && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Completado
                    </>
                  )}
                </CardDescription>
              </div>
              {currentStep.status !== 'pendiente' && currentStep.started_at && (
                <div className="text-right text-sm text-muted-foreground">
                  Iniciado:{' '}
                  {new Date(currentStep.started_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Formulario de datos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Datos de Producción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {dataFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name} className="text-base font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                  {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                </Label>
                {field.type === 'text' ? (
                  <Textarea
                    id={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="min-h-[100px] text-base"
                    placeholder={`Ingrese ${field.label.toLowerCase()}`}
                  />
                ) : (
                  <Input
                    id={field.name}
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className={`text-lg h-14 ${
                      validationErrors[field.name] ? 'border-destructive' : ''
                    }`}
                    placeholder={`Ingrese ${field.label.toLowerCase()}`}
                    min={field.min}
                    max={field.max}
                  />
                )}
                {validationErrors[field.name] && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {validationErrors[field.name]}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Fotos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Fotografías
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="upload-photo">Subir Foto</Label>
              <Input
                id="upload-photo"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  // Validar tamaño
                  if (file.size > 10 * 1024 * 1024) {
                    toast({
                      title: 'Error',
                      description: 'Archivo muy grande (máx 10MB)',
                      variant: 'destructive',
                    });
                    return;
                  }

                  // Validar tipo
                  if (!file.type.startsWith('image/')) {
                    toast({
                      title: 'Error',
                      description: 'Solo se permiten imágenes',
                      variant: 'destructive',
                    });
                    return;
                  }

                  try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    const filePath = `production-photos/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                      .from('production-photos')
                      .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage
                      .from('production-photos')
                      .getPublicUrl(filePath);

                    // Actualizar paso con nueva foto
                    const updatedPhotos = [...(currentStep.photos || []), data.publicUrl];
                    await supabase
                      .from('production_steps')
                      .update({ photos: updatedPhotos })
                      .eq('id', currentStep.id);

                    toast({
                      title: '✅ Foto subida',
                      description: 'La foto se ha guardado correctamente',
                    });

                    fetchMySteps();
                    e.target.value = '';
                  } catch (error) {
                    console.error('Error uploading photo:', error);
                    toast({
                      title: 'Error',
                      description: 'No se pudo subir la foto',
                      variant: 'destructive',
                    });
                  }
                }}
                className="h-14"
              />
            </div>
            {currentStep.photos && currentStep.photos.length > 0 && (
              <PhotoGallery photos={currentStep.photos} />
            )}
          </CardContent>
        </Card>

        {/* Incidencias */}
        <Card className="border-orange-500 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <AlertCircle className="h-5 w-5" />
              Reportar Incidencia (Opcional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={incidencia}
              onChange={(e) => setIncidencia(e.target.value)}
              placeholder="Describe cualquier problema o incidencia encontrada..."
              className="min-h-[120px] text-base"
            />
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => {
              if (currentStepIndex > 0) {
                setCurrentStepIndex(currentStepIndex - 1);
                setFormData(steps[currentStepIndex - 1]?.data_json || {});
                setValidationErrors({});
              }
            }}
            disabled={currentStepIndex === 0}
            variant="outline"
            size="lg"
            className="h-16 text-lg"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Anterior
          </Button>

          <Button
            onClick={() => saveCurrentStep(false)}
            disabled={saving || Object.keys(validationErrors).length > 0}
            variant="secondary"
            size="lg"
            className="h-16 text-lg"
          >
            <Save className="mr-2 h-5 w-5" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>

          <Button
            onClick={() => saveCurrentStep(true)}
            disabled={saving || Object.keys(validationErrors).length > 0}
            size="lg"
            className="h-16 text-lg bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {currentStepIndex === steps.length - 1 ? 'Finalizar' : 'Completar y Siguiente'}
          </Button>
        </div>

        {/* Navegación a siguiente paso (opcional) */}
        {currentStepIndex < steps.length - 1 && currentStep.status !== 'completado' && (
          <Button
            onClick={() => {
              setCurrentStepIndex(currentStepIndex + 1);
              setFormData(steps[currentStepIndex + 1]?.data_json || {});
              setValidationErrors({});
            }}
            variant="ghost"
            className="w-full h-12"
          >
            Ver siguiente paso
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
