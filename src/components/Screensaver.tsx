import React from "react";

const Screensaver: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-[100] text-white p-4">
      <div className="text-center animate-pulse">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-green-400 mb-4 text-outline-gold">
          Masjid Digital TV
        </h1>
        <p className="text-2xl md:text-3xl lg:text-4xl text-gray-300">
          Layar akan kembali aktif saat ada aktivitas.
        </p>
        <p className="text-xl md:text-2xl lg:text-3xl text-gray-400 mt-4">
          Sentuh layar atau tekan tombol apa saja untuk melanjutkan.
        </p>
      </div>
    </div>
  );
};

export default Screensaver;