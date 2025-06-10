import React, { useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionProvider"; // Import useSession

const Login: React.FC = () => {
  const { session, isLoading } = useSession(); // Gunakan hook useSession
  const navigate = useNavigate();

  useEffect(() => {
    // Jika tidak sedang memuat dan sesi sudah ada, alihkan ke halaman utama atau admin
    if (!isLoading && session) {
      console.log("Login: Session exists, redirecting to /admin");
      navigate("/admin"); // Atau ke "/" jika itu halaman default setelah login
    }
  }, [session, isLoading, navigate]);

  // Tampilkan loading atau Auth component
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 text-white text-2xl">
        Memuat...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
        <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Masuk ke Admin Panel</h2>
        {/* Render Auth component hanya jika tidak ada sesi */}
        {!session && (
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "hsl(222.2 47.4% 11.2%)",
                    brandAccent: "hsl(217.2 91.2% 59.8%)",
                    inputBackground: "hsl(217.2 32.6% 17.5%)",
                    inputBorder: "hsl(217.2 32.6% 17.5%)",
                    inputPlaceholder: "hsl(215.4 16.3% 46.9%)",
                    inputText: "hsl(210 40% 98%)",
                    defaultButtonBackground: "hsl(222.2 47.4% 11.2%)",
                    defaultButtonBackgroundHover: "hsl(217.2 91.2% 59.8%)",
                    defaultButtonBorder: "hsl(222.2 47.4% 11.2%)",
                    defaultButtonText: "hsl(210 40% 98%)",
                    messageText: "hsl(210 40% 98%)",
                    messageBackground: "hsl(217.2 32.6% 17.5%)",
                  },
                },
              },
            }}
            theme="dark"
          />
        )}
      </div>
    </div>
  );
};

export default Login;