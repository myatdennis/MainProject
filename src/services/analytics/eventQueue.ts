import type { AnalyticsEvent } from '../analyticsService';

export type EventFilter = Partial<Pick<AnalyticsEvent, 'courseId' | 'lessonId' | 'moduleId' | 'type' | 'userId'>>;

export class EventQueue {
  private readonly events = new Map<string, AnalyticsEvent>();

  add(event: AnalyticsEvent) {
    this.events.set(event.id, event);
  }

  has(id: string) {
    return this.events.has(id);
  }

  get(id: string) {
    return this.events.get(id) ?? null;
  }

  all() {
    return Array.from(this.events.values());
  }

  filter(filters?: EventFilter) {
    let events = this.all();
    if (filters) {
      events = events.filter((event) =>
        Object.entries(filters).every(([key, value]) => event[key as keyof AnalyticsEvent] === value),
      );
    }
    return events;
  }

  clearOlderThan(daysOld: number) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    Array.from(this.events.entries()).forEach(([id, event]) => {
      if (new Date(event.timestamp) < cutoffDate) {
        this.events.delete(id);
      }
    });
  }

  remove(id: string) {
    this.events.delete(id);
  }

  entries() {
    return Array.from(this.events.entries());
  }
}
