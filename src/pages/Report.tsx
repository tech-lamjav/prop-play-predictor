import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { AlertCircle, ArrowRight, Calendar as CalendarIcon, ExternalLink, FileText, Loader2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useReportAccess } from '@/hooks/use-report-access';

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
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}/${month}/${year}`;
}

interface ReportEntry {
  filename: string;
  date: Date;
  label: string;
}

export default function Report() {
  const { hasAccess, isLoading: accessLoading } = useReportAccess();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noReportForDate, setNoReportForDate] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Set de date-strings (YYYY-MM-DD) que têm relatório — destaca dias no calendário.
  const availableDateSet = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}-${String(r.date.getDate()).padStart(2, '0')}`;
      set.add(key);
    });
    return set;
  }, [reports]);

  // Lista relatórios disponíveis no bucket
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
          return { filename: file.name, date, label: formatDateLabel(date) };
        })
        .filter((entry): entry is ReportEntry => entry !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      setReports(entries);
      if (entries.length > 0) setSelectedDate(entries[0].date);
      setLoading(false);
    }

    fetchReports();
  }, []);

  // Busca signed URL quando a data muda
  useEffect(() => {
    if (!selectedDate) return;

    const filename = toReportFilename(selectedDate);
    const match = reports.find((r) => r.filename === filename);

    if (!match) {
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

  const reportDayModifier = (date: Date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return availableDateSet.has(key);
  };

  const isLoading = loading || loadingPdf;

  // ── Estados auxiliares (loading do auth, sem acesso) ──────────────────

  if (accessLoading) {
    return (
      <div className="theme-rebrand min-h-screen bg-canvas">
        <AnalyticsNav variant="rebrand" showBack backTo="/home-nba" />
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-forest opacity-70" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="theme-rebrand min-h-screen bg-canvas">
        <AnalyticsNav variant="rebrand" showBack backTo="/home-nba" />
        <div className="max-w-md mx-auto px-4 py-24 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-amber-100 border border-amber-200 rounded-full flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-700" />
          </div>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">Acesso restrito</h2>
          <p className="text-[13px] text-ink-2 max-w-md leading-relaxed">
            Os relatórios estão disponíveis para assinantes premium e novos usuários em período de teste.
          </p>
          <button
            type="button"
            onClick={() => navigate('/paywall')}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-forest text-white text-[13px] font-semibold hover:bg-forest-soft transition-colors"
          >
            Ver planos
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Relatório do dia — Smart Betting</title>
      </Helmet>

      <div className="theme-rebrand min-h-screen bg-canvas text-ink">
        <AnalyticsNav variant="rebrand" showBack backTo="/home-nba" />

        {/* Page header (bg-white) */}
        <div className="bg-white border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 md:py-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-md bg-forest-tint border border-forest/20 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-forest" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight text-ink leading-none">
                    Relatório do dia
                  </h1>
                  <p className="text-[13px] text-ink-2 mt-1.5">
                    Atualizado periodicamente pela equipe Smart Betting
                  </p>
                </div>
              </div>

              {reports.length > 0 && (
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-white rounded-md text-[12px] text-ink hover:border-forest/40 transition-colors shrink-0"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-ink-2" />
                      <span>{selectedDate ? formatDateLabel(selectedDate) : 'Selecione a data'}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="theme-rebrand w-auto p-0 bg-white border border-line text-ink" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate || undefined}
                      onSelect={handleDateSelect}
                      initialFocus
                      modifiers={{ hasReport: reportDayModifier }}
                      modifiersClassNames={{ hasReport: 'report-day-dot' }}
                      classNames={{
                        caption_label: 'text-sm font-semibold text-ink',
                        head_cell: 'text-ink-2 w-9 font-medium text-[0.75rem]',
                        day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-canvas-2 rounded-md relative',
                        day_selected: 'bg-forest text-white hover:bg-forest-soft hover:text-white focus:bg-forest focus:text-white',
                        day_today: 'bg-forest-tint text-forest font-semibold',
                        day_outside: 'text-ink-2/40',
                        nav_button: 'h-7 w-7 bg-white p-0 border border-line text-ink-2 hover:text-ink hover:bg-canvas-2',
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
                        background-color: #0a3d2e;
                      }
                      .report-day-dot[aria-selected="true"]::after {
                        background-color: #ffffff;
                      }
                    `}</style>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Estados ─────────────────────────────────────── */}
          {isLoading && (
            <div className="bg-white border border-line rounded-xl p-16 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-forest opacity-70" />
              <p className="text-[13px] text-ink-2">Carregando relatório...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-white border border-status-danger/30 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-status-danger" />
              <p className="text-[13px] text-status-danger font-medium">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-white text-[12px] text-ink hover:border-forest/40 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div className="bg-white border border-line rounded-xl p-16 flex flex-col items-center gap-3 text-center">
              <FileText className="w-8 h-8 text-ink-2/50" />
              <p className="text-[13px] text-ink-2">Nenhum relatório disponível ainda.</p>
            </div>
          )}

          {!isLoading && !error && noReportForDate && (
            <div className="bg-white border border-amber-200 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
              <CalendarIcon className="w-8 h-8 text-amber-700" />
              <p className="text-[13px] text-amber-800 font-semibold">Não há relatório para essa data.</p>
              <p className="text-[12px] text-ink-2">Selecione uma data com o indicador verde no calendário.</p>
            </div>
          )}

          {pdfUrl && !isLoading && !error && !noReportForDate && (
            <div>
              {/* Mobile fallback: link direto pro PDF native viewer */}
              <div className="sm:hidden mb-3">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-forest text-white text-[13px] font-semibold hover:bg-forest-soft transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir PDF em tela cheia
                </a>
              </div>

              {/*
                iOS Safari expande iframes pra altura do conteúdo, ignorando CSS height.
                Fix: container com altura fixa + iframe absoluto dentro.
              */}
              <div
                className="rounded-xl border border-line overflow-hidden bg-white relative"
                style={{
                  height: 'calc(100vh - 240px)',
                  minHeight: '480px',
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
        </main>
      </div>
    </>
  );
}
