import React, { useState, useEffect, createContext, useContext, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useNavigate, useLocation } from "react-router-dom"; // Baris ini yang diperbaiki

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const isListenerSetup = useRef(false);

  useEffect(() => {
    console.log("SessionProvider: useEffect (mount/update)");

    if (isListenerSetup.current) {
      console.log("SessionProvider: Listener already set up. Skipping re-setup.");
      return;
    }

    isListenerSetup.current = true;
    console.log("SessionProvider: Setting up initial session and auth state listener.");

    const getInitialSession = async () => {
      console.log("SessionProvider: Fetching initial session...");
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("SessionProvider: Error fetching initial session:", error);
      }
      setSession(initialSession);
      setIsLoading(false);
      console.log("SessionProvider: Initial session fetched. Session:", initialSession);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("SessionProvider: Auth state change event:", event, "Session:", session);
      setSession(session);
      setIsLoading(false);
      if (event === 'SIGNED_OUT') {
        console.log("SessionProvider: User signed out. Clearing session.");
        setSession(null);
      }
    });

    return () => {
      console.log("SessionProvider: useEffect cleanup. Unsubscribing from auth state changes.");
      subscription.unsubscribe();
      isListenerSetup.current = false;
    };
  }, []);

  useEffect(() => {
    console.log("SessionProvider: Redirect effect triggered. isLoading:", isLoading, "session:", !!session, "pathname:", location.pathname);
    if (!isLoading) {
      const protectedRoutes = ["/admin"];
      const isProtectedRoute = protectedRoutes.includes(location.pathname);

      // --- START TEMPORARY BYPASS FOR DEVELOPMENT ---
      // If you want to bypass login for /admin, comment out the following 'if' block:
      if (isProtectedRoute && !session) {
        console.log("SessionProvider: Redirecting to /login (protected route, no session).");
        navigate("/login");
      } 
      // --- END TEMPORARY BYPASS FOR DEVELOPMENT ---
      
      // Keep this part to redirect authenticated users from login page
      if (session && location.pathname === "/login") {
        console.log("SessionProvider: Redirecting to / (session exists, on login page).");
        navigate("/");
      }
    }
  }, [session, isLoading, location.pathname, navigate]);

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};