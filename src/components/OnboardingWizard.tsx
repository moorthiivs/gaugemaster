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
import { Building2, User, UserCheck } from "lucide-react";
import heroImage from "@/assets/hero-instruments.jpg";
import dashboardPreview from "@/assets/dashboard-preview.jpg";

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

  const getStepIcon = () => {
    switch (currentStep) {
      case 1: return Building2;
      case 2: return UserCheck;
      case 3: return User;
      default: return Building2;
    }
  };

  const getStepImage = () => {
    switch (currentStep) {
      case 1: return heroImage;
      case 2: return dashboardPreview;
      case 3: return heroImage;
      default: return heroImage;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent" />
      
      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Image */}
        <div className="hidden lg:flex lg:w-1/2 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
          <img 
            src={getStepImage()} 
            alt="Setup illustration" 
            className="w-full h-full object-cover transition-all duration-700 ease-in-out animate-fade-in"
            key={currentStep}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 text-white">
            <h2 className="text-3xl font-bold mb-2 animate-fade-in">
              {currentStep === 1 && "Tell us about your company"}
              {currentStep === 2 && "What's your role?"}
              {currentStep === 3 && "Almost done!"}
            </h2>
            <p className="text-white/80 animate-fade-in">
              {currentStep === 1 && "Help us customize your experience"}
              {currentStep === 2 && "We'll personalize your dashboard"}
              {currentStep === 3 && "Just a few more details"}
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                {(() => {
                  const Icon = getStepIcon();
                  return <Icon className="w-8 h-8 text-primary" />;
                })()}
              </div>
              <h1 className="text-3xl font-bold mb-2 animate-fade-in">Welcome to Calibration Alerts</h1>
              <p className="text-muted-foreground animate-fade-in">Let's set up your account in just a few steps</p>
              
              {/* Progress */}
              <div className="mt-6 animate-fade-in">
                <div className="flex justify-between mb-2">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                        step <= currentStep
                          ? 'bg-primary text-primary-foreground scale-110'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step}
                    </div>
                  ))}
                </div>
                <Progress value={progress} className="w-full h-2" />
                <p className="text-sm text-muted-foreground mt-2">Step {currentStep} of {totalSteps}</p>
              </div>
            </div>
        
            {/* Form Content */}
            <div className="space-y-6">
              {/* Step 1: Company Information */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in" key="step1">
                  <div className="text-center lg:text-left mb-8">
                    <h3 className="text-2xl font-semibold mb-2">Company Information</h3>
                    <p className="text-muted-foreground">Tell us about your organization to get started</p>
                  </div>
              
                  <div className="space-y-6">
                    <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                      <Label htmlFor="companyName" className="text-base font-medium">Company Name</Label>
                      <Input
                        id="companyName"
                        placeholder="Enter your company name"
                        value={setupData.companyName}
                        onChange={(e) => updateData('companyName', e.target.value)}
                        className="mt-2 h-12 text-lg"
                      />
                    </div>
                    
                    <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                      <Label htmlFor="companySize" className="text-base font-medium">Company Size</Label>
                      <Select value={setupData.companySize} onValueChange={(value) => updateData('companySize', value)}>
                        <SelectTrigger className="mt-2 h-12 text-lg">
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
                    
                    <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                      <Label htmlFor="industry" className="text-base font-medium">Industry</Label>
                      <Select value={setupData.industry} onValueChange={(value) => updateData('industry', value)}>
                        <SelectTrigger className="mt-2 h-12 text-lg">
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
                <div className="space-y-6 animate-fade-in" key="step2">
                  <div className="text-center lg:text-left mb-8">
                    <h3 className="text-2xl font-semibold mb-2">Your Role</h3>
                    <p className="text-muted-foreground">What's your role in the company? This helps us personalize your experience.</p>
                  </div>
                  
                  <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <Label htmlFor="userRole" className="text-base font-medium">Role</Label>
                    <Select value={setupData.userRole} onValueChange={(value) => updateData('userRole', value)}>
                      <SelectTrigger className="mt-2 h-12 text-lg">
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
                <div className="space-y-6 animate-fade-in" key="step3">
                  <div className="text-center lg:text-left mb-8">
                    <h3 className="text-2xl font-semibold mb-2">Personal Information</h3>
                    <p className="text-muted-foreground">How should we address you? We're almost ready to get started!</p>
                  </div>
                  
                  <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <Label htmlFor="userName" className="text-base font-medium">Full Name</Label>
                    <Input
                      id="userName"
                      placeholder="Enter your full name"
                      value={setupData.userName}
                      onChange={(e) => updateData('userName', e.target.value)}
                      className="mt-2 h-12 text-lg"
                    />
                  </div>
                  
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <h4 className="font-semibold text-primary mb-2">🎉 You're all set!</h4>
                    <p className="text-sm text-muted-foreground">
                      Once you complete this step, you'll have access to your personalized dashboard with all the calibration management tools you need.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className="h-12 px-8 text-base hover-scale"
                >
                  Previous
                </Button>
                
                {currentStep < totalSteps ? (
                  <Button
                    onClick={handleNext}
                    disabled={!isStepValid()}
                    className="h-12 px-8 text-base hover-scale bg-primary hover:bg-primary/90"
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    disabled={!isStepValid()}
                    className="h-12 px-8 text-base hover-scale bg-primary hover:bg-primary/90"
                  >
                    🚀 Complete Setup
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}