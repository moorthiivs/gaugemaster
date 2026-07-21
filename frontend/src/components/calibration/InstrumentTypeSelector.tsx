import { CALIBRATION_TYPES, CalibrationTypeConfig } from "@/types/calibration";
import { Card } from "@/components/ui/card";
import { Gauge, Thermometer, Ruler, RotateCw, Zap, Scale, Droplets } from "lucide-react";

interface InstrumentTypeSelectorProps {
  selectedType: string;
  onSelect: (type: CalibrationTypeConfig) => void;
}

const iconMap: Record<string, React.ElementType> = {
  Gauge,
  Thermometer,
  Ruler,
  RotateCw,
  Zap,
  Scale,
  Droplets,
};

const colorMap: Record<string, string> = {
  pressure: "from-blue-500/20 to-blue-600/10 border-blue-300 hover:border-blue-400",
  temperature: "from-orange-500/20 to-orange-600/10 border-orange-300 hover:border-orange-400",
  dimensional: "from-emerald-500/20 to-emerald-600/10 border-emerald-300 hover:border-emerald-400",
  torque: "from-violet-500/20 to-violet-600/10 border-violet-300 hover:border-violet-400",
  electrical: "from-yellow-500/20 to-yellow-600/10 border-yellow-300 hover:border-yellow-400",
  weight: "from-cyan-500/20 to-cyan-600/10 border-cyan-300 hover:border-cyan-400",
  flow: "from-sky-500/20 to-sky-600/10 border-sky-300 hover:border-sky-400",
};

const iconColorMap: Record<string, string> = {
  pressure: "text-blue-500",
  temperature: "text-orange-500",
  dimensional: "text-emerald-500",
  torque: "text-violet-500",
  electrical: "text-yellow-500",
  weight: "text-cyan-500",
  flow: "text-sky-500",
};

/**
 * Visual card grid for selecting the instrument calibration type.
 */
export function InstrumentTypeSelector({ selectedType, onSelect }: InstrumentTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {CALIBRATION_TYPES.map((ct) => {
        const IconComp = iconMap[ct.icon] || Gauge;
        const isSelected = selectedType === ct.type;
        const colors = colorMap[ct.type] || "";
        const iconColor = iconColorMap[ct.type] || "text-primary";

        return (
          <Card
            key={ct.type}
            onClick={() => onSelect(ct)}
            className={`cursor-pointer p-4 transition-all duration-200 bg-gradient-to-br ${colors} ${
              isSelected
                ? "ring-2 ring-primary shadow-lg scale-[1.02]"
                : "hover:shadow-md"
            }`}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className={`p-2.5 rounded-xl bg-background/60 shadow-sm ${isSelected ? "ring-1 ring-primary/30" : ""}`}>
                <IconComp className={`w-6 h-6 ${iconColor}`} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{ct.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{ct.description}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
