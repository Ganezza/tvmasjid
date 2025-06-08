import React from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase"; // Ensure this path is correct

const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
        <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Masuk ke Admin Panel</h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // You can add 'google', 'github', etc. here if needed
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "hsl(222.2 47.4% 11.2%)", // primary color
                  brandAccent: "hsl(217.2 91.2% 59.8%)", // accent color
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
          theme="dark" // Use dark theme to match your app's aesthetic
          redirectTo={window.location.origin} // Redirect to home after login
        />
      </div>
    </div>
  );
};

export default Login;