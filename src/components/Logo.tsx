import { useSettings } from '@/context/SettingsContext';

export default function Logo({ size = 64, className = '' }: { size?: number; className?: string }) {
  const { settings } = useSettings();
  return (
    <img
      src={settings.logo_url}
      alt={`Logo ${settings.org_name}`}
      style={{ height: size, width: 'auto' }}
      className={`object-contain ${className}`}
    />
  );
}
