import { useState, useEffect } from 'react';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import MainNav from '@/components/MainNav';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const BUCKET = 'reports';
const FILE_PATH = 'report.pdf';
// Signed URL valid for 1 hour
const SIGNED_URL_EXPIRY = 3600;

export default function WeeklyReport() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPdfUrl() {
      setLoading(true);
      setError(null);

      const { data, error: storageError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(FILE_PATH, SIGNED_URL_EXPIRY);

      if (storageError || !data?.signedUrl) {
        setError('Não foi possível carregar o relatório. Tente novamente mais tarde.');
        setLoading(false);
        return;
      }

      setPdfUrl(data.signedUrl);
      setLoading(false);
    }

    fetchPdfUrl();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">Relatório</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Atualizado periodicamente pela equipe Smartbetting
            </p>
          </div>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando relatório...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {pdfUrl && !loading && !error && (
          <div className="rounded-lg border border-border overflow-hidden bg-white">
            <iframe
              src={pdfUrl}
              title="Relatório"
              className="w-full"
              style={{ height: 'calc(100vh - 160px)', minHeight: '400px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
