import { useStore } from '@/store/useStore';
import { strings, AppStrings } from './strings';

export { AppStrings };

export function useI18n(): AppStrings {
  const appLanguage = useStore(s => s.appLanguage);
  return strings[appLanguage] ?? strings.en;
}
