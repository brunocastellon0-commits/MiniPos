"use client";

import { Button } from "./button";
import { Input } from "./input";

export interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onPresetSelect?: (preset: "today" | "7days" | "30days" | "month") => void;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onPresetSelect,
}: DateRangeFilterProps) {
  const handlePreset = (preset: "today" | "7days" | "30days" | "month") => {
    if (onPresetSelect) {
      onPresetSelect(preset);
      return;
    }
    const today = new Date();
    const format = (d: Date) => d.toISOString().split("T")[0]!;
    const end = format(today);

    if (preset === "today") {
      onStartDateChange(end);
      onEndDateChange(end);
    } else if (preset === "7days") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      onStartDateChange(format(past));
      onEndDateChange(end);
    } else if (preset === "30days") {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      onStartDateChange(format(past));
      onEndDateChange(end);
    } else if (preset === "month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      onStartDateChange(format(startOfMonth));
      onEndDateChange(end);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-muted">Desde:</label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="h-9 w-auto text-xs"
          aria-label="Fecha desde"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-muted">Hasta:</label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="h-9 w-auto text-xs"
          aria-label="Fecha hasta"
        />
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 px-2.5 text-xs"
          onClick={() => handlePreset("today")}
        >
          Hoy
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 px-2.5 text-xs"
          onClick={() => handlePreset("7days")}
        >
          7 días
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 px-2.5 text-xs"
          onClick={() => handlePreset("30days")}
        >
          30 días
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 px-2.5 text-xs"
          onClick={() => handlePreset("month")}
        >
          Este mes
        </Button>
      </div>
    </div>
  );
}
