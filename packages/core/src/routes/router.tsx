import { createBrowserRouter } from 'react-router';
import type { ShellUIConfig } from '../features/config/types';
import { createRoutes } from './routes';

export const createAppRouter = (config: ShellUIConfig) => {
  const routes = createRoutes(config);
  return createBrowserRouter(routes);
};
