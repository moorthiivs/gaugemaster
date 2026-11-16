import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface BreadcrumbItemData {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  icon?: LucideIcon;
  breadcrumbs?: BreadcrumbItemData[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  icon: Icon,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-3 pb-4 border-b border-border/60", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  <BreadcrumbItem>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage className="font-medium text-foreground">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.href} className="hover:text-primary transition-colors">
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            {Icon && (
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0 shadow-2xs">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {badge && (
              typeof badge === "string" ? (
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-border bg-muted/50">
                  {badge}
                </Badge>
              ) : (
                badge
              )
            )}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0 pt-1 sm:pt-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
