import { AlertTriangle, CloudSun, Loader2, MapPin } from 'lucide-react';
import React, { useState } from 'react';

import { useLocalWeather } from '../hooks/useLocalWeather';

import type { WeatherDailyForecast, WeatherForecast, WeatherSeverity } from '../types/weather';

const SEVERITY_CLASSES: Record<WeatherSeverity, string> = {
  normal: 'border-zinc-200 text-zinc-600 hover:bg-zinc-100',
  attention: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  severe: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
};

function WeatherChipButton({
  forecast,
  open,
  onClick,
}: {
  forecast: WeatherForecast;
  open: boolean;
  onClick: () => void;
}) {
  const temperature = Math.round(forecast.current.temperature);
  return (
    <button
      type="button"
      aria-label={`Clima local: ${temperature} graus, ${forecast.current.weatherLabel}`}
      aria-expanded={open}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${SEVERITY_CLASSES[forecast.overallSeverity]}`}
    >
      <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
      <span aria-hidden="true">{forecast.current.icon}</span>
      <span>{temperature}°</span>
      <span className="hidden sm:inline">{forecast.locationLabel}</span>
    </button>
  );
}

function DailyForecastRow({ day }: { day: WeatherDailyForecast }) {
  const date = new Date(`${day.date}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    weekday: 'short',
  });
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
      <span className="w-16 text-xs text-zinc-500 capitalize">{date}</span>
      <span aria-hidden="true" className="text-lg">{day.icon}</span>
      <span className="min-w-20 flex-1 text-xs text-zinc-600">{day.weatherLabel}</span>
      <span className="text-xs font-medium text-zinc-800">{Math.round(day.temperatureMin)}° / {Math.round(day.temperatureMax)}°</span>
    </div>
  );
}

function WeatherPopover({ forecast }: { forecast: WeatherForecast }) {
  const current = forecast.current;
  return (
    <div
      role="dialog"
      aria-labelledby="local-weather-popover-title"
      className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
    >
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <CloudSun className="h-4 w-4 text-orange-500" />
          <h2 id="local-weather-popover-title" className="truncate text-sm font-semibold text-zinc-900">
            {forecast.locationLabel}
          </h2>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {current.icon} {Math.round(current.temperature)}° · {current.weatherLabel}
        </p>
      </div>

      <div className="divide-y divide-zinc-100">
        {forecast.daily.slice(0, 3).map((day) => (
          <DailyForecastRow key={day.date} day={day} />
        ))}
      </div>

      {forecast.alertMessage && (
        <div className="flex gap-2 border-t border-zinc-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{forecast.alertMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function LocalWeatherChip(): React.ReactElement | null {
  const { status, forecast, requestPermission } = useLocalWeather();
  const [open, setOpen] = useState(false);

  if (status === 'hidden' || status === 'error') return null;

  if (status === 'loading') {
    return (
      <div className="relative shrink-0">
        <span className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-500" aria-label="Carregando clima local">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          <span className="hidden sm:inline">Clima</span>
        </span>
      </div>
    );
  }

  if (status === 'needsPermission') {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="Ativar clima local"
          onClick={requestPermission}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          <span aria-hidden="true">📍</span>
          <span className="hidden sm:inline">Clima local</span>
        </button>
      </div>
    );
  }

  if (!forecast) return null;

  return (
    <div className="relative shrink-0">
      <WeatherChipButton forecast={forecast} open={open} onClick={() => setOpen((value) => !value)} />
      {open && <WeatherPopover forecast={forecast} />}
    </div>
  );
}
