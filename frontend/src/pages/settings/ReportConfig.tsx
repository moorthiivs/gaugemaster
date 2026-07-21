import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, Save, Plus, Edit2, Trash2, ArrowLeft } from "lucide-react";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import JoditEditor from 'jodit-react';
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const joditConfig = {
    readonly: false,
    placeholder: 'Start typing your report format here...',
    height: 300,
    toolbarAdaptive: false,
    buttons: [
        'source', '|',
        'bold', 'strikethrough', 'underline', 'italic', '|',
        'ul', 'ol', '|',
        'outdent', 'indent', '|',
        'font', 'fontsize', 'brush', 'paragraph', '|',
        'image', 'table', 'link', '|',
        'align', 'undo', 'redo', '|',
        'hr', 'eraser', 'copyformat', '|',
        'fullsize', 'preview', 'print'
    ],
    uploader: {
        insertImageAsBase64URI: true
    },
    image: {
        editSrc: false,
        useImageEditor: false
    }
};

interface Template {
    id: string;
    name: string;
    headerText: string;
    footerText: string;
}

export default function ReportConfig() {
    const { user, setUser } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"default" | "templates">("default");

    // Default configuration
    const [reportConfig, setReportConfig] = useState({
        headerText: "<h1>Calibration Instruments Report</h1>",
        footerText: ""
    });

    // Custom templates
    const [templates, setTemplates] = useState<Template[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formName, setFormName] = useState("");
    const [formHeader, setFormHeader] = useState("");
    const [formFooter, setFormFooter] = useState("");

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSaveDefault = async () => {
        try {
            setIsSaving(true);
            const userId = user?.id || (user as any)?.sub;
            if (!userId) {
                throw new Error("User ID is missing.");
            }
            const payload = {
                reportConfig,
                userId,
                companyId: user?.companyId
            };
            
            const response = await httpClient.post('/settings/mailconfig', payload);

            if (response.status === 201 || response.status === 200) {
                const { id } = response.data;
                const updatedUser = {
                    ...user,
                    settingsid: id
                };
                setUser(updatedUser);

                toast({
                    title: "Settings saved",
                    description: "Your report configuration has been updated successfully.",
                });
            }
        } catch (error) {
            console.error("Failed to save report configuration", error);
            toast({
                title: "Save failed",
                description: "Failed to update report settings. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setReportConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const params = { userId: user.id, companyId: user.companyId };
            const response = await httpClient.get('/settings/fetchmailconfig', { params });
            if (response.status === 200 && response.data?.reportConfig) {
                setReportConfig({
                    headerText: response.data.reportConfig.headerText || "<h1>Calibration Instruments Report</h1>",
                    footerText: response.data.reportConfig.footerText || ""
                });
            }
            // Fetch templates
            const templatesRes = await httpClient.get('/report-templates', { params: { userId: user.id } });
            setTemplates(templatesRes.data || []);
        } catch (error) {
            console.error("Error fetching report config", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchConfig();
        }
    }, [user]);

    // Custom templates API handlers
    const handleOpenCreate = () => {
        setEditingTemplate(null);
        setFormName("");
        setFormHeader("<h1>Calibration Instruments Report</h1>");
        setFormFooter("");
        setIsFormOpen(true);
    };

    const handleOpenEdit = (template: Template) => {
        setEditingTemplate(template);
        setFormName(template.name);
        setFormHeader(template.headerText);
        setFormFooter(template.footerText);
        setIsFormOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!formName.trim()) {
            return toast({
                title: "Validation Error",
                description: "Please enter a template name.",
                variant: "destructive"
            });
        }

        try {
            setIsSaving(true);
            const userId = user?.id || (user as any)?.sub;
            const payload = {
                name: formName,
                headerText: formHeader,
                footerText: formFooter,
                userId,
                companyId: user?.companyId
            };

            if (editingTemplate) {
                await httpClient.patch(`/report-templates/${editingTemplate.id}`, payload);
                toast({ title: "Template Updated", description: "The template has been updated successfully." });
            } else {
                await httpClient.post('/report-templates', payload);
                toast({ title: "Template Created", description: "The template has been created successfully." });
            }

            setIsFormOpen(false);
            fetchConfig();
        } catch (error) {
            console.error("Failed to save template", error);
            toast({
                title: "Save failed",
                description: "Failed to save the template.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenDelete = (template: Template) => {
        setTemplateToDelete(template);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!templateToDelete) return;
        try {
            setIsDeleting(true);
            await httpClient.delete(`/report-templates/${templateToDelete.id}`);
            toast({ title: "Template Deleted", description: "The template was successfully deleted." });
            setDeleteDialogOpen(false);
            fetchConfig();
        } catch (error) {
            console.error("Failed to delete template", error);
            toast({
                title: "Delete failed",
                description: "Failed to delete template.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
            setTemplateToDelete(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-72" />
                    </div>
                </div>
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-4 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <Skeleton className="h-32 w-full rounded-md" />
                            <Skeleton className="h-32 w-full rounded-md" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Report Format</h2>
                        <p className="text-muted-foreground text-sm">Configure default formats or create custom templates for your documents</p>
                    </div>
                </div>

                {!isFormOpen && (
                    <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-lg border w-fit">
                        <Button 
                            variant={activeTab === "default" ? "secondary" : "ghost"}
                            size="sm"
                            className={activeTab === "default" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}
                            onClick={() => setActiveTab("default")}
                        >
                            Default Format
                        </Button>
                        <Button 
                            variant={activeTab === "templates" ? "secondary" : "ghost"}
                            size="sm"
                            className={activeTab === "templates" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}
                            onClick={() => setActiveTab("templates")}
                        >
                            Custom Templates
                        </Button>
                    </div>
                )}
            </div>

            {isFormOpen ? (
                // Create/Edit Template Form
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setIsFormOpen(false)}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h3 className="text-lg font-bold">{editingTemplate ? "Edit Template" : "New Report Template"}</h3>
                                <p className="text-xs text-muted-foreground text-sm">Define header and footer formatting for this template</p>
                            </div>
                        </div>
                        <Button onClick={handleSaveTemplate} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Template
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="font-bold text-foreground">Template Name</Label>
                            <Input 
                                value={formName} 
                                onChange={(e) => setFormName(e.target.value)} 
                                placeholder="e.g. ISO Standard Calibration Template" 
                                className="max-w-md bg-background"
                            />
                        </div>

                        <Card className="bg-card/50 border-border/50">
                            <CardHeader>
                                <CardTitle className="text-md">Header HTML Document</CardTitle>
                                <CardDescription>HTML content that will appear at the top of generated PDF pages</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-background border rounded-md text-foreground">
                                    <JoditEditor 
                                        value={formHeader} 
                                        config={joditConfig}
                                        onBlur={(newContent) => setFormHeader(newContent)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/50 border-border/50">
                            <CardHeader>
                                <CardTitle className="text-md">Footer HTML Document</CardTitle>
                                <CardDescription>HTML content that will appear at the bottom of generated PDF pages</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-background border rounded-md text-foreground">
                                    <JoditEditor 
                                        value={formFooter} 
                                        config={joditConfig}
                                        onBlur={(newContent) => setFormFooter(newContent)}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Template"}
                        </Button>
                    </div>
                </div>
            ) : activeTab === "default" ? (
                // Default settings view
                <div className="grid gap-6">
                    <Card className="bg-card/50 border-border/50 overflow-visible">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">PDF Document Editor</CardTitle>
                            <CardDescription>
                                Attach logos, define titles, and format the text that appears at the top and bottom of each PDF page.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-12">
                            <div className="space-y-3">
                                <Label>Report Header Document</Label>
                                <div className="bg-background border rounded-md">
                                    <JoditEditor 
                                        value={reportConfig.headerText} 
                                        config={joditConfig}
                                        onBlur={(newContent) => handleInputChange("headerText", newContent)}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">This document block will be printed at the top of every PDF page.</p>
                            </div>
                            
                            <div className="space-y-3">
                                <Label>Report Footer Document</Label>
                                <div className="bg-background border rounded-md">
                                    <JoditEditor 
                                        value={reportConfig.footerText} 
                                        config={joditConfig}
                                        onBlur={(newContent) => handleInputChange("footerText", newContent)}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">This document block will be printed at the bottom of every PDF page along with the page number.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4 pb-8">
                        <Button onClick={handleSaveDefault} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Configuration
                        </Button>
                    </div>
                </div>
            ) : (
                // Custom templates list view
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold">Custom Report Templates</h3>
                            <p className="text-xs text-muted-foreground">Manage templates configured for custom report headers and footers</p>
                        </div>
                        <Button onClick={handleOpenCreate}>
                            <Plus className="h-4 w-4 mr-2" /> Add Template
                        </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {templates.map(t => (
                            <Card key={t.id} className="bg-card/50 hover:bg-card/75 transition-colors border border-border/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-md flex items-center justify-between">
                                        <span className="truncate max-w-[200px] font-bold">{t.name}</span>
                                        <div className="flex items-center gap-1.5">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => handleOpenEdit(t)}>
                                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => handleOpenDelete(t)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                        <div className="flex justify-between">
                                            <span>Header:</span>
                                            <span className="text-foreground truncate max-w-[200px]">{t.headerText ? "Configured" : "Empty"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Footer:</span>
                                            <span className="text-foreground truncate max-w-[200px]">{t.footerText ? "Configured" : "Empty"}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {templates.length === 0 && (
                            <div className="col-span-2 text-center py-12 border border-dashed rounded-lg bg-card/10">
                                <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                                <h4 className="font-semibold text-muted-foreground">No Custom Templates Found</h4>
                                <p className="text-xs text-muted-foreground/75 mb-4">Create your first custom header/footer template to use during report generation.</p>
                                <Button variant="outline" size="sm" onClick={handleOpenCreate}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Create Template
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Delete Confirm Dialog */}
                    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-destructive flex items-center gap-2">
                                    <Trash2 className="h-5 w-5" />
                                    Delete Template
                                </DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to delete the template <strong>{templateToDelete?.name}</strong>? This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </div>
    );
}
