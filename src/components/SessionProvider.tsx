import React, { useState, useEffect, createContext, useContext, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useNavigate, useLocation } from "react-router-dom";

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

  // Gunakan ref untuk memastikan listener hanya diatur sekali
  const isListenerSetup = useRef(false);

  useEffect(() => {
    if (isListenerSetup.current) {
      return; // Mencegah eksekusi ulang jika sudah diatur
    }

    isListenerSetup.current = true;

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsLoading(false);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false); // Pastikan status loading diperbarui
    });

    return () => {
      subscription.unsubscribe();
      isListenerSetup.current = false; // Reset ref saat komponen dilepas
    };
  }, []); // Array dependensi kosong untuk hanya berjalan sekali

  useEffect(() => {
    if (!isLoading) {
      const protectedRoutes = ["/admin"];
      const isProtectedRoute = protectedRoutes.includes(location.pathname);

      if (isProtectedRoute && !session) {
        navigate("/login");
      } else if (session && location.pathname === "/login") {
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