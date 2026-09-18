import { describe, expect, it } from 'vitest';
import type { NavigationItem } from '../../features/config/types';
import { getNavigationRouteAccess } from './navigationRouteAccess';

const staffRoute: NavigationItem = {
  label: 'Staff tools',
  path: 'staff',
  url: 'https://app.example.com/staff',
  requiresStaff: true,
};

const authRoute: NavigationItem = {
  label: 'Billing',
  path: 'billing',
  url: 'https://app.example.com/billing',
  requiresAuth: true,
};

const publicRoute: NavigationItem = {
  label: 'Home',
  path: 'home',
  url: 'https://app.example.com/',
};

describe('getNavigationRouteAccess', () => {
  it('allows public routes', () => {
    expect(
      getNavigationRouteAccess(
        publicRoute,
        { isLoading: false, isAuthenticated: false, isStaff: false },
        '/home',
      ),
    ).toEqual({ kind: 'allow' });
  });

  it('redirects unauthenticated users on requiresAuth routes', () => {
    expect(
      getNavigationRouteAccess(
        authRoute,
        { isLoading: false, isAuthenticated: false, isStaff: false },
        '/billing?tab=1',
      ),
    ).toEqual({ kind: 'login', next: '/billing?tab=1' });
  });

  it('denies non-staff users on requiresStaff routes', () => {
    expect(
      getNavigationRouteAccess(
        staffRoute,
        { isLoading: false, isAuthenticated: true, isStaff: false },
        '/staff',
      ),
    ).toEqual({ kind: 'forbidden' });
  });

  it('denies signed-out users on requiresStaff routes', () => {
    expect(
      getNavigationRouteAccess(
        staffRoute,
        { isLoading: false, isAuthenticated: false, isStaff: false },
        '/staff',
      ),
    ).toEqual({ kind: 'forbidden' });
  });

  it('allows staff users on requiresStaff routes', () => {
    expect(
      getNavigationRouteAccess(
        staffRoute,
        { isLoading: false, isAuthenticated: true, isStaff: true },
        '/staff',
      ),
    ).toEqual({ kind: 'allow' });
  });

  it('waits while auth is loading', () => {
    expect(
      getNavigationRouteAccess(
        authRoute,
        { isLoading: true, isAuthenticated: false, isStaff: false },
        '/billing',
      ),
    ).toEqual({ kind: 'loading' });
  });
});
