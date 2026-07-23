import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import {
  CalendarDays,
  BookOpen,
  Package,
  UtensilsCrossed,
  ShoppingCart,
  MessageCircle,
  ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// If already signed in, skip the hero and go straight to the app.
const checkAuth = createServerFn().handler(async () => {
  const { userId } = await auth()
  if (userId) {
    throw redirect({ to: '/schedule' })
  }
  return {}
})

export const Route = createFileRoute('/')({
  beforeLoad: () => checkAuth(),
  component: HeroPage,
})

interface Feature {
  icon: LucideIcon
  name: string
  desc: string
}

const FEATURES: readonly Feature[] = [
  { icon: CalendarDays, name: 'Weekly Schedule', desc: 'Fill lunch and dinner slots for each day. Assign recipes, pull from the food bank, or mark a night off.' },
  { icon: Package, name: 'Inventory', desc: 'Track ingredients by quantity, mark staples as endless, or flag what you have run out of.' },
  { icon: BookOpen, name: 'Recipe Catalog', desc: 'Save recipes with ingredients and serving sizes. Reuse them across weeks.' },
  { icon: UtensilsCrossed, name: 'Food Bank', desc: 'Cooking produces extra portions. Reserve them for another night instead of cooking from scratch.' },
  { icon: ShoppingCart, name: 'Shopping List', desc: 'A derived view of what your planned meals need but your kitchen does not have.' },
  { icon: MessageCircle, name: 'Chat Agent', desc: 'Tell the agent what you bought, what you finished, or ask it to plan the week for you.' },
]

interface Step {
  num: string
  title: string
  desc: string
}

const STEPS: readonly Step[] = [
  { num: '01', title: 'Fill your week', desc: 'Assign recipes to lunch and dinner slots, or mark a night as no-cook.' },
  { num: '02', title: 'Cook and track', desc: 'Cooking a recipe decrements the ingredients you track. Extra servings go to the food bank.' },
  { num: '03', title: 'Shop what is missing', desc: 'The shopping list shows exactly what your planned meals need but you do not have.' },
]

function HeroPage() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-md">
        {/* Hero */}
        <section className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-16">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Personal Manager
          </span>

          <div className="py-16">
            <h1 className="font-display text-[2.75rem] font-semibold leading-[1.05] tracking-tight">
              Your kitchen,
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">accounted</span>
                <span
                  className="absolute bottom-1 left-0 right-0 h-3 -z-0 -rotate-1"
                  style={{ backgroundColor: 'var(--accent-warm)', opacity: 0.35 }}
                />
              </span>{' '}
              for.
            </h1>
            <p className="mt-6 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
              Plan your week, track what you have, and cook with intent. A
              cooking life-manager that lives on your phone.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Link
              to="/sign-in"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
            >
              Start cooking
            </Link>
            <div className="flex flex-col items-center gap-0.5 pt-4 text-muted-foreground/50">
              <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
              <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border px-6 py-16">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            How it works
          </h2>
          <div className="mt-8 space-y-10">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-4">
                <span className="font-display text-sm font-semibold text-muted-foreground/60">
                  {step.num}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border px-6 py-16">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            What is inside
          </h2>
          <div className="mt-8">
            <dl className="divide-y divide-border">
              {FEATURES.map(({ icon: Icon, name, desc }) => (
                <div key={name} className="flex gap-4 py-5">
                  <Icon
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <div>
                    <dt className="font-display text-[15px] font-semibold tracking-tight">
                      {name}
                    </dt>
                    <dd className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                      {desc}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-t border-border px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Ready to cook?
          </h2>
          <Link
            to="/sign-in"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            Get started
          </Link>
          <p className="mt-12 text-xs text-muted-foreground/60">
            Personal Manager
          </p>
        </section>
      </main>
    </div>
  )
}
