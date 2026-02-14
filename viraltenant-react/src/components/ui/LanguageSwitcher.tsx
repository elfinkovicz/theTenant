import { useTranslation } from 'react-i18next';
import { type SupportedLanguage } from '@/i18n';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const currentLanguage = (i18n.language?.split('-')[0] || 'de') as SupportedLanguage;

  const handleLanguageChange = (lang: SupportedLanguage) => {
    if (lang !== currentLanguage) {
      i18n.changeLanguage(lang);
    }
  };

  return (
    <div className="flex items-center gap-0.5 ml-2">
      <button
        onClick={() => handleLanguageChange('de')}
        className={`text-xs leading-none transition-all duration-200 p-0.5 ${
          currentLanguage === 'de'
            ? 'opacity-100'
            : 'opacity-25 grayscale hover:opacity-80 hover:grayscale-0'
        }`}
        aria-label="Deutsch"
        title="Deutsch"
      >
        🇩🇪
      </button>
      <button
        onClick={() => handleLanguageChange('en')}
        className={`text-xs leading-none transition-all duration-200 p-0.5 ${
          currentLanguage === 'en'
            ? 'opacity-100'
            : 'opacity-25 grayscale hover:opacity-80 hover:grayscale-0'
        }`}
        aria-label="English"
        title="English"
      >
        🇬🇧
      </button>
    </div>
  );
};
