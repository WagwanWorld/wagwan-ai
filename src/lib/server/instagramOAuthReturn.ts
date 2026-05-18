type InstagramReturnBase = '/' | '/profile' | '/join' | '/onboarding';

export function instagramOAuthReturnBase(from: string | null | undefined): InstagramReturnBase {
  switch (from) {
    case 'landing':
      return '/';
    case 'profile':
      return '/profile';
    case 'join':
      return '/join';
    default:
      return '/onboarding';
  }
}
