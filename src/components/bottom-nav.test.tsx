import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  Outlet,
} from '@tanstack/react-router'
import { BottomNav } from './bottom-nav'

function renderWithRouter(element: React.ReactElement) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        {element}
        <Outlet />
      </>
    ),
  })

  const children = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/schedule',
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/inventory',
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/recipes',
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/chat',
      component: () => null,
    }),
  ]

  const routeTree = rootRoute.addChildren(children)
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return render(<RouterProvider router={router} />)
}

describe('BottomNav', () => {
  it('renders the four cooking navigation surfaces as links', async () => {
    renderWithRouter(<BottomNav />)

    for (const label of ['Schedule', 'Inventory', 'Recipes', 'Chat']) {
      await expect(
        screen.findByRole('link', { name: label }),
      ).resolves.toBeInTheDocument()
    }
  })

  it('points each tab at its surface route', async () => {
    renderWithRouter(<BottomNav />)

    expect(await screen.findByRole('link', { name: 'Schedule' })).toHaveAttribute(
      'href',
      '/schedule',
    )
    expect(await screen.findByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'href',
      '/inventory',
    )
    expect(await screen.findByRole('link', { name: 'Recipes' })).toHaveAttribute(
      'href',
      '/recipes',
    )
    expect(await screen.findByRole('link', { name: 'Chat' })).toHaveAttribute(
      'href',
      '/chat',
    )
  })
})
