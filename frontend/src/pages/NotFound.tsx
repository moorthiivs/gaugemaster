import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useSEO({
    title: "404 - Page Not Found",
    description: "The page you are looking for does not exist.",
    noIndex: true,
  });

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-extrabold text-primary">404</h1>
        <h2 className="text-2xl font-bold">Oops! Page not found</h2>
        <p className="text-muted-foreground text-sm">
          The page you requested could not be found or has been moved.
        </p>
        <div>
          <Button asChild className="rounded-full font-semibold">
            <Link to="/">Return to Homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
