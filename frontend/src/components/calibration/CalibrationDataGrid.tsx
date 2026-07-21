import { useState, useEffect } from "react";
import { CalibrationPoint, CalibrationTypeConfig } from "@/types/calibration";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CalibrationDataGridProps {
  typeConfig: CalibrationTypeConfig;
  points: CalibrationPoint[];
  onPointsChange: (points: CalibrationPoint[]) => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  tolerance: number;
  onToleranceChange: (tolerance: number) => void;
}

/**
 * Dynamic data entry grid for calibration points.
 * Adapts columns based on instrument type, auto-calculates error,
 * and color-codes cells based on tolerance.
 */
export function CalibrationDataGrid({
  typeConfig,
  points,
  onPointsChange,
  unit,
  onUnitChange,
  tolerance,
  onToleranceChange,
}: CalibrationDataGridProps) {
  const hasDescending = typeConfig.columns.some(c => c.key === "descending_reading");

  const addPoint = () => {
    const newPoint: CalibrationPoint = {
      point_number: points.length + 1,
      nominal: 0,
      ascending_reading: 0,
      descending_reading: hasDescending ? 0 : undefined,
      error: 0,
      unit,
      tolerance,
      status: undefined,
    };
    onPointsChange([...points, newPoint]);
  };

  const removePoint = (index: number) => {
    const updated = points.filter((_, i) => i !== index).map((p, i) => ({ ...p, point_number: i + 1 }));
    onPointsChange(updated);
  };

  const updatePoint = (index: number, field: string, value: number) => {
    const updated = [...points];
    const pt = { ...updated[index], [field]: value };

    // Auto-calculate error
    if (hasDescending) {
      const avg = ((pt.ascending_reading || 0) + (pt.descending_reading || 0)) / 2;
      pt.error = parseFloat((avg - (pt.nominal || 0)).toFixed(4));
    } else {
      pt.error = parseFloat(((pt.ascending_reading || 0) - (pt.nominal || 0)).toFixed(4));
    }

    // Determine pass/fail
    pt.tolerance = tolerance;
    pt.unit = unit;
    if (tolerance > 0) {
      pt.status = Math.abs(pt.error) <= tolerance ? "PASS" : "FAIL";
    }

    updated[index] = pt;
    onPointsChange(updated);
  };

  const addMultiplePoints = (count: number) => {
    const newPoints: CalibrationPoint[] = [];
    for (let i = 0; i < count; i++) {
      newPoints.push({
        point_number: points.length + i + 1,
        nominal: 0,
        ascending_reading: 0,
        descending_reading: hasDescending ? 0 : undefined,
        error: 0,
        unit,
        tolerance,
        status: undefined,
      });
    }
    onPointsChange([...points, ...newPoints]);
  };

  // Get column labels from config
  const nominalCol = typeConfig.columns.find(c => c.key === "nominal");
  const ascCol = typeConfig.columns.find(c => c.key === "ascending_reading");
  const descCol = typeConfig.columns.find(c => c.key === "descending_reading");
  const errorCol = typeConfig.columns.find(c => c.key === "error");

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Unit</label>
          <Select value={unit} onValueChange={onUnitChange}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeConfig.units.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tolerance (±)</label>
          <Input
            type="number"
            value={tolerance}
            onChange={(e) => {
              const newTol = parseFloat(e.target.value) || 0;
              onToleranceChange(newTol);
              
              // Re-evaluate all points with new tolerance
              const updated = points.map(pt => {
                const newPt = { ...pt, tolerance: newTol };
                if (newTol > 0) {
                  newPt.status = Math.abs(newPt.error) <= newTol ? "PASS" : "FAIL";
                } else {
                  newPt.status = undefined;
                }
                return newPt;
              });
              onPointsChange(updated);
            }}
            className="w-[120px] h-9"
            step="0.01"
          />
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => addMultiplePoints(5)} className="text-xs">
            +5 Points
          </Button>
          <Button variant="outline" size="sm" onClick={() => addMultiplePoints(10)} className="text-xs">
            +10 Points
          </Button>
          <Button size="sm" onClick={addPoint} className="gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add Point
          </Button>
        </div>
      </div>

      {/* Data Table */}
      {points.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center font-semibold">Pt</TableHead>
                <TableHead className="font-semibold">{nominalCol?.label || "Nominal"} ({unit})</TableHead>
                <TableHead className="font-semibold">{ascCol?.label || "Ascending"} ({unit})</TableHead>
                {hasDescending && <TableHead className="font-semibold">{descCol?.label || "Descending"} ({unit})</TableHead>}
                <TableHead className="font-semibold">{errorCol?.label || "Error"} ({unit})</TableHead>
                <TableHead className="font-semibold text-center">Tolerance (±{tolerance})</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((pt, idx) => {
                const isOutOfTolerance = tolerance > 0 && Math.abs(pt.error) > tolerance;
                return (
                  <TableRow key={idx} className={isOutOfTolerance ? "bg-red-50 dark:bg-red-950/20" : ""}>
                    <TableCell className="text-center font-medium text-muted-foreground">{pt.point_number}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={pt.nominal || ""}
                        onChange={(e) => updatePoint(idx, "nominal", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        step="any"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={pt.ascending_reading || ""}
                        onChange={(e) => updatePoint(idx, "ascending_reading", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        step="any"
                      />
                    </TableCell>
                    {hasDescending && (
                      <TableCell>
                        <Input
                          type="number"
                          value={pt.descending_reading || ""}
                          onChange={(e) => updatePoint(idx, "descending_reading", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          step="any"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <span className={`font-mono text-sm font-medium ${isOutOfTolerance ? "text-red-600" : "text-emerald-600"}`}>
                        {pt.error.toFixed(4)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      ±{tolerance}
                    </TableCell>
                    <TableCell className="text-center">
                      {pt.status === "PASS" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300 text-[10px]">PASS</Badge>
                      ) : pt.status === "FAIL" ? (
                        <Badge className="bg-red-500/15 text-red-600 border-red-300 text-[10px]">FAIL</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removePoint(idx)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-sm">No calibration points added yet.</p>
          <p className="text-xs mt-1">Click "Add Point" or use the bulk add buttons above.</p>
        </div>
      )}

      {/* Summary */}
      {points.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{points.length} point(s)</span>
          {tolerance > 0 && (
            <>
              <span className="text-emerald-600 font-medium">
                {points.filter(p => p.status === "PASS").length} Pass
              </span>
              <span className="text-red-600 font-medium">
                {points.filter(p => p.status === "FAIL").length} Fail
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
