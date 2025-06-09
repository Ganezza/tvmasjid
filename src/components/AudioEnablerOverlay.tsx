import React from "react";
import { Button } from "@/components/ui/button";

interface AudioEnablerOverlayProps {
  onEnable: () => void;
}

const AudioEnablerOverlay: React.FC<AudioEnablerOverlayProps> = ({ onEnable }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-[100]">
      <h2 className="text-white text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-center">
        Aktifkan Suara Masjid TV
      </h2>
      <p className="text-gray-300 text-lg md:text-xl text-center mb-10 max-w-md px-4">
        Browser Anda mungkin memblokir pemutaran audio otomatis. Klik tombol di bawah untuk mengaktifkan suara.
      </p>
      <Button
        onClick={onEnable}
        className="bg-green-600 hover:bg-green-700 text-white text-xl md:text-2xl px-8 py-4 rounded-lg shadow-lg"
      >
        Aktifkan Suara
      </Button>
    </div>
  );
};

export default AudioEnablerOverlay;