import { useState, useEffect } from 'react';
import { FileText, Loader2, AlertCircle, ChevronDown, Calendar } from 'lucide-react';
import MainNav from '@/components/MainNav';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BUCKET = 'reports';
const SIGNED_URL_EXPIRY = 3600;

/** Parse DD-MM-YYYY filename into a Date */
function parseReportDate(filename: string): Date | null {
  const match = filename.match(/^(\d{2})-(\d{2})-(\d{4})\.pdf$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Format Date to DD/MM/YYYY for display */
function formatDateDisplay(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Format Date to weekday label */
function formatWeekday(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

interface ReportEntry {
  filename: string;
  date: Date;
  label: string;
}

export default function WeeklyReport() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available reports from the bucket
  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      setError(null);

      const { data, error: listError } = await supabase.storage
        .from(BUCKET)
        .list('', { sortBy: { column: 'name', order: 'desc' } });

      if (listError) {
        setError('Não foi possível carregar os relatórios. Tente novamente mais tarde.');
        setLoading(false);
        return;
      }

      const entries: ReportEntry[] = (data || [])
        .map((file) => {
          const date = parseReportDate(file.name);
          if (!date) return null;
          return {
            filename: file.name,
            date,
            label: `${formatWeekday(date)}, ${formatDateDisplay(date)}`,
          };
        })
        .filter((entry): entry is ReportEntry => entry !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      setReports(entries);

      if (entries.length > 0) {
        setSelectedFile(entries[0].filename);
      }

      setLoading(false);
    }

    fetchReports();
  }, []);

  // Fetch signed URL when selected file changes
  useEffect(() => {
    if (!selectedFile) return;

    async function fetchPdfUrl() {
      setLoadingPdf(true);
      setPdfUrl(null);

      const { data, error: storageError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(selectedFile!, SIGNED_URL_EXPIRY);

      if (storageError || !data?.signedUrl) {
        setError('Não foi possível carregar o relatório. Tente novamente mais tarde.');
        setLoadingPdf(false);
        return;
      }

      setError(null);
      setPdfUrl(data.signedUrl);
      setLoadingPdf(false);
    }

    fetchPdfUrl();
  }, [selectedFile]);

  const isLoading = loading || loadingPdf;

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">Relatório</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Atualizado periodicamente pela equipe Smartbetting
              </p>
            </div>
          </div>

          {/* Date selector */}
          {reports.length > 0 && (
            <Select
              value={selectedFile || undefined}
              onValueChange={(value) => setSelectedFile(value)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Selecione a data" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {reports.map((report) => (
                  <SelectItem key={report.filename} value={report.filename}>
                    {report.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando relatório...</p>
          </div>
        )}

        {error && !isLoading && (
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

        {!loading && !error && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <FileText className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground font-medium">Nenhum relatório disponível</p>
          </div>
        )}

        {pdfUrl && !isLoading && !error && (
          <div className="rounded-lg border border-border overflow-hidden bg-white">
            <iframe
              src={pdfUrl}
              title="Relatório"
              className="w-full"
              style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
