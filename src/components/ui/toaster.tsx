import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  // Toasts disparados em rotas do bolão usam paleta light "Direção A"
  // (canvas/forest/amber). O resto do app continua no tema dark padrão.
  // Lemos window.location direto porque o Toaster fica fora do <BrowserRouter>
  // no App.tsx, então useLocation() não funciona aqui. O Toaster re-renderiza
  // a cada toast novo, o que garante que pathname é lido fresh.
  const isBolao =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/bolao')

  return (
    <ToastProvider>
      <ToastViewport />
      {toasts.map(function ({ id, title, description, action, variant, className, ...props }) {
        const themeClass = isBolao
          ? variant === 'destructive'
            ? 'theme-bolao !bg-status-danger !border-status-danger !text-white'
            : 'theme-bolao !bg-white !border-line !text-ink shadow-md'
          : ''
        return (
          <Toast
            key={id}
            variant={variant}
            className={cn(themeClass, className)}
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription className={isBolao && variant !== 'destructive' ? 'text-ink-2' : undefined}>
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
    </ToastProvider>
  )
}
