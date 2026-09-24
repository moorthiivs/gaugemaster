import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export interface ScreenContextInfo {
  screenContext: string;
  screenTitle: string;
  badge: string;
  entityId?: string;
  suggestedPrompts: string[];
}

export function useScreenContext(): ScreenContextInfo {
  const location = useLocation();

  return useMemo(() => {
    const path = location.pathname.toLowerCase();
    const searchParams = new URLSearchParams(location.search);
    const idParam = searchParams.get('id') || searchParams.get('templateId') || undefined;

    if (path.includes('/calibration/templates/builder')) {
      return {
        screenContext: 'template_builder',
        screenTitle: 'Visual Template Builder',
        badge: 'ISO 17025 Canvas Studio',
        entityId: idParam,
        suggestedPrompts: [
          'Audit formula syntax & measurement uncertainty',
          'Generate LF standard repeatability table',
          'Test boundary limits against ISO/IEC 17025',
          'Propose calibration data columns for micrometer standard',
        ],
      };
    }

    if (path.includes('/calibration/templates')) {
      return {
        screenContext: 'template_catalog',
        screenTitle: 'Template Catalog',
        badge: 'Master Templates',
        entityId: idParam,
        suggestedPrompts: [
          'How do I create a new ISO 17025 visual template?',
          'Recommend calibration template for Micrometers & Calipers',
          'What is the difference between visual and legacy templates?',
        ],
      };
    }

    if (path.includes('/calibration/wizard')) {
      return {
        screenContext: 'calibration_wizard',
        screenTitle: 'Calibration Execution Wizard',
        badge: 'Live Calibration',
        entityId: idParam,
        suggestedPrompts: [
          'Verify environmental conditions (20°C ± 1°C, 45-60% RH)',
          'Validate standard uncertainty budget (k=2, 95% CL)',
          'Explain calibration receipt condition rules & criteria',
        ],
      };
    }

    if (path.includes('/instruments')) {
      return {
        screenContext: 'instruments',
        screenTitle: 'Instrument Master Registry',
        badge: 'Asset Tracking',
        entityId: idParam,
        suggestedPrompts: [
          'Guide me on ISO 17025 calibration intervals for gauges',
          'How to assign primary calibration master standards?',
          'Check overdue and upcoming calibration schedules',
        ],
      };
    }

    if (path.includes('/reports')) {
      return {
        screenContext: 'reports',
        screenTitle: 'Calibration Reports & Certificates',
        badge: 'Quality Records',
        entityId: idParam,
        suggestedPrompts: [
          'Summarize pass/fail rates for this month',
          'Prepare calibration audit log export',
          'Check certificate approval bottlenecks',
        ],
      };
    }

    if (path.includes('/dashboard')) {
      return {
        screenContext: 'dashboard',
        screenTitle: 'Quality Operations Dashboard',
        badge: 'Lab Operations',
        entityId: idParam,
        suggestedPrompts: [
          'Summarize overall lab calibration status',
          'Which instruments are currently overdue?',
          'Show active technicians and pending approvals',
        ],
      };
    }

    return {
      screenContext: 'general',
      screenTitle: 'Gaugemaster Quality Suite',
      badge: 'Metrology Copilot',
      entityId: idParam,
      suggestedPrompts: [
        'How do I setup standard calibration tolerances?',
        'Explain ISO/IEC 17025 compliance requirements',
        'Help navigate Gaugemaster calibration modules',
      ],
    };
  }, [location.pathname, location.search]);
}
