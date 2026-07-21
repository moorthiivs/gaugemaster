import { useState, useEffect } from "react";
import { useForm, Controller, UseFormSetValue, UseFormGetValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export interface FormFieldConfig {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  col?: number; // Tailwind grid span: 1 to 12
  placeholder?: string;
  options?: string[] | { label: string; value: string }[] | ((watchedValues: any) => string[]);
  defaultValue?: any;
}

interface DynamicFormProps {
  fields: FormFieldConfig[];
  validationRules: any[];
  defaultValues?: Record<string, any>;
  onSubmit: (data: any) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  onChangeEffects?: (
    name: string,
    value: any,
    setValue: UseFormSetValue<any>,
    getValues: UseFormGetValues<any>
  ) => void;
}

export default function DynamicForm({
  fields,
  validationRules,
  defaultValues = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  onChangeEffects,
}: DynamicFormProps) {
  // 1. Generate Zod Schema Dynamically
  const [dynamicSchema, setDynamicSchema] = useState<z.ZodObject<any> | null>(null);

  useEffect(() => {
    const schemaShape: Record<string, any> = {};

    fields.forEach((field) => {
      // Find database validation settings for this field
      const rule = validationRules.find((r) => r.fieldName === field.name);
      const isRequired = rule ? rule.isRequired : false;
      const displayName = rule?.displayName || field.label;
      const valType = rule?.validationType || (field.type === "number" ? "number" : field.type === "date" ? "date" : "text");

      let fieldSchema: any = z.string().trim();

      if (valType === "number") {
        if (isRequired) {
          fieldSchema = z.preprocess(
            (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
            z.number({ required_error: `${displayName} is required`, invalid_type_error: `${displayName} must be a number` })
          );
        } else {
          fieldSchema = z.preprocess(
            (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
            z.number({ invalid_type_error: `${displayName} must be a number` }).optional()
          );
        }
      } else if (valType === "date") {
        if (isRequired) {
          fieldSchema = z.string({ required_error: `${displayName} is required` })
            .min(1, { message: `${displayName} is required` })
            .refine((val) => !isNaN(Date.parse(val)), { message: `${displayName} must be a valid date` });
        } else {
          fieldSchema = z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: `${displayName} must be a valid date` })
          );
        }
      } else if (valType === "checkbox" || field.type === "checkbox") {
        fieldSchema = z.boolean().default(false).optional();
      } else {
        if (isRequired) {
          fieldSchema = z.string({ required_error: `${displayName} is required` })
            .min(1, { message: `${displayName} is required` });
        } else {
          fieldSchema = z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.string().optional()
          );
        }
      }

      schemaShape[field.name] = fieldSchema;
    });

    setDynamicSchema(z.object(schemaShape));
  }, [fields, validationRules]);

  // 2. Initialize React Hook Form once schema is built
  const [formInitialized, setFormInitialized] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm({
    resolver: dynamicSchema ? zodResolver(dynamicSchema) : undefined,
    defaultValues,
  });

  // Keep defaultValues updated (e.g. for edit mode once fetched)
  useEffect(() => {
    if (Object.keys(defaultValues).length > 0) {
      reset(defaultValues);
      setFormInitialized(true);
    }
  }, [defaultValues, reset]);

  // Watch form values for conditional options or side-effects
  const watchedValues = watch();

  if (!dynamicSchema || (!formInitialized && Object.keys(defaultValues).length > 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-sm">Building smart validation schema...</p>
      </div>
    );
  }

  const isRequired = (name: string) => {
    return validationRules.find((r) => r.fieldName === name)?.isRequired;
  };

  const getDisplayName = (name: string, defaultName: string) => {
    return validationRules.find((r) => r.fieldName === name)?.displayName || defaultName;
  };

  // Helper to map grid spans to Tailwind CSS class names (must be full strings for production JIT compiler)
  const getColSpanClass = (col?: number) => {
    switch (col) {
      case 1: return "md:col-span-1";
      case 2: return "md:col-span-2";
      case 3: return "md:col-span-3";
      case 4: return "md:col-span-4";
      case 5: return "md:col-span-5";
      case 6: return "md:col-span-6";
      case 7: return "md:col-span-7";
      case 8: return "md:col-span-8";
      case 9: return "md:col-span-9";
      case 10: return "md:col-span-10";
      case 11: return "md:col-span-11";
      case 12: return "md:col-span-12";
      default: return "md:col-span-4";
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-12">
      {fields.map((field) => {
        const fieldError = errors[field.name];
        const spanClass = getColSpanClass(field.col);
        const labelText = getDisplayName(field.name, field.label);
        const required = isRequired(field.name);

        return (
          <div key={field.name} className={`${spanClass} space-y-2`}>
            <Label htmlFor={field.name} className="text-sm font-semibold flex items-center gap-1">
              {field.type !== "checkbox" && labelText}
              {field.type !== "checkbox" && required && <span className="text-destructive font-bold">*</span>}
            </Label>

            <div className="relative">
              {/* Type: CHECKBOX */}
              {field.type === "checkbox" && (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: checkboxField }) => (
                    <div className="flex items-center space-x-2 pt-2 pb-2">
                      <Checkbox
                        id={field.name}
                        checked={checkboxField.value}
                        onCheckedChange={(checked) => {
                          checkboxField.onChange(checked);
                          if (onChangeEffects) {
                            onChangeEffects(field.name, checked, setValue, getValues);
                          }
                        }}
                      />
                      <label
                        htmlFor={field.name}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {labelText} {required && <span className="text-destructive font-bold">*</span>}
                      </label>
                    </div>
                  )}
                />
              )}
              {/* Type: TEXT, NUMBER */}
              {(field.type === "text" || field.type === "number") && (
                <Input
                  id={field.name}
                  type={field.type}
                  {...register(field.name)}
                  placeholder={field.placeholder || `Enter ${labelText.toLowerCase()}`}
                  className={`h-11 bg-background/50 border-muted-foreground/20 focus:ring-primary/20 transition-all ${
                    fieldError ? "border-destructive focus:ring-destructive/20" : ""
                  }`}
                  onChange={(e) => {
                    const val = e.target.value;
                    register(field.name).onChange(e);
                    if (onChangeEffects) {
                      onChangeEffects(field.name, val, setValue, getValues);
                    }
                  }}
                />
              )}

              {/* Type: TEXTAREA */}
              {field.type === "textarea" && (
                <Textarea
                  id={field.name}
                  {...register(field.name)}
                  placeholder={field.placeholder || `Enter ${labelText.toLowerCase()}...`}
                  className={`bg-background/50 border-muted-foreground/20 focus:ring-primary/20 transition-all min-h-[90px] ${
                    fieldError ? "border-destructive focus:ring-destructive/20" : ""
                  }`}
                  onChange={(e) => {
                    const val = e.target.value;
                    register(field.name).onChange(e);
                    if (onChangeEffects) {
                      onChangeEffects(field.name, val, setValue, getValues);
                    }
                  }}
                />
              )}

              {/* Type: SELECT */}
              {field.type === "select" && (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: selectField }) => {
                    // Resolve options (can be string array, object array, or computed function)
                    let items: { label: string; value: string }[] = [];
                    if (Array.isArray(field.options)) {
                      items = field.options.map((opt) =>
                        typeof opt === "string" ? { label: opt, value: opt } : opt
                      );
                    } else if (typeof field.options === "function") {
                      const resolved = field.options(watchedValues);
                      items = resolved.map((opt) => ({ label: opt, value: opt }));
                    }

                    return (
                      <Select
                        onValueChange={(val) => {
                          selectField.onChange(val);
                          if (onChangeEffects) {
                            onChangeEffects(field.name, val, setValue, getValues);
                          }
                        }}
                        value={selectField.value || ""}
                      >
                        <SelectTrigger
                          className={`h-11 bg-background/50 border-muted-foreground/20 ${
                            fieldError ? "border-destructive" : ""
                          }`}
                        >
                          <SelectValue placeholder={field.placeholder || "Select option"} />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
              )}

              {/* Type: DATE */}
              {field.type === "date" && (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: dateField }) => {
                    const dateValue = dateField.value ? new Date(dateField.value) : undefined;
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full h-11 justify-start text-left font-normal bg-background/50 border-muted-foreground/20 ${
                              !dateValue ? "text-muted-foreground" : ""
                            } ${fieldError ? "border-destructive text-destructive" : ""}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateValue ? format(dateValue, "yyyy-MM-dd") : field.placeholder || "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarPicker
                            mode="single"
                            selected={dateValue}
                            onSelect={(date) => {
                              if (date) {
                                const localDate = format(date, "yyyy-MM-dd");
                                dateField.onChange(localDate);
                                if (onChangeEffects) {
                                  onChangeEffects(field.name, localDate, setValue, getValues);
                                }
                              }
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    );
                  }}
                />
              )}
            </div>

            {/* Error Message */}
            {fieldError && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="h-3 w-3" />
                {String(fieldError.message)}
              </p>
            )}
          </div>
        );
      })}

      {/* Buttons */}
      <div className="md:col-span-12 flex gap-3 justify-end mt-4 pt-6 border-t">
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} className="font-bold">
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={isSubmitting} className="px-10 font-bold shadow-lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Save Instrument"
          )}
        </Button>
      </div>
    </form>
  );
}
