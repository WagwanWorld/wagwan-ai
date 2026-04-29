export function isUserSubjectAuthorized(
  profileGoogleSub: string | null | undefined,
  requestedGoogleSub: string,
): boolean {
  return !!profileGoogleSub?.trim() && profileGoogleSub.trim() === requestedGoogleSub.trim();
}
