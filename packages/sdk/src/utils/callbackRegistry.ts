/**
 * Callback Registry
 * Manages callbacks for toast actions and cancel buttons
 * Since postMessage can only send serializable content, callbacks are stored
 * in the SDK and triggered by ID
 */

import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

interface CallbackEntry {
  action?: () => void;
  cancel?: () => void;
  secondary?: () => void;
  createdAt: Date;
}

export class CallbackRegistry {
  private callbacks = new Map<string, CallbackEntry>();

  register(
    id: string,
    { action, cancel, secondary }: { action?: () => void; cancel?: () => void; secondary?: () => void } = {}
  ): void {
    if (!id) {
      logger.warn('Cannot register callback without ID');
      return;
    }

    this.callbacks.set(id, {
      action,
      cancel,
      secondary,
      createdAt: new Date(),
    });

    logger.debug(`Registered callbacks for ID ${id}`, {
      hasAction: !!action,
      hasCancel: !!cancel,
      hasSecondary: !!secondary,
    });
  }

  triggerAction(id: string): boolean {
    const callbacks = this.callbacks.get(id);
    if (!callbacks) {
      logger.warn(`No callbacks found for ID ${id}`);
      return false;
    }

    if (callbacks.action && typeof callbacks.action === 'function') {
      try {
        callbacks.action();
        logger.debug(`Triggered action callback for ID ${id}`);
        return true;
      } catch (error) {
        logger.error(`Error triggering action callback for ID ${id}:`, {
          error,
        });
        return false;
      }
    }

    logger.warn(`No action callback found for ID ${id}`);
    return false;
  }

  triggerCancel(id: string): boolean {
    const callbacks = this.callbacks.get(id);
    if (!callbacks) {
      logger.warn(`No callbacks found for ID ${id}`);
      return false;
    }

    if (callbacks.cancel && typeof callbacks.cancel === 'function') {
      try {
        callbacks.cancel();
        logger.debug(`Triggered cancel callback for ID ${id}`);
        return true;
      } catch (error) {
        logger.error(`Error triggering cancel callback for ID ${id}:`, {
          error,
        });
        return false;
      }
    }

    logger.warn(`No cancel callback found for ID ${id}`);
    return false;
  }

  triggerSecondary(id: string): boolean {
    const callbacks = this.callbacks.get(id);
    if (!callbacks) {
      logger.warn(`No callbacks found for ID ${id}`);
      return false;
    }

    if (callbacks.secondary && typeof callbacks.secondary === 'function') {
      try {
        callbacks.secondary();
        logger.debug(`Triggered secondary callback for ID ${id}`);
        return true;
      } catch (error) {
        logger.error(`Error triggering secondary callback for ID ${id}:`, {
          error,
        });
        return false;
      }
    }

    logger.warn(`No secondary callback found for ID ${id}`);
    return false;
  }

  clear(id: string): boolean {
    const existed = this.callbacks.has(id);
    if (existed) {
      const callbacks = this.callbacks.get(id);
      this.callbacks.delete(id);
      if (callbacks) {
        logger.debug(`Cleared callbacks for ID ${id}`, {
          createdAt: callbacks.createdAt,
          age: Date.now() - callbacks.createdAt.getTime(),
        });
      }
    } else {
      logger.warn(`No callbacks found to clear for ID ${id}`);
    }
    return existed;
  }

  get(id: string): CallbackEntry | undefined {
    return this.callbacks.get(id);
  }

  getAllIds(): string[] {
    return Array.from(this.callbacks.keys());
  }

  clearAll(): void {
    const count = this.callbacks.size;
    this.callbacks.clear();
    logger.debug(`Cleared all callbacks (${count} total)`);
  }
}
