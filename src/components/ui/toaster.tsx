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
        // Em /bolao usamos paleta light "Direção A". Cores LITERAIS (#hex)
        // em vez de CSS vars (var(--ink)) porque o portal do Radix renderiza
        // no body — fora do escopo de `.theme-bolao` do BolaoLayout, então
        // var(--ink) pode resolver pra undefined dependendo do browser
        // (especialmente iOS Safari mobile em system light mode), resultando
        // em texto invisível ("branco em branco").
        const themeClass = isBolao
          ? variant === 'destructive'
            ? '!bg-[#b91c1c] !border-[#b91c1c] !text-white'
            : '!bg-white !border-[#e3e6e0] !text-[#1a1d1a] shadow-md'
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
                <ToastDescription className={isBolao && variant !== 'destructive' ? '!text-[#4a4f48]' : undefined}>
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
