import { createFileRoute } from '@tanstack/react-router'
import { InventoryPage } from '#/cooking/ui/inventory/inventory-page'

export const Route = createFileRoute('/_authed/inventory')({
  component: InventoryPage,
})
