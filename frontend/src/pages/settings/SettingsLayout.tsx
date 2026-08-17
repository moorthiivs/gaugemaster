import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReactNode, useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export interface SettingsTabItem {
  category?: string;
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface SettingsLayoutProps {
  defaultTab?: string;
  tabs: SettingsTabItem[];
}

export default function SettingsLayout({ defaultTab = "mail", tabs }: SettingsLayoutProps) {
  // Collapsed state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("gaugemaster_settings_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("gaugemaster_settings_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Group tabs by category
  const groupedTabs = useMemo(() => {
    const groups: { category: string; items: SettingsTabItem[] }[] = [];
    tabs.forEach((tab) => {
      const cat = tab.category || "General Configuration";
      let existing = groups.find((g) => g.category === cat);
      if (!existing) {
        existing = { category: cat, items: [] };
        groups.push(existing);
      }
      existing.items.push(tab);
    });
    return groups;
  }, [tabs]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="w-full h-[calc(100vh-6rem)] overflow-hidden bg-background">
        <Tabs defaultValue={defaultTab} orientation="horizontal" className="flex flex-col md:flex-row gap-6 w-full h-full items-start overflow-hidden">
          {/* Mobile / Tablet Horizontal Navigation (< md) */}
          <div className="md:hidden w-full overflow-x-auto pb-2 shrink-0 scrollbar-none">
            <TabsList className="inline-flex h-auto p-1.5 bg-muted/60 rounded-xl border gap-1 w-max">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap
                    data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm
                    transition-all duration-200"
                >
                  {tab.icon && <span className="text-base shrink-0">{tab.icon}</span>}
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Desktop Left Sidebar (>= md) - Fixed in Viewport */}
          <Card
            className={`hidden md:flex flex-col h-full max-h-full bg-card/70 backdrop-blur-md border-border/70 shadow-md shrink-0 rounded-2xl transition-all duration-300 ease-in-out overflow-hidden ${
              isCollapsed ? "w-20" : "w-80 lg:w-84 xl:w-88"
            }`}
          >
            {/* Top Fixed Header with Toggle */}
            <div className={`p-3 lg:p-4 pb-2 border-b border-border/50 shrink-0 flex items-center ${isCollapsed ? "justify-center" : "justify-between px-3"}`}>
              {!isCollapsed && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground animate-in fade-in duration-200">
                  Configuration
                </h3>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCollapse}
                    className="h-8 w-8 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  >
                    {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "bottom"}>
                  {isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Scrollable Groups Container if tabs exceed height, else clean list */}
            <div className={`p-3 lg:p-4 space-y-4 flex-1 overflow-y-auto ${isCollapsed ? "px-2" : ""}`}>
              {groupedTabs.map((group, gIdx) => (
                <div key={group.category} className="space-y-1.5">
                  {/* Category Header */}
                  {!isCollapsed ? (
                    <div className="px-2.5 py-1 flex items-center gap-2 animate-in fade-in duration-200">
                      <div className="h-2 w-2 bg-primary/70 rounded-full shrink-0" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
                        {group.category}
                      </h3>
                    </div>
                  ) : (
                    <div className="flex justify-center py-1">
                      <div className="h-1 w-5 bg-border/80 rounded-full" />
                    </div>
                  )}

                  {/* Tabs in Category */}
                  <TabsList className="flex flex-col space-y-1 w-full bg-transparent p-0 h-auto">
                    {group.items.map((tab) => {
                      const triggerButton = (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className={`w-full rounded-xl text-left
                            bg-transparent border-0 text-foreground/85 font-semibold text-sm
                            hover:bg-muted/60 hover:text-foreground
                            data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-md
                            transition-all duration-200 flex items-center group ${
                              isCollapsed
                                ? "justify-center p-2.5 h-11 w-11 mx-auto"
                                : "justify-start px-3.5 py-2.5 gap-3"
                            }`}
                        >
                          {tab.icon && (
                            <span className="shrink-0 text-base transition-transform group-hover:scale-110 group-data-[state=active]:text-primary-foreground duration-200">
                              {tab.icon}
                            </span>
                          )}
                          {!isCollapsed && <span className="leading-snug break-words animate-in fade-in duration-200">{tab.label}</span>}
                        </TabsTrigger>
                      );

                      if (isCollapsed) {
                        return (
                          <Tooltip key={tab.value}>
                            <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
                            <TooltipContent side="right" className="font-semibold text-xs py-1.5 px-3">
                              <p>{tab.label}</p>
                              <p className="text-[10px] text-muted-foreground font-normal">{group.category}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return triggerButton;
                    })}
                  </TabsList>

                  {gIdx < groupedTabs.length - 1 && <div className="border-b border-border/40 pt-2" />}
                </div>
              ))}
            </div>
          </Card>

          {/* Right Main Content Area - Scrollable Independently */}
          <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 pb-6">
            {tabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
                <Card className="bg-card/70 backdrop-blur-md border-border/70 shadow-md rounded-2xl">
                  <div className="p-5 sm:p-7 lg:p-8">
                    {tab.content}
                  </div>
                </Card>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
