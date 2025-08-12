import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface SettingsLayoutProps {
    defaultTab?: string;
    tabs: { value: string; label: string; icon?: string; content: ReactNode }[];
}

export default function SettingsLayout({ defaultTab = "mail", tabs }: SettingsLayoutProps) {
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto">
                {/* <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                        Settings
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Configure your preferences and app settings
                    </p>
                </div> */}

                <Tabs defaultValue={defaultTab} orientation="horizontal" className="flex gap-8">
                    {/* Side Navigation */}
                    <Card className="w-80 h-fit bg-settings-nav border-border/50">
                        <div className="p-6">
                            <TabsList className="flex flex-col space-y-2 w-full bg-transparent p-0 h-auto">
                                {tabs.map((tab) => (
                                    <TabsTrigger
                                        key={tab.value}
                                        value={tab.value}
                                        className="w-full justify-start px-4 py-3 rounded-lg text-left 
                                                 bg-transparent border-0 
                                                 hover:bg-accent/50 hover:text-accent-foreground
                                                 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground 
                                                 data-[state=active]:shadow-elegant data-[state=active]:font-semibold
                                                 transition-all duration-300 ease-smooth"
                                    >
                                        {tab.icon && (
                                            <span className="mr-3 text-lg">{tab.icon}</span>
                                        )}
                                        <span className="text-sm">{tab.label}</span>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                    </Card>

                    {/* Content Area */}
                    <div className="flex-1">
                        {tabs.map((tab) => (
                            <TabsContent key={tab.value} value={tab.value} className="mt-0">
                                <Card className="bg-settings-content border-border/50">
                                    <div className="p-8">
                                        {tab.content}
                                    </div>
                                </Card>
                            </TabsContent>
                        ))}
                    </div>
                </Tabs>
            </div>
        </div>
    );
}