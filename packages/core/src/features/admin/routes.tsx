import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import type { ShellUIConfig } from '../config/types';
import { getAdminPath } from './config';

const AdminView = lazy(() => import('./AdminView').then((m) => ({ default: m.AdminView })));

export function createAdminRoute(config: ShellUIConfig): RouteObject {
  const adminPath = getAdminPath(config);
  return {
    path: `${adminPath.replace(/^\//, '')}/*`,
    element: <AdminView />,
  };
}
