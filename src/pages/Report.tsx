import { useState, useEffect, useMemo } from 'react';
import { FileText, Loader2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const BUCKET = 'reports';
const SIGNED_URL_EXPIRY = 3600;

/** Parse DD-MM-YYYY filename into a Date */
function parseReportDate(filename: string): Date | null {
  const match = filename.match(/^(\d{2})-(\d{2})-(\d{4})\.pdf$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Build DD-MM-YYYY filename from a Date */
function toReportFilename(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}.pdf`;
}

/** Format Date to a short display label  */
function formatDateLabel(date: Date): string {
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${weekday}, ${day}/${month}/${year}`;
}

interface ReportEntry {
  filename: string;
  date: Date;
  label: string;
}

export default function WeeklyReport() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noReportForDate, setNoReportForDate] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Set of date-strings (YYYY-MM-DD) that have reports — used to highlight calendar days
  const availableDateSet = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}-${String(r.date.getDate()).padStart(2, '0')}`;
      set.add(key);
    });
    return set;
  }, [reports]);

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
            label: formatDateLabel(date),
          };
        })
        .filter((entry): entry is ReportEntry => entry !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      setReports(entries);

      // Auto-select the most recent report
      if (entries.length > 0) {
        setSelectedDate(entries[0].date);
      }

      setLoading(false);
    }

    fetchReports();
  }, []);

  // Fetch signed URL when selected date changes
  useEffect(() => {
    if (!selectedDate) return;

    const filename = toReportFilename(selectedDate);
    const match = reports.find((r) => r.filename === filename);

    if (!match) {
      // No report exists for this date
      setPdfUrl(null);
      setNoReportForDate(true);
      return;
    }

    setNoReportForDate(false);

    async function fetchPdfUrl() {
      setLoadingPdf(true);
      setPdfUrl(null);

      const { data, error: storageError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filename, SIGNED_URL_EXPIRY);

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
  }, [selectedDate, reports]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setCalendarOpen(false);
  };

  // Modifier to add a dot indicator on days that have reports
  const reportDayModifier = (date: Date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return availableDateSet.has(key);
  };

  const isLoading = loading || loadingPdf;

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <AnalyticsNav />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 bg-terminal-green/20 border border-terminal-green/50 rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-terminal-green" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-wider text-terminal-green">
                RELATÓRIO
              </h1>
              <p className="text-[10px] sm:text-xs text-terminal-text opacity-60">
                Atualizado periodicamente pela equipe Smartbetting
              </p>
            </div>
          </div>

          {/* Calendar date picker */}
          {reports.length > 0 && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="terminal-input h-9 text-sm w-full sm:w-[240px] justify-start border-terminal-border-subtle bg-terminal-gray/30 hover:bg-terminal-gray/40"
                >
                  <CalendarIcon className="w-4 h-4 mr-2 opacity-70" />
                  {selectedDate ? formatDateLabel(selectedDate) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 bg-terminal-dark-gray border-terminal-border-subtle"
                align="end"
              >
                <Calendar
                  mode="single"
                  selected={selectedDate || undefined}
                  onSelect={handleDateSelect}
                  initialFocus
                  modifiers={{ hasReport: reportDayModifier }}
                  modifiersClassNames={{
                    hasReport: 'report-day-dot',
                  }}
                  className="bg-terminal-dark-gray text-terminal-text"
                  classNames={{
                    caption_label: 'text-sm font-semibold text-terminal-text',
                    head_cell: 'text-terminal-text/60 rounded-md w-9 font-medium text-[0.75rem]',
                    day: 'h-9 w-9 p-0 font-normal text-terminal-text hover:bg-terminal-gray/40 relative',
                    day_selected: 'bg-terminal-green text-terminal-black hover:bg-terminal-green/90',
                    day_today: 'bg-terminal-gray text-terminal-text',
                    nav_button:
                      'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 border border-terminal-border-subtle',
                  }}
                />
                <style>{`
                  .report-day-dot::after {
                    content: '';
                    position: absolute;
                    bottom: 2px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background-color: #00ff88;
                  }
                  .report-day-dot[aria-selected="true"]::after {
                    background-color: #000;
                  }
                `}</style>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-terminal-green" />
            <p className="text-terminal-text opacity-60">Carregando relatório...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-terminal-red" />
            <p className="text-terminal-red font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="terminal-button"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <FileText className="w-10 h-10 text-terminal-text opacity-40" />
            <p className="text-terminal-text opacity-60 font-medium">Nenhum relatório disponível</p>
          </div>
        )}

        {!isLoading && !error && noReportForDate && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <CalendarIcon className="w-10 h-10 text-terminal-yellow opacity-70" />
            <p className="text-terminal-yellow font-medium">
              Não há relatório para esse dia
            </p>
            <p className="text-terminal-text opacity-50 text-xs">
              Selecione uma data com o indicador verde no calendário
            </p>
          </div>
        )}

        {pdfUrl && !isLoading && !error && !noReportForDate && (
          <div>
            {/* Mobile fallback: direct link to open PDF in native viewer */}
            <div className="sm:hidden mb-3">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-terminal-green bg-terminal-green/10 text-terminal-green text-sm font-semibold hover:bg-terminal-green/20 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Abrir PDF em tela cheia
              </a>
            </div>

            {/*
              iOS Safari expands iframes to their content height, ignoring CSS height.
              Fix: position the iframe absolutely inside a fixed-height container.
              The wrapper clips overflow so the PDF scrolls inside, not the page.
            */}
            <div
              className="rounded-lg border border-terminal-border-subtle overflow-hidden bg-white relative"
              style={{
                height: 'calc(100vh - 220px)',
                minHeight: '400px',
                WebkitOverflowScrolling: 'touch',
                overflow: 'auto',
              }}
            >
              <iframe
                src={pdfUrl}
                title="Relatório"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
