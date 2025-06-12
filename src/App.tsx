import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { SessionProvider } from "./components/SessionProvider";
import React from "react"; // Import React

// Menggunakan React.lazy untuk memuat komponen secara dinamis
const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));
const Login = React.lazy(() => import("./pages/Login"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/tvmasjid/">
        <SessionProvider>
          {/* Wrapper untuk skala global */}
          <div style={{ 
            transform: 'scale(0.75)', 
            transformOrigin: 'top left', 
            width: 'calc(100% / 0.75)', 
            height: 'calc(100% / 0.75)' 
          }}>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* Menggunakan Suspense untuk lazy-loaded components */}
              <Route 
                path="/admin" 
                element={
                  <React.Suspense fallback={<div>Memuat Admin Panel...</div>}>
                    <AdminPanel />
                  </React.Suspense>
                } 
              />
              <Route 
                path="/login" 
                element={
                  <React.Suspense fallback={<div>Memuat Halaman Login...</div>}>
                    <Login />
                  </React.Suspense>
                } 
              />
              {/* TAMBAHKAN SEMUA RUTE KUSTOM DI ATAS RUTE CATCH-ALL "*" */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </SessionProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;