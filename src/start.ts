import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createStart } from '@tanstack/react-start'

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [
      clerkMiddleware({
        authorizedParties: [
          'http://localhost:3000',
          'https://personal-management-tool.netlify.app',
        ],
      }),
    ],
  }
})
