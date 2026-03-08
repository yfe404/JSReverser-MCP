/**
 * EventBreakpointManager - Event listener breakpoint management
 *
 * Features:
 * 1. Set event listener breakpoints (by event type)
 * 2. Pause execution when events are triggered
 * 3. Support predefined event categories (mouse, keyboard, timers, etc.)
 *
 * Design principles:
 * - Uses CDP DOMDebugger.setEventListenerBreakpoint
 * - Provides shortcut methods for common event categories
 * - Supports custom event names
 */

import type { CDPSession } from 'puppeteer';
import { logger } from '../../utils/logger.js';

/**
 * Event breakpoint information
 */
export interface EventBreakpoint {
  id: string;
  eventName: string;
  targetName?: string;
  enabled: boolean;
  hitCount: number;
  createdAt: number;
}

/**
 * Event breakpoint manager
 *
 * Refactored: uses shared CDP session instead of creating a separate session
 */
export class EventBreakpointManager {
  private eventBreakpoints: Map<string, EventBreakpoint> = new Map();
  private breakpointCounter = 0;

  // Predefined event categories
  static readonly MOUSE_EVENTS = ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave'];
  static readonly KEYBOARD_EVENTS = ['keydown', 'keyup', 'keypress'];
  // Timer uses Instrumentation Breakpoint (not DOM events)
  static readonly TIMER_INSTRUMENTATION_EVENTS = ['TimerInstall', 'TimerFire', 'AnimationFrameFired'];
  static readonly WEBSOCKET_EVENTS = ['message', 'open', 'close', 'error'];

  /**
   * @param cdpSession Shared CDP Session (provided by DebuggerManager)
   */
  constructor(private cdpSession: CDPSession) {
    logger.info('EventBreakpointManager initialized with shared CDP session');
  }

  /**
   * Set an event listener breakpoint
   *
   * @param eventName Event name (e.g. 'click', 'setTimeout')
   * @param targetName Optional target name
   */
  async setEventListenerBreakpoint(eventName: string, targetName?: string): Promise<string> {
    try {
      // Call CDP API to set event listener breakpoint
      await this.cdpSession.send('DOMDebugger.setEventListenerBreakpoint', {
        eventName,
        targetName,
      });

      // Create breakpoint info
      const breakpointId = `event_${++this.breakpointCounter}`;
      this.eventBreakpoints.set(breakpointId, {
        id: breakpointId,
        eventName,
        targetName,
        enabled: true,
        hitCount: 0,
        createdAt: Date.now(),
      });

      logger.info(`Event listener breakpoint set: ${eventName}`, { breakpointId, targetName });
      return breakpointId;
    } catch (error) {
      logger.error('Failed to set event listener breakpoint:', error);
      throw error;
    }
  }

  /**
   * Remove an event listener breakpoint
   */
  async removeEventListenerBreakpoint(breakpointId: string): Promise<boolean> {
    const breakpoint = this.eventBreakpoints.get(breakpointId);
    if (!breakpoint) {
      return false;
    }

    try {
      if (breakpoint.targetName === '__instrumentation__') {
        await this.cdpSession.send('DOMDebugger.removeInstrumentationBreakpoint', {
          eventName: breakpoint.eventName,
        });
      } else {
        await this.cdpSession.send('DOMDebugger.removeEventListenerBreakpoint', {
          eventName: breakpoint.eventName,
          targetName: breakpoint.targetName,
        });
      }

      this.eventBreakpoints.delete(breakpointId);
      logger.info(`Event listener breakpoint removed: ${breakpointId}`);
      return true;
    } catch (error) {
      logger.error('Failed to remove event listener breakpoint:', error);
      throw error;
    }
  }

  /**
   * Set breakpoints for all mouse events
   */
  async setMouseEventBreakpoints(): Promise<string[]> {
    const breakpointIds: string[] = [];
    for (const event of EventBreakpointManager.MOUSE_EVENTS) {
      const id = await this.setEventListenerBreakpoint(event);
      breakpointIds.push(id);
    }
    logger.info(`Set ${breakpointIds.length} mouse event breakpoints`);
    return breakpointIds;
  }

  /**
   * Set breakpoints for all keyboard events
   */
  async setKeyboardEventBreakpoints(): Promise<string[]> {
    const breakpointIds: string[] = [];
    for (const event of EventBreakpointManager.KEYBOARD_EVENTS) {
      const id = await this.setEventListenerBreakpoint(event);
      breakpointIds.push(id);
    }
    logger.info(`Set ${breakpointIds.length} keyboard event breakpoints`);
    return breakpointIds;
  }

  /**
   * Set breakpoints for all timer events (using Instrumentation Breakpoint)
   */
  async setTimerEventBreakpoints(): Promise<string[]> {
    const breakpointIds: string[] = [];
    for (const event of EventBreakpointManager.TIMER_INSTRUMENTATION_EVENTS) {
      try {
        await this.cdpSession.send('DOMDebugger.setInstrumentationBreakpoint', {
          eventName: event,
        });

        const breakpointId = `event_${++this.breakpointCounter}`;
        this.eventBreakpoints.set(breakpointId, {
          id: breakpointId,
          eventName: event,
          targetName: '__instrumentation__',
          enabled: true,
          hitCount: 0,
          createdAt: Date.now(),
        });
        breakpointIds.push(breakpointId);
      } catch (error) {
        logger.warn(`Failed to set timer instrumentation breakpoint: ${event}`, error);
      }
    }
    logger.info(`Set ${breakpointIds.length} timer event breakpoints`);
    return breakpointIds;
  }

  /**
   * Set breakpoints for all WebSocket events
   */
  async setWebSocketEventBreakpoints(): Promise<string[]> {
    const breakpointIds: string[] = [];
    for (const event of EventBreakpointManager.WEBSOCKET_EVENTS) {
      const id = await this.setEventListenerBreakpoint(event, 'WebSocket');
      breakpointIds.push(id);
    }
    logger.info(`Set ${breakpointIds.length} WebSocket event breakpoints`);
    return breakpointIds;
  }

  /**
   * Get all event breakpoints
   */
  getAllEventBreakpoints(): EventBreakpoint[] {
    return Array.from(this.eventBreakpoints.values());
  }

  /**
   * Get a specific event breakpoint
   */
  getEventBreakpoint(breakpointId: string): EventBreakpoint | undefined {
    return this.eventBreakpoints.get(breakpointId);
  }

  /**
   * Clear all event breakpoints
   */
  async clearAllEventBreakpoints(): Promise<void> {
    const breakpoints = Array.from(this.eventBreakpoints.values());

    for (const bp of breakpoints) {
      try {
        if (bp.targetName === '__instrumentation__') {
          // Instrumentation breakpoints use the corresponding remove API
          await this.cdpSession.send('DOMDebugger.removeInstrumentationBreakpoint', {
            eventName: bp.eventName,
          });
        } else {
          await this.cdpSession.send('DOMDebugger.removeEventListenerBreakpoint', {
            eventName: bp.eventName,
            targetName: bp.targetName,
          });
        }
      } catch (error) {
        logger.warn(`Failed to remove event breakpoint ${bp.id}:`, error);
      }
    }

    this.eventBreakpoints.clear();
    logger.info('All event breakpoints cleared');
  }

  /**
   * Close and clean up resources
   */
  async close(): Promise<void> {
    try {
      await this.clearAllEventBreakpoints();
      logger.info('EventBreakpointManager closed');
    } catch (error) {
      logger.error('Failed to close EventBreakpointManager:', error);
      throw error;
    }
  }
}

