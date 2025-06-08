import React from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase"; // Pastikan path ini benar

const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
        <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Masuk ke Admin Panel</h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Anda bisa menambahkan 'google', 'github', dll. di sini jika diperlukan
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "hsl(222.2 47.4% 11.2%)", // warna primer
                  brandAccent: "hsl(217.2 91.2% 59.8%)", // warna aksen
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
          theme="dark" // Gunakan tema gelap agar sesuai dengan estetika aplikasi Anda
          redirectTo={window.location.origin} // Redirect ke halaman utama setelah login
        />
      </div>
    </div>
  );
};

export default Login;