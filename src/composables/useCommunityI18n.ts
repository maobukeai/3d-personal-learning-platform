import { useI18n } from 'vue-i18n';

export function useCommunityI18n() {
  const { t: i18nT } = useI18n();
  const COMMUNITY_PREFIXES = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  
  const t = (key: string, ...args: unknown[]): string => {
    if (COMMUNITY_PREFIXES.some((p) => key.startsWith(p))) {
      return (i18nT as (key: string, ...args: unknown[]) => string)(`community.${key}`, ...args);
    }
    return (i18nT as (key: string, ...args: unknown[]) => string)(key, ...args);
  };

  return { t };
}
