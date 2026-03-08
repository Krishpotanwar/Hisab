import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background px-6">
      <div className="text-center max-w-sm">
        <h1 className="mb-2 text-4xl font-bold">404</h1>
        <p className="mb-6 text-base text-muted-foreground break-words">Oops! We could not find that page.</p>
        <Button asChild>
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
