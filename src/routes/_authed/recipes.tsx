import { createFileRoute } from '@tanstack/react-router'
import { RecipesPage } from '#/cooking/ui/recipes/recipes-page'

export const Route = createFileRoute('/_authed/recipes')({
  component: RecipesPage,
})
