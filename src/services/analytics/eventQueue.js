export class EventQueue {
    constructor() {
        this.events = new Map();
    }
    add(event) {
        this.events.set(event.id, event);
    }
    has(id) {
        return this.events.has(id);
    }
    get(id) {
        return this.events.get(id) ?? null;
    }
    all() {
        return Array.from(this.events.values());
    }
    filter(filters) {
        let events = this.all();
        if (filters) {
            events = events.filter((event) => Object.entries(filters).every(([key, value]) => event[key] === value));
        }
        return events;
    }
    clearOlderThan(daysOld) {
        const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
        Array.from(this.events.entries()).forEach(([id, event]) => {
            if (new Date(event.timestamp) < cutoffDate) {
                this.events.delete(id);
            }
        });
    }
    remove(id) {
        this.events.delete(id);
    }
    entries() {
        return Array.from(this.events.entries());
    }
}
