export class MembershipSelfHealTracker {
  private attempts = new Set<string>();

  shouldAttempt(userId?: string | null, orgId?: string | null): boolean {
    if (!userId || !orgId) {
      return false;
    }
    const key = `${userId}:${orgId}`;
    if (this.attempts.has(key)) {
      return false;
    }
    this.attempts.add(key);
    return true;
  }

  resetForTesting(): void {
    this.attempts.clear();
  }
}

export const createMembershipSelfHealTracker = () => new MembershipSelfHealTracker();
