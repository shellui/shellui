import { useTranslation } from 'react-i18next';

export const HomeView = () => {
  const { t } = useTranslation('common');

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      flexDirection: 'column',
      color: '#666'
    }}>
      <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 300 }}>{t('welcome')}</h1>
      <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>{t('getStarted')}</p>
    </div>
  );
};
