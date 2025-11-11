import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle legacy role-specific API routes and redirect them to unified endpoints
 * This provides backward compatibility while transitioning to unified API structure
 */

interface RouteAlias {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Define route aliases for backward compatibility
const routeAliases: RouteAlias[] = [
  // NOTE: Super Admin routes should NOT be aliased - they go through the super-admin router
  // Removed super-admin aliases to prevent conflicts with the super-admin router

  // Agency Admin aliases
  {
    pattern: /^\/agency-admin\/dashboard$/,
    replacement: '/dashboard',
    description: 'Agency admin dashboard → unified dashboard'
  },
  {
    pattern: /^\/agency-admin\/properties$/,
    replacement: '/properties',
    description: 'Agency admin properties → unified properties'
  },
  {
    pattern: /^\/agency-admin\/units$/,
    replacement: '/units',
    description: 'Agency admin units → unified units'
  },
  {
    pattern: /^\/agency-admin\/tenants$/,
    replacement: '/tenants',
    description: 'Agency admin tenants → unified tenants'
  },
  {
    pattern: /^\/agency-admin\/staff\/agents$/,
    replacement: '/users?role=agent',
    description: 'Agency admin agents → unified users with role filter'
  },
  {
    pattern: /^\/agency-admin\/staff\/caretakers$/,
    replacement: '/caretakers',
    description: 'Agency admin caretakers → unified caretakers'
  },
  {
    pattern: /^\/agency-admin\/reports\/(.+)$/,
    replacement: '/reports/$1',
    description: 'Agency admin reports → unified reports'
  },
  {
    pattern: /^\/agency-admin\/messages$/,
    replacement: '/messages',
    description: 'Agency admin messages → unified messages'
  },
  {
    pattern: /^\/agency-admin\/notifications$/,
    replacement: '/notifications',
    description: 'Agency admin notifications → unified notifications'
  },
  {
    pattern: /^\/agency-admin\/billing\/(.+)$/,
    replacement: '/billing/$1',
    description: 'Agency admin billing → unified billing'
  },

  // Landlord aliases
  {
    pattern: /^\/landlord\/dashboard$/,
    replacement: '/dashboard',
    description: 'Landlord dashboard → unified dashboard'
  },
  {
    pattern: /^\/landlord\/properties$/,
    replacement: '/properties',
    description: 'Landlord properties → unified properties'
  },
  {
    pattern: /^\/landlord\/units$/,
    replacement: '/units',
    description: 'Landlord units → unified units'
  },
  {
    pattern: /^\/landlord\/tenants$/,
    replacement: '/tenants',
    description: 'Landlord tenants → unified tenants'
  },
  {
    pattern: /^\/landlord\/caretakers$/,
    replacement: '/caretakers',
    description: 'Landlord caretakers → unified caretakers'
  },
  {
    pattern: /^\/landlord\/maintenance$/,
    replacement: '/maintenance',
    description: 'Landlord maintenance → unified maintenance'
  },
  {
    pattern: /^\/landlord\/financial\/(.+)$/,
    replacement: '/financial/$1',
    description: 'Landlord financial → unified financial'
  },
  {
    pattern: /^\/landlord\/reports\/(.+)$/,
    replacement: '/reports/$1',
    description: 'Landlord reports → unified reports'
  },

  // NOTE: Generic super-admin pattern removed - super-admin routes should go through the super-admin router
  // Do NOT alias super-admin routes as they have their own router with authentication
  {
    pattern: /^\/agency-admin\/(.+)$/,
    replacement: '/$1',
    description: 'Generic agency admin routes → unified routes'
  },
  {
    pattern: /^\/landlord\/(.+)$/,
    replacement: '/$1',
    description: 'Generic landlord routes → unified routes'
  }
];

/**
 * Route alias middleware - redirects legacy role-specific routes to unified endpoints
 */
export const routeAliasMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalUrl = req.url;
  const originalPath = req.path;

  // Check if this is a legacy route that needs aliasing
  for (const alias of routeAliases) {
    const match = originalPath.match(alias.pattern);
    if (match) {
      // Replace the path with the unified endpoint
      const newPath = originalPath.replace(alias.pattern, alias.replacement);
      
      // Preserve query parameters
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      const newUrl = queryString ? `${newPath}?${queryString}` : newPath;

      // Log the alias for debugging (can be removed in production)
      console.log(`🔄 Route alias: ${originalPath} → ${newPath} (${alias.description})`);

      // Update the request URL and path
      req.url = newUrl;
      // Use Object.defineProperty to override the read-only path property
      Object.defineProperty(req, 'path', {
        value: newPath,
        writable: true,
        configurable: true
      });

      // Add a header to indicate this was an aliased route
      res.setHeader('X-Route-Aliased', 'true');
      res.setHeader('X-Original-Route', originalPath);
      res.setHeader('X-Unified-Route', newPath);

      break; // Stop after first match
    }
  }

  next();
};

/**
 * Middleware to add deprecation warnings for legacy routes
 */
export const deprecationWarningMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalPath = req.path;

  // Check if this was an aliased route
  const isLegacyRoute = routeAliases.some(alias => alias.pattern.test(originalPath));

  if (isLegacyRoute) {
    // Add deprecation warning to response headers
    res.setHeader('X-API-Deprecation-Warning', 'This endpoint is deprecated. Please use the unified API endpoints.');
    res.setHeader('X-API-Migration-Guide', 'https://docs.letrents.com/api/migration-guide');
    
    // Optionally add to response body for JSON responses
    const originalSend = res.send;
    res.send = function(body: any) {
      if (res.getHeader('content-type')?.toString().includes('application/json')) {
        try {
          const jsonBody = typeof body === 'string' ? JSON.parse(body) : body;
          if (jsonBody && typeof jsonBody === 'object') {
            jsonBody._deprecation_warning = {
              message: 'This endpoint is deprecated. Please migrate to unified API endpoints.',
              migration_guide: 'https://docs.letrents.com/api/migration-guide',
              original_route: originalPath,
              unified_route: req.path
            };
            body = JSON.stringify(jsonBody);
          }
        } catch (e) {
          // If JSON parsing fails, just send the original body
        }
      }
      return originalSend.call(this, body);
    };
  }

  next();
};

/**
 * Get all available route aliases for documentation
 */
export const getRouteAliases = (): RouteAlias[] => {
  return routeAliases;
};

/**
 * Check if a route is a legacy route
 */
export const isLegacyRoute = (path: string): boolean => {
  return routeAliases.some(alias => alias.pattern.test(path));
};

export default {
  routeAliasMiddleware,
  deprecationWarningMiddleware,
  getRouteAliases,
  isLegacyRoute
};
