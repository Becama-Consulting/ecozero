import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { X, ZoomIn, Check, AlertCircle, MessageSquare } from "lucide-react";

interface PhotoMetadata {
  validated?: boolean | null;
  validationComment?: string;
  validatedBy?: string;
  validatedAt?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

interface PhotoGalleryProps {
  photos: string[];
  metadata?: Record<string, PhotoMetadata>;
  onValidate?: (photoUrl: string, approved: boolean, comment: string) => void;
  onDelete?: (photoUrl: string) => void;
  canValidate?: boolean;
  canDelete?: boolean;
}

export const PhotoGallery = ({ 
  photos, 
  metadata = {},
  onValidate, 
  onDelete, 
  canValidate = false, 
  canDelete = false 
}: PhotoGalleryProps) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comment, setComment] = useState('');

  const getPhotoMetadata = (url: string): PhotoMetadata => {
    return metadata[url] || {};
  };

  const handleValidate = (approved: boolean) => {
    if (!selectedPhoto || !onValidate) return;
    
    if (!approved && !comment) {
      setShowCommentModal(true);
      return;
    }

    onValidate(selectedPhoto, approved, comment);
    setComment('');
    setSelectedPhoto(null);
    setShowCommentModal(false);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photoUrl) => {
          const meta = getPhotoMetadata(photoUrl);
          
          return (
            <Card 
              key={photoUrl} 
              className="relative group overflow-hidden cursor-pointer"
              onClick={() => setSelectedPhoto(photoUrl)}
            >
              <div className="aspect-square">
                <img
                  src={photoUrl}
                  alt="Foto producción"
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white" />
                </div>

                <div className="absolute top-2 right-2">
                  {meta.validated === true && (
                    <Badge variant="default" className="gap-1 bg-green-600">
                      <Check className="w-3 h-3" />
                      Aprobada
                    </Badge>
                  )}
                  {meta.validated === false && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Rechazada
                    </Badge>
                  )}
                  {meta.validated === undefined && (
                    <Badge variant="secondary">
                      Pendiente
                    </Badge>
                  )}
                </div>

                {meta.validationComment && (
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="outline" className="gap-1 bg-white/90">
                      <MessageSquare className="w-3 h-3" />
                    </Badge>
                  </div>
                )}

                {canDelete && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 left-2 w-6 h-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDelete) onDelete(photoUrl);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="p-2 bg-muted/50">
                <p className="text-xs text-muted-foreground truncate">
                  {meta.uploadedBy || 'Sin información'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {meta.uploadedAt ? new Date(meta.uploadedAt).toLocaleDateString('es-ES') : 'Fecha desconocida'}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          {selectedPhoto && (
            <div className="space-y-4">
              <img
                src={selectedPhoto}
                alt="Foto ampliada"
                className="w-full h-auto rounded-lg"
              />

              <div className="space-y-2">
                {(() => {
                  const meta = getPhotoMetadata(selectedPhoto);
                  
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            Subido por: {meta.uploadedBy || 'Desconocido'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {meta.uploadedAt ? new Date(meta.uploadedAt).toLocaleString('es-ES') : 'Fecha desconocida'}
                          </p>
                        </div>
                        <div>
                          {meta.validated === true && (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <Check className="w-4 h-4" />
                              Aprobada
                            </Badge>
                          )}
                          {meta.validated === false && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="w-4 h-4" />
                              Rechazada
                            </Badge>
                          )}
                          {meta.validated === undefined && (
                            <Badge variant="secondary">
                              Pendiente Validación
                            </Badge>
                          )}
                        </div>
                      </div>

                      {meta.validationComment && (
                        <Card className="p-3 bg-muted">
                          <p className="text-sm font-medium mb-1">Comentario Quality:</p>
                          <p className="text-sm">{meta.validationComment}</p>
                          {meta.validatedBy && meta.validatedAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {meta.validatedBy} • {new Date(meta.validatedAt).toLocaleString('es-ES')}
                            </p>
                          )}
                        </Card>
                      )}

                      {canValidate && meta.validated === undefined && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleValidate(true)}
                            variant="default"
                            className="flex-1"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Aprobar
                          </Button>
                          <Button
                            onClick={() => setShowCommentModal(true)}
                            variant="destructive"
                            className="flex-1"
                          >
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCommentModal} onOpenChange={setShowCommentModal}>
        <DialogContent>
          <h3 className="text-lg font-semibold mb-4">Motivo del Rechazo</h3>
          <Textarea
            placeholder="Escribe el motivo por el que rechazas esta foto..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowCommentModal(false);
              setComment('');
            }}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => handleValidate(false)}
              disabled={!comment.trim()}
            >
              Confirmar Rechazo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
