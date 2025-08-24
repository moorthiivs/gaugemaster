import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

interface SetupData {
  companyName: string;
  companySize: string;
  industry: string;
  userRole: string;
  userName: string;
}

export default function OnboardingWizard() {
  useSEO({
    title: "Welcome Setup — Calibration Alerts",
    description: "Complete your profile setup to get started with instrument management.",
  });

  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({
    companyName: "",
    companySize: "",
    industry: "",
    userRole: "",
    userName: "",
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Frontend-only save - just store in localStorage for demo
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupData', JSON.stringify(setupData));
    
    toast({
      title: "Setup Complete!",
      description: "Welcome to Calibration Alerts. Let's get started!",
    });
    
    navigate("/dashboard", { replace: true });
  };

  const updateData = (field: keyof SetupData, value: string) => {
    setSetupData(prev => ({ ...prev, [field]: value }));
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return setupData.companyName && setupData.companySize && setupData.industry;
      case 2:
        return setupData.userRole;
      case 3:
        return setupData.userName;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Calibration Alerts</CardTitle>
          <p className="text-muted-foreground">Let's set up your account in just a few steps</p>
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">Step {currentStep} of {totalSteps}</p>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Step 1: Company Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">Company Information</h3>
                <p className="text-muted-foreground">Tell us about your organization</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="Enter your company name"
                    value={setupData.companyName}
                    onChange={(e) => updateData('companyName', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="companySize">Company Size</Label>
                  <Select value={setupData.companySize} onValueChange={(value) => updateData('companySize', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-500">201-500 employees</SelectItem>
                      <SelectItem value="500+">500+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={setupData.industry} onValueChange={(value) => updateData('industry', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="aerospace">Aerospace</SelectItem>
                      <SelectItem value="automotive">Automotive</SelectItem>
                      <SelectItem value="pharmaceutical">Pharmaceutical</SelectItem>
                      <SelectItem value="energy">Energy</SelectItem>
                      <SelectItem value="research">Research & Development</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: User Role */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">Your Role</h3>
                <p className="text-muted-foreground">What's your role in the company?</p>
              </div>
              
              <div>
                <Label htmlFor="userRole">Role</Label>
                <Select value={setupData.userRole} onValueChange={(value) => updateData('userRole', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quality-manager">Quality Manager</SelectItem>
                    <SelectItem value="lab-technician">Lab Technician</SelectItem>
                    <SelectItem value="calibration-technician">Calibration Technician</SelectItem>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: User Name */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">Personal Information</h3>
                <p className="text-muted-foreground">How should we address you?</p>
              </div>
              
              <div>
                <Label htmlFor="userName">Full Name</Label>
                <Input
                  id="userName"
                  placeholder="Enter your full name"
                  value={setupData.userName}
                  onChange={(e) => updateData('userName', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            
            {currentStep < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={!isStepValid()}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!isStepValid()}
              >
                Complete Setup
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}