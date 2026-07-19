import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/recipes')({
  component: RecipesPage,
})

function RecipesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Recipes</h1>
      <p className="text-sm text-muted-foreground">
        Your recipe catalog, with cookability badges against your inventory,
        lands here in a later ticket.
      </p>
    </div>
  )
}
