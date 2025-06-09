import React from "react";
import { Button } from "@/components/ui/button";

interface AudioPermissionOverlayProps {
  onGrantPermission: () => void;
}

const AudioPermissionOverlay: React.FC<AudioPermissionOverlayProps> = ({ onGrantPermission }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex flex-col items-center justify-center z-[100] text-white p-4 text-center">
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-yellow-300">
        Selamat Datang di Masjid Digital TV
      </h2>
      <p className="text-xl md:text-2xl lg:text-3xl mb-10 text-gray-300">
        Untuk pengalaman penuh, termasuk audio murottal dan tarhim,
        silakan klik tombol di bawah ini.
      </p>
      <Button
        onClick={onGrantPermission}
        className="bg-green-600 hover:bg-green-700 text-white text-2xl md:text-3xl lg:text-4xl px-8 py-4 rounded-lg shadow-lg animate-pulse"
      >
        Mulai Aplikasi
      </Button>
      <p className="text-sm text-gray-500 mt-12">
        (Klik di mana saja di layar juga akan mengaktifkan audio)
      </p>
    </div>
  );
};

export default AudioPermissionOverlay;