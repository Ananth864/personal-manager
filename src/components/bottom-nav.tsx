import { Link } from '@tanstack/react-router'
import { BookOpen, CalendarDays, MessageCircle, Package } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  label: string
  to: '/schedule' | '/inventory' | '/recipes' | '/chat'
  icon: LucideIcon
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Schedule', to: '/schedule', icon: CalendarDays },
  { label: 'Inventory', to: '/inventory', icon: Package },
  { label: 'Recipes', to: '/recipes', icon: BookOpen },
  { label: 'Chat', to: '/chat', icon: MessageCircle },
] as const

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              aria-label={label}
              className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors"
              activeProps={{ className: 'text-foreground' }}
              inactiveProps={{ className: 'text-muted-foreground' }}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
