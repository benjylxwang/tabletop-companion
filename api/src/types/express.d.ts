import type { User } from '@supabase/supabase-js';
import type { ViewMode } from '@tabletop/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestedView: ViewMode;
    }
  }
}

export {};
