export function supportsMatchResult(session) {
  return session?.result_tracking_enabled === true || Number(session?.match_stats_version) >= 2;
}

