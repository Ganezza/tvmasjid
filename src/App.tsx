import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";
import { SessionProvider } from "./components/SessionProvider";
// import "./App.css"; // Hapus import ini

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
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/login" element={<Login />} />
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