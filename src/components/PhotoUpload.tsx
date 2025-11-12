import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoUploadProps {
  onPhotoUploaded: (url: string) => void;
  existingPhotos?: string[];
  onRemovePhoto?: (url: string) => void;
}

export const PhotoUpload = ({ onPhotoUploaded, existingPhotos = [], onRemovePhoto }: PhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Archivo muy grande (máx 10MB)');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `production-photos/${fileName}`;

      // Upload a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('production-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('production-photos')
        .getPublicUrl(filePath);

      onPhotoUploaded(data.publicUrl);
      toast.success('Foto subida correctamente');
      
      // Reset input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Error al subir foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="photo">Subir Foto</Label>
        <Input
          id="photo"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Subiendo foto...
          </div>
        )}
      </div>

      {/* Preview de fotos existentes */}
      {existingPhotos.length > 0 && (
        <div>
          <Label>Fotos Adjuntas ({existingPhotos.length})</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {existingPhotos.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-24 object-cover rounded border"
                />
                {onRemovePhoto && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemovePhoto(url)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
