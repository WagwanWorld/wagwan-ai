export function instagramOAuthReturnBase(fromPage: string | undefined): '/' | '/profile' | '/join' | '/onboarding' {
  switch (fromPage) {
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
