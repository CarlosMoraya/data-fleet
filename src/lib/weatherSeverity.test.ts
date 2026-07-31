import { describe, expect, it } from 'vitest';

import {
  buildWeatherAlertMessage,
  combineWeatherSeverity,
  deriveWeatherSeverity,
  getWeatherCodePresentation,
} from './weatherSeverity';

describe('weatherSeverity', () => {
  it('apresenta céu limpo, chuva forte, tempestade e código desconhecido', () => {
    expect(getWeatherCodePresentation(0)).toEqual({ label: 'céu limpo', icon: '☀️' });
    expect(getWeatherCodePresentation(65)).toEqual({ label: 'chuva forte', icon: '🌧️' });
    expect(getWeatherCodePresentation(95)).toEqual({ label: 'tempestade', icon: '⛈️' });
    expect(getWeatherCodePresentation(999)).toEqual({ label: 'condição climática', icon: '🌤️' });
  });

  it('classifica tempestade como severa', () => {
    expect(deriveWeatherSeverity({ weatherCode: 95 })).toBe('severe');
  });

  it('classifica rajadas de 70 km/h ou mais como severas', () => {
    expect(deriveWeatherSeverity({ weatherCode: 0, windGusts: 70 })).toBe('severe');
  });

  it('classifica probabilidade de chuva de 70% ou mais como atenção', () => {
    expect(deriveWeatherSeverity({ weatherCode: 0, precipitationProbability: 70 })).toBe('attention');
  });

  it('respeita a prioridade entre severidade normal, atenção e severa', () => {
    expect(combineWeatherSeverity(['normal', 'attention'])).toBe('attention');
    expect(combineWeatherSeverity(['attention', 'severe'])).toBe('severe');
    expect(combineWeatherSeverity([])).toBe('normal');
  });

  it('gera mensagem apenas quando há condição de atenção ou severa', () => {
    const current = {
      temperature: 26,
      apparentTemperature: 26,
      weatherCode: 0,
      weatherLabel: 'céu limpo',
      icon: '☀️',
      precipitation: 0,
      windSpeed: 10,
      windGusts: 20,
      severity: 'normal' as const,
    };

    expect(buildWeatherAlertMessage({ current, daily: [], overallSeverity: 'normal' })).toBeNull();
    expect(
      buildWeatherAlertMessage({
        current: { ...current, weatherCode: 95, severity: 'severe' },
        daily: [],
        overallSeverity: 'severe',
      }),
    ).toBe('Tempestade prevista na sua região.');
  });
});
