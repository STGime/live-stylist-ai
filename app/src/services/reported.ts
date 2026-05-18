// Per-launch set of items the user has reported during this app session.
// FeedScreen / FollowScreen filter against it so reported content
// disappears immediately rather than waiting for a feed re-fetch (or
// for an admin to set hidden_at server-side).
//
// Memory-only on purpose:
//   - Acceptable v1: if the user kills + reopens the app, server-side
//     filter takes over once an admin acts (hidden_at flips on).
//     Between report-time and admin-action-time, a kill+reopen will
//     briefly resurface the row. Live with it for now.
//   - The proper fix is a server-side filter in /feed that excludes
//     sessions the requester has already reported; tracked as a
//     follow-up.

const reportedSessionIds = new Set<string>();
const reportedFollowRequestIds = new Set<string>();

export function markSessionReported(sessionId: string): void {
  reportedSessionIds.add(sessionId);
}
export function isSessionReported(sessionId: string): boolean {
  return reportedSessionIds.has(sessionId);
}

export function markFollowRequestReported(followId: string): void {
  reportedFollowRequestIds.add(followId);
}
export function isFollowRequestReported(followId: string): boolean {
  return reportedFollowRequestIds.has(followId);
}
