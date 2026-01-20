/**
 * Callback Registry
 * Manages callbacks for toast actions and cancel buttons
 * Since postMessage can only send serializable content, callbacks are stored
 * in the SDK and triggered by ID
 */

import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

/**
 * CallbackRegistry class for managing callbacks
 */
export class CallbackRegistry {
    constructor() {
        // Map to store callbacks by ID
        // Key: callback ID (e.g., toast ID)
        // Value: { action?: Function, cancel?: Function, createdAt: Date }
        this.callbacks = new Map();
    }

    /**
     * Registers callbacks for an ID
     * @param {string} id - The callback ID (e.g., toast ID)
     * @param {Object} options - Callback options
     * @param {Function} [options.action] - Action button callback
     * @param {Function} [options.cancel] - Cancel button callback
     */
    register(id, { action, cancel } = {}) {
        if (!id) {
            logger.warn('Cannot register callback without ID');
            return;
        }

        this.callbacks.set(id, {
            action,
            cancel,
            createdAt: new Date(),
        });

        logger.debug(`Registered callbacks for ID ${id}`, {
            hasAction: !!action,
            hasCancel: !!cancel,
        });
    }

    /**
     * Triggers the action callback for an ID
     * @param {string} id - The callback ID
     * @returns {boolean} True if callback was found and triggered, false otherwise
     */
    triggerAction(id) {
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
                logger.error(`Error triggering action callback for ID ${id}:`, error);
                return false;
            }
        }

        logger.warn(`No action callback found for ID ${id}`);
        return false;
    }

    /**
     * Triggers the cancel callback for an ID
     * @param {string} id - The callback ID
     * @returns {boolean} True if callback was found and triggered, false otherwise
     */
    triggerCancel(id) {
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
                logger.error(`Error triggering cancel callback for ID ${id}:`, error);
                return false;
            }
        }

        logger.warn(`No cancel callback found for ID ${id}`);
        return false;
    }

    /**
     * Removes callbacks for an ID
     * @param {string} id - The callback ID
     * @returns {boolean} True if callbacks were found and removed, false otherwise
     */
    clear(id) {
        const existed = this.callbacks.has(id);
        if (existed) {
            const callbacks = this.callbacks.get(id);
            this.callbacks.delete(id);
            logger.debug(`Cleared callbacks for ID ${id}`, {
                createdAt: callbacks.createdAt,
                age: Date.now() - callbacks.createdAt.getTime(),
            });
        } else {
            logger.warn(`No callbacks found to clear for ID ${id}`);
        }
        return existed;
    }

    /**
     * Gets callback info for an ID (for debugging)
     * @param {string} id - The callback ID
     * @returns {Object|undefined} Callback info or undefined if not found
     */
    get(id) {
        return this.callbacks.get(id);
    }

    /**
     * Gets all registered IDs (for debugging)
     * @returns {string[]} Array of callback IDs
     */
    getAllIds() {
        return Array.from(this.callbacks.keys());
    }

    /**
     * Clears all callbacks (for cleanup)
     */
    clearAll() {
        const count = this.callbacks.size;
        this.callbacks.clear();
        logger.debug(`Cleared all callbacks (${count} total)`);
    }
}
