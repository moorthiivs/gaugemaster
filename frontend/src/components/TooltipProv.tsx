import { Tooltip, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { TooltipArrow, TooltipPortal, TooltipTrigger } from "@radix-ui/react-tooltip";

function TooltipProv({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
    return (

        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    {children}
                    <TooltipPortal>
                        <TooltipContent className="TooltipContent" sideOffset={-1}>
                            {content}
                            <TooltipArrow className="TooltipArrow"  />
                        </TooltipContent>
                    </TooltipPortal>
                </TooltipTrigger>
            </Tooltip>

        </TooltipProvider>

    )
}

export default TooltipProv